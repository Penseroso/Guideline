const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const test = require("node:test");

const { validateDerivedArtifacts } = require("../scripts/validate_derived");

const ROOT = path.resolve(__dirname, "..");
const FIXTURE_DIR = path.join(ROOT, "test", "fixtures", "derived");
const SOURCE_FILE = path.join(FIXTURE_DIR, "minimal_source_bundle.json");
const AMENDMENT_FILE = path.join(FIXTURE_DIR, "minimal_amendment_mappings.json");
const EFFECTIVE_FILE = path.join(FIXTURE_DIR, "minimal_effective_records.json");

const sourceFixture = JSON.parse(fs.readFileSync(SOURCE_FILE, "utf8"));
const amendmentFixture = JSON.parse(fs.readFileSync(AMENDMENT_FILE, "utf8"));
const effectiveFixture = JSON.parse(fs.readFileSync(EFFECTIVE_FILE, "utf8"));

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function validateCopies(mutator) {
  const sourceBundle = clone(sourceFixture);
  const amendmentArtifact = clone(amendmentFixture);
  const effectiveArtifact = clone(effectiveFixture);
  if (mutator) mutator(sourceBundle, amendmentArtifact, effectiveArtifact);
  return validateDerivedArtifacts({
    sourceBundle,
    amendmentArtifact,
    effectiveArtifact,
    files: {
      sourceFile: SOURCE_FILE,
      amendmentFile: AMENDMENT_FILE,
      effectiveFile: EFFECTIVE_FILE
    }
  });
}

function assertValid(result) {
  assert.equal(result.ok, true, result.errors.join("\n"));
  assert.deepEqual(result.errors, []);
}

function assertInvalid(result, expectedFragment) {
  assert.equal(result.ok, false, "validation unexpectedly passed");
  assert.notEqual(result.errors.length, 0, "expected at least one validation error");
  assert(
    result.errors.some((error) => error.includes(expectedFragment)),
    `expected an error containing ${JSON.stringify(expectedFragment)}, got:\n${result.errors.join("\n")}`
  );
}

test("valid derived fixtures pass", () => {
  assertValid(validateCopies());
});

test("current S6 derived artifacts pass", () => {
  const sourceBundle = JSON.parse(fs.readFileSync(path.join(ROOT, "structured_data", "pilots", "s6_r1_species_selection.json"), "utf8"));
  const amendmentArtifact = JSON.parse(fs.readFileSync(path.join(ROOT, "structured_data", "derived", "s6_r1_amendment_mappings.json"), "utf8"));
  const effectiveArtifact = JSON.parse(fs.readFileSync(path.join(ROOT, "structured_data", "derived", "s6_r1_effective_records.json"), "utf8"));
  assertValid(validateDerivedArtifacts({
    sourceBundle,
    amendmentArtifact,
    effectiveArtifact,
    files: {
      sourceFile: "structured_data/pilots/s6_r1_species_selection.json",
      amendmentFile: "structured_data/derived/s6_r1_amendment_mappings.json",
      effectiveFile: "structured_data/derived/s6_r1_effective_records.json"
    }
  }));
});

test("duplicate mapping IDs fail", () => {
  assertInvalid(validateCopies((source, amendments) => {
    amendments.amendment_mappings.push(clone(amendments.amendment_mappings[0]));
  }), "duplicate mapping_id");
});

test("missing Parent KR endpoint fails", () => {
  assertInvalid(validateCopies((source, amendments) => {
    amendments.amendment_mappings[0].parent_knowledge_record_ids[0] = "test.kr.missing";
  }), "reference does not resolve to knowledge_records: test.kr.missing");
});

test("missing Addendum KR endpoint fails", () => {
  assertInvalid(validateCopies((source, amendments) => {
    amendments.amendment_mappings[0].addendum_knowledge_record_ids[0] = "test.kr.missing";
  }), "reference does not resolve to knowledge_records: test.kr.missing");
});

test("invalid relation type fails", () => {
  assertInvalid(validateCopies((source, amendments) => {
    amendments.amendment_mappings[0].relation_type = "explains";
  }), "is not in the derived relation vocabulary");
});

test("invalid mapping review status fails", () => {
  assertInvalid(validateCopies((source, amendments) => {
    amendments.amendment_mappings[0].review_status = "approved";
  }), "must be reviewed or needs_review");
});

test("reviewed mapping referencing unreviewed endpoint fails", () => {
  assertInvalid(validateCopies((source) => {
    source.knowledge_records[0].review_status = "needs_review";
  }), "reviewed mapping references unreviewed KnowledgeRecord test.kr.parent.001");
});

test("missing contextual CrossReference IDs fail when note exists", () => {
  assertInvalid(validateCopies((source, amendments) => {
    delete amendments.amendment_mappings[0].contextual_cross_reference_ids;
  }), "contextual_cross_reference_ids: must be an array");
});

test("unresolved contextual CrossReference ID fails", () => {
  assertInvalid(validateCopies((source, amendments) => {
    amendments.amendment_mappings[0].contextual_cross_reference_ids[0] = "test.xref.missing";
  }), "reference does not resolve to cross_references: test.xref.missing");
});

