const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const { summaryAlreadyCovers, salienceAlreadyCovers, SALIENCE_MIN_FACETS } = require("../scripts/build_semantic_summaries");

const ROOT = path.resolve(__dirname, "..");
const OVERLAY_DIR = path.join(ROOT, "data", "derived", "semantic");

function overlays() {
  return fs.readdirSync(OVERLAY_DIR)
    .filter((name) => name.endsWith(".json"))
    .map((name) => JSON.parse(fs.readFileSync(path.join(OVERLAY_DIR, name), "utf8")));
}

function manifestFacetCount(manifest) {
  return new Set((manifest.coverage_groups || []).flatMap((group) => group.facet_ids || [])).size;
}

test("every manifest whose answer_intent has a summary_kind mapping is covered by exactly one summary_spec (Stage F invariant)", () => {
  for (const overlay of overlays()) {
    for (const manifest of overlay.coverage_manifests) {
      if (["multi_criterion", "comparison"].includes(manifest.answer_intent)) continue;
      assert.ok(
        summaryAlreadyCovers(overlay, manifest),
        `${overlay.document_id}/${manifest.manifest_id} (${manifest.answer_intent}) has no summary_spec covering it`
      );
    }
  }
});

test("every manifest with >= SALIENCE_MIN_FACETS facets has a salience_profile covering it (Stage F invariant)", () => {
  for (const overlay of overlays()) {
    for (const manifest of overlay.coverage_manifests) {
      if (manifestFacetCount(manifest) < SALIENCE_MIN_FACETS) continue;
      assert.ok(
        salienceAlreadyCovers(overlay, manifest),
        `${overlay.document_id}/${manifest.manifest_id} has ${manifestFacetCount(manifest)} facets but no salience_profile covering it`
      );
    }
  }
});

test("all Stage F objects (5 pre-existing + Stage F's new authoring) are reviewed", () => {
  for (const overlay of overlays()) {
    for (const summary of overlay.summary_specs) {
      assert.equal(summary.review_status, "reviewed", `${overlay.document_id}/${summary.summary_id} is not reviewed`);
    }
    for (const profile of overlay.salience_profiles) {
      assert.equal(profile.review_status, "reviewed", `${overlay.document_id}/${profile.profile_id} is not reviewed`);
    }
  }
});

test("total summary_specs and salience_profiles match Stage F's committed authoring counts", () => {
  let summaryCount = 0;
  let salienceCount = 0;
  for (const overlay of overlays()) {
    summaryCount += overlay.summary_specs.length;
    salienceCount += overlay.salience_profiles.length;
  }
  assert.equal(summaryCount, 50, "5 pre-existing + 45 Stage F");
  assert.equal(salienceCount, 26, "7 pre-existing + 19 Stage F");
});
