const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const { formatCitation, formatFinding, parseArgs, runEvaluate, discoverRuleCandidates } = require("../engine/applicability_cli");

test("parseArgs reads --flag value pairs", () => {
  assert.deepEqual(parseArgs(["--context", "ctx.json", "--rules", "a,b,c"]), { context: "ctx.json", rules: "a,b,c" });
});

test("parseArgs returns an empty object for no flags", () => {
  assert.deepEqual(parseArgs([]), {});
});

test("formatCitation renders a real citation shape", () => {
  const text = formatCitation({
    guideline_code: "S6(R1)",
    section_number: "3.3",
    printed_page_label: "5",
    source_unit_id: "su1"
  });
  assert.match(text, /S6\(R1\) §3\.3, p\.5 \[su1\]/);
});

test("formatCitation handles a null citation without throwing", () => {
  assert.equal(formatCitation(null), "(citation unavailable)");
});

test("formatFinding includes the verdict, every condition's own verbatim condition_text, and unresolved slots", () => {
  const finding = {
    rule_id: "rule1",
    rule_type: "knowledge_record",
    rule_review_status: "reviewed",
    verdict: "insufficient_context",
    conditional_reason: null,
    citations: [{ guideline_code: "TEST", section_number: "1", printed_page_label: "1", source_unit_id: "su1" }],
    scope_basis: { document_id: "test_doc", matched_profile: null, exclusions_triggered: [] },
    unresolved_slots: ["molecule_class"],
    basis: [
      { outcome: "insufficient_context", condition_type: "precondition", condition_text: "if the product is a biologic", binding_id: "b1", binding_verification_status: "verified" }
    ]
  };
  const text = formatFinding(finding);
  assert.match(text, /insufficient_context/);
  assert.match(text, /if the product is a biologic/);
  assert.match(text, /molecule_class/);
  assert.match(text, /verified/);
});

test("formatFinding reports no attached conditions plainly", () => {
  const finding = {
    rule_id: "rule1",
    rule_type: "knowledge_record",
    rule_review_status: "reviewed",
    verdict: "applicable",
    conditional_reason: null,
    citations: [],
    scope_basis: { document_id: "test_doc", matched_profile: null, exclusions_triggered: [] },
    unresolved_slots: [],
    basis: []
  };
  assert.match(formatFinding(finding), /no attached conditions/);
});

test("runEvaluate against the real S6(R1) archive: a species-selection rule reads applicable with a real context", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "applicability_cli_e2e_"));
  try {
    const file = path.join(dir, "ctx.json");
    fs.writeFileSync(file, JSON.stringify({ product_modality: "monoclonal_antibody" }));

    let output = "";
    const originalLog = console.log;
    console.log = (msg) => { output += msg + "\n"; };
    try {
      await runEvaluate({ contextFile: file, ruleIds: ["ich_s6_r1.kr.part1.3_3.002"] });
    } finally {
      console.log = originalLog;
    }
    assert.match(output, /Verdict: applicable/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("runEvaluate exits with an error message (not a crash) for an unknown rule_id", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "applicability_cli_e2e_"));
  try {
    const file = path.join(dir, "ctx.json");
    fs.writeFileSync(file, JSON.stringify({}));

    let errorOutput = "";
    const originalError = console.error;
    const originalLog = console.log;
    console.error = (msg) => { errorOutput += msg + "\n"; };
    console.log = () => {};
    try {
      await runEvaluate({ contextFile: file, ruleIds: ["not.a.real.rule"] });
    } finally {
      console.error = originalError;
      console.log = originalLog;
    }
    assert.match(errorOutput, /unknown rule_id/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

// --- Rule discovery (added so a real question can reach evaluateRule()
// without the user already knowing an internal rule_id, docs/milestone_log.md
// M6 "Rule discovery") ---

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

test("runEvaluate with --question discovers candidates and evaluates them, printing the discovery list before the findings", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "applicability_cli_e2e_"));
  try {
    const file = path.join(dir, "ctx.json");
    fs.writeFileSync(file, JSON.stringify({ product_modality: "monoclonal_antibody" }));

    let output = "";
    const originalLog = console.log;
    console.log = (msg) => { output += msg + "\n"; };
    try {
      await runEvaluate({ contextFile: file, question: "species selection monoclonal antibody", topK: 3 });
    } finally {
      console.log = originalLog;
    }
    assert.match(output, /Found \d+ candidate rule/);
    assert.match(output, /Verdict:/, "must go on to actually evaluate the discovered candidates, not just list them");
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("runEvaluate reports no candidates found rather than crashing when nothing matches", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "applicability_cli_e2e_"));
  try {
    const file = path.join(dir, "ctx.json");
    fs.writeFileSync(file, JSON.stringify({}));

    let output = "";
    const originalLog = console.log;
    console.log = (msg) => { output += msg + "\n"; };
    try {
      await runEvaluate({ contextFile: file, question: "completely unrelated gibberish xyzzy plugh" });
    } finally {
      console.log = originalLog;
    }
    assert.match(output, /No candidate rules found/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
