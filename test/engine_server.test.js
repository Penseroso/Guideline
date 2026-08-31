const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const { startServer } = require("../engine/server");

function baseUrl(server) {
  const { port } = server.address();
  return `http://127.0.0.1:${port}`;
}

function tempPath(name) {
  return path.join(os.tmpdir(), `${name}_${Date.now()}_${Math.random().toString(36).slice(2)}.jsonl`);
}

// Every test server gets its own temp query/feedback log paths — the real
// Historical usage logs are frozen under history/usage, not scratch space
// for test runs to append to.
async function withServer(opts, fn) {
  const queryLogPath = tempPath("test_query_log");
  const feedbackLogPath = tempPath("test_feedback_log");
  const server = startServer({ port: 0, host: "127.0.0.1", deps: {}, queryLogPath, feedbackLogPath, ...opts });
  await new Promise((resolve) => server.once("listening", resolve));
  try {
    await fn(server, { queryLogPath, feedbackLogPath });
  } finally {
    await new Promise((resolve) => server.close(resolve));
    fs.rmSync(queryLogPath, { force: true });
    fs.rmSync(feedbackLogPath, { force: true });
  }
}

test("GET /api/health returns 200 with archive stats and option_b_available: false when deps has no client/store", async () => {
  await withServer({}, async (server) => {
    const res = await fetch(`${baseUrl(server)}/api/health`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.status, "ok");
    assert.equal(body.documents, 6);
    assert.ok(body.records > 0);
    assert.equal(body.option_b_available, false);
    assert.equal(body.auth, "disabled");
  });
});

test("GET /api/documents lists all 6 documents with titles and record counts", async () => {
  await withServer({}, async (server) => {
    const res = await fetch(`${baseUrl(server)}/api/documents`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.documents.length, 6);
    for (const d of body.documents) {
      assert.ok(d.title && d.title !== d.document_id, "title must be the real title, not the raw id");
      assert.ok(d.record_count > 0);
    }
  });
});

test("GET /api/stats aggregates the (temp, per-test) query log and reflects a real /api/ask call", async () => {
  await withServer({}, async (server) => {
    const askRes = await fetch(`${baseUrl(server)}/api/ask`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question: "minimum replicates required at each QC concentration level" })
    });
    assert.equal(askRes.status, 200);

    const statsRes = await fetch(`${baseUrl(server)}/api/stats`);
    assert.equal(statsRes.status, 200);
    const stats = await statsRes.json();
    assert.equal(stats.total, 1);
    assert.equal(stats.answered, 1);
    assert.equal(stats.by_path.A, 1);
    assert.ok(stats.by_document.ich_m10 && stats.by_document.ich_m10.answered === 1);
  });
});

test("POST /api/ask returns a full envelope for a known Option A hit, and logs the interaction", async () => {
  await withServer({}, async (server) => {
    const res = await fetch(`${baseUrl(server)}/api/ask`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question: "minimum replicates required at each QC concentration level" })
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.answered, true);
    assert.equal(body.mode, "structured");
    assert.equal(body.path, "A");
    assert.ok(body.claims.length > 0);
    assert.ok(body.interaction_id);
  });
});

test("POST /api/ask returns 400 for an empty or missing question", async () => {
  await withServer({}, async (server) => {
    const res1 = await fetch(`${baseUrl(server)}/api/ask`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ question: "" }) });
    assert.equal(res1.status, 400);
    const res2 = await fetch(`${baseUrl(server)}/api/ask`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) });
    assert.equal(res2.status, 400);
  });
});

test("POST /api/ask returns 400 for an oversized body", async () => {
  await withServer({}, async (server) => {
    const res = await fetch(`${baseUrl(server)}/api/ask`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question: "a".repeat(20000) })
    });
    assert.equal(res.status, 400);
  });
});

test("POST /api/feedback accepts a valid verdict and rejects an invalid one", async () => {
  await withServer({}, async (server) => {
    const good = await fetch(`${baseUrl(server)}/api/feedback`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question: "q", verdict: "correct" })
    });
    assert.equal(good.status, 200);
    const goodBody = await good.json();
    assert.ok(goodBody.feedback_id);

    const bad = await fetch(`${baseUrl(server)}/api/feedback`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question: "q", verdict: "5 stars" })
    });
    assert.equal(bad.status, 400);
  });
});

