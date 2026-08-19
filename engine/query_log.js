const fs = require("fs");
const path = require("path");

/**
 * M2 (product_roadmap.md §3): "Log every refusal, and every answer that
 * came from the grounded-RAG fallback... that log IS the coverage-
 * expansion backlog." Appends one JSON line per real question asked
 * through engine/cli.js, including the actual answer text — a log of
 * questions alone can't be triaged later without re-running each one.
 */
const DEFAULT_LOG_PATH = path.resolve(__dirname, "..", "logs", "m2_queries.jsonl");

function logInteraction(question, result, logPath = DEFAULT_LOG_PATH) {
  const entry = {
    timestamp: new Date().toISOString(),
    question,
    path: result.path ?? null,
    answered: result.answered,
    review_status: result.review_status ?? null,
    answer_text: result.text
  };
  fs.mkdirSync(path.dirname(logPath), { recursive: true });
  fs.appendFileSync(logPath, JSON.stringify(entry) + "\n", "utf8");
}

module.exports = { logInteraction, DEFAULT_LOG_PATH };
