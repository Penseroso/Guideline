const test = require("node:test");
const assert = require("node:assert/strict");

const { loadStore } = require("../engine/data_store");
const { structuredQuery, answer, answerOptionB, NOT_FOUND, tokenize } = require("../engine/query_router");

const { records } = loadStore();

test("tokenize strips stopwords and punctuation", () => {
  const tokens = tokenize("What is the minimum number of replicates?");
  assert.ok(!tokens.includes("the"));
  assert.ok(!tokens.includes("is"));
  assert.ok(tokens.includes("replicates"));
});

test("a precise numeric question surfaces the QuantitativeCriterion, not the raw paragraph it came from", () => {
  const match = structuredQuery("minimum replicates required at each QC concentration level", records);
  assert.ok(match, "expected a confident match");
  assert.equal(match.record.type, "quantitative_criterion");
  assert.equal(match.record.parameter, "replicates");
  assert.equal(match.record.value, 5);
});

test("answer() returns a formatted citation for a confident match", async () => {
  const result = await answer("minimum replicates required at each QC concentration level", records);
  assert.equal(result.answered, true);
  assert.match(result.text, /M10 §3\.2\.5\.2/);
  assert.match(result.text, /p\.14/);
});

test("an unrelated question returns the explicit refusal, not a guess, when no Option B provider is configured", async () => {
  const result = await answer("what is the meaning of life", records);
  assert.equal(result.answered, false);
  assert.equal(result.text, NOT_FOUND);
  assert.equal(result.record, null);
});

test("an empty question returns no match rather than throwing", () => {
  assert.equal(structuredQuery("", records), null);
});

test("review_status is exposed on a match so the caller can surface it, per TPP §1.3", async () => {
  const result = await answer("minimum replicates required at each QC concentration level", records);
  assert.ok(["reviewed", "needs_review", "unreviewed"].includes(result.review_status));
});

// --- Option B (mocked client + store; no network) ---

function fakeStore(candidateRecords) {
  return { search: async () => candidateRecords.map((record) => ({ record, score: 1 })) };
}

test("answer() falls back to Option B only when a client and store are both supplied", async () => {
  const candidate = records.find((r) => r.type === "knowledge_record");
  const client = { complete: async ({ schema }) => (schema ? { entailed: true, reason: "ok" } : { text: `Per the archive: ${candidate.source_text}` }) };
  const store = fakeStore([candidate]);

  const withFallback = await answer("what is the meaning of life", records, { client, store });
  assert.equal(withFallback.path, "B");
  assert.equal(withFallback.answered, true);

  const withoutFallback = await answer("what is the meaning of life", records);
  assert.equal(withoutFallback.answered, false);
});

test("answerOptionB refuses when the vector store returns no candidates", async () => {
  const client = { complete: async () => { throw new Error("must not be called with no candidates"); } };
  const result = await answerOptionB("anything", records, { client, store: fakeStore([]) });
  assert.equal(result.answered, false);
  assert.equal(result.text, NOT_FOUND);
});

test("answerOptionB refuses when the model itself says not found", async () => {
  const candidate = records.find((r) => r.type === "condition");
  const client = { complete: async () => ({ text: NOT_FOUND }) };
  const result = await answerOptionB("irrelevant", records, { client, store: fakeStore([candidate]) });
  assert.equal(result.answered, false);
});

test("answerOptionB refuses a generated answer that fails citation verification, instead of showing it", async () => {
  const candidate = records.find((r) => r.type === "quantitative_criterion" && r.parameter === "replicates");
  const client = {
    complete: async ({ schema }) => {
      if (schema) return { entailed: false, reason: "claim states a value not present in the source" };
      return { text: "Exactly 10 replicates are always required, no exceptions." };
    }
  };
  const result = await answerOptionB("replicate count", records, { client, store: fakeStore([candidate]) });
  assert.equal(result.answered, false);
  assert.match(result.text, /failed citation verification/);
});

test("answerOptionB returns the generated answer with sources once verification passes", async () => {
  const candidate = records.find((r) => r.type === "quantitative_criterion" && r.parameter === "replicates");
  const client = {
    complete: async ({ schema }) => {
      if (schema) return { entailed: true, reason: "matches source_text" };
      return { text: "At least 5 replicates are required at each QC concentration level." };
    }
  };
  const result = await answerOptionB("replicate count", records, { client, store: fakeStore([candidate]) });
  assert.equal(result.answered, true);
  assert.match(result.text, /Sources: M10 §3\.2\.5\.2/);
});
