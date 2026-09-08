/**
 * Offline routing audit over every manifest in the semantic overlay's
 * facet/coverage_manifest inventory (built by build_semantic_manifests.js),
 * feeding verify_semantic_manifests.js's routing check.
 *
 * Questions are generated after authoring from document/section titles and
 * are validation probes only. They never feed facet or manifest creation.
 */
const fs = require("node:fs");
const path = require("node:path");

const { answerEnvelope } = require("../engine/answer_envelope");
const { loadStore } = require("../engine/data_store");
const { loadSemanticOverlayStore } = require("../engine/semantic_overlay_store");
const { comparePlans, buildReviewedSemanticCoverage } = require("../engine/semantic_routing");

const ROOT = path.resolve(__dirname, "..");
const OUTPUT_PATH = process.env.GUIDELINE_STAGE_D_AUDIT_OUTPUT
  ? path.resolve(process.env.GUIDELINE_STAGE_D_AUDIT_OUTPUT)
  : path.join(ROOT, "logs", "runtime", "semantic_stage_d_audit.json");

const SPECIAL_QUESTIONS = {
  "ich_m10.sem.manifest.run_acceptance": "ICH M10 분석 run acceptance에서 calibration standard와 QC 기준은 어떻게 구성돼?",
  "fda_ada.sem.manifest.screening_performance": "FDA ADA screening assay validation 성능 기준은 무엇이야?",
  "ich_m10.sem.manifest.isr_process": "ICH M10 ISR은 어떤 순서와 기준으로 수행해?",
  "fda_ada.sem.manifest.multi_tier_testing": "FDA ADA multi-tier testing은 어떤 단계로 이어져?",
  "fda_ada_2014.sem.manifest.clinical_risk_mitigation": "FDA 2014 임상 면역원성 검체 채취와 위험 완화 절차는 어떻게 이어져?",
  "ich_m3_r2.sem.manifest.high_dose_selection": "ICH M3(R2) 일반독성시험 high dose 선택 기준은 무엇이야?",
  "ich_s6_r1.sem.manifest.species_number_conditions": "ICH S6(R1) 독성시험에 한 종 또는 두 종을 쓰는 조건은 무엇이야?"
};

function promotedStore(store) {
  return {
    ...store,
    overlaysByDocumentId: new Map([...store.overlaysByDocumentId].map(([documentId, overlay]) => [documentId, {
      ...overlay,
      facets: overlay.facets.map((facet) => ({ ...facet, review_status: "reviewed" })),
      coverage_manifests: overlay.coverage_manifests.map((manifest) => ({ ...manifest, review_status: "reviewed" })),
      comparison_bindings: overlay.comparison_bindings.map((binding) => ({ ...binding, review_status: "reviewed" }))
    }]))
  };
}

function sectionForManifest(manifest, overlay, archive) {
  if (manifest.target.type === "section") return archive.sectionsById.get(manifest.target.id);
  if (manifest.target.type !== "facet") return null;
  const facet = overlay.facets.find((item) => item.facet_id === manifest.target.id);
  return facet ? archive.sectionsById.get(facet.scope) : null;
}

function questionFor(manifest, overlay, store) {
  if (SPECIAL_QUESTIONS[manifest.manifest_id]) return SPECIAL_QUESTIONS[manifest.manifest_id];
  const document = store.archive.byDocumentId.get(overlay.document_id).bundle.documents[0];
  const code = document.guideline_code;
  if (manifest.target.type === "document") return `${code}은 전체적으로 무엇을 다루는 가이드라인이야?`;
  const section = sectionForManifest(manifest, overlay, store.archive);
  const parent = section.parent_section_id && store.archive.sectionsById.get(section.parent_section_id);
  const context = parent ? `${parent.title}의 ` : "";
  return `${code} §${section.section_number} ${context}${section.title} 항목은 어떻게 구성돼?`;
}

async function main() {
  const semanticStore = loadSemanticOverlayStore();
  const futureStore = promotedStore(semanticStore);
  const { records, index } = loadStore();
  const results = [];

  for (const [documentId, overlay] of semanticStore.overlaysByDocumentId) {
    for (const manifest of overlay.coverage_manifests) {
      const question = questionFor(manifest, overlay, semanticStore);
      const envelope = await answerEnvelope(question, records, { index, generationPreference: "prefer_structured" });
      const comparison = comparePlans(question, envelope, { store: semanticStore });
      const shadowMatch = (comparison.semantic_plan.manifests || []).find((item) => item.manifest_id === manifest.manifest_id);
      const futureCoverage = buildReviewedSemanticCoverage(question, envelope, { store: futureStore });
      const servedIds = futureCoverage ? futureCoverage.manifests.map((item) => item.manifest_id) : [];
      results.push({
        document_id: documentId,
        manifest_id: manifest.manifest_id,
        question,
        route: envelope.route,
        mode: envelope.mode,
        answer_intent: envelope.answer_intent,
        shadow_exercised: Boolean(shadowMatch),
        future_served_manifest_ids: servedIds,
        selected_as_best_match: servedIds.includes(manifest.manifest_id)
      });
    }
  }

  fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
  fs.writeFileSync(OUTPUT_PATH, `${JSON.stringify(results, null, 2)}\n`, "utf8");
  const shadowMisses = results.filter((item) => !item.shadow_exercised);
  const servedMisses = results.filter((item) => !item.selected_as_best_match);
  console.log(`Manifest routing audit: ${results.length} unique manifests`);
  console.log(`Shadow exercised: ${results.length - shadowMisses.length}/${results.length}`);
  console.log(`Future served selector: ${results.length - servedMisses.length}/${results.length}`);
  console.log(`Output: ${path.relative(ROOT, OUTPUT_PATH)}`);
  for (const item of servedMisses) {
    console.log(`MISS ${item.manifest_id}: ${item.route}/${item.mode}, intent=${item.answer_intent}, selected=${item.future_served_manifest_ids.join(",") || "none"}`);
  }
  if (shadowMisses.length > 0 || servedMisses.length > 0) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error.stack || error.message || error);
  process.exitCode = 1;
});
