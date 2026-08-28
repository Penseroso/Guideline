const test = require("node:test");
const assert = require("node:assert/strict");

const { loadStore } = require("../engine/data_store");
const { structuredQuery, formatAnswer, formatApplicableConditions, formatCrossReferences, answer, answerOptionB, NOT_FOUND, tokenize } = require("../engine/query_router");

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

// --- Option B Scope Guard parity + per-unit grounding
// (docs/test_record.md Entry 007: Option B previously only checked
// explicit_exclusions and cited every retrieved candidate unconditionally,
// so a scope-excluded query silently substituted the wrong document, and a
// generated answer's Sources line never reflected which candidate actually
// backed which sentence.) ---

test("answerOptionB refuses a scope-excluded query instead of substituting a wrongly-scoped candidate, and never calls the model", async () => {
  const excluded = records.find((r) => r.id === "ich_s6_r1.kr.part1.3_3.001");
  assert.ok(excluded, "fixture record must exist in the real archive");
  assert.ok(excluded.explicit_exclusions.includes("small_molecule"));
  const client = { complete: async () => { throw new Error("must not be called once every candidate is scope-rejected"); } };
  const result = await answerOptionB("저분자 화합물의 독성 시험에서 종 선택 기준은?", records, { client, store: fakeStore([excluded]) });
  assert.equal(result.answered, false);
  assert.equal(result.refusal_reason, "scope_excluded");
});

test("answer() surfaces refusal_reason: scope_excluded on the no-client-configured path too", async () => {
  const result = await answer("저분자 화합물의 독성 시험에서 종 선택 기준은?", records);
  assert.equal(result.answered, false);
  assert.equal(result.refusal_reason, "scope_excluded");
});

test("answerOptionB drops an ungrounded line and attaches each surviving line's own candidate citation, not every candidate", async () => {
  const candidateA = records.find((r) => r.type === "quantitative_criterion" && r.parameter === "replicates");
  const candidateB = records.find((r) => r.type === "condition" && r.id !== candidateA.id);
  assert.ok(candidateA && candidateB && candidateA.id !== candidateB.id);

  const client = {
    complete: async ({ schema, messages }) => {
      if (!schema) {
        return { text: "Line one is true.\nLine two is true.\nLine three is fabricated and unsupported." };
      }
      // Verification call: entail "Line one" only against candidateA's
      // source_text, "Line two" only against candidateB's, and never
      // entail the fabricated third line against anything.
      const claim = messages[0].content;
      if (claim.includes("Line one") && claim.includes(candidateA.source_text)) return { entailed: true, reason: "matches A" };
      if (claim.includes("Line two") && claim.includes(candidateB.source_text)) return { entailed: true, reason: "matches B" };
      return { entailed: false, reason: "not supported by this excerpt" };
    }
  };

  const result = await answerOptionB("irrelevant", records, { client, store: fakeStore([candidateA, candidateB]) });
  assert.equal(result.answered, true);
  assert.match(result.text, /Line one is true\./);
  assert.match(result.text, /Line two is true\./);
  assert.doesNotMatch(result.text, /fabricated/);
  assert.equal(result.claims.length, 2);
  const citedUnits = result.claims.map((c) => c.source_unit_id);
  assert.ok(citedUnits.includes(candidateA.citations[0].source_unit_id));
  assert.ok(citedUnits.includes(candidateB.citations[0].source_unit_id));
});

test("answerOptionB refuses when no line of the generated answer can be independently grounded", async () => {
  const candidate = records.find((r) => r.type === "quantitative_criterion" && r.parameter === "replicates");
  const client = {
    complete: async ({ schema }) => {
      if (schema) return { entailed: false, reason: "not supported" };
      return { text: "This entire answer is fabricated." };
    }
  };
  const result = await answerOptionB("irrelevant", records, { client, store: fakeStore([candidate]) });
  assert.equal(result.answered, false);
  assert.equal(result.refusal_reason, "verification_failed");
  assert.match(result.text, /failed citation verification/);
});

// --- Korean tokenization & Structured Routing Fixes ---

test("tokenize maps Korean regulatory synonyms and strips Korean particles", () => {
  const tokens = tokenize("LLOQ에서 accuracy 허용범위는?");
  assert.ok(tokens.includes("lloq"));
  assert.ok(tokens.includes("accuracy"));
  assert.ok(tokens.includes("acceptance") || tokens.includes("criteria"));
});

