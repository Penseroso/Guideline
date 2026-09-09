const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const { loadResults, runQuestions, saveResults } = require("../scripts/run_answer_suitability_audit");

test("answer suitability audit persists each completed question before the next question starts", async () => {
  const persisted = [];
  const questions = [{ id: "Q01" }, { id: "Q02" }];

  await assert.rejects(
    runQuestions(questions, {
      execute: async (item) => {
        if (item.id === "Q02") throw new Error("simulated interruption");
        return { ...item, envelope: { claims: [] }, error: null };
      },
      persist: (results) => persisted.push(structuredClone(results))
    }),
    /simulated interruption/
  );

  assert.equal(persisted.length, 1);
  assert.deepEqual(persisted[0].map((item) => item.id), ["Q01"]);
});

test("answer suitability audit resumes by skipping persisted question IDs", async () => {
  const executed = [];
  const persisted = [{ id: "Q01", envelope: { claims: [] }, error: null }];

  const results = await runQuestions([{ id: "Q01" }, { id: "Q02" }], {
    results: persisted,
    execute: async (item) => {
      executed.push(item.id);
      return { ...item, envelope: { claims: [] }, error: null };
    },
    persist: () => {}
  });

  assert.deepEqual(executed, ["Q02"]);
  assert.deepEqual(results.map((item) => item.id), ["Q01", "Q02"]);
});

test("answer suitability audit writes a complete atomic JSON snapshot", () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "guideline-audit-persistence-"));
  const outputPath = path.join(directory, "results.json");
  try {
    const expected = [{ id: "Q01", elapsed_ms: 12, envelope: { claims: [] }, error: null }];
    saveResults(expected, outputPath);
    assert.deepEqual(loadResults(outputPath, { fresh: false }), expected);
    assert.equal(fs.existsSync(`${outputPath}.tmp`), false);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});
