const fs = require("node:fs");
const path = require("node:path");

require("dotenv").config({ path: path.resolve(__dirname, "..", ".env"), quiet: true });

const { loadStore } = require("../engine/data_store");
const { setUpAnswering } = require("../engine/cli");
const { startServer } = require("../engine/server");
const { computeSemanticStateFingerprint } = require("./semantic_promotion_lifecycle");

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

function loadResults(outputPath = OUTPUT_PATH, { fresh = process.env.GUIDELINE_AUDIT_FRESH === "true" } = {}) {
  if (fresh) return [];
  if (!fs.existsSync(outputPath)) return [];
  return JSON.parse(fs.readFileSync(outputPath, "utf8"));
}

function saveResults(results, outputPath = OUTPUT_PATH) {
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  const temporaryPath = `${outputPath}.tmp`;
  fs.writeFileSync(temporaryPath, `${JSON.stringify(results, null, 2)}\n`, "utf8");
  fs.renameSync(temporaryPath, outputPath);
}

async function runQuestions(questions, {
  results = [],
  execute,
  persist = saveResults,
  onResult = () => {}
} = {}) {
  const completed = new Set(results.map((result) => result.id));
  for (const item of questions) {
    if (completed.has(item.id)) {
      onResult({ item, skipped: true });
      continue;
    }
    const result = await execute(item);
    results.push(result);
    persist(results);
    completed.add(item.id);
    onResult({ item, result, skipped: false });
  }
  return results;
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
  const rerunIds = new Set(String(process.env.GUIDELINE_AUDIT_RERUN_IDS || "")
    .split(",").map((id) => id.trim()).filter(Boolean));
  const results = loadResults().filter((result) =>
    !rerunIds.has(result.id) && !result.error && result.envelope && Array.isArray(result.envelope.claims)
  );
  // Stamped on every new entry so a promotion script can refuse to reuse an
  // audit captured against a different data/derived/ state (see
  // scripts/semantic_promotion_lifecycle.js's assertLiveAuditRegression) — a
  // resumed/mixed run would otherwise silently combine entries from two
  // different overlay states.
  const semanticStateFingerprint = computeSemanticStateFingerprint();
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
    await runQuestions(questions, {
      results,
      execute: async (item) => {
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
        return {
          ...item,
          elapsed_ms: Date.now() - startedAt,
          envelope: envelope || null,
          error,
          semantic_state_fingerprint: semanticStateFingerprint
        };
      },
      onResult: ({ item, result, skipped }) => {
        if (skipped) {
          console.log(`SKIP ${item.id}`);
          return;
        }
        const envelopeLabel = result.envelope && Array.isArray(result.envelope.claims)
          ? `${result.envelope.route}/${result.envelope.mode} claims=${result.envelope.claims.length}`
          : "no-valid-envelope";
        console.log(`${result.error ? "ERROR" : "DONE"} ${item.id} ${envelopeLabel} ${result.elapsed_ms}ms`);
      }
    });
  } finally {
    await close(server);
  }

  console.log(`Saved ${results.length}/50 responses to ${OUTPUT_PATH}`);
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error.stack || error.message || error);
    process.exitCode = 1;
  });
}

module.exports = {
  loadResults,
  main,
  questionsFromDesign,
  runQuestions,
  saveResults
};
