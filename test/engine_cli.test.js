const test = require("node:test");
const assert = require("node:assert/strict");

const { isExitCommand } = require("../engine/cli");

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