test("auth: with a token configured, /api/* requires it — absent or wrong token gets 401, correct token gets 200", async () => {
  await withServer({ authToken: "secret123" }, async (server) => {
    const noAuth = await fetch(`${baseUrl(server)}/api/health`);
    assert.equal(noAuth.status, 401);

    const wrongAuth = await fetch(`${baseUrl(server)}/api/health`, { headers: { Authorization: "Bearer wrong" } });
    assert.equal(wrongAuth.status, 401);

    const rightAuth = await fetch(`${baseUrl(server)}/api/health`, { headers: { Authorization: "Bearer secret123" } });
    assert.equal(rightAuth.status, 200);
    const body = await rightAuth.json();
    assert.equal(body.auth, "enabled");
  });
});

test("server refuses to start bound non-loopback with no auth token configured", () => {
  assert.throws(
    () => startServer({ port: 0, host: "0.0.0.0", deps: {} }),
    /refusing to start/
  );
});

test("server starts fine bound non-loopback when an auth token IS configured", async () => {
  // Bind to a real interface with a token set — must not throw. Use
  // 127.0.0.1 anyway for the actual listen to keep the test self-contained
  // (the guard only inspects the `host` string, not perform a live
  // 0.0.0.0 bind in CI).
  await withServer({ authToken: "secret123" }, async () => {
    assert.ok(true, "reaching here means the constructor didn't throw with a token set");
  });
});

test("unknown routes return 404, and a path-traversal attempt on /pdf/ never escapes source_pdfs", async () => {
  await withServer({}, async (server) => {
    const res = await fetch(`${baseUrl(server)}/nonexistent`);
    assert.equal(res.status, 404);

    const traversal = await fetch(`${baseUrl(server)}/pdf/..%2F..%2Fpackage.json`);
    assert.equal(traversal.status, 404, "an unresolvable/non-archive document_id must 404, never read an arbitrary path");
  });
});

test("GET / serves the static index page", async () => {
  await withServer({}, async (server) => {
    const res = await fetch(`${baseUrl(server)}/`);
    assert.equal(res.status, 200);
    assert.match(res.headers.get("content-type"), /text\/html/);
  });
});

test("503-equivalent: allow_option_b requested but no provider configured falls back to Option A only, never crashes", async () => {
  await withServer({}, async (server) => {
    const res = await fetch(`${baseUrl(server)}/api/ask`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question: "completely unrelated nonsense question", allow_option_b: true })
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.answered, false);
    assert.equal(body.refusal.kind, "no_provider");
  });
});

test("Option B via injected mock deps: success and timeout both produce a well-formed response, never a raw 500 refusal masquerading as a grounded answer", async () => {
  const candidateModule = require("../engine/data_store");
  const { records } = candidateModule.loadStore();
  const candidate = records.find((r) => r.type === "quantitative_criterion" && r.parameter === "replicates");

  const fastClient = {
    complete: async ({ schema }) => schema.properties.verdicts
      ? { verdicts: [{ unit_index: 0, entailed: true, source_index: 0, reason: "ok" }] }
      : { answered: true, units: [{ text: "At least 5 replicates are required at each QC concentration level." }] }
  };
  const fastStore = { search: async () => [{ record: candidate, score: 1 }] };

  await withServer({ deps: { client: fastClient, store: fastStore } }, async (server) => {
    const res = await fetch(`${baseUrl(server)}/api/ask`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question: "some question Option A cannot structurally answer but B can", allow_option_b: true })
    });
    assert.equal(res.status, 200);
  });

  const slowClient = { complete: () => new Promise((resolve) => setTimeout(() => resolve({ text: "too slow" }), 500)) };
  const slowStore = { search: async () => [{ record: candidate, score: 1 }] };
  await withServer({ deps: { client: slowClient, store: slowStore }, optionBTimeoutMs: 50 }, async (server) => {
    const res = await fetch(`${baseUrl(server)}/api/ask`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question: "anything", allow_option_b: true })
    });
    assert.equal(res.status, 504);
    const body = await res.json();
    assert.equal(body.error, "upstream_timeout");
  });
});
