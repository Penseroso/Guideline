const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const { validateBundles } = require("../scripts/validate_structured_data");

const ROOT = path.resolve(__dirname, "..");
const PILOT_3_2_5_2 = path.join(ROOT, "structured_data", "pilots", "m10_3_2_5_2.json");
const PILOT_6_1 = path.join(ROOT, "structured_data", "pilots", "m10_6_1.json");

const pilot3252 = JSON.parse(fs.readFileSync(PILOT_3_2_5_2, "utf8"));
const pilot61 = JSON.parse(fs.readFileSync(PILOT_6_1, "utf8"));

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function validatePilotCopies(mutator) {
  const first = clone(pilot3252);
  const second = clone(pilot61);
  if (mutator) mutator(first, second);
  return validateBundles([
    { file: "m10_3_2_5_2.json", bundle: first },
    { file: "m10_6_1.json", bundle: second }
  ]);
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

function addOtherDocument(bundle) {
  bundle.documents.push({
    ...clone(bundle.documents[0]),
    document_id: "test.other_document"
  });
}

test("valid two-bundle validation passes", () => {
  assertValid(validatePilotCopies());
});

test("duplicate primary ID fails", () => {
  const result = validatePilotCopies((first) => {
    first.knowledge_records[0].knowledge_record_id = first.source_units[0].source_unit_id;
  });

  assertInvalid(result, "duplicate primary ID also used by source_units");
});

test("unresolved local reference fails", () => {
  const result = validatePilotCopies((first) => {
    first.knowledge_records[0].source_unit_ids[0] = "test.missing_source_unit";
  });

  assertInvalid(result, "reference does not resolve inside this bundle: test.missing_source_unit");
});

test("repeated non-context Section across files fails", () => {
  const result = validatePilotCopies((first, second) => {
    const repeatedSection = {
      section_id: "test.sec.repeated_non_context",
      document_id: "ich_m10",
      section_number: "T",
      title: "Repeated non-context section",
      parent_section_id: null,
      section_order: null,
      section_order_status: "unknown",
      heading_source_unit_id: null
    };
    first.sections.push(clone(repeatedSection));
    second.sections.push(clone(repeatedSection));
    first.source_units.push({
      source_unit_id: "test.su.repeated_non_context.001",
      document_id: "ich_m10",
      section_id: repeatedSection.section_id,
      unit_type: "paragraph",
      unit_order: 1,
      unit_order_status: "known",
      source_text: "Synthetic source unit for validator regression testing.",
      related_source_unit_ids: [],
      table_context: null,
      trace: {
        source_file_path: "Guideline Files/ICH M10.pdf",
        document_id: "ich_m10",
        section_id: repeatedSection.section_id,
        pdf_page_index_zero_based: 13,
        pdf_page_index_status: "known",
        printed_page_label: "14",
        printed_page_label_status: "known",
        extraction_method: "validator regression test"
      },
      review_status: "reviewed"
    });
  });

  assertInvalid(result, "repeated Section must be context-only in every bundle where it appears");
});

test("repeated identical context-only ancestor Section passes", () => {
  const result = validatePilotCopies((first, second) => {
    const ancestorSection = {
      section_id: "test.sec.context_only_ancestor",
      document_id: "ich_m10",
      section_number: "T",
      title: "Context-only ancestor",
      parent_section_id: null,
      section_order: null,
      section_order_status: "unknown",
      heading_source_unit_id: null
    };
    first.sections.push(clone(ancestorSection));
    second.sections.push(clone(ancestorSection));
    first.sections[0].parent_section_id = ancestorSection.section_id;
    second.sections[0].parent_section_id = ancestorSection.section_id;
  });

  assertValid(result);
});

test("mismatched SourceUnit and Section document_id fails", () => {
  const result = validatePilotCopies((first) => {
    addOtherDocument(first);
    first.source_units[0].document_id = "test.other_document";
    first.source_units[0].trace.document_id = "test.other_document";
  });

  assertInvalid(result, "referenced Section must have the same document_id");
});

test("mismatched parent and child Section documents fails", () => {
  const result = validatePilotCopies((first) => {
    addOtherDocument(first);
    first.sections[1].document_id = "test.other_document";
  });

  assertInvalid(result, "parent Section must have the same document_id");
});

test("invalid heading_source_unit_id fails", () => {
  const result = validatePilotCopies((first) => {
    first.sections[3].heading_source_unit_id = "ich_m10.su.3_2_5_2.002";
  });

  assertInvalid(result, "is not a heading SourceUnit");
});

test("duplicate and non-increasing SourceUnit order fails", () => {
  const result = validatePilotCopies((first) => {
    first.source_units[1].unit_order = first.source_units[0].unit_order;
  });

  assertInvalid(result, "must increase within section ich_m10.sec.3_2_5_2");
  assertInvalid(result, "duplicates ich_m10.su.3_2_5_2.001 in section ich_m10.sec.3_2_5_2");
});

test("value_status known with neither value type fails", () => {
  const result = validatePilotCopies((first) => {
    first.quantitative_criteria[0].value = null;
    first.quantitative_criteria[0].value_fraction = null;
  });

  assertInvalid(result, "known requires exactly one of value or value_fraction");
});

test("value_status known with both value types fails", () => {
  const result = validatePilotCopies((first) => {
    first.quantitative_criteria[0].value_fraction = {
      numerator: 1,
      denominator: 2
    };
  });

  assertInvalid(result, "known requires exactly one of value or value_fraction");
});

test("zero fraction denominator fails", () => {
  const result = validatePilotCopies((first) => {
    first.quantitative_criteria[9].value_fraction.denominator = 0;
  });

  assertInvalid(result, "must be greater than zero");
});

test("negative fraction denominator fails", () => {
  const result = validatePilotCopies((first) => {
    first.quantitative_criteria[9].value_fraction.denominator = -1;
  });

  assertInvalid(result, "must be greater than zero");
});

test("unresolved CrossReference with non-null target_id fails", () => {
  const result = validatePilotCopies((first) => {
    first.cross_references.push({
      xref_id: "test.xref.unresolved_non_null_target",
      source_unit_id: "ich_m10.su.3_2_5_2.001",
      raw_reference_text: "Synthetic unresolved reference",
      target_type: "section",
      target_document_label: null,
      target_id: "ich_m10.sec.3_2_5_2",
      resolution_status: "unresolved",
      review_status: "reviewed"
    });
  });

  assertInvalid(result, "unresolved or needs_review CrossReference must use null target_id");
});

test("provenance source path mismatch fails", () => {
  const result = validatePilotCopies((first) => {
    first.source_units[0].trace.source_file_path = "Guideline Files/Other.pdf";
  });

  assertInvalid(result, "must match Document.source_file_path");
});

test("trace document_id mismatch fails", () => {
  const result = validatePilotCopies((first) => {
    first.source_units[0].trace.document_id = "test.other_document";
  });

  assertInvalid(result, "must match SourceUnit.document_id");
});

test("trace section_id mismatch fails", () => {
  const result = validatePilotCopies((first) => {
    first.source_units[0].trace.section_id = "ich_m10.sec.3_2_5";
  });

  assertInvalid(result, "must match SourceUnit.section_id");
});
