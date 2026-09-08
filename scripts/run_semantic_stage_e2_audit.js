/**
 * Offline Stage E2 audit: once a summary_spec's matching presentation entry
 * is also treated as reviewed, does the served coverage actually render
 * text — in the summary_spec's own sentence_roles order? Narrow scope only
 * (the 3 existing presentation files: ema_fih, ich_m3_r2, ich_s6_r1).
 * fda_ada and fda_ada_2014 have a summary_spec but no presentation file at
 * all yet — that is an expected, documented gap (see
 * history/verification/semantic_stage_e2_2026-09-08.md), not a case this
 * audit exercises.
 *
 * No LLM call: same offline, deterministic-engine pattern as
 * scripts/run_semantic_stage_e1_audit.js.
 */
const fs = require("node:fs");
const path = require("node:path");

const { answerEnvelope } = require("../engine/answer_envelope");
const { loadStore } = require("../engine/data_store");
const { loadSemanticOverlayStore } = require("../engine/semantic_overlay_store");
const { buildReviewedSemanticCoverage } = require("../engine/semantic_shadow");

const ROOT = path.resolve(__dirname, "..");
const OUTPUT_PATH = process.env.GUIDELINE_STAGE_E2_AUDIT_OUTPUT
  ? path.resolve(process.env.GUIDELINE_STAGE_E2_AUDIT_OUTPUT)
  : path.join(ROOT, "logs", "runtime", "semantic_stage_e2_audit.json");

const CASES = [
  {
    summary_id: "ema_fih.sem.summary.document_overview",
    manifest_id: "ema_fih.sem.manifest.document_overview",
    expected_sentence_roles: ["main_points", "boundary"],
    question: "EMA FIH 가이드라인은 전체적으로 무엇을 다루는 가이드라인이야?"
  },
  {
    summary_id: "ich_m3_r2.sem.summary.scope",
    manifest_id: "ich_m3_r2.sem.manifest.section_1_introduction",
    expected_sentence_roles: ["scope", "boundary"],
    question: "ICH M3(R2) §1 Introduction 항목은 어떻게 구성돼?"
  },
  {
    summary_id: "ich_s6_r1.sem.summary.scope",
    manifest_id: "ich_s6_r1.sem.manifest.section_1_introduction",
    expected_sentence_roles: ["scope", "exception"],
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
    }])),
    presentationByDocumentId: new Map([...store.presentationByDocumentId].map(([documentId, presentation]) => [documentId, {
      ...presentation,
      entries: presentation.entries.map((entry) => ({ ...entry, review_status: "reviewed" }))
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
    const text = manifest && manifest.summary && manifest.summary.text;
    const actualRoles = (text || []).map((unit) => unit.sentence_role);
    results.push({
      summary_id: testCase.summary_id,
      manifest_id: testCase.manifest_id,
      question: testCase.question,
      route: envelope.route,
      mode: envelope.mode,
      text_rendered: Boolean(text && text.length > 0),
      sentence_roles_match: JSON.stringify(actualRoles) === JSON.stringify(testCase.expected_sentence_roles)
    });
  }

  fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
  fs.writeFileSync(OUTPUT_PATH, `${JSON.stringify(results, null, 2)}\n`, "utf8");
  const misses = results.filter((item) => !item.text_rendered || !item.sentence_roles_match);
  console.log(`Stage E2 presentation audit: ${results.length} case(s)`);
  console.log(`Text rendered in the correct sentence_roles order: ${results.length - misses.length}/${results.length}`);
  console.log(`Output: ${path.relative(ROOT, OUTPUT_PATH)}`);
  for (const item of misses) {
    console.log(`MISS ${item.summary_id}: text_rendered=${item.text_rendered}, sentence_roles_match=${item.sentence_roles_match}`);
  }
  if (misses.length > 0) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error.stack || error.message || error);
  process.exitCode = 1;
});
