const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const { recordFeedback, readFeedback, VALID_VERDICTS } = require("../engine/feedback_log");

function tempLogPath() {
  return path.join(os.tmpdir(), `feedback_test_${Date.now()}_${Math.random().toString(36).slice(2)}.jsonl`);
}

test("recordFeedback appends a valid entry with a generated feedback_id and timestamp", () => {
  const logPath = tempLogPath();
  try {
    const rec = recordFeedback({ question: "q1", verdict: "wrong_citation", note: "cites the wrong section" }, logPath);
    assert.ok(rec.feedback_id.startsWith("fb_"));
    assert.ok(rec.timestamp);
    assert.equal(rec.verdict, "wrong_citation");
    assert.equal(rec.triage, null);

    const lines = fs.readFileSync(logPath, "utf8").trim().split("\n");
    assert.equal(lines.length, 1);
    assert.equal(JSON.parse(lines[0]).question, "q1");
  } finally {
    fs.rmSync(logPath, { force: true });
  }
});

test("recordFeedback rejects an out-of-vocabulary verdict — no free-text rating allowed", () => {
  const logPath = tempLogPath();
  try {
    assert.throws(() => recordFeedback({ question: "q1", verdict: "5 stars" }, logPath), /verdict must be one of/);
    assert.throws(() => recordFeedback({ question: "q1", verdict: 5 }, logPath));
  } finally {
    fs.rmSync(logPath, { force: true });
  }
});

test("recordFeedback requires a question", () => {
  const logPath = tempLogPath();
  try {
    assert.throws(() => recordFeedback({ verdict: "correct" }, logPath), /question is required/);
  } finally {
    fs.rmSync(logPath, { force: true });
  }
});

test("every VALID_VERDICTS entry is independently accepted", () => {
  const logPath = tempLogPath();
  try {
    for (const verdict of VALID_VERDICTS) {
      assert.doesNotThrow(() => recordFeedback({ question: "q", verdict }, logPath));
    }
    assert.equal(readFeedback(logPath).length, VALID_VERDICTS.length);
  } finally {
    fs.rmSync(logPath, { force: true });
  }
});

test("readFeedback returns [] for a nonexistent log, appends across multiple calls otherwise", () => {
  const logPath = tempLogPath();
  assert.deepEqual(readFeedback(logPath), []);
  try {
    recordFeedback({ question: "q1", verdict: "incomplete" }, logPath);
    recordFeedback({ question: "q2", verdict: "should_have_refused" }, logPath);
    const entries = readFeedback(logPath);
    assert.equal(entries.length, 2);
    assert.equal(entries[0].question, "q1");
    assert.equal(entries[1].verdict, "should_have_refused");
  } finally {
    fs.rmSync(logPath, { force: true });
  }
});

test("no rating/score field exists anywhere on a feedback record — grep-checkable invariant", () => {
  const logPath = tempLogPath();
  try {
    const rec = recordFeedback({ question: "q", verdict: "correct" }, logPath);
    assert.equal(Object.prototype.hasOwnProperty.call(rec, "score"), false);
    assert.equal(Object.prototype.hasOwnProperty.call(rec, "rating"), false);
    assert.equal(Object.prototype.hasOwnProperty.call(rec, "stars"), false);
  } finally {
    fs.rmSync(logPath, { force: true });
  }
});

test("recordFeedback creates the log directory if it doesn't exist yet", () => {
  const dir = path.join(os.tmpdir(), `feedback_dir_test_${Date.now()}`);
  const logPath = path.join(dir, "nested", "feedback.jsonl");
  try {
    recordFeedback({ question: "q", verdict: "correct" }, logPath);
    assert.ok(fs.existsSync(logPath));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
