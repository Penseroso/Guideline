const test = require("node:test");
const assert = require("node:assert/strict");

const { loadStore } = require("../engine/data_store");
const { structuredQuery, formatAnswer, answer, answerOptionB, NOT_FOUND, tokenize } = require("../engine/query_router");

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

// --- Korean tokenization & Structured Routing Fixes ---

test("tokenize maps Korean regulatory synonyms and strips Korean particles", () => {
  const tokens = tokenize("LLOQ에서 accuracy 허용범위는?");
  assert.ok(tokens.includes("lloq"));
  assert.ok(tokens.includes("accuracy"));
  assert.ok(tokens.includes("acceptance") || tokens.includes("criteria"));
});

test("structuredQuery picks LLOQ accuracy (20%) over general accuracy (15%) when querying LLOQ", () => {
  const match = structuredQuery("LLOQ에서 accuracy 허용범위는?", records);
  assert.ok(match, "expected match");
  assert.equal(match.record.value, 20);
  assert.match(match.record.denominator_or_reference, /LLOQ/);
  const text = formatAnswer(match);
  assert.match(text, /20 %/);
});

test("structuredQuery formats composite sibling criteria when querying general parameter", () => {
  const match = structuredQuery("accuracy 허용기준", records);
  assert.ok(match, "expected match");
  const text = formatAnswer(match);
  assert.match(text, /15 %/);
  assert.match(text, /20 %/);
});

test("structuredQuery abstains (returns null) on ambiguous queries with no clear single or sibling winner", () => {
  const match = structuredQuery("Full validation 항목이 뭐야", records);
  assert.equal(match, null);
});

// --- 5-Dimensional Scope Guard Tests ---

test("Scope Guard blocks small molecule query from matching biotechnology-exclusive S6 records", () => {
  const match = structuredQuery("저분자 화합물의 독성 시험에서 종 선택 기준은?", records);
  assert.equal(match, null, "expected null due to small_molecule exclusion in S6");
});

test("Scope Guard blocks species selection query from falsely matching study duration criteria", () => {
  const s6DurationQc = records.find((r) => r.id === "ich_s6_r1.qc.part2.2_2.004");
  assert.ok(s6DurationQc, "duration QC must exist in store");
  const match = structuredQuery("바이오의약품의 독성 시험에서 종 선택 기준은?", [s6DurationQc]);
  assert.equal(match, null, "expected topic anchor to block duration QC on species query");
});

test("records in data_store carry 5-dimensional Scope metadata", () => {
  const s6Record = records.find((r) => r.guideline_code === "S6(R1)");
  assert.equal(s6Record.molecule_scope, "biotechnology");
  assert.ok(s6Record.explicit_exclusions.includes("small_molecule"));
  assert.ok(Array.isArray(s6Record.section_path));

  const m10Record = records.find((r) => r.guideline_code === "M10");
  assert.equal(m10Record.study_context_scope, "bioanalytical_validation");
  assert.ok(Array.isArray(m10Record.section_path));
});


