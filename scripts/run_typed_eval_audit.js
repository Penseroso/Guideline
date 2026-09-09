const fs = require("node:fs");
const path = require("node:path");

require("dotenv").config({ path: path.resolve(__dirname, "..", ".env"), quiet: true });

const { loadStore } = require("../engine/data_store");
const { setUpAnswering } = require("../engine/cli");
const { startServer } = require("../engine/server");
const { computeSemanticStateFingerprint } = require("./semantic_promotion_lifecycle");
const { runQuestions, saveResults } = require("./run_answer_suitability_audit");

const ROOT = path.resolve(__dirname, "..");
const CORPUS_PATH = path.join(ROOT, "data", "eval", "typed_questions.json");
const OUTPUT_PATH = process.env.GUIDELINE_TYPED_EVAL_OUTPUT
  ? path.resolve(process.env.GUIDELINE_TYPED_EVAL_OUTPUT)
  : path.join(ROOT, "logs", "runtime", "typed_eval_50plus_raw_2026-09-09.json");
const REQUEST_TIMEOUT_MS = 120000;

function questionsFromCorpus() {
  const corpus = JSON.parse(fs.readFileSync(CORPUS_PATH, "utf8"));
  return corpus.questions;
}

function loadResults(outputPath = OUTPUT_PATH, { fresh = process.env.GUIDELINE_TYPED_EVAL_FRESH === "true" } = {}) {
  if (fresh) return [];
  if (!fs.existsSync(outputPath)) return [];
  return JSON.parse(fs.readFileSync(outputPath, "utf8"));
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
  const questions = questionsFromCorpus();
  const rerunIds = new Set(String(process.env.GUIDELINE_TYPED_EVAL_RERUN_IDS || "")
    .split(",").map((id) => id.trim()).filter(Boolean));
  const results = loadResults().filter((result) =>
    !rerunIds.has(result.id) && !result.error && result.envelope && Array.isArray(result.envelope.claims)
  );
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
      persist: (r) => saveResults(r, OUTPUT_PATH),
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
              generation_preference: process.env.GUIDELINE_TYPED_EVAL_GENERATION_PREFERENCE || "auto"
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
        console.log(`${result.error ? "ERROR" : "DONE"} [${item.type}] ${item.id} ${envelopeLabel} ${result.elapsed_ms}ms`);
      }
    });
  } finally {
    await close(server);
  }

  console.log(`Saved ${results.length}/${questions.length} responses to ${OUTPUT_PATH}`);
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error.stack || error.message || error);
    process.exitCode = 1;
  });
}

module.exports = { loadResults, main, questionsFromCorpus };
