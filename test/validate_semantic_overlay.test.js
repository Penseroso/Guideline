const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const {
  validateSemanticOverlays,
  OVERLAY_DIR,
  PRESENTATION_DIR
} = require("../validation/validate_semantic_overlay");

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function tempDir(label) {
  const dir = path.join(os.tmpdir(), `semantic_overlay_test_${label}_${Date.now()}_${Math.random().toString(36).slice(2)}`);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function loadSample(fileName) {
  return clone(JSON.parse(fs.readFileSync(path.join(OVERLAY_DIR, fileName), "utf8")));
}

function withMutatedOverlay(fileName, mutator) {
  const overlay = loadSample(fileName);
  if (mutator) mutator(overlay);
  const dir = tempDir(path.basename(fileName, ".json"));
  fs.writeFileSync(path.join(dir, fileName), JSON.stringify(overlay), "utf8");
  return validateSemanticOverlays({ overlayDir: dir, presentationDir: path.join(dir, "presentation_missing") });
}

function assertInvalid(result, expectedFragment) {
  assert.equal(result.ok, false, "validation unexpectedly passed");
  assert(
    result.errors.some((error) => error.includes(expectedFragment)),
    `expected an error containing ${JSON.stringify(expectedFragment)}, got:\n${result.errors.join("\n")}`
  );
}

test("committed sample semantic overlays and presentation entries validate cleanly", () => {
  const result = validateSemanticOverlays();
  assert.equal(result.ok, true, result.errors.join("\n"));
  assert.deepEqual(result.errors, []);
  assert.equal(result.overlayCount, 5);
  assert.equal(result.presentationCount, 3);
});

test("stale source_bundle_sha256 fails", () => {
  const result = withMutatedOverlay("ich_m10.json", (overlay) => {
    overlay.source_bundle_sha256 = "0".repeat(64);
  });
  assertInvalid(result, "is stale: does not match the current core bundle");
});

test("coverage manifest referencing an unknown facet fails", () => {
  const result = withMutatedOverlay("ich_m10.json", (overlay) => {
    overlay.coverage_manifests[0].coverage_groups[0].facet_ids.push("ich_m10.sem.facet.does_not_exist");
  });
  assertInvalid(result, "does not resolve inside this overlay: ich_m10.sem.facet.does_not_exist");
});

test("relation evidence pointing at a nonexistent record fails", () => {
  const result = withMutatedOverlay("ich_m10.json", (overlay) => {
    overlay.relations[0].evidence_refs[0].record_id = "ich_m10.qc.does_not_exist";
  });
  assertInvalid(result, "evidence record_id does not resolve in core archive: ich_m10.qc.does_not_exist");
});

test("stale evidence source_text_sha256 fails", () => {
  const result = withMutatedOverlay("ich_m10.json", (overlay) => {
    overlay.relations[0].evidence_refs[0].source_text_sha256 = "1".repeat(64);
  });
  assertInvalid(result, "evidence is stale");
});

test("facet parent cycle fails", () => {
  const result = withMutatedOverlay("ich_m10.json", (overlay) => {
    const chromatography = overlay.facets.find((f) => f.facet_id === "ich_m10.sem.facet.run_acceptance.chromatography");
    const lba = overlay.facets.find((f) => f.facet_id === "ich_m10.sem.facet.run_acceptance.lba");
    chromatography.parent_facet_id = lba.facet_id;
    lba.parent_facet_id = chromatography.facet_id;
  });
  assertInvalid(result, "facet parent graph contains a cycle");
});

test("procedural relation cycle fails", () => {
  const result = withMutatedOverlay("ich_m10.json", (overlay) => {
    const chromatography = "ich_m10.sem.facet.run_acceptance.chromatography";
    const lba = "ich_m10.sem.facet.run_acceptance.lba";
    overlay.relations[0].relation_type = "precedes";
    overlay.relations[0].from_ref = { ref_type: "facet", ref_id: chromatography };
    overlay.relations[0].to_ref = { ref_type: "facet", ref_id: lba };
    overlay.relations.push({
      relation_id: "ich_m10.sem.rel.test_reverse",
      from_ref: { ref_type: "facet", ref_id: lba },
      to_ref: { ref_type: "facet", ref_id: chromatography },
      relation_type: "precedes",
      evidence_refs: clone(overlay.relations[0].evidence_refs),
      review_status: "needs_review"
    });
  });
  assertInvalid(result, "procedural relation graph contains a cycle");
});

test("duplicate display_order within the same salience tier fails", () => {
  const result = withMutatedOverlay("ich_m10.json", (overlay) => {
    overlay.salience_profiles[0].items[1].display_order = overlay.salience_profiles[0].items[0].display_order;
  });
  assertInvalid(result, "duplicate display_order");
});

test("comparison binding referencing an unknown axis fails", () => {
  const result = withMutatedOverlay("ich_m3_r2.json", (overlay) => {
    overlay.comparison_bindings[0].axis_id = "scope.does_not_exist";
  });
  assertInvalid(result, "does not resolve in ontology: scope.does_not_exist");
});

test("coverage group with an unknown context slot value fails", () => {
  const result = withMutatedOverlay("ich_m10.json", (overlay) => {
    overlay.coverage_manifests[0].coverage_groups[0].when = { slot_id: "target_assay", value: "not_a_real_technique" };
  });
  assertInvalid(result, "unknown value not_a_real_technique for context slot target_assay");
});

test("member_record_ids from a different document fails", () => {
  const result = withMutatedOverlay("ich_m10.json", (overlay) => {
    overlay.facets.find((f) => f.facet_id === "ich_m10.sem.facet.run_acceptance.chromatography").member_record_ids.push(
      "fda_ada.kr.VI_A.001"
    );
  });
  assertInvalid(result, "belongs to a different document");
});

test("presentation entry with an unresolved semantic_id fails", () => {
  const overlayDir = tempDir("presentation_overlay");
  const presentationDir = tempDir("presentation_entries");
  const overlay = loadSample("ich_m10.json");
  fs.writeFileSync(path.join(overlayDir, "ich_m10.json"), JSON.stringify(overlay), "utf8");

  const presentation = {
    presentation_overlay_version: "0.1.0",
    language: "ko",
    document_id: "ich_m10",
    entries: [
      {
        semantic_id: "ich_m10.sem.summary.does_not_exist",
        language: "ko",
        review_status: "needs_review",
        units: [
          {
            unit_id: "u1",
            text: "테스트 문장",
            sentence_role: "scope",
            evidence_refs: [
              {
                record_id: "ich_m10.qc.3_3_2.001",
                source_unit_id: "ich_m10.su.3_3_2.001",
                source_text_sha256: "0".repeat(64)
              }
            ],
            source_support: "direct"
          }
        ]
      }
    ]
  };
  fs.writeFileSync(path.join(presentationDir, "ich_m10.json"), JSON.stringify(presentation), "utf8");

  const result = validateSemanticOverlays({ overlayDir, presentationDir });
  assertInvalid(result, "does not resolve to a summary_spec or facet in the corresponding semantic overlay");
});
