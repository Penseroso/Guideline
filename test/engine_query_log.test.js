const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const { logInteraction } = require("../engine/query_log");

function tempLogPath() {
  return path.join(os.tmpdir(), `m2_queries_test_${Date.now()}_${Math.random().toString(36).slice(2)}.jsonl`);
}

test("logInteraction appends one JSON line with the question, path, and full answer text", () => {
  const logPath = tempLogPath();
  try {
    logInteraction("minimum replicates required", { path: "A", answered: true, review_status: "reviewed", text: "replicates: at least 5" }, logPath);
    const lines = fs.readFileSync(logPath, "utf8").trim().split("\n");
    assert.equal(lines.length, 1);
    const entry = JSON.parse(lines[0]);
    assert.equal(entry.question, "minimum replicates required");
    assert.equal(entry.path, "A");
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
    logInteraction("q1", { path: "A", answered: true, review_status: "reviewed", text: "a1" }, logPath);
    logInteraction("q2", { path: null, answered: false, review_status: null, text: "Not found in the current archive." }, logPath);
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
    logInteraction("q", { path: "B", answered: true, review_status: "reviewed", text: "a" }, logPath);
    assert.ok(fs.existsSync(logPath));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
