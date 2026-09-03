/**
 * engine/semantic_shadow_log.js
 * Appends one JSON line per /api/ask request comparing the existing
 * router's plan against the derived-semantic-layer plan
 * (engine/semantic_shadow.js), per docs/derived_semantic_layer.md §10
 * Stage B. Same append-only JSONL shape as engine/query_log.js, kept as a
 * separate file/log so a stage-B-only reader never has to filter out
 * ordinary interaction log lines (or vice versa).
 */
const fs = require("fs");
const path = require("path");

const DEFAULT_LOG_PATH = path.resolve(__dirname, "..", "logs", "runtime", "semantic_shadow.jsonl");

function logShadowComparison(comparison, logPath = process.env.GUIDELINE_SEMANTIC_SHADOW_LOG_PATH || DEFAULT_LOG_PATH) {
  const entry = { timestamp: new Date().toISOString(), ...comparison };
  fs.mkdirSync(path.dirname(logPath), { recursive: true });
  fs.appendFileSync(logPath, JSON.stringify(entry) + "\n", "utf8");
  return entry;
}

function readShadowComparisons(logPath = process.env.GUIDELINE_SEMANTIC_SHADOW_LOG_PATH || DEFAULT_LOG_PATH) {
  if (!fs.existsSync(logPath)) return [];
  return fs.readFileSync(logPath, "utf8")
    .trim()
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

module.exports = { logShadowComparison, readShadowComparisons, DEFAULT_LOG_PATH };
