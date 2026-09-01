const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const { startServer } = require("../engine/server");
const { loadStore } = require("../engine/data_store");

function tempPath(name) {
  return path.join(os.tmpdir(), `${name}_${Date.now()}_${Math.random().toString(36).slice(2)}.jsonl`);
}

async function withServer(options, fn) {
  const queryLogPath = tempPath("security_query");
  const feedbackLogPath = tempPath("security_feedback");
  const server = startServer({ port: 0, host: "127.0.0.1", deps: {}, queryLogPath, feedbackLogPath, ...options });
  await new Promise((resolve) => server.once("listening", resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    await fn({ server, base, queryLogPath, feedbackLogPath });
  } finally {
    await new Promise((resolve) => server.close(resolve));
    fs.rmSync(queryLogPath, { force: true });
    fs.rmSync(feedbackLogPath, { force: true });
  }
}

test("POST APIs reject browser-simple cross-origin bodies and non-object JSON", async () => {
  await withServer({}, async ({ base }) => {
    const payload = JSON.stringify({ question: "minimum replicates required at each QC concentration level", allow_fallback: false });
    const textPlain = await fetch(`${base}/api/ask`, {
      method: "POST",
      headers: { "Content-Type": "text/plain", Origin: "https://attacker.example" },
      body: payload
    });
    assert.equal(textPlain.status, 415);

    const crossOriginJson = await fetch(`${base}/api/ask`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: "https://attacker.example" },
      body: payload
    });
    assert.equal(crossOriginJson.status, 403);

    const reboundHost = await fetch(`${base}/api/ask`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Host: "attacker.example", Origin: "http://attacker.example" },
      body: payload
    });
    assert.equal(reboundHost.status, 403, "loopback mode must reject DNS-rebinding Host headers");

    const sameOrigin = await fetch(`${base}/api/ask`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: base },
      body: payload
    });
    assert.equal(sameOrigin.status, 200);

    const nullBody = await fetch(`${base}/api/ask`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "null"
    });
    assert.equal(nullBody.status, 400);
  });
});

test("GUIDELINE_AUTH_TOKEN protects API, UI, and PDFs with Bearer or browser Basic auth", async () => {
  await withServer({ authToken: "security-secret" }, async ({ base }) => {
    assert.equal((await fetch(`${base}/`)).status, 401);
    assert.equal((await fetch(`${base}/pdf/ich_m10`)).status, 401);
    assert.equal((await fetch(`${base}/api/health`)).status, 401);

    const bearer = { Authorization: "Bearer security-secret" };
    assert.equal((await fetch(`${base}/api/health`, { headers: bearer })).status, 200);
    assert.equal((await fetch(`${base}/pdf/ich_m10`, { headers: bearer })).status, 200);

    const basic = { Authorization: `Basic ${Buffer.from("guideline:security-secret").toString("base64")}` };
    assert.equal((await fetch(`${base}/`, { headers: basic })).status, 200);
    assert.equal((await fetch(`${base}/api/health`, { headers: basic })).status, 200);
    assert.equal((await fetch(`${base}/pdf/ich_m10`, { headers: basic })).status, 200);
  });
});

test("logging opt-out writes no interaction file and disables feedback persistence", async () => {
  await withServer({ loggingEnabled: false }, async ({ base, queryLogPath, feedbackLogPath }) => {
    const ask = await fetch(`${base}/api/ask`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question: "minimum replicates required at each QC concentration level", allow_fallback: false })
    });
    assert.equal(ask.status, 200);
    assert.equal(fs.existsSync(queryLogPath), false);

    const feedback = await fetch(`${base}/api/feedback`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question: "q", verdict: "correct" })
    });
    assert.equal(feedback.status, 503);
    assert.equal(fs.existsSync(feedbackLogPath), false);

    const health = await (await fetch(`${base}/api/health`)).json();
    assert.equal(health.logging_enabled, false);
  });
});

test("grounded-generation deadline aborts provider requests and never exceeds two active tasks", async () => {
  const { records } = loadStore();
  const candidate = records.find((record) => record.type === "quantitative_criterion" && record.parameter === "replicates");
  let active = 0;
  let maxActive = 0;
  let generationCalls = 0;
  let aborts = 0;
  const generatorClient = {
    complete: ({ signal }) => new Promise((resolve, reject) => {
      generationCalls++;
      active++;
      maxActive = Math.max(maxActive, active);
      const timer = setTimeout(() => {
        active--;
        resolve({ answered: true, units: [{ text: "late", source_index: 0 }] });
      }, 200);
      signal.addEventListener("abort", () => {
        aborts++;
        clearTimeout(timer);
        active--;
        reject(signal.reason);
      }, { once: true });
    })
  };
  const verifierClient = { complete: async () => ({ verdicts: [] }) };
  const store = { search: async () => [{ record: candidate, score: 1 }] };

  await withServer({
    deps: { generatorClient, verifierClient, store, generatorProvider: "mock-a", verifierProvider: "mock-b", fallbackMode: "grounded_generation" },
    fallbackTimeoutMs: 25
  }, async ({ base }) => {
    const request = () => fetch(`${base}/api/ask`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question: "zzzz grounded generation deadline probe", allow_fallback: true })
    });
    const responses = await Promise.all([request(), request(), request(), request()]);
    assert.deepEqual(responses.map((response) => response.status), [504, 504, 504, 504]);
    assert.equal(maxActive, 2);
    assert.ok(generationCalls >= 2 && generationCalls <= 4);
    assert.equal(aborts, generationCalls, "every provider request that started must receive the deadline abort");
  });
});

test("a provider that ignores AbortSignal does not cause early semaphore release", async () => {
  const { records } = loadStore();
  const candidate = records.find((record) => record.type === "quantitative_criterion" && record.parameter === "replicates");
  let active = 0;
  let maxActive = 0;
  let generationCalls = 0;
  let releaseTasks;
  const taskGate = new Promise((resolve) => { releaseTasks = resolve; });
  const generatorClient = {
    complete: async () => {
      generationCalls++;
      active++;
      maxActive = Math.max(maxActive, active);
      await taskGate;
      active--;
      return { answered: true, units: [{ text: "late", source_index: 0 }] };
    }
  };
  const verifierClient = { complete: async () => ({ verdicts: [] }) };
  const store = { search: async () => [{ record: candidate, score: 1 }] };

  await withServer({
    deps: { generatorClient, verifierClient, store, generatorProvider: "mock-a", verifierProvider: "mock-b", fallbackMode: "grounded_generation" },
    fallbackTimeoutMs: 20
  }, async ({ base }) => {
    const request = () => fetch(`${base}/api/ask`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question: "zzzz ignored abort probe", allow_fallback: true })
    });
    try {
      const first = await Promise.all([request(), request()]);
      assert.deepEqual(first.map((response) => response.status), [504, 504]);
      const third = await request();
      assert.equal(third.status, 504);
      assert.equal(maxActive, 2);
      assert.equal(generationCalls, 2, "timed-out underlying tasks must retain their slots");
    } finally {
      releaseTasks();
      await new Promise((resolve) => setImmediate(resolve));
    }
  });
});
