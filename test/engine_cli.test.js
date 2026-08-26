const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const { isExitCommand, isContextCommand, applyContextCommand, loadInitialContext } = require("../engine/cli");

test("isExitCommand matches exit/quit regardless of case (regression: a real M2 session typed 'EXIT' and it was logged as a refused question instead of quitting)", () => {
  assert.equal(isExitCommand("exit"), true);
  assert.equal(isExitCommand("EXIT"), true);
  assert.equal(isExitCommand("Exit"), true);
  assert.equal(isExitCommand("quit"), true);
  assert.equal(isExitCommand("QUIT"), true);
});

test("isExitCommand does not match a real question that merely contains 'exit'", () => {
  assert.equal(isExitCommand("what is the exit criteria for the study"), false);
  assert.equal(isExitCommand(""), false);
});

// --- :context command (Applicability Layer 0.1.0) ---

test("isContextCommand matches ':context' and its subcommands, case-insensitively", () => {
  assert.equal(isContextCommand(":context"), true);
  assert.equal(isContextCommand(":CONTEXT set molecule_class biotechnology"), true);
  assert.equal(isContextCommand("what is the context here"), false);
});

test("bare :context shows the current context without changing it", () => {
  const result = applyContextCommand({ molecule_class: "biotechnology" }, ":context");
  assert.deepEqual(result.context, { molecule_class: "biotechnology" });
  assert.match(result.message, /biotechnology/);
});

test(":context set validates and applies a real slot/value pair", () => {
  const result = applyContextCommand({}, ":context set molecule_class biotechnology");
  assert.deepEqual(result.context, { molecule_class: "biotechnology" });
});

test(":context set rejects an invalid value and leaves the prior context untouched", () => {
  const prior = { molecule_class: "biotechnology" };
  const result = applyContextCommand(prior, ":context set molecule_class not_a_real_value");
  assert.deepEqual(result.context, prior, "an invalid :context set must never silently change the context");
  assert.match(result.message, /invalid context/);
});

test(":context set rejects an unknown slot", () => {
  const prior = {};
  const result = applyContextCommand(prior, ":context set made_up_slot x");
  assert.deepEqual(result.context, prior);
});

test(":context clear resets to an empty context", () => {
  const result = applyContextCommand({ molecule_class: "biotechnology" }, ":context clear");
  assert.deepEqual(result.context, {});
});

test(":context with no recognized subcommand shows usage without changing the context", () => {
  const prior = { molecule_class: "biotechnology" };
  const result = applyContextCommand(prior, ":context bogus");
  assert.deepEqual(result.context, prior);
  assert.match(result.message, /Usage/);
});

test("loadInitialContext returns {} when --context is not passed", () => {
  assert.deepEqual(loadInitialContext([]), {});
});

test("loadInitialContext loads and validates a real context file", () => {
  const file = path.join(os.tmpdir(), `context_test_${Date.now()}.json`);
  fs.writeFileSync(file, JSON.stringify({ molecule_class: "biotechnology" }));
  try {
    assert.deepEqual(loadInitialContext(["--context", file]), { molecule_class: "biotechnology" });
  } finally {
    fs.rmSync(file, { force: true });
  }
});
