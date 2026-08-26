const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const { formatCitation, formatFinding, parseArgs, runEvaluate } = require("../engine/applicability_cli");

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

test("runEvaluate against the real S6(R1) archive: a species-selection rule reads applicable with a real context", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "applicability_cli_e2e_"));
  try {
    const file = path.join(dir, "ctx.json");
    fs.writeFileSync(file, JSON.stringify({ product_modality: "monoclonal_antibody" }));

    let output = "";
    const originalLog = console.log;
    console.log = (msg) => { output += msg + "\n"; };
    try {
      runEvaluate({ contextFile: file, ruleIds: ["ich_s6_r1.kr.part1.3_3.002"] });
    } finally {
      console.log = originalLog;
    }
    assert.match(output, /Verdict: applicable/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("runEvaluate exits with an error message (not a crash) for an unknown rule_id", () => {
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
      runEvaluate({ contextFile: file, ruleIds: ["not.a.real.rule"] });
    } finally {
      console.error = originalError;
      console.log = originalLog;
    }
    assert.match(errorOutput, /unknown rule_id/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