test("malformed or empty mapping endpoint arrays fail", () => {
  assertInvalid(validateCopies((source, amendments) => {
    amendments.amendment_mappings[0].addendum_knowledge_record_ids = [];
  }), "addendum_knowledge_record_ids: must not be empty");
  assertInvalid(validateCopies((source, amendments) => {
    amendments.amendment_mappings[0].parent_knowledge_record_ids = "test.kr.parent.001";
  }), "parent_knowledge_record_ids: must be an array");
});

test("incorrect object-layer references fail", () => {
  assertInvalid(validateCopies((source, amendments) => {
    amendments.amendment_mappings[0].parent_knowledge_record_ids[0] = "test.su.parent.001";
  }), "reference resolves to source_units, expected knowledge_records");
});

test("duplicate EffectiveRecord IDs fail", () => {
  assertInvalid(validateCopies((source, amendments, effective) => {
    effective.effective_records[1].effective_record_id = effective.effective_records[0].effective_record_id;
  }), "duplicate effective_record_id");
});

test("missing EffectiveRecord KR ID fails", () => {
  assertInvalid(validateCopies((source, amendments, effective) => {
    effective.effective_records[0].knowledge_record_ids[0] = "test.kr.missing";
  }), "reference does not resolve to knowledge_records: test.kr.missing");
});

test("missing Condition ID fails", () => {
  assertInvalid(validateCopies((source, amendments, effective) => {
    effective.effective_records[0].condition_ids[0] = "test.cond.missing";
  }), "reference does not resolve to conditions: test.cond.missing");
});

test("missing QuantitativeCriterion ID fails", () => {
  assertInvalid(validateCopies((source, amendments, effective) => {
    effective.effective_records[0].quantitative_criterion_ids[0] = "test.qc.missing";
  }), "reference does not resolve to quantitative_criteria: test.qc.missing");
});

test("missing CrossReference ID fails", () => {
  assertInvalid(validateCopies((source, amendments, effective) => {
    effective.effective_records[0].cross_reference_ids[0] = "test.xref.missing";
  }), "reference does not resolve to cross_references: test.xref.missing");
});

test("missing SourceUnit ID fails", () => {
  assertInvalid(validateCopies((source, amendments, effective) => {
    effective.effective_records[0].source_unit_ids[0] = "test.su.missing";
  }), "reference does not resolve to source_units: test.su.missing");
});

test("missing amendment relation ID fails", () => {
  assertInvalid(validateCopies((source, amendments, effective) => {
    effective.effective_records[0].amendment_relation_ids[0] = "test.amend.missing";
  }), "reference does not resolve to amendment_mappings: test.amend.missing");
});

test("invalid EffectiveRecord review status fails", () => {
  assertInvalid(validateCopies((source, amendments, effective) => {
    effective.effective_records[0].review_status = "approved";
  }), "must be reviewed or needs_review");
});

test("empty effective_status fails without enforcing an enum", () => {
  assertInvalid(validateCopies((source, amendments, effective) => {
    effective.effective_records[0].effective_status = "";
  }), "effective_status: is required and must be a non-empty string");
  assertValid(validateCopies((source, amendments, effective) => {
    effective.effective_records[0].effective_status = "future_status_for_module_3_6";
  }));
});

test("mapping-backed record referencing unreviewed mapping fails", () => {
  assertInvalid(validateCopies((source, amendments) => {
    amendments.amendment_mappings[0].review_status = "needs_review";
  }), "amendment mapping is not reviewed: test.amend.001");
});

test("mapping-backed record missing Parent endpoint coverage fails", () => {
  assertInvalid(validateCopies((source, amendments, effective) => {
    effective.effective_records[0].knowledge_record_ids = ["test.kr.addendum.001"];
    effective.effective_records[0].source_unit_ids = ["test.su.addendum.001"];
  }), "missing Parent endpoint coverage");
});

test("mapping-backed record missing Addendum endpoint coverage fails", () => {
  assertInvalid(validateCopies((source, amendments, effective) => {
    effective.effective_records[0].knowledge_record_ids = ["test.kr.parent.001"];
    effective.effective_records[0].condition_ids = [];
    effective.effective_records[0].quantitative_criterion_ids = [];
    effective.effective_records[0].cross_reference_ids = [];
    effective.effective_records[0].source_unit_ids = ["test.su.parent.001"];
  }), "missing Addendum endpoint coverage");
});

test("mapping-independent record with empty amendment_relation_ids passes", () => {
  assertValid(validateCopies((source, amendments, effective) => {
    effective.effective_records = [effective.effective_records[1]];
  }));
});

test("reviewed EffectiveRecord referencing unreviewed contributor fails", () => {
  assertInvalid(validateCopies((source) => {
    source.conditions[0].review_status = "needs_review";
  }), "reviewed EffectiveRecord references unreviewed contributor test.cond.001");
});

test("undocumented unreviewed CrossReference contributor fails", () => {
  assertInvalid(validateCopies((source) => {
    source.cross_references[0].review_status = "needs_review";
  }), "unreviewed CrossReference test.xref.001 must be documented");
});

