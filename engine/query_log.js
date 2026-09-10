const fs = require("fs");
const path = require("path");

/**
 * product_roadmap.md §3: "Log every refusal, and every answer that came
 * from the grounded-RAG fallback... that log IS the coverage-expansion
 * backlog." Appends one JSON line per real question asked through
 * engine/cli.js (or engine/server.js), including the actual answer text —
 * a log of questions alone can't be triaged later without re-running each
 * one.
 *
 * `interaction_id`/`mode`/`latency_ms`/`cited_source_unit_ids`/`source`
 * were added additively alongside the original fields, so archived legacy
 * lines (which lack them) stay readable by any reader that treats missing
 * fields as absent, not as an error. `readInteractions()` replays the log
 * (scripts/replay_query_log.js uses it to actually replay it).
 */
const DEFAULT_LOG_PATH = path.resolve(__dirname, "..", "logs", "runtime", "queries.jsonl");

function logInteraction(question, result, logPath = process.env.GUIDELINE_QUERY_LOG_PATH || DEFAULT_LOG_PATH) {
  if (process.env.GUIDELINE_LOG_ENABLED === "false") return null;
  const entry = {
    timestamp: new Date().toISOString(),
    question,
    route: result.route ?? null,
    answered: result.answered,
    review_status: result.review_status ?? null,
    answer_text: result.text,
    interaction_id: result.interaction_id ?? null,
    mode: result.mode ?? null,
    latency_ms: result.timing_ms ?? null,
    telemetry: result.telemetry ?? null,
    cited_source_unit_ids: (result.claims || []).map((c) => c.source_unit_id).filter(Boolean),
    source: result.source ?? "cli"
  };
  fs.mkdirSync(path.dirname(logPath), { recursive: true });
  fs.appendFileSync(logPath, JSON.stringify(entry) + "\n", "utf8");
  return entry;
}

function readInteractions(logPath = process.env.GUIDELINE_QUERY_LOG_PATH || DEFAULT_LOG_PATH) {
  if (!fs.existsSync(logPath)) return [];
  return fs.readFileSync(logPath, "utf8")
    .trim()
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

module.exports = { logInteraction, readInteractions, DEFAULT_LOG_PATH };
