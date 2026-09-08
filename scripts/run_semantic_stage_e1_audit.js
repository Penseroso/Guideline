/**
 * Offline Stage E1 audit: does each existing summary_spec attach to the
 * manifest docs/derived_semantic_layer.md §10 단계 E1 says it should, once
 * both are treated as reviewed? Narrow scope only (the 5 pre-existing
 * pilot summary_specs) — Stage F is responsible for authoring one for each
 * of Stage D's 47 newly generated manifests.
 *
 * No LLM call: answerEnvelope() runs the real deterministic engine, but the
 * summary-attachment check itself is pure local selection logic
 * (selectServedSummary inside engine/semantic_shadow.js).
 */
const fs = require("node:fs");
const path = require("node:path");

const { answerEnvelope } = require("../engine/answer_envelope");
const { loadStore } = require("../engine/data_store");
const { loadSemanticOverlayStore } = require("../engine/semantic_overlay_store");
const { buildReviewedSemanticCoverage } = require("../engine/semantic_shadow");

const ROOT = path.resolve(__dirname, "..");
const OUTPUT_PATH = process.env.GUIDELINE_STAGE_E1_AUDIT_OUTPUT
  ? path.resolve(process.env.GUIDELINE_STAGE_E1_AUDIT_OUTPUT)
  : path.join(ROOT, "logs", "runtime", "semantic_stage_e1_audit.json");

// summary_id -> the manifest it must be served on, and a real question that
// resolves that manifest (reused/adapted from the Stage D audit's own
// per-manifest questions where the target manifest is the same).
const CASES = [
  {
    summary_id: "ema_fih.sem.summary.document_overview",
    manifest_id: "ema_fih.sem.manifest.document_overview",
    question: "EMA FIH 가이드라인은 전체적으로 무엇을 다루는 가이드라인이야?"
  },
  {
    summary_id: "fda_ada.sem.summary.assay_validation",
    manifest_id: "fda_ada.sem.manifest.assay_validation",
    question: "FDA ADA §6 Assay Validation 항목은 어떻게 구성돼?"
  },
  {
    summary_id: "fda_ada_2014.sem.summary.risk_factors",
    manifest_id: "fda_ada_2014.sem.manifest.risk_factors",
    question: "FDA-2014-ADA §V PATIENT- AND PRODUCT-SPECIFIC FACTORS THAT AFFECT IMMUNOGENICITY 항목은 어떻게 구성돼?"
  },
  {
    summary_id: "ich_m3_r2.sem.summary.scope",
    manifest_id: "ich_m3_r2.sem.manifest.section_1_introduction",
    question: "ICH M3(R2) §1 Introduction 항목은 어떻게 구성돼?"
  },
  {
    summary_id: "ich_s6_r1.sem.summary.scope",
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
      comparison_bindings: overlay.comparison_bindings.map((binding) => ({ ...binding, review_status: "reviewed" }))
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
    results.push({
      summary_id: testCase.summary_id,
      manifest_id: testCase.manifest_id,
      question: testCase.question,
      route: envelope.route,
      mode: envelope.mode,
      manifest_selected: Boolean(manifest),
      summary_attached: Boolean(manifest && manifest.summary && manifest.summary.summary_id === testCase.summary_id)
    });
  }

  fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
  fs.writeFileSync(OUTPUT_PATH, `${JSON.stringify(results, null, 2)}\n`, "utf8");
  const misses = results.filter((item) => !item.summary_attached);
  console.log(`Stage E1 summary audit: ${results.length} summary_specs`);
  console.log(`Attached to the intended manifest: ${results.length - misses.length}/${results.length}`);
  console.log(`Output: ${path.relative(ROOT, OUTPUT_PATH)}`);
  for (const item of misses) {
    console.log(`MISS ${item.summary_id}: manifest_selected=${item.manifest_selected}, route=${item.route}/${item.mode}`);
  }
  if (misses.length > 0) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error.stack || error.message || error);
  process.exitCode = 1;
});
