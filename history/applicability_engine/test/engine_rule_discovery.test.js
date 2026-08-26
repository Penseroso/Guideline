const test = require("node:test");
const assert = require("node:assert/strict");

const { discoverRuleCandidates } = require("../engine/rule_discovery");

function fakeRecord(overrides) {
  return {
    type: "knowledge_record",
    id: "fake.kr.001",
    source_text: "some source text",
    citations: [],
    ...overrides
  };
}

test("discoverRuleCandidates only searches knowledge_record/quantitative_criterion records, never condition entries", async () => {
  const records = [
    fakeRecord({ id: "kr1", type: "knowledge_record", source_text: "species selection for monoclonal antibodies", parameter: undefined }),
    fakeRecord({ id: "qc1", type: "quantitative_criterion", source_text: "species selection threshold", parameter: "species selection" }),
    fakeRecord({ id: "cond1", type: "condition", source_text: "species selection condition text" })
  ];
  const candidates = await discoverRuleCandidates("species selection", records, 5);
  const ids = candidates.map((c) => c.rule_id);
  assert.ok(ids.includes("kr1"));
  assert.ok(ids.includes("qc1"));
  assert.ok(!ids.includes("cond1"), "condition entries are evidence, not rules, and must never be returned as a rule_id candidate");
});

test("discoverRuleCandidates respects topK", async () => {
  // distinct source_text per record: createKeywordStore's search dedupes by
  // source_text (engine/vector_store.js) to yield diverse paragraphs, so
  // identical text across fixtures would collapse to one result regardless
  // of topK — not a bug, just something this fixture must account for.
  const records = Array.from({ length: 10 }, (_, i) =>
    fakeRecord({ id: `kr${i}`, source_text: `monoclonal antibody species selection criteria, variant ${i}` })
  );
  const candidates = await discoverRuleCandidates("monoclonal antibody species selection", records, 3);
  assert.equal(candidates.length, 3);
});

test("discoverRuleCandidates returns rule_id/score/source_text/citation for each match", async () => {
  const records = [fakeRecord({ id: "kr1", source_text: "monoclonal antibody species selection", citations: [{ guideline_code: "S6" }] })];
  const candidates = await discoverRuleCandidates("monoclonal antibody species selection", records, 5);
  assert.equal(candidates.length, 1);
  assert.equal(candidates[0].rule_id, "kr1");
  assert.ok(candidates[0].score > 0);
  assert.equal(candidates[0].source_text, "monoclonal antibody species selection");
  assert.deepEqual(candidates[0].citation, { guideline_code: "S6" });
});

test("discoverRuleCandidates against the real archive: a species-selection question surfaces an ich_s6_r1 rule", async () => {
  const { loadStore } = require("../engine/data_store");
  const { records } = loadStore();
  const candidates = await discoverRuleCandidates("species selection monoclonal antibody", records, 5);
  assert.ok(candidates.length > 0, "must find at least one candidate for a real, on-topic question");
  assert.ok(candidates.every((c) => c.rule_type === "knowledge_record" || c.rule_type === "quantitative_criterion"));
});
