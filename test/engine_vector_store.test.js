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
