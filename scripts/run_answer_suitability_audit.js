const fs = require("node:fs");
const path = require("node:path");

require("dotenv").config({ path: path.resolve(__dirname, "..", ".env"), quiet: true });

const { loadStore } = require("../engine/data_store");
const { setUpAnswering } = require("../engine/cli");
const { startServer } = require("../engine/server");

const DESIGN_PATH = path.resolve(__dirname, "..", "docs", "answer_suitability_evaluation.md");
const OUTPUT_PATH = process.env.GUIDELINE_AUDIT_OUTPUT
  ? path.resolve(process.env.GUIDELINE_AUDIT_OUTPUT)
  : path.resolve(__dirname, "..", "logs", "runtime", "answer_suitability_50_raw_2026-09-02.json");
const REQUEST_TIMEOUT_MS = 120000;

function questionsFromDesign() {
  const text = fs.readFileSync(DESIGN_PATH, "utf8");
  const questions = [];
  for (const line of text.split(/\r?\n/)) {
    const match = line.match(/^\| (Q\d{2}) \| ([A-Z0-9]+) \| (.*?) \|/);
    if (match) questions.push({ id: match[1], depth: match[2], question: match[3] });
  }
  if (questions.length !== 50) throw new Error(`Expected 50 questions, found ${questions.length}`);
  return questions;
}

function loadResults() {
  if (process.env.GUIDELINE_AUDIT_FRESH === "true") return [];
  if (!fs.existsSync(OUTPUT_PATH)) return [];
  return JSON.parse(fs.readFileSync(OUTPUT_PATH, "utf8"));
}

function saveResults(results) {
  fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
  fs.writeFileSync(OUTPUT_PATH, `${JSON.stringify(results, null, 2)}\n`, "utf8");
}

async function listen(server) {
  if (server.listening) return;
  await new Promise((resolve, reject) => {
    server.once("listening", resolve);
    server.once("error", reject);
  });
}

async function close(server) {
  if (!server.listening) return;
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
}

async function main() {
  let questions = questionsFromDesign();
  const requestedIds = new Set(String(process.env.GUIDELINE_AUDIT_IDS || "")
    .split(",").map((id) => id.trim()).filter(Boolean));
  if (requestedIds.size > 0) questions = questions.filter((item) => requestedIds.has(item.id));
  const results = loadResults().filter((result) => !result.error && result.envelope && Array.isArray(result.envelope.claims));
  const completed = new Set(results.map((result) => result.id));
  const { records } = loadStore();
  const deps = setUpAnswering(records);
  const server = startServer({
    port: 0,
    host: "127.0.0.1",
    deps,
    fallbackTimeoutMs: REQUEST_TIMEOUT_MS,
    loggingEnabled: false
  });
  await listen(server);
  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  try {
    const health = await (await fetch(`${baseUrl}/api/health`)).json();
    console.log(`[server] ${health.generator_provider || "local"}/${health.generator_model || "excerpts"} -> ${health.verifier_provider || "local"}/${health.verifier_model || "none"}`);
    for (const item of questions) {
      if (completed.has(item.id)) {
        console.log(`SKIP ${item.id}`);
        continue;
      }
      const startedAt = Date.now();
      let envelope;
      let error = null;
      try {
        const response = await fetch(`${baseUrl}/api/ask`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            question: item.question,
            response_language: "ko",
            generation_preference: process.env.GUIDELINE_AUDIT_GENERATION_PREFERENCE || "auto"
          }),
          signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
        });
        envelope = await response.json();
        if (!response.ok) throw new Error(`HTTP ${response.status}: ${JSON.stringify(envelope)}`);
      } catch (caught) {
        error = caught.stack || caught.message || String(caught);
      }
      const elapsed_ms = Date.now() - startedAt;
      results.push({ ...item, elapsed_ms, envelope: envelope || null, error });
      saveResults(results);
      const envelopeLabel = envelope && Array.isArray(envelope.claims)
        ? `${envelope.route}/${envelope.mode} claims=${envelope.claims.length}`
        : "no-valid-envelope";
      console.log(`${error ? "ERROR" : "DONE"} ${item.id} ${envelopeLabel} ${elapsed_ms}ms`);
    }
  } finally {
    await close(server);
  }

  console.log(`Saved ${results.length}/50 responses to ${OUTPUT_PATH}`);
}

main().catch((error) => {
  console.error(error.stack || error.message || error);
  process.exitCode = 1;
});
