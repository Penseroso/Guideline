/**
 * Offline Stage E3 audit: once a salience_profile is treated as reviewed
 * too, does the served coverage attach it to the manifest it should order,
 * grouped by tier? Narrow scope only (the 7 existing pilot salience_profiles
 * across 6 documents) — Stage F is responsible for authoring salience for
 * Stage D's 47 newly generated manifests.
 *
 * No LLM call: same offline, deterministic-engine pattern as
 * scripts/run_semantic_stage_e1_audit.js / run_semantic_stage_e2_audit.js.
 */
const fs = require("node:fs");
const path = require("node:path");

const { answerEnvelope } = require("../engine/answer_envelope");
const { loadStore } = require("../engine/data_store");
const { loadSemanticOverlayStore } = require("../engine/semantic_overlay_store");
const { buildReviewedSemanticCoverage } = require("../engine/semantic_shadow");

const ROOT = path.resolve(__dirname, "..");
const OUTPUT_PATH = process.env.GUIDELINE_STAGE_E3_AUDIT_OUTPUT
  ? path.resolve(process.env.GUIDELINE_STAGE_E3_AUDIT_OUTPUT)
  : path.join(ROOT, "logs", "runtime", "semantic_stage_e3_audit.json");

const CASES = [
  {
    profile_id: "ema_fih.sem.profile.document_overview",
    manifest_id: "ema_fih.sem.manifest.document_overview",
    question: "EMA FIH 가이드라인은 전체적으로 무엇을 다루는 가이드라인이야?"
  },
  {
    profile_id: "fda_ada.sem.profile.assay_validation",
    manifest_id: "fda_ada.sem.manifest.assay_validation",
    question: "FDA ADA §6 Assay Validation 항목은 어떻게 구성돼?"
  },
  {
    profile_id: "fda_ada.sem.profile.screening_performance",
    manifest_id: "fda_ada.sem.manifest.screening_performance",
    question: "ADA screening assay validation 성능 기준은?"
  },
  {
    profile_id: "fda_ada_2014.sem.profile.risk_factors",
    manifest_id: "fda_ada_2014.sem.manifest.risk_factors",
    question: "FDA-2014-ADA §V PATIENT- AND PRODUCT-SPECIFIC FACTORS THAT AFFECT IMMUNOGENICITY 항목은 어떻게 구성돼?"
  },
  {
    profile_id: "ich_m10.sem.profile.run_acceptance",
    manifest_id: "ich_m10.sem.manifest.run_acceptance",
    question: "LC-MS/MS chromatography 분석 run 허용 기준이 뭐야?"
  },
  {
    profile_id: "ich_m3_r2.sem.profile.scope",
    manifest_id: "ich_m3_r2.sem.manifest.section_1_introduction",
    question: "ICH M3(R2) §1 Introduction 항목은 어떻게 구성돼?"
  },
  {
    profile_id: "ich_s6_r1.sem.profile.scope",
    manifest_id: "ich_s6_r1.sem.manifest.section_1_introduction",
    question: "ICH S6(R1) §1 Introduction 항목은 어떻게 구성돼?"
  }
];

function promotedStore(store) {
  return {
    ...store,
    overlaysByDocumentId: new Map([...store.overlaysByDocumentId].map(([documentId, overlay]) => [documentId, {
      ...overlay,
      summary_specs: overlay.summary_specs.map((summary) => ({ ...summary, review_status: "reviewed" })),
      facets: overlay.facets.map((facet) => ({ ...facet, review_status: "reviewed" })),
      coverage_manifests: overlay.coverage_manifests.map((manifest) => ({ ...manifest, review_status: "reviewed" })),
      comparison_bindings: overlay.comparison_bindings.map((binding) => ({ ...binding, review_status: "reviewed" })),
      salience_profiles: overlay.salience_profiles.map((profile) => ({ ...profile, review_status: "reviewed" }))
    }]))
  };
}

async function main() {
  const semanticStore = loadSemanticOverlayStore();
  const futureStore = promotedStore(semanticStore);
  const { records, index } = loadStore();
  const results = [];

  for (const testCase of CASES) {
    const envelope = await answerEnvelope(testCase.question, records, { index, generationPreference: "prefer_structured" });
    const futureCoverage = buildReviewedSemanticCoverage(testCase.question, envelope, { store: futureStore });
    const manifest = futureCoverage && futureCoverage.manifests.find((item) => item.manifest_id === testCase.manifest_id);
    const salience = manifest && manifest.salience;
    results.push({
      profile_id: testCase.profile_id,
      manifest_id: testCase.manifest_id,
      question: testCase.question,
      route: envelope.route,
      mode: envelope.mode,
      salience_attached: Boolean(salience && salience.profile_id === testCase.profile_id)
    });
  }

  fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
  fs.writeFileSync(OUTPUT_PATH, `${JSON.stringify(results, null, 2)}\n`, "utf8");
  const misses = results.filter((item) => !item.salience_attached);
  console.log(`Stage E3 salience audit: ${results.length} salience_profiles`);
  console.log(`Attached to the intended manifest: ${results.length - misses.length}/${results.length}`);
  console.log(`Output: ${path.relative(ROOT, OUTPUT_PATH)}`);
  for (const item of misses) {
    console.log(`MISS ${item.profile_id}: route=${item.route}/${item.mode}`);
  }
  if (misses.length > 0) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error.stack || error.message || error);
  process.exitCode = 1;
});
