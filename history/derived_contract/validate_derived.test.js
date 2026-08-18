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

test("contract manifest validates the complete contract graph fixture", () => {
  assertValid(validateDerivedManifestFile({
    manifestFile: path.join(CONTRACT_FIXTURE_DIR, "complete_graph", "manifest.json")
  }));
});

test("contract validator source contains no frozen Phase 3 artifact paths", () => {
  const validatorSource = fs.readFileSync(path.join(ROOT, "scripts", "validate_derived.js"), "utf8");
  assert.equal(validatorSource.includes("structured_data/derived/s6_r1_amendment_mappings.json"), false);
  assert.equal(validatorSource.includes("structured_data/derived/s6_r1_effective_records.json"), false);
  assert.equal(validatorSource.includes("--amendments"), false);
  assert.equal(validatorSource.includes("--effective"), false);
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

test("contract CLI exits zero on the complete graph manifest", () => {
  const result = spawnSync(process.execPath, [
    "scripts/validate_derived.js",
    "--manifest",
    path.join(CONTRACT_FIXTURE_DIR, "complete_graph", "manifest.json")
  ], { cwd: ROOT, encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Validated contract graph with 1 AmendmentMapping record\(s\) and 1 EffectiveRecord record\(s\)\./);
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

