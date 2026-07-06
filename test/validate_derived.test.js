const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const test = require("node:test");

const {
  validateContractArtifacts,
  validateDerivedArtifacts,
  validateDerivedContractArtifact,
  validateLegacyDerivedArtifacts
} = require("../scripts/validate_derived");

const ROOT = path.resolve(__dirname, "..");
const FIXTURE_DIR = path.join(ROOT, "test", "fixtures", "derived");
const CONTRACT_FIXTURE_DIR = path.join(ROOT, "test", "fixtures", "derived_contract");
const SOURCE_FILE = path.join(FIXTURE_DIR, "minimal_source_bundle.json");
const AMENDMENT_FILE = path.join(FIXTURE_DIR, "minimal_amendment_mappings.json");
const EFFECTIVE_FILE = path.join(FIXTURE_DIR, "minimal_effective_records.json");

const sourceFixture = JSON.parse(fs.readFileSync(SOURCE_FILE, "utf8"));
const amendmentFixture = JSON.parse(fs.readFileSync(AMENDMENT_FILE, "utf8"));
const effectiveFixture = JSON.parse(fs.readFileSync(EFFECTIVE_FILE, "utf8"));

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function addOtherDocument(sourceBundle) {
  sourceBundle.documents.push({
    ...clone(sourceBundle.documents[0]),
    document_id: "other_doc",
    title: "Other Test Guideline"
  });
}

