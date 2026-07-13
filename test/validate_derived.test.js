const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const test = require("node:test");

const {
  validateContractArtifacts,
  validateDerivedContractArtifact,
  validateDerivedManifestFile
} = require("../scripts/validate_derived");
const {
  validateLegacyDerivedArtifacts
} = require("../scripts/validate_legacy_derived");

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
          },
          {
            document_id: "test_doc",
            section_id: "test.sec.addendum",
            source_unit_id: "test.su.addendum.001",
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
          },
          {
            document_id: "test_doc",
            section_id: "test.sec.addendum",
            source_unit_id: "test.su.addendum.001",
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

test("S6-style AmendmentMapping regression fixture preserves rationale and contextual evidence fields", () => {
  const artifact = readJson(path.join(CONTRACT_FIXTURE_DIR, "valid", "s6_r1_amendment_mapping_regression.json"));
  const record = artifact.records[0];
  assertValid(validateDerivedContractArtifact({ artifact, file: "s6_r1_amendment_mapping_regression.json" }));
  assert.equal(record.mapped_scope.length > 0, true);
  assert.equal(record.analyst_rationale.length > 0, true);
  assert.deepEqual(record.contextual_cross_reference_ids, ["ich_s6_r1.xref.part2.2_1.001"]);
  assert.equal(record.contextual_cross_reference_note.length > 0, true);
});

test("S6-style EffectiveRecord regression fixture preserves synthesis rationale and structured limitations", () => {
  const artifact = readJson(path.join(CONTRACT_FIXTURE_DIR, "valid", "s6_r1_effective_record_regression.json"));
  const record = artifact.records[0];
  assertValid(validateDerivedContractArtifact({ artifact, file: "s6_r1_effective_record_regression.json" }));
  assert.equal(record.synthesis_rationale.length > 0, true);
  assert.equal(record.representation_limitations[0].limitation_text.length > 0, true);
  assert.deepEqual(record.representation_limitations[0].affected_cross_reference_ids, ["ich_s6_r1.xref.part2.2_1.001"]);
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

test("contract artifacts can represent semantic predecessor history", () => {
  const fixturePath = path.join(CONTRACT_FIXTURE_DIR, "valid", "effective_record_history_example.json");
  const artifact = JSON.parse(fs.readFileSync(fixturePath, "utf8"));
  assertValid(validateDerivedContractArtifact({ artifact, file: fixturePath }));
});

test("contract graph validation passes after schema validation for valid contract artifacts", () => {
  assertValid(validateContractGraphCopies());
});

test("minimal complete registry graph passes", () => {
  assertValid(validateContractGraphCopies());
});

test("contract source references do not store duplicated page or text fields", () => {
  const files = fs.readdirSync(path.join(CONTRACT_FIXTURE_DIR, "valid")).filter((file) => file.endsWith(".json"));
  const serializedFixtures = files.map((file) => fs.readFileSync(path.join(CONTRACT_FIXTURE_DIR, "valid", file), "utf8")).join("\n");
  const coreSchema = fs.readFileSync(path.join(ROOT, "structured_data", "schemas", "derived", "core.schema.json"), "utf8");
  for (const forbidden of ["pdf_page_index_zero_based", "printed_page_label", "source_text"]) {
    assert.equal(coreSchema.includes(forbidden), false);
    assert.equal(serializedFixtures.includes(forbidden), false);
  }
});

test("contract source references reject a Section from another Document", () => {
  assertInvalid(validateContractGraphCopies((source) => {
    addOtherDocument(source);
    source.sections[0].document_id = "other_doc";
  }), "Section test.sec.parent document_id must match source reference document_id test_doc");
});

test("contract source references reject a SourceUnit from another Document", () => {
  assertInvalid(validateContractGraphCopies((source) => {
    addOtherDocument(source);
    source.source_units[0].document_id = "other_doc";
  }), "SourceUnit test.su.parent.001 document_id must match source reference document_id test_doc");
});

test("contract source references reject a SourceUnit from another Section", () => {
  assertInvalid(validateContractGraphCopies((source) => {
    source.source_units[0].section_id = "test.sec.addendum";
  }), "SourceUnit test.su.parent.001 section_id must match source reference section_id test.sec.parent");
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

test("LifecycleRelationship rejects unauthorized evidence Documents", () => {
  assertInvalid(validateContractGraphCopies((source, artifacts) => {
    addOtherDocument(source);
    source.sections.push({ ...clone(source.sections[1]), section_id: "other.sec", document_id: "other_doc" });
    source.source_units.push({ ...clone(source.source_units[1]), source_unit_id: "other.su", document_id: "other_doc", section_id: "other.sec" });
    artifacts.lifecycleArtifact.records[0].source_references = [{ document_id: "other_doc", section_id: "other.sec", source_unit_id: "other.su" }];
  }), "source document other_doc is not authorized by EditionSource");
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

test("DocumentEdition jurisdiction must be listed in its GuidanceFamily", () => {
  assertInvalid(validateContractGraphCopies((source, artifacts) => {
    artifacts.documentEditionArtifact.records[0].jurisdiction = "OTHER";
  }), "must be listed in GuidanceFamily jurisdictions");
});

test("EffectiveRecord jurisdiction must match its DocumentEdition", () => {
  assertInvalid(validateContractGraphCopies((source, artifacts) => {
    artifacts.effectiveArtifact.records[0].jurisdiction = "OTHER";
  }), "EffectiveRecord jurisdiction must match DocumentEdition jurisdiction");
});

test("LifecycleRelationship jurisdiction must match both editions", () => {
  assertInvalid(validateContractGraphCopies((source, artifacts) => {
    artifacts.lifecycleArtifact.records[0].jurisdiction = "OTHER";
  }), "LifecycleRelationship jurisdiction must match source DocumentEdition jurisdiction");
});

test("contract graph validation rejects unresolved source IDs", () => {
  assertInvalid(validateContractGraphCopies((source, artifacts) => {
    artifacts.amendmentArtifact.records[0].source_record_ids[0] = "test.kr.missing";
  }), "reference does not resolve to knowledge_records: test.kr.missing");
});

test("AmendmentMapping rejects missing source endpoint SourceUnit evidence", () => {
  assertInvalid(validateContractGraphCopies((source, artifacts) => {
    artifacts.amendmentArtifact.records[0].source_references = artifacts.amendmentArtifact.records[0].source_references.filter((ref) => ref.source_unit_id !== "test.su.parent.001");
  }), "KnowledgeRecord test.kr.parent.001 direct SourceUnit test.su.parent.001 is not included");
});

test("AmendmentMapping rejects missing amending endpoint SourceUnit evidence", () => {
  assertInvalid(validateContractGraphCopies((source, artifacts) => {
    artifacts.amendmentArtifact.records[0].source_references = artifacts.amendmentArtifact.records[0].source_references.filter((ref) => ref.source_unit_id !== "test.su.addendum.001");
  }), "KnowledgeRecord test.kr.addendum.001 direct SourceUnit test.su.addendum.001 is not included");
});

test("AmendmentMapping rejects contextual CrossReference without SourceUnit evidence", () => {
  assertInvalid(validateContractGraphCopies((source, artifacts) => {
    artifacts.amendmentArtifact.records[0].contextual_cross_reference_ids = ["test.xref.001"];
    artifacts.amendmentArtifact.records[0].contextual_cross_reference_note = "Fixture contextual reference.";
    artifacts.amendmentArtifact.records[0].source_references = artifacts.amendmentArtifact.records[0].source_references.filter((ref) => ref.source_unit_id !== "test.su.addendum.001");
  }), "CrossReference test.xref.001 direct SourceUnit test.su.addendum.001 is not included");
});

test("AmendmentMapping rejects source endpoint evidence authorized only by amending edition", () => {
  assertInvalid(validateContractGraphCopies((source, artifacts) => {
    addOtherDocument(source);
    artifacts.editionSourceArtifact.records[0].document_id = "other_doc";
  }), "SourceUnit test.su.parent.001 document test_doc is not authorized by EditionSource for DocumentEdition test.edition.parent");
});

test("AmendmentMapping rejects amending endpoint evidence authorized only by source edition", () => {
  assertInvalid(validateContractGraphCopies((source, artifacts) => {
    addOtherDocument(source);
    artifacts.editionSourceArtifact.records[1].document_id = "other_doc";
  }), "SourceUnit test.su.addendum.001 document test_doc is not authorized by EditionSource for DocumentEdition test.edition.addendum");
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

test("EffectiveRecord rejects direct SourceUnit contributor missing from source references", () => {
  assertInvalid(validateContractGraphCopies((source, artifacts) => {
    artifacts.effectiveArtifact.records[0].derivation_basis = "direct_source";
    artifacts.effectiveArtifact.records[0].amendment_mapping_ids = [];
    artifacts.effectiveArtifact.records[0].contributing_record_ids = ["test.su.parent.001"];
    artifacts.effectiveArtifact.records[0].source_references = [{ document_id: "test_doc", section_id: "test.sec.addendum", source_unit_id: "test.su.addendum.001" }];
  }), "SourceUnit test.su.parent.001 direct SourceUnit test.su.parent.001 is not included");
});

test("EffectiveRecord allows direct SourceUnit contributor with source reference", () => {
  assertValid(validateContractGraphCopies((source, artifacts) => {
    artifacts.effectiveArtifact.records[0].derivation_basis = "direct_source";
    artifacts.effectiveArtifact.records[0].amendment_mapping_ids = [];
    artifacts.effectiveArtifact.records[0].contributing_record_ids = ["test.su.parent.001"];
    artifacts.effectiveArtifact.records[0].source_references = [{ document_id: "test_doc", section_id: "test.sec.parent", source_unit_id: "test.su.parent.001" }];
  }));
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

test("duplicate contract IDs within one artifact fail", () => {
  assertInvalid(validateContractGraphCopies((source, artifacts) => {
    artifacts.documentEditionArtifact.records[1].document_edition_id = "test.edition.parent";
  }), "duplicate contract record ID");
});

test("duplicate contract IDs across files fail", () => {
  const graph = contractGraphArtifacts();
  const duplicateAmendmentArtifact = clone(graph.amendmentArtifact);
  assertInvalid(validateContractArtifacts({
    sourceBundle: graph.sourceBundle,
    artifacts: [
      { artifact: graph.amendmentArtifact, file: "amendment_a.json" },
      { artifact: duplicateAmendmentArtifact, file: "amendment_b.json" }
    ]
  }), "duplicate contract record ID");
});

test("duplicate contract IDs across artifact types fail", () => {
  assertInvalid(validateContractGraphCopies((source, artifacts) => {
    artifacts.guidanceFamilyArtifact.records[0].guidance_family_id = "test.contract.amend.001";
  }), "duplicate contract record ID");
});

test("predecessor self-reference fails", () => {
  assertInvalid(validateContractGraphCopies((source, artifacts) => {
    artifacts.effectiveArtifact.records[0].history = { predecessor_record_ids: ["test.contract.eff.001"] };
  }), "must not reference the current record ID");
});

test("supplied-record predecessor cycles fail", () => {
  assertInvalid(validateContractGraphCopies((source, artifacts) => {
    const second = clone(artifacts.effectiveArtifact.records[0]);
    second.effective_record_id = "test.contract.eff.002";
    second.history = { predecessor_record_ids: ["test.contract.eff.001"] };
    artifacts.effectiveArtifact.records[0].history = { predecessor_record_ids: ["test.contract.eff.002"] };
    artifacts.effectiveArtifact.records.push(second);
  }), "predecessor cycle detected");
});

test("predecessor referencing a different supplied artifact type fails", () => {
  assertInvalid(validateContractGraphCopies((source, artifacts) => {
    artifacts.effectiveArtifact.records[0].history = { predecessor_record_ids: ["test.family"] };
  }), "predecessor test.family must have the same artifact_type EffectiveRecord; found GuidanceFamily");
});

test("predecessor referencing the same supplied artifact type passes", () => {
  assertValid(validateContractGraphCopies((source, artifacts) => {
    const second = clone(artifacts.effectiveArtifact.records[0]);
    second.effective_record_id = "test.contract.eff.002";
    second.history = { predecessor_record_ids: ["test.contract.eff.001"] };
    artifacts.effectiveArtifact.records.push(second);
  }));
});

test("predecessor IDs absent from the supplied graph are allowed", () => {
  assertValid(validateContractGraphCopies((source, artifacts) => {
    artifacts.effectiveArtifact.records[0].history = { predecessor_record_ids: ["legacy.effective.not_in_graph"] };
  }));
});

test("derived validation revalidates the supplied source bundle and fails on an invalid source bundle", () => {
  const result = validateDerivedManifestFile({
    manifestFile: path.join(CONTRACT_FIXTURE_DIR, "invalid_source", "manifest.json")
  });
  assertInvalid(result, "reference does not resolve inside this bundle: test.sec.nonexistent");
});

test("derived graph validation does not run when source validation fails", () => {
  const result = validateDerivedManifestFile({
    manifestFile: path.join(CONTRACT_FIXTURE_DIR, "invalid_source", "manifest.json")
  });
  assert.equal(result.ok, false);
  assert.equal(
    result.errors.some((error) => error.includes("does not resolve to knowledge_records: test.kr.parent.001")),
    false,
    `derived graph validation should not have run, got:\n${result.errors.join("\n")}`
  );
});

test("source-unit-level evidence rejects a missing section_id", () => {
  const artifact = readJson(path.join(CONTRACT_FIXTURE_DIR, "valid", "lifecycle_relationship.json"));
  delete artifact.records[0].source_references[0].section_id;
  assertInvalid(validateDerivedContractArtifact({ artifact, file: "lifecycle_relationship.json" }), "must have required property 'section_id'");
});

test("source-unit-level evidence rejects a missing source_unit_id", () => {
  const artifact = readJson(path.join(CONTRACT_FIXTURE_DIR, "valid", "lifecycle_relationship.json"));
  delete artifact.records[0].source_references[0].source_unit_id;
  assertInvalid(validateDerivedContractArtifact({ artifact, file: "lifecycle_relationship.json" }), "must have required property 'source_unit_id'");
});

function contractArtifactsWithoutEditionSource(mutator) {
  const graph = contractGraphArtifacts(mutator);
  return validateContractArtifacts({
    sourceBundle: graph.sourceBundle,
    artifacts: [
      { artifact: graph.guidanceFamilyArtifact, file: "contract_guidance_family.json" },
      { artifact: graph.documentEditionArtifact, file: "contract_document_edition.json" },
      { artifact: graph.lifecycleArtifact, file: "contract_lifecycle.json" },
      { artifact: graph.amendmentArtifact, file: "contract_amendment.json" },
      { artifact: graph.effectiveArtifact, file: "contract_effective.json" }
    ]
  });
}

test("authorization is skipped when no referenced edition has an EditionSource", () => {
  assertValid(contractArtifactsWithoutEditionSource());
});

test("authorization runs when every referenced edition has an EditionSource", () => {
  assertValid(validateContractGraphCopies());
});

test("partial EditionSource coverage fails with an incomplete registry error", () => {
  assertInvalid(validateContractGraphCopies((source, artifacts) => {
    artifacts.editionSourceArtifact.records = artifacts.editionSourceArtifact.records.filter((record) => record.document_edition_id !== "test.edition.addendum");
  }), "incomplete EditionSource registry");
});

test("LifecycleRelationship partial EditionSource coverage fails", () => {
  assertInvalid(validateContractGraphCopies((source, artifacts) => {
    artifacts.editionSourceArtifact.records = artifacts.editionSourceArtifact.records.filter((record) => record.document_edition_id !== "test.edition.addendum");
  }), "test.lifecycle.001 edition_source: incomplete EditionSource registry");
});

test("AmendmentMapping partial EditionSource coverage fails", () => {
  assertInvalid(validateContractGraphCopies((source, artifacts) => {
    artifacts.editionSourceArtifact.records = artifacts.editionSourceArtifact.records.filter((record) => record.document_edition_id !== "test.edition.addendum");
  }), "test.contract.amend.001 edition_source: incomplete EditionSource registry");
});

test("EffectiveRecord partial EditionSource coverage fails", () => {
  assertInvalid(validateContractGraphCopies((source, artifacts) => {
    artifacts.editionSourceArtifact.records = artifacts.editionSourceArtifact.records.filter((record) => record.document_edition_id !== "test.edition.addendum");
  }), "test.contract.eff.001 edition_source: incomplete EditionSource registry");
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

function snapshotArtifact(overrides = {}) {
  return {
    derived_model_version: "0.1.0",
    artifact_type: "EffectiveStateSnapshot",
    regulator_profile: "core",
    records: [
      {
        snapshot_id: "test.snapshot.001",
        guidance_family_id: "test.family",
        jurisdiction: "TEST",
        as_of_date: "2026-07-06",
        review_policy: "include_needs_review",
        source_corpus_identity: "test_doc@fixture",
        calculation_policy_version: "test-policy-0.1",
        effective_record_ids: ["test.contract.eff.001"],
        calculated_at: "2026-07-06T00:00:00Z",
        review_status: "needs_review",
        profile_details: null,
        ...overrides
      }
    ]
  };
}

function validateContractGraphWithSnapshot({ graphMutator, snapshotOverrides, extraArtifacts } = {}) {
  const graph = contractGraphArtifacts(graphMutator);
  const artifacts = [
    { artifact: graph.guidanceFamilyArtifact, file: "contract_guidance_family.json" },
    { artifact: graph.documentEditionArtifact, file: "contract_document_edition.json" },
    { artifact: graph.editionSourceArtifact, file: "contract_edition_source.json" },
    { artifact: graph.lifecycleArtifact, file: "contract_lifecycle.json" },
    { artifact: graph.amendmentArtifact, file: "contract_amendment.json" },
    { artifact: graph.effectiveArtifact, file: "contract_effective.json" },
    { artifact: snapshotArtifact(snapshotOverrides), file: "contract_snapshot.json" },
    ...(extraArtifacts || [])
  ];
  return validateContractArtifacts({ sourceBundle: graph.sourceBundle, artifacts });
}

test("EffectiveStateSnapshot with resolving members and matching family passes", () => {
  assertValid(validateContractGraphWithSnapshot());
});

test("EffectiveStateSnapshot member must resolve to a supplied EffectiveRecord", () => {
  assertInvalid(
    validateContractGraphWithSnapshot({ snapshotOverrides: { effective_record_ids: ["test.contract.eff.999"] } }),
    "reference does not resolve to a supplied EffectiveRecord: test.contract.eff.999"
  );
});

test("EffectiveStateSnapshot guidance_family_id must resolve to a supplied GuidanceFamily", () => {
  assertInvalid(
    validateContractGraphWithSnapshot({ snapshotOverrides: { guidance_family_id: "test.family.missing" } }),
    "reference does not resolve to GuidanceFamily: test.family.missing"
  );
});

test("EffectiveStateSnapshot member from a different family is rejected", () => {
  const otherFamilyArtifact = {
    derived_model_version: "0.1.0",
    artifact_type: "GuidanceFamily",
    regulator_profile: "core",
    records: [
      {
        guidance_family_id: "test.family.other",
        family_title: "Other test family",
        jurisdictions: ["TEST"],
        current_risk_assessment_id: null,
        review_status: "needs_review",
        profile_details: null
      }
    ]
  };
  assertInvalid(
    validateContractGraphWithSnapshot({
      snapshotOverrides: { guidance_family_id: "test.family.other" },
      extraArtifacts: [{ artifact: otherFamilyArtifact, file: "contract_other_family.json" }]
    }),
    "EffectiveRecord test.contract.eff.001 guidance_family_id test.family must match snapshot guidance_family_id test.family.other"
  );
});

test("contract manifest validates the complete contract graph fixture", () => {
  assertValid(validateDerivedManifestFile({
    manifestFile: path.join(CONTRACT_FIXTURE_DIR, "complete_graph", "manifest.json")
  }));
});

test("production registry manifest validates both corpus documents against multiple bootstrap pilot bundles", () => {
  assertValid(validateDerivedManifestFile({
    manifestFile: path.join(ROOT, "structured_data", "derived", "registry", "manifest.json")
  }));
});

test("multi-bundle manifest merges source_bundles and resolves references across them", () => {
  const manifestDir = path.join(ROOT, "structured_data", "derived", "registry");
  const manifest = {
    source_bundles: [
      "../../pilots/m10_3_2_5_2.json",
      "../../pilots/s6_r1_species_selection.json"
    ],
    artifacts: ["edition_source.json"]
  };
  assertValid(require("../scripts/validate_derived").validateDerivedManifest({
    manifest,
    manifestFile: path.join(manifestDir, "manifest.json")
  }));
});

test("multi-bundle manifest fails when a referenced Document is not among the supplied bundles", () => {
  const manifestDir = path.join(ROOT, "structured_data", "derived", "registry");
  const manifest = {
    source_bundles: ["../../pilots/m10_3_2_5_2.json"],
    artifacts: ["edition_source.json"]
  };
  const result = require("../scripts/validate_derived").validateDerivedManifest({
    manifest,
    manifestFile: path.join(manifestDir, "manifest.json")
  });
  assertInvalid(result, "reference does not resolve to documents: ich_s6_r1");
});

test("manifest rejects combining source_bundle and source_bundles", () => {
  const result = validateDerivedManifestFile({
    manifestFile: path.join(CONTRACT_FIXTURE_DIR, "invalid", "source_bundle_and_source_bundles.json")
  });
  assert.equal(result.configError, true);
  assertInvalid(result, "must not be combined with source_bundles");
});

test("m10_direct_slice validates a candidate direct-source EffectiveRecord and snapshot against the real M10 pilot", () => {
  const result = validateDerivedManifestFile({
    manifestFile: path.join(CONTRACT_FIXTURE_DIR, "m10_direct_slice", "manifest.json")
  });
  assertValid(result);
  assert.equal(result.effectiveRecordCount, 1);
  const effectiveArtifact = readJson(path.join(CONTRACT_FIXTURE_DIR, "m10_direct_slice", "effective_record.json"));
  assert.equal(effectiveArtifact.records[0].derivation_basis, "direct_source");
  assert.equal(effectiveArtifact.records[0].review_status, "needs_review");
});

test("s6_amendment_slice validates a candidate amendment-synthesis EffectiveRecord and snapshot against the real S6 pilot", () => {
  const result = validateDerivedManifestFile({
    manifestFile: path.join(CONTRACT_FIXTURE_DIR, "s6_amendment_slice", "manifest.json")
  });
  assertValid(result);
  assert.equal(result.amendmentMappingCount, 1);
  assert.equal(result.effectiveRecordCount, 1);
  const effectiveArtifact = readJson(path.join(CONTRACT_FIXTURE_DIR, "s6_amendment_slice", "effective_record.json"));
  assert.equal(effectiveArtifact.records[0].derivation_basis, "amendment_synthesis");
  assert.equal(effectiveArtifact.records[0].review_status, "needs_review");
});

test("s6_amendment_slice mapping reconciles without divergence against the frozen Phase 3 amend.001 reference", () => {
  const sliceMapping = readJson(path.join(CONTRACT_FIXTURE_DIR, "s6_amendment_slice", "amendment_mapping.json")).records[0];
  const frozenArtifact = readJson(path.join(ROOT, "structured_data", "derived", "s6_r1_amendment_mappings.json"));
  const frozenMapping = frozenArtifact.amendment_mappings.find((mapping) => mapping.mapping_id === "ich_s6_r1.amend.001");
  assert.equal(sliceMapping.relation_type, frozenMapping.relation_type);
  assert.deepEqual(sliceMapping.source_record_ids, frozenMapping.parent_knowledge_record_ids);
  assert.deepEqual(sliceMapping.amending_record_ids, frozenMapping.addendum_knowledge_record_ids);
  assert.equal(frozenMapping.review_status, "reviewed");
});

test("S6(R1) registry and slice use one integrated-package DocumentEdition with no LifecycleRelationship (DEC-050)", () => {
  const registryEditions = readJson(path.join(ROOT, "structured_data", "derived", "registry", "document_edition.json")).records;
  const s6RegistryEditions = registryEditions.filter((edition) => edition.guidance_family_id === "gf.ich_s6r1");
  assert.equal(s6RegistryEditions.length, 1);
  assert.equal(s6RegistryEditions[0].edition_role, "integrated_package");
  const sliceFiles = fs.readdirSync(path.join(CONTRACT_FIXTURE_DIR, "s6_amendment_slice"));
  assert.equal(sliceFiles.includes("lifecycle_relationship.json"), false);
  const sliceEditions = readJson(path.join(CONTRACT_FIXTURE_DIR, "s6_amendment_slice", "document_edition.json")).records;
  assert.equal(sliceEditions.length, 1);
  assert.equal(sliceEditions[0].edition_role, "integrated_package");
});

test("closed registry schema already rejects source-Document field duplication without a dedicated validator rule", () => {
  const artifact = readJson(path.join(ROOT, "structured_data", "derived", "registry", "guidance_family.json"));
  artifact.records[0].source_file_checksum = "duplicated-checksum-should-be-rejected";
  assertInvalid(
    validateDerivedContractArtifact({ artifact, file: "guidance_family.json" }),
    "must NOT have additional properties"
  );
});

test("contract validator source contains no frozen Phase 3 artifact paths", () => {
  const validatorSource = fs.readFileSync(path.join(ROOT, "scripts", "validate_derived.js"), "utf8");
  assert.equal(validatorSource.includes("structured_data/derived/s6_r1_amendment_mappings.json"), false);
  assert.equal(validatorSource.includes("structured_data/derived/s6_r1_effective_records.json"), false);
  assert.equal(validatorSource.includes("--amendments"), false);
  assert.equal(validatorSource.includes("--effective"), false);
});

test("legacy Phase 3 prototypes validate only through the legacy validator", () => {
  const sourceBundle = JSON.parse(fs.readFileSync(path.join(ROOT, "structured_data", "pilots", "s6_r1_species_selection.json"), "utf8"));
  const amendmentArtifact = JSON.parse(fs.readFileSync(path.join(ROOT, "structured_data", "derived", "s6_r1_amendment_mappings.json"), "utf8"));
  const effectiveArtifact = JSON.parse(fs.readFileSync(path.join(ROOT, "structured_data", "derived", "s6_r1_effective_records.json"), "utf8"));
  assertValid(validateLegacyDerivedArtifacts({
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

test("legacy-shaped artifacts fail contract validation without filename dispatch", () => {
  assertInvalid(validateContractArtifacts({
    sourceBundle: sourceFixture,
    artifacts: [
      { artifact: clone(amendmentFixture), file: "copied_legacy_amendment.json" },
      { artifact: clone(effectiveFixture), file: "copied_legacy_effective.json" }
    ]
  }), "derived contract artifacts must declare derived_model_version and artifact_type");
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

test("contract CLI exits zero on the complete graph manifest", () => {
  const result = spawnSync(process.execPath, [
    "scripts/validate_derived.js",
    "--manifest",
    path.join(CONTRACT_FIXTURE_DIR, "complete_graph", "manifest.json")
  ], { cwd: ROOT, encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Validated contract graph with 1 AmendmentMapping record\(s\) and 1 EffectiveRecord record\(s\)\./);
});

test("legacy CLI exits zero on frozen Phase 3 prototype files", () => {
  const result = spawnSync(process.execPath, [
    "scripts/validate_legacy_derived.js",
    "--source",
    path.join(ROOT, "structured_data", "pilots", "s6_r1_species_selection.json"),
    "--amendments",
    path.join(ROOT, "structured_data", "derived", "s6_r1_amendment_mappings.json"),
    "--effective",
    path.join(ROOT, "structured_data", "derived", "s6_r1_effective_records.json")
  ], { cwd: ROOT, encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Validated 4 legacy amendment mapping\(s\) and 4 legacy EffectiveRecord\(s\)\./);
});

test("contract CLI exits two on unreadable manifest", () => {
  const result = spawnSync(process.execPath, [
    "scripts/validate_derived.js",
    "--manifest",
    path.join(CONTRACT_FIXTURE_DIR, "invalid", "missing_manifest.json")
  ], { cwd: ROOT, encoding: "utf8" });
  assert.equal(result.status, 2);
  assert.match(result.stderr, /Derived contract validation failed/);
});

test("contract CLI exits two on usage failure", () => {
  const result = spawnSync(process.execPath, ["scripts/validate_derived.js"], { cwd: ROOT, encoding: "utf8" });
  assert.equal(result.status, 2);
  assert.match(result.stderr, /Usage:/);
});

test("legacy CLI exits two on unreadable configured file", () => {
  const result = spawnSync(process.execPath, [
    "scripts/validate_legacy_derived.js",
    "--source",
    path.join(FIXTURE_DIR, "missing_source_bundle.json"),
    "--amendments",
    AMENDMENT_FILE,
    "--effective",
    EFFECTIVE_FILE
  ], { cwd: ROOT, encoding: "utf8" });
  assert.equal(result.status, 2);
  assert.match(result.stderr, /Legacy derived validation failed/);
});
