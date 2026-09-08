const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const {
  PARENT_SECTIONS,
  DOCUMENT_AREAS,
  LEAF_TOPICS
} = require("../scripts/build_semantic_stage_d");

const ROOT = path.resolve(__dirname, "..");
const OVERLAY_DIR = path.join(ROOT, "data", "derived", "semantic");
const DOCUMENT_IDS = Object.keys(PARENT_SECTIONS);
const SPECIALIZED_MANIFESTS = new Set([
  "ich_m10.sem.manifest.run_acceptance",
  "fda_ada.sem.manifest.screening_performance"
]);

function overlays() {
  return DOCUMENT_IDS.map((documentId) => JSON.parse(
    fs.readFileSync(path.join(OVERLAY_DIR, `${documentId}.json`), "utf8")
  ));
}

test("Stage D inventory is the final 55-object unique manifest set", () => {
  const all = overlays().flatMap((overlay) => overlay.coverage_manifests);
  const ids = new Set(all.map((manifest) => manifest.manifest_id));
  assert.equal(all.length, 55);
  assert.equal(ids.size, 55);

  const parents = new Set(Object.values(PARENT_SECTIONS).flat());
  assert.equal(parents.size, 42);
  for (const sectionId of parents) {
    assert.equal(all.filter((manifest) => manifest.target.type === "section" && manifest.target.id === sectionId).length, 1, sectionId);
  }

  const documentOverviews = all.filter((manifest) => manifest.target.type === "document");
  assert.equal(documentOverviews.length, 6);
  assert.deepEqual(new Set(documentOverviews.map((manifest) => manifest.target.id)), new Set(DOCUMENT_IDS));

  const leafIds = new Set(Object.entries(LEAF_TOPICS).flatMap(([documentId, topics]) =>
    topics.map((topic) => `${documentId}.sem.manifest.${topic.key}`)
  ));
  assert.equal(leafIds.size, 5);
  for (const id of leafIds) assert.ok(ids.has(id), id);
  for (const id of SPECIALIZED_MANIFESTS) assert.ok(ids.has(id), id);

  const categorized = new Set([
    ...all.filter((manifest) => manifest.target.type === "section").map((manifest) => manifest.manifest_id),
    ...documentOverviews.map((manifest) => manifest.manifest_id),
    ...leafIds,
    ...SPECIALIZED_MANIFESTS
  ]);
  assert.equal(categorized.size, 55);
  assert.deepEqual(categorized, ids);
});

test("every parent and document overview is derived from the declared section hierarchy", () => {
  for (const overlay of overlays()) {
    const parentIds = new Set(PARENT_SECTIONS[overlay.document_id]);
    for (const sectionId of parentIds) {
      const manifest = overlay.coverage_manifests.find((item) => item.target.type === "section" && item.target.id === sectionId);
      assert.equal(manifest.coverage_groups.length, 1, manifest.manifest_id);
      assert.equal(manifest.coverage_groups[0].group_id, "direct_child_sections", manifest.manifest_id);
    }
    const documentManifest = overlay.coverage_manifests.find((item) => item.target.type === "document");
    const facetsById = new Map(overlay.facets.map((facet) => [facet.facet_id, facet]));
    const scopes = documentManifest.coverage_groups.flatMap((group) => group.facet_ids)
      .map((id) => facetsById.get(id).scope);
    assert.deepEqual(new Set(scopes), new Set(DOCUMENT_AREAS[overlay.document_id]), overlay.document_id);
  }
});

test("Stage D keeps authoring separate from summary, presentation, and salience runtime expansion", () => {
  for (const overlay of overlays()) {
    assert.ok(Array.isArray(overlay.summary_specs), overlay.document_id);
    assert.ok(Array.isArray(overlay.salience_profiles), overlay.document_id);
    assert.equal(overlay.semantic_overlay_version, "0.3.0");
    assert.equal(overlay.derivation.pipeline_version, "stage-d-2026-09-08");
  }
});