test("tokenize maps the Korean synonyms cherry-picked from the M6 Applicability spike's ontology (docs/milestone_log.md M6 'Cherry-pick audit')", () => {
  assert.ok(tokenize("건강인 대상 시험").includes("healthy"));
  assert.ok(tokenize("설치류와 비설치류").includes("rodent"));
  assert.ok(tokenize("중증질환 환자군").includes("severe"));
  assert.ok(tokenize("선별 분석").includes("assay"));
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
  const match = structuredQuery("unknown ambiguous non-existing random protocol", records);
  assert.equal(match, null);
});

test("structuredQuery handles list composite query for structured sections", () => {
  const match = structuredQuery("LBA 밸리데이션 항목", records);
  assert.ok(match);
  assert.equal(match.isListComposite, true);
  assert.ok(match.compositeRecords.length >= 2);
  const text = formatAnswer(match);
  assert.match(text, /관련 주요 요건 및 기준 목록/);
  assert.match(text, /M10/);
});

// --- Applicable-conditions caveat (cherry-picked from the M6 spike's
// audit finding that a KR/QC's own attached Conditions were already
// correctly computed via data_store.js's conditionsByTarget reverse index,
// but never shown to the end user, docs/milestone_log.md M6 "Cherry-pick
// audit") ---

test("formatApplicableConditions renders each condition's verbatim type and text", () => {
  const text = formatApplicableConditions([
    { condition_type: "exception", condition_text: "unless justified" },
    { condition_type: "precondition", condition_text: "if the study is ongoing" }
  ]);
  assert.match(text, /Applicable conditions:/);
  assert.match(text, /\(exception\) "unless justified"/);
  assert.match(text, /\(precondition\) "if the study is ongoing"/);
});

test("formatApplicableConditions returns an empty string for no conditions, undefined, or null", () => {
  assert.equal(formatApplicableConditions([]), "");
  assert.equal(formatApplicableConditions(undefined), "");
  assert.equal(formatApplicableConditions(null), "");
});

test("formatAnswer appends applicable_conditions for a knowledge_record answer, verbatim, never a judgment about whether it applies", () => {
  const record = {
    type: "knowledge_record",
    source_text: "some source text",
    citations: [{ guideline_code: "TEST", section_number: "1", printed_page_label: "1", source_unit_id: "su1" }],
    applicable_conditions: [{ condition_type: "exception", condition_text: "unless a robust rationale is provided" }]
  };
  const text = formatAnswer(record);
  assert.match(text, /some source text/);
  assert.match(text, /Applicable conditions:/);
  assert.match(text, /unless a robust rationale is provided/);
});

test("formatAnswer against the real archive: a KR with a real attached Condition shows it as a caveat", () => {
  const withCondition = records.find((r) => r.type === "knowledge_record" && r.applicable_conditions && r.applicable_conditions.length > 0);
  assert.ok(withCondition, "the real archive must have at least one KR with an attached Condition");
  const text = formatAnswer(withCondition);
  assert.match(text, /Applicable conditions:/);
  assert.match(text, new RegExp(withCondition.applicable_conditions[0].condition_text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
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

test("formatCrossReferences renders historical notes and related citations", () => {
  const xrefs = [
    {
      target_id: "ich_s6_r1.su.part1.4_4.001",
      target_citation: "S6(R1) §4.4, p.7 [ich_s6_r1.su.part1.4_4.001]",
      target_source_text: "Repeated dose toxicity studies should be conducted for 6-12 months."
    },
    {
      raw_reference_text: "ICH S9 Guideline"
    }
  ];
  const rendered = formatCrossReferences(xrefs);
  assert.match(rendered, /Note on Guideline History & Related References/);
  assert.match(rendered, /S6\(R1\) §4\.4, p\.7/);
  assert.match(rendered, /Repeated dose toxicity/);
  assert.match(rendered, /ICH S9 Guideline/);
});

test("formatCrossReferences returns empty string when array is empty or null", () => {
  assert.equal(formatCrossReferences([]), "");
  assert.equal(formatCrossReferences(null), "");
});


