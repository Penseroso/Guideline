const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const { logInteraction, readInteractions } = require("../engine/query_log");
const LEGACY_LOG_FIXTURE = path.resolve(__dirname, "fixtures", "query_log_legacy.jsonl");

function tempLogPath() {
  return path.join(os.tmpdir(), `m2_queries_test_${Date.now()}_${Math.random().toString(36).slice(2)}.jsonl`);
}

test("logInteraction appends one JSON line with the question, route, and full answer text", () => {
  const logPath = tempLogPath();
  try {
    logInteraction("minimum replicates required", { route: "structured", answered: true, review_status: "reviewed", text: "replicates: at least 5" }, logPath);
    const lines = fs.readFileSync(logPath, "utf8").trim().split("\n");
    assert.equal(lines.length, 1);
    const entry = JSON.parse(lines[0]);
    assert.equal(entry.question, "minimum replicates required");
    assert.equal(entry.route, "structured");
    assert.equal(entry.answered, true);
    assert.equal(entry.review_status, "reviewed");
    assert.equal(entry.answer_text, "replicates: at least 5");
    assert.ok(entry.timestamp, "must record when the question was asked");
  } finally {
    fs.rmSync(logPath, { force: true });
  }
});

test("logInteraction appends across multiple calls rather than overwriting", () => {
  const logPath = tempLogPath();
  try {
    logInteraction("q1", { route: "structured", answered: true, review_status: "reviewed", text: "a1" }, logPath);
    logInteraction("q2", { route: "refusal", answered: false, review_status: null, text: "Not found in the current archive." }, logPath);
    const lines = fs.readFileSync(logPath, "utf8").trim().split("\n");
    assert.equal(lines.length, 2);
    assert.equal(JSON.parse(lines[0]).question, "q1");
    assert.equal(JSON.parse(lines[1]).question, "q2");
    assert.equal(JSON.parse(lines[1]).answered, false, "a refusal must still be logged, not skipped");
  } finally {
    fs.rmSync(logPath, { force: true });
  }
});

test("logInteraction creates the log directory if it doesn't exist yet", () => {
  const dir = path.join(os.tmpdir(), `m2_log_dir_test_${Date.now()}`);
  const logPath = path.join(dir, "nested", "m2_queries.jsonl");
  try {
    logInteraction("q", { route: "source_excerpts", answered: true, review_status: "reviewed", text: "a" }, logPath);
    assert.ok(fs.existsSync(logPath));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

// M5 Phase 5: additive fields (interaction_id/mode/latency_ms/
// cited_source_unit_ids/source) — must not require a caller to supply
// them, and must default sensibly (source: "cli") so existing cli.js call
// sites (which never set `source`) keep logging as before.
test("logInteraction records the new additive fields when present, and defaults source to 'cli'", () => {
  const logPath = tempLogPath();
  try {
    logInteraction("q", {
      route: "structured",
      answered: true,
      review_status: "reviewed",
      text: "answer",
      interaction_id: "int_1",
      mode: "structured",
      timing_ms: 42,
      claims: [{ source_unit_id: "su_1" }, { source_unit_id: null }, { source_unit_id: "su_2" }]
    }, logPath);
    const entry = JSON.parse(fs.readFileSync(logPath, "utf8").trim());
    assert.equal(entry.interaction_id, "int_1");
    assert.equal(entry.mode, "structured");
    assert.equal(entry.latency_ms, 42);
    assert.deepEqual(entry.cited_source_unit_ids, ["su_1", "su_2"]);
    assert.equal(entry.source, "cli");
  } finally {
    fs.rmSync(logPath, { force: true });
  }
});

test("readInteractions returns [] for a log file that doesn't exist yet, and parses real lines otherwise", () => {
  const logPath = tempLogPath();
  assert.deepEqual(readInteractions(logPath), []);
  try {
    logInteraction("q1", { route: "structured", answered: true, review_status: "reviewed", text: "a1" }, logPath);
    logInteraction("q2", { route: "refusal", answered: false, review_status: null, text: "Not found." }, logPath);
    const entries = readInteractions(logPath);
    assert.equal(entries.length, 2);
    assert.equal(entries[0].question, "q1");
    assert.equal(entries[1].question, "q2");
  } finally {
    fs.rmSync(logPath, { force: true });
  }
});

test("readInteractions parses legacy entries that predate the additive fields", () => {
  const entries = readInteractions(LEGACY_LOG_FIXTURE);
  assert.equal(entries.length, 2);
  for (const e of entries) {
    assert.ok(typeof e.question === "string");
    assert.ok(typeof e.answered === "boolean");
  }
});