test("documented unreviewed CrossReference contributor passes", () => {
  assertValid(validateCopies((source, amendments, effective) => {
    source.cross_references[0].review_status = "needs_review";
    effective.effective_records[0].representation_limitations = ["test.xref.001 remains unresolved in the source model."];
  }));
});

test("missing required provenance field fails", () => {
  assertInvalid(validateCopies((source, amendments, effective) => {
    delete effective.effective_records[0].source_unit_ids;
  }), "source_unit_ids: must be an array");
});

test("malformed edition context fails", () => {
  assertInvalid(validateCopies((source, amendments, effective) => {
    effective.effective_records[0].edition_context = null;
  }), "edition_context: must be an object");
});

test("artifact metadata path mismatch fails after repo-relative normalization", () => {
  assertInvalid(validateCopies((source, amendments) => {
    amendments.artifact.source_pilot_file = "structured_data/pilots/s6_r1_species_selection.json";
  }), "artifact.source_pilot_file: must match configured path test/fixtures/derived/minimal_source_bundle.json");
});

test("source model version mismatch fails", () => {
  assertInvalid(validateCopies((source, amendments, effective) => {
    effective.effective_records[0].edition_context.source_model_version = "0.3.0";
  }), "must match source Document.schema_model_version 0.2.0");
});

test("reviewed EffectiveRecord referencing conflicts_with mapping fails", () => {
  assertInvalid(validateCopies((source, amendments) => {
    amendments.amendment_mappings[0].relation_type = "conflicts_with";
  }), "reviewed EffectiveRecord cannot reference conflicts_with mapping");
});

test("Condition not applying to included KR fails", () => {
  assertInvalid(validateCopies((source) => {
    source.conditions[0].applies_to_ids = ["test.kr.parent.001"];
  }), "does not apply to any included KnowledgeRecord");
});

test("QC referencing missing included KR fails", () => {
  assertInvalid(validateCopies((source) => {
    source.quantitative_criteria[0].knowledge_record_id = "test.kr.parent.001";
  }), "references KnowledgeRecord test.kr.parent.001 not included");
});

test("QC condition missing from EffectiveRecord condition_ids fails", () => {
  assertInvalid(validateCopies((source, amendments, effective) => {
    effective.effective_records[0].condition_ids = [];
  }), "QuantitativeCriterion test.qc.001 condition test.cond.001 is not included");
});

test("contributor direct SourceUnit missing from source_unit_ids fails", () => {
  assertInvalid(validateCopies((source, amendments, effective) => {
    effective.effective_records[0].source_unit_ids = ["test.su.parent.001"];
  }), "direct SourceUnit test.su.addendum.001 is not included");
});

test("invalid normalized_ko fails", () => {
  assertInvalid(validateCopies((source, amendments, effective) => {
    effective.effective_records[0].normalized_ko = 1;
  }), "normalized_ko: must be a string or null");
});

test("invalid representation_limitations fails", () => {
  assertInvalid(validateCopies((source, amendments, effective) => {
    effective.effective_records[0].representation_limitations = [1];
  }), "representation_limitations: must be an array of strings");
});

test("missing amendment artifact metadata fails", () => {
  assertInvalid(validateCopies((source, amendments) => {
    delete amendments.artifact.derivation;
  }), "artifact.derivation: is required and must be a non-empty string");
});

test("missing effective artifact metadata fails", () => {
  assertInvalid(validateCopies((source, amendments, effective) => {
    delete effective.artifact.design_note;
  }), "artifact.design_note: is required and must be a non-empty string");
});

test("CLI exits zero on valid files", () => {
  const result = spawnSync(process.execPath, [
    "scripts/validate_derived.js",
    "--source",
    SOURCE_FILE,
    "--amendments",
    AMENDMENT_FILE,
    "--effective",
    EFFECTIVE_FILE
  ], { cwd: ROOT, encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Validated 1 amendment mapping\(s\) and 2 EffectiveRecord\(s\)\./);
});

test("CLI exits one on validation failure", () => {
  const result = spawnSync(process.execPath, [
    "scripts/validate_derived.js",
    "--source",
    SOURCE_FILE,
    "--amendments",
    AMENDMENT_FILE,
    "--effective",
    path.join(ROOT, "package.json")
  ], { cwd: ROOT, encoding: "utf8" });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Derived validation failed/);
});

test("CLI exits two on usage failure", () => {
  const result = spawnSync(process.execPath, ["scripts/validate_derived.js"], { cwd: ROOT, encoding: "utf8" });
  assert.equal(result.status, 2);
  assert.match(result.stderr, /Usage:/);
});

test("CLI exits two on unreadable configured file", () => {
  const result = spawnSync(process.execPath, [
    "scripts/validate_derived.js",
    "--source",
    path.join(FIXTURE_DIR, "missing_source_bundle.json"),
    "--amendments",
    AMENDMENT_FILE,
    "--effective",
    EFFECTIVE_FILE
  ], { cwd: ROOT, encoding: "utf8" });
  assert.equal(result.status, 2);
  assert.match(result.stderr, /Derived validation failed/);
});
