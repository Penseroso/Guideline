const test = require("node:test");
const assert = require("node:assert/strict");

const { loadStore } = require("../engine/data_store");
const { createStore } = require("../engine/vector_store");

const { records } = loadStore();

test("createStore defaults to keyword mode when no embed function is supplied", () => {
  const store = createStore();
  assert.equal(store.mode, "keyword");
});

test("keyword mode returns ranked, relevant top-k results with zero LLM calls", async () => {
  const store = createStore();
  store.index(records);
  const results = await store.search("replicates QC concentration level", 5);
  assert.ok(results.length > 0);
  assert.ok(results.length <= 5);
  // scores should be non-increasing
  for (let i = 1; i < results.length; i++) {
    assert.ok(results[i - 1].score >= results[i].score);
  }
});

test("keyword mode returns an empty array for a query with no shared tokens", async () => {
  const store = createStore();
  store.index(records);
  const results = await store.search("zzznonexistentzzz", 5);
  assert.deepEqual(results, []);
});

test("crude ADA evaluation-method phrasing retrieves FDA assay-method evidence, not arbitrary clinical-risk chunks", async () => {
  const store = createStore();
  store.index(records);
  const results = await store.search("ada 평가방법", 5);
  assert.ok(results.length > 0);
  assert.equal(results[0].record.document_id, "fda_ada");
  assert.match(results[0].record.source_text, /multi-tiered|screening assay/i);
});

test("vector mode wires an injected embed function through index() and search()", async () => {
  const dim = 4;
  const embed = async (text) => {
    // deterministic fake embedding — proves the plumbing, not real semantics
    let seed = 0;
    for (const c of text) seed = (seed * 31 + c.charCodeAt(0)) % 9973;
    return Array.from({ length: dim }, (_, i) => Math.sin(seed + i));
  };
  const store = createStore({ embed });
  assert.equal(store.mode, "vector");
  const sample = records.slice(0, 8);
  await store.index(sample);
  const results = await store.search(sample[0].source_text, 3);
  assert.ok(results.length > 0);
  assert.ok(results.length <= 3);
  for (const r of results) assert.ok(sample.includes(r.record));
});

test("vector mode throws a clear error if search() is called before index()", async () => {
  const store = createStore({ embed: async () => [0, 0, 0] });
  await assert.rejects(() => store.search("anything"), /index\(\) must be called before search\(\)/);
});

// Response Intelligence Workstream 4 (scripts/analyze_retrieval_quality.js):
// a document-frequency-aware bonus was added on top of the flat field-tier
// score so a rare, distinctive token counts for more than a near-ubiquitous
// one at the same tier.
test("a rare token ranks its record above a record that only matches a common token at the same field tier", () => {
  const common = { id: "common", type: "knowledge_record", document_id: "doc_common", source_text: "widely shared filler word appears here and elsewhere too" };
  const many = Array.from({ length: 20 }, (_, i) => ({
    id: `filler_${i}`,
    type: "knowledge_record",
    document_id: `doc_filler_${i}`,
    source_text: "widely shared filler word appears in every single one of these records"
  }));
  const rare = { id: "rare", type: "knowledge_record", document_id: "doc_rare", source_text: "an utterly distinctive uncommon zephyrine token appears here" };
  const store = createStore();
  store.index([common, rare, ...many]);
  return store.search("filler zephyrine", 3).then((results) => {
    const rareResult = results.find((r) => r.record.id === "rare");
    const commonResult = results.find((r) => r.record.id === "common");
    assert.ok(rareResult, "the rare-token record should be retrievable");
    if (commonResult) assert.ok(rareResult.score > commonResult.score, "the rare token should outweigh the common one at the same source-text tier");
  });
});

test("REGULATORY_SYNONYMS covers 'repeats'/'cycling' as real wording variants found by the retrieval-quality benchmark", async () => {
  const store = createStore();
  store.index(records);
  const repeatsResults = await store.search("concentration repeats", 5);
  assert.ok(repeatsResults.some((r) => r.record.id === "ich_m10.qc.3_2_5_2.001" || (r.record.source_unit_ids || [])[0] === "ich_m10.su.3_2_5_2.003"));
  const cyclingResults = await store.search("matrix cycling", 5);
  assert.ok(cyclingResults.some((r) => r.record.id === "ich_m10.qc.4_2_7.003" || (r.record.source_unit_ids || [])[0] === "ich_m10.su.4_2_7.001"));
});