function validateCopies(mutator) {
  const sourceBundle = clone(sourceFixture);
  const amendmentArtifact = clone(amendmentFixture);
  const effectiveArtifact = clone(effectiveFixture);
  if (mutator) mutator(sourceBundle, amendmentArtifact, effectiveArtifact);
  return validateLegacyDerivedArtifacts({
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

function contractGraphArtifacts(mutator) {
  const sourceBundle = clone(sourceFixture);
  const guidanceFamilyArtifact = {
    derived_model_version: "0.1.0",
    artifact_type: "GuidanceFamily",
    regulator_profile: "core",
    records: [
      {
        guidance_family_id: "test.family",
        family_title: "Test family",
        regulator_profile: "core",
        jurisdictions: ["TEST"],
        current_risk_assessment_id: null,
        review_status: "needs_review",
        profile_details: null
      }
    ]
  };
  const documentEditionArtifact = {
    derived_model_version: "0.1.0",
    artifact_type: "DocumentEdition",
    regulator_profile: "core",
    records: [
      {
        document_edition_id: "test.edition.parent",
        guidance_family_id: "test.family",
        edition_label: "Parent",
        edition_role: "parent",
        jurisdiction: "TEST",
        publication_date: null,
        effective_date: null,
        document_status: "historical",
        current_risk_assessment_id: null,
        review_status: "needs_review",
        profile_details: null
      },
      {
        document_edition_id: "test.edition.addendum",
        guidance_family_id: "test.family",
        edition_label: "Addendum",
        edition_role: "addendum",
        jurisdiction: "TEST",
        publication_date: null,
        effective_date: null,
        document_status: "current",
        current_risk_assessment_id: null,
        review_status: "needs_review",
        profile_details: null
      }
    ]
  };
  const editionSourceArtifact = {
    derived_model_version: "0.1.0",
    artifact_type: "EditionSource",
    regulator_profile: "core",
    records: [
      {
        edition_source_id: "test.edition_source.parent",
        document_edition_id: "test.edition.parent",
        document_id: "test_doc",
        source_role: "primary",
        review_status: "needs_review",
        profile_details: null
      },
      {
        edition_source_id: "test.edition_source.addendum",
        document_edition_id: "test.edition.addendum",
        document_id: "test_doc",
        source_role: "primary",
        review_status: "needs_review",
        profile_details: null
      }
    ]
  };
  const lifecycleArtifact = {
    derived_model_version: "0.1.0",
    artifact_type: "LifecycleRelationship",
    regulator_profile: "core",
    records: [
      {
        lifecycle_relationship_id: "test.lifecycle.001",
        guidance_family_id: "test.family",
        from_document_edition_id: "test.edition.parent",
        to_document_edition_id: "test.edition.addendum",
        relationship_type: "amends",
        original_relationship_wording: "amends",
        jurisdiction: "TEST",
        source_references: [
          {
            document_id: "test_doc",
            section_id: "test.sec.addendum",
            source_unit_id: "test.su.addendum.001",
            pdf_page_index_zero_based: 1,
            printed_page_label: "2",
            source_text: "Addendum source text."
          }
        ],
        review_status: "needs_review",
        profile_details: null
      }
    ]
  };
  const amendmentArtifact = {
    derived_model_version: "0.1.0",
    artifact_type: "AmendmentMapping",
    regulator_profile: "core",
    records: [
      {
        mapping_id: "test.contract.amend.001",
        guidance_family_id: "test.family",
        source_document_edition_id: "test.edition.parent",
        amending_document_edition_id: "test.edition.addendum",
        source_record_ids: ["test.kr.parent.001"],
        amending_record_ids: ["test.kr.addendum.001"],
        relation_type: "clarifies",
        mapped_scope: "Fixture amendment scope.",
        analyst_rationale: "Fixture rationale for the amendment relationship.",
        original_relationship_wording: "clarifies",
        contextual_cross_reference_ids: [],
        contextual_cross_reference_note: null,
        source_references: [
          {
            document_id: "test_doc",
            section_id: "test.sec.parent",
            source_unit_id: "test.su.parent.001",
            pdf_page_index_zero_based: 0,
            printed_page_label: "1",
            source_text: "Parent source text."
          },
          {
            document_id: "test_doc",
            section_id: "test.sec.addendum",
            source_unit_id: "test.su.addendum.001",
            pdf_page_index_zero_based: 1,
            printed_page_label: "2",
            source_text: "Addendum source text."
          }
        ],
        review_status: "needs_review",
        profile_details: null
      }
    ]
  };
  const effectiveArtifact = {
    derived_model_version: "0.1.0",
    artifact_type: "EffectiveRecord",
    regulator_profile: "core",
    records: [
      {
        effective_record_id: "test.contract.eff.001",
        guidance_family_id: "test.family",
        document_edition_id: "test.edition.addendum",
        jurisdiction: "TEST",
        as_of_date: "2026-07-06",
        effective_status: "current",
        derivation_basis: "amendment_synthesis",
        amendment_mapping_ids: ["test.contract.amend.001"],
        contributing_record_ids: [
          "test.kr.parent.001",
          "test.kr.addendum.001",
          "test.cond.001",
          "test.qc.001",
          "test.xref.001"
        ],
        source_references: [
          {
            document_id: "test_doc",
            section_id: "test.sec.parent",
            source_unit_id: "test.su.parent.001",
            pdf_page_index_zero_based: 0,
            printed_page_label: "1",
            source_text: "Parent source text."
          },
          {
            document_id: "test_doc",
            section_id: "test.sec.addendum",
            source_unit_id: "test.su.addendum.001",
            pdf_page_index_zero_based: 1,
            printed_page_label: "2",
            source_text: "Addendum source text."
          }
        ],
        effective_text_en: "Fixture contract effective text.",
        normalized_ko: null,
        synthesis_rationale: "Fixture synthesis rationale.",
        representation_limitations: [],
        review_status: "needs_review",
        profile_details: null
      }
    ]
  };
  const artifacts = {
    guidanceFamilyArtifact,
    documentEditionArtifact,
    editionSourceArtifact,
    lifecycleArtifact,
    amendmentArtifact,
    effectiveArtifact
  };
  if (mutator) mutator(sourceBundle, artifacts);
  return { sourceBundle, ...artifacts };
}

function validateContractGraphCopies(mutator) {
  const {
    sourceBundle,
    guidanceFamilyArtifact,
    documentEditionArtifact,
    editionSourceArtifact,
    lifecycleArtifact,
    amendmentArtifact,
    effectiveArtifact
  } = contractGraphArtifacts(mutator);
  return validateContractArtifacts({
    sourceBundle,
    artifacts: [
      { artifact: guidanceFamilyArtifact, file: "contract_guidance_family.json" },
      { artifact: documentEditionArtifact, file: "contract_document_edition.json" },
      { artifact: editionSourceArtifact, file: "contract_edition_source.json" },
      { artifact: lifecycleArtifact, file: "contract_lifecycle.json" },
      { artifact: amendmentArtifact, file: "contract_amendment.json" },
      { artifact: effectiveArtifact, file: "contract_effective.json" }
    ]
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

test("valid derived contract 0.1.0 fixtures pass schema validation", () => {
  const validDir = path.join(CONTRACT_FIXTURE_DIR, "valid");
  const files = fs.readdirSync(validDir).filter((file) => file.endsWith(".json"));
  assert.equal(files.length, 13);
  for (const file of files) {
    const fixturePath = path.join(validDir, file);
    const artifact = readJson(fixturePath);
    assertValid(validateDerivedContractArtifact({ artifact, file: fixturePath }));
  }
});

test("real Phase 3 AmendmentMapping successor preserves reviewed meaning", () => {
  const legacy = readJson(path.join(ROOT, "structured_data", "derived", "s6_r1_amendment_mappings.json"))
    .amendment_mappings.find((record) => record.mapping_id === "ich_s6_r1.amend.004");
  const successor = readJson(path.join(CONTRACT_FIXTURE_DIR, "valid", "s6_r1_amendment_mapping_successor.json"));
  const record = successor.records[0];
  assertValid(validateDerivedContractArtifact({ artifact: successor, file: "s6_r1_amendment_mapping_successor.json" }));
  assert.equal(record.mapping_id, legacy.mapping_id);
  assert.deepEqual(record.source_record_ids, legacy.parent_knowledge_record_ids);
  assert.deepEqual(record.amending_record_ids, legacy.addendum_knowledge_record_ids);
  assert.equal(record.mapped_scope, legacy.mapped_scope);
  assert.equal(record.analyst_rationale, legacy.analyst_rationale);
  assert.deepEqual(record.contextual_cross_reference_ids, legacy.contextual_cross_reference_ids);
  assert.equal(record.contextual_cross_reference_note, legacy.contextual_cross_reference_note);
  assert.equal(record.review_status, legacy.review_status);
  assert.deepEqual(record.history.technical_migration_from_record_ids, [legacy.mapping_id]);
  assert.deepEqual(successor.technical_migration.source_artifact_paths, ["structured_data/derived/s6_r1_amendment_mappings.json"]);
});

test("real Phase 3 EffectiveRecord successor preserves reviewed meaning", () => {
  const legacy = readJson(path.join(ROOT, "structured_data", "derived", "s6_r1_effective_records.json"))
    .effective_records.find((record) => record.effective_record_id === "ich_s6_r1.eff.part2.2_1.animal_tcr_species_selection");
  const successor = readJson(path.join(CONTRACT_FIXTURE_DIR, "valid", "s6_r1_effective_record_successor.json"));
  const record = successor.records[0];
  assertValid(validateDerivedContractArtifact({ artifact: successor, file: "s6_r1_effective_record_successor.json" }));
  assert.equal(record.effective_record_id, legacy.effective_record_id);
  assert.deepEqual(record.amendment_mapping_ids, legacy.amendment_relation_ids);
  assert.deepEqual(record.contributing_record_ids, [
    ...legacy.knowledge_record_ids,
    ...legacy.condition_ids,
    ...legacy.quantitative_criterion_ids,
    ...legacy.cross_reference_ids
  ]);
  assert.equal(record.effective_text_en, legacy.effective_text_en);
  assert.equal(record.synthesis_rationale, legacy.synthesis_rationale);
  assert.equal(record.representation_limitations[0].limitation_text, legacy.representation_limitations[0]);
  assert.deepEqual(record.representation_limitations[0].affected_cross_reference_ids, legacy.cross_reference_ids);
  assert.equal(record.review_status, legacy.review_status);
  assert.deepEqual(record.history.technical_migration_from_record_ids, [legacy.effective_record_id]);
  assert.deepEqual(successor.technical_migration.source_artifact_paths, ["structured_data/derived/s6_r1_effective_records.json"]);
});

test("core schema does not reference the ICH profile", () => {
  const coreSchema = fs.readFileSync(path.join(ROOT, "structured_data", "schemas", "derived", "core.schema.json"), "utf8");
  assert.equal(coreSchema.includes("profiles/ich"), false);
});

test("derived contract fixtures fail on wrong version", () => {
  const fixturePath = path.join(CONTRACT_FIXTURE_DIR, "invalid", "wrong_version.json");
  const artifact = JSON.parse(fs.readFileSync(fixturePath, "utf8"));
  assertInvalid(validateDerivedContractArtifact({ artifact, file: fixturePath }), "must be equal to constant");
});

test("derived contract fixtures reject unknown closed-vocabulary relation types", () => {
  const fixturePath = path.join(CONTRACT_FIXTURE_DIR, "invalid", "unknown_relation.json");
  const artifact = JSON.parse(fs.readFileSync(fixturePath, "utf8"));
  assertInvalid(validateDerivedContractArtifact({ artifact, file: fixturePath }), "must be equal to one of the allowed values");
});

test("derived contract core records reject direct ICH field leakage", () => {
  const fixturePath = path.join(CONTRACT_FIXTURE_DIR, "invalid", "ich_field_leak.json");
  const artifact = JSON.parse(fs.readFileSync(fixturePath, "utf8"));
  assertInvalid(validateDerivedContractArtifact({ artifact, file: fixturePath }), "must NOT have additional properties");
});

test("derived contract core artifacts reject ICH profile details", () => {
  const fixturePath = path.join(CONTRACT_FIXTURE_DIR, "invalid", "core_profile_details.json");
  const artifact = JSON.parse(fs.readFileSync(fixturePath, "utf8"));
  assertInvalid(validateDerivedContractArtifact({ artifact, file: fixturePath }), "must be null for regulator-neutral core artifacts");
});

test("relevant ICH EffectiveRecords require profile details", () => {
  const fixturePath = path.join(CONTRACT_FIXTURE_DIR, "invalid", "ich_effective_missing_profile_details.json");
  const artifact = JSON.parse(fs.readFileSync(fixturePath, "utf8"));
  assertInvalid(validateDerivedContractArtifact({ artifact, file: fixturePath }), "must be object");
});

test("non-relevant ICH EffectiveRecords do not require derivation-specific profile details", () => {
  const fixturePath = path.join(CONTRACT_FIXTURE_DIR, "valid", "effective_record_ich_direct_source.json");
  const artifact = JSON.parse(fs.readFileSync(fixturePath, "utf8"));
  assertValid(validateDerivedContractArtifact({ artifact, file: fixturePath }));
});

test("metadata artifacts do not require derivation-specific ICH fields", () => {
  for (const file of ["guidance_family.json", "review_attestation.json", "risk_assessment.json"]) {
    const fixturePath = path.join(CONTRACT_FIXTURE_DIR, "valid", file);
    const artifact = JSON.parse(fs.readFileSync(fixturePath, "utf8"));
    assertValid(validateDerivedContractArtifact({ artifact, file: fixturePath }));
  }
});

test("successor artifacts can represent technical migration provenance", () => {
  const fixturePath = path.join(CONTRACT_FIXTURE_DIR, "valid", "effective_record_migrated_successor.json");
  const artifact = JSON.parse(fs.readFileSync(fixturePath, "utf8"));
  assertValid(validateDerivedContractArtifact({ artifact, file: fixturePath }));
});

test("contract graph validation passes after schema validation for valid contract artifacts", () => {
  assertValid(validateContractGraphCopies());
});

test("minimal complete registry graph passes", () => {
  assertValid(validateContractGraphCopies());
});

test("LifecycleRelationship rejects missing editions", () => {
  assertInvalid(validateContractGraphCopies((source, artifacts) => {
    artifacts.lifecycleArtifact.records[0].to_document_edition_id = "test.edition.missing";
  }), "reference does not resolve to DocumentEdition: test.edition.missing");
});

test("LifecycleRelationship rejects cross-family editions", () => {
  assertInvalid(validateContractGraphCopies((source, artifacts) => {
    artifacts.guidanceFamilyArtifact.records.push({
      ...clone(artifacts.guidanceFamilyArtifact.records[0]),
      guidance_family_id: "other.family",
      family_title: "Other family"
    });
    artifacts.documentEditionArtifact.records[1].guidance_family_id = "other.family";
  }), "DocumentEdition guidance_family_id must match LifecycleRelationship guidance_family_id");
});

test("LifecycleRelationship source references resolve correctly", () => {
  assertInvalid(validateContractGraphCopies((source, artifacts) => {
    artifacts.lifecycleArtifact.records[0].source_references[0].source_unit_id = "test.su.missing";
  }), "reference does not resolve to source_units: test.su.missing");
});

test("LifecycleRelationship self-relations are rejected", () => {
  assertInvalid(validateContractGraphCopies((source, artifacts) => {
    artifacts.lifecycleArtifact.records[0].to_document_edition_id = "test.edition.parent";
  }), "self-relations are not supported");
});

test("EditionSource rejects an unknown source Document", () => {
  assertInvalid(validateContractGraphCopies((source, artifacts) => {
    artifacts.editionSourceArtifact.records[0].document_id = "missing_doc";
  }), "reference does not resolve to documents: missing_doc");
});

test("EffectiveRecord rejects source documents not authorized by EditionSource", () => {
  assertInvalid(validateContractGraphCopies((source, artifacts) => {
    addOtherDocument(source);
    artifacts.effectiveArtifact.records[0].source_references[0].document_id = "other_doc";
  }), "is not authorized by EditionSource");
});

test("AmendmentMapping rejects edition/family mismatch", () => {
  assertInvalid(validateContractGraphCopies((source, artifacts) => {
    artifacts.amendmentArtifact.records[0].source_document_edition_id = "test.edition.addendum";
    artifacts.documentEditionArtifact.records[1].guidance_family_id = "other.family";
  }), "DocumentEdition guidance_family_id must match mapping guidance_family_id");
});

test("EffectiveRecord rejects edition/family mismatch", () => {
  assertInvalid(validateContractGraphCopies((source, artifacts) => {
    artifacts.documentEditionArtifact.records[1].guidance_family_id = "other.family";
  }), "DocumentEdition guidance_family_id must match EffectiveRecord guidance_family_id");
});

test("contract graph validation rejects unresolved source IDs", () => {
  assertInvalid(validateContractGraphCopies((source, artifacts) => {
    artifacts.amendmentArtifact.records[0].source_record_ids[0] = "test.kr.missing";
  }), "reference does not resolve to knowledge_records: test.kr.missing");
});

test("contract graph validation rejects incomplete mapping endpoint coverage", () => {
  assertInvalid(validateContractGraphCopies((source, artifacts) => {
    artifacts.effectiveArtifact.records[0].contributing_record_ids = artifacts.effectiveArtifact.records[0].contributing_record_ids.filter((id) => id !== "test.kr.parent.001");
  }), "missing source endpoint coverage");
});

test("contract graph validation rejects incomplete provenance closure", () => {
  assertInvalid(validateContractGraphCopies((source, artifacts) => {
    artifacts.effectiveArtifact.records[0].source_references = artifacts.effectiveArtifact.records[0].source_references.filter((ref) => ref.source_unit_id !== "test.su.addendum.001");
  }), "direct SourceUnit test.su.addendum.001 is not included");
});

test("contract graph validation rejects unauthorized cross-family synthesis", () => {
  assertInvalid(validateContractGraphCopies((source, artifacts) => {
    artifacts.amendmentArtifact.records[0].guidance_family_id = "other.family";
  }), "unauthorized cross-family synthesis");
});

test("reviewed contract EffectiveRecord rejects unreviewed CrossReference without structured limitation", () => {
  assertInvalid(validateContractGraphCopies((source, artifacts) => {
    artifacts.amendmentArtifact.records[0].review_status = "reviewed";
    artifacts.effectiveArtifact.records[0].review_status = "reviewed";
  }), "must be documented in structured representation_limitations");
});

test("reviewed contract EffectiveRecord accepts unresolved CrossReference with structured limitation", () => {
  assertValid(validateContractGraphCopies((source, artifacts) => {
    artifacts.amendmentArtifact.records[0].review_status = "reviewed";
    artifacts.effectiveArtifact.records[0].review_status = "reviewed";
    artifacts.effectiveArtifact.records[0].representation_limitations = [
      {
        limitation_text: "Fixture CrossReference remains unresolved in the source model.",
        affected_cross_reference_ids: ["test.xref.001"],
        affected_record_ids: ["test.su.addendum.001"]
      }
    ];
  }));
});

test("structured representation limitations require grounded affected IDs", () => {
  assertInvalid(validateContractGraphCopies((source, artifacts) => {
    artifacts.effectiveArtifact.records[0].representation_limitations = [
      {
        limitation_text: "Ungrounded limitation.",
        affected_cross_reference_ids: [],
        affected_record_ids: ["test.kr.unused"]
      }
    ];
  }), "reference does not resolve to source or contract evidence: test.kr.unused");
});

test("structured representation limitations reject free-form notes without affected IDs", () => {
  const artifact = readJson(path.join(CONTRACT_FIXTURE_DIR, "valid", "effective_record.json"));
  artifact.records[0].representation_limitations = [
    {
      limitation_text: "Free-form limitation without a grounded target.",
      affected_cross_reference_ids: [],
      affected_record_ids: []
    }
  ];
  assertInvalid(validateDerivedContractArtifact({ artifact, file: "effective_record.json" }), "must match a schema in anyOf");
});

test("real S6 successor graph preserves reviewed unresolved CrossReference with structured limitation", () => {
  const sourceBundle = readJson(path.join(ROOT, "structured_data", "pilots", "s6_r1_species_selection.json"));
  const amendmentArtifact = readJson(path.join(CONTRACT_FIXTURE_DIR, "valid", "s6_r1_amendment_mapping_successor.json"));
  const effectiveArtifact = readJson(path.join(CONTRACT_FIXTURE_DIR, "valid", "s6_r1_effective_record_successor.json"));
  const guidanceFamilyArtifact = {
    derived_model_version: "0.1.0",
    artifact_type: "GuidanceFamily",
    regulator_profile: "core",
    records: [
      {
        guidance_family_id: "fixture.family.ich_s6",
        family_title: "ICH S6",
        regulator_profile: "core",
        jurisdictions: ["ICH"],
        current_risk_assessment_id: null,
        review_status: "needs_review",
        profile_details: null
      }
    ]
  };
  const documentEditionArtifact = {
    derived_model_version: "0.1.0",
    artifact_type: "DocumentEdition",
    regulator_profile: "core",
    records: [
      {
        document_edition_id: "fixture.edition.s6.parent",
        guidance_family_id: "fixture.family.ich_s6",
        edition_label: "Parent guideline",
        edition_role: "parent",
        jurisdiction: "ICH",
        publication_date: null,
        effective_date: null,
        document_status: "historical",
        current_risk_assessment_id: null,
        review_status: "needs_review",
        profile_details: null
      },
      {
        document_edition_id: "fixture.edition.s6.addendum",
        guidance_family_id: "fixture.family.ich_s6",
        edition_label: "Addendum",
        edition_role: "addendum",
        jurisdiction: "ICH",
        publication_date: null,
        effective_date: null,
        document_status: "current",
        current_risk_assessment_id: null,
        review_status: "needs_review",
        profile_details: null
      }
    ]
  };
  const editionSourceArtifact = {
    derived_model_version: "0.1.0",
    artifact_type: "EditionSource",
    regulator_profile: "core",
    records: [
      {
        edition_source_id: "fixture.edition_source.s6.parent",
        document_edition_id: "fixture.edition.s6.parent",
        document_id: "ich_s6_r1",
        source_role: "primary",
        review_status: "needs_review",
        profile_details: null
      },
      {
        edition_source_id: "fixture.edition_source.s6.addendum",
        document_edition_id: "fixture.edition.s6.addendum",
        document_id: "ich_s6_r1",
        source_role: "primary",
        review_status: "needs_review",
        profile_details: null
      }
    ]
  };
  assertValid(validateContractArtifacts({
    sourceBundle,
    artifacts: [
      { artifact: guidanceFamilyArtifact, file: "s6_guidance_family.json" },
      { artifact: documentEditionArtifact, file: "s6_document_edition.json" },
      { artifact: editionSourceArtifact, file: "s6_edition_source.json" },
      { artifact: amendmentArtifact, file: "s6_amendment_successor.json" },
      { artifact: effectiveArtifact, file: "s6_effective_successor.json" }
    ]
  }));
});

test("AmendmentMapping rejects empty source endpoints", () => {
  const artifact = readJson(path.join(CONTRACT_FIXTURE_DIR, "valid", "amendment_mapping.json"));
  artifact.records[0].source_record_ids = [];
  assertInvalid(validateDerivedContractArtifact({ artifact, file: "amendment_mapping.json" }), "must NOT have fewer than 1 items");
});

test("AmendmentMapping rejects empty amending endpoints", () => {
  const artifact = readJson(path.join(CONTRACT_FIXTURE_DIR, "valid", "amendment_mapping.json"));
  artifact.records[0].amending_record_ids = [];
  assertInvalid(validateDerivedContractArtifact({ artifact, file: "amendment_mapping.json" }), "must NOT have fewer than 1 items");
});

test("EffectiveRecord rejects empty contributors", () => {
  const artifact = readJson(path.join(CONTRACT_FIXTURE_DIR, "valid", "effective_record.json"));
  artifact.records[0].contributing_record_ids = [];
  assertInvalid(validateDerivedContractArtifact({ artifact, file: "effective_record.json" }), "must NOT have fewer than 1 items");
});

test("amendment_synthesis rejects empty amendment mapping IDs", () => {
  const artifact = readJson(path.join(CONTRACT_FIXTURE_DIR, "valid", "effective_record.json"));
  artifact.records[0].derivation_basis = "amendment_synthesis";
  artifact.records[0].amendment_mapping_ids = [];
  assertInvalid(validateDerivedContractArtifact({ artifact, file: "effective_record.json" }), "must NOT have fewer than 1 items");
});

test("direct-source records allow empty amendment mapping IDs", () => {
  const artifact = readJson(path.join(CONTRACT_FIXTURE_DIR, "valid", "effective_record_ich_direct_source.json"));
  artifact.records[0].amendment_mapping_ids = [];
  assertValid(validateDerivedContractArtifact({ artifact, file: "effective_record_ich_direct_source.json" }));
});

test("public dispatch validates contract artifacts with contract-aware graph checks", () => {
  const { sourceBundle, amendmentArtifact, effectiveArtifact } = contractGraphArtifacts();
  assertValid(validateDerivedArtifacts({
    sourceBundle,
    amendmentArtifact,
    effectiveArtifact,
    files: {
      sourceFile: SOURCE_FILE,
      amendmentFile: "contract_amendment.json",
      effectiveFile: "contract_effective.json"
    }
  }));
});

test("legacy Phase 3 prototype paths are exempt from 0.1.0 schema enforcement", () => {
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

test("legacy-shaped artifacts outside exact Phase 3 paths fail public dispatch", () => {
  assertInvalid(validateDerivedArtifacts({
    sourceBundle: sourceFixture,
    amendmentArtifact: clone(amendmentFixture),
    effectiveArtifact: clone(effectiveFixture),
    files: {
      sourceFile: SOURCE_FILE,
      amendmentFile: path.join(CONTRACT_FIXTURE_DIR, "copied_legacy_amendment.json"),
      effectiveFile: path.join(CONTRACT_FIXTURE_DIR, "copied_legacy_effective.json")
    }
  }), "derived contract artifacts must declare derived_model_version and artifact_type");
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

test("amendment artifact layer must be amendment_mapping", () => {
  assertInvalid(validateCopies((source, amendments) => {
    amendments.artifact.layer = "effective_state";
  }), "minimal_amendment_mappings.json artifact.layer: must equal amendment_mapping; found effective_state");
});

test("effective artifact layer must be effective_state", () => {
  assertInvalid(validateCopies((source, amendments, effective) => {
    effective.artifact.layer = "amendment_mapping";
  }), "minimal_effective_records.json artifact.layer: must equal effective_state; found amendment_mapping");
});

test("amendment and effective artifact document IDs must match", () => {
  assertInvalid(validateCopies((source, amendments) => {
    addOtherDocument(source);
    amendments.artifact.document_id = "other_doc";
  }), "minimal_effective_records.json artifact.document_id: must equal amendment artifact document_id other_doc; found test_doc");
});

test("EffectiveRecord edition_context document_id must match effective artifact document_id", () => {
  assertInvalid(validateCopies((source, amendments, effective) => {
    addOtherDocument(source);
    effective.effective_records[0].edition_context.document_id = "other_doc";
  }), "test.eff.001 edition_context.document_id: must equal effective artifact document_id test_doc; found other_doc");
});

test("EffectiveRecord SourceUnit document_id must match edition_context document_id", () => {
  assertInvalid(validateCopies((source) => {
    source.source_units[1].document_id = "other_doc";
  }), "test.eff.001 source_unit_ids: SourceUnit test.su.addendum.001 document_id must equal edition_context.document_id test_doc; found other_doc");
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
    path.join(ROOT, "structured_data", "pilots", "s6_r1_species_selection.json"),
    "--amendments",
    path.join(ROOT, "structured_data", "derived", "s6_r1_amendment_mappings.json"),
    "--effective",
    path.join(ROOT, "structured_data", "derived", "s6_r1_effective_records.json")
  ], { cwd: ROOT, encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Validated 4 amendment mapping\(s\) and 4 EffectiveRecord\(s\)\./);
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
