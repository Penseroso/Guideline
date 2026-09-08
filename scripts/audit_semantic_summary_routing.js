/**
 * Offline routing audit, feeding promote_semantic_summaries.js's
 * precondition gate: for every summary_spec/salience_profile added since
 * the original small hand-authored set (PRE_EXISTING_SUMMARY_IDS/
 * PRE_EXISTING_SALIENCE_IDS below — identified dynamically as "not one of
 * these", so this covers whatever build_semantic_summaries.js has added
 * since, not just one historical batch), does the served selector actually
 * attach it to its intended manifest once everything is treated as
 * reviewed?
 *
 * Question generation reuses scripts/audit_semantic_manifest_routing.js's
 * pattern (document/section-title templates, no LLM call) since these
 * objects sit on the same manifests that script already generated
 * questions for the shape of.
 */
const fs = require("node:fs");
const path = require("node:path");

const { answerEnvelope } = require("../engine/answer_envelope");
const { loadStore } = require("../engine/data_store");
const { loadSemanticOverlayStore } = require("../engine/semantic_overlay_store");
const { buildReviewedSemanticCoverage } = require("../engine/semantic_routing");

const ROOT = path.resolve(__dirname, "..");
const OUTPUT_PATH = process.env.GUIDELINE_STAGE_F_AUDIT_OUTPUT
  ? path.resolve(process.env.GUIDELINE_STAGE_F_AUDIT_OUTPUT)
  : path.join(ROOT, "logs", "runtime", "semantic_stage_f_audit.json");

// The original 5 hand-authored summary_specs / 7 hand-authored
// salience_profiles — everything else in the committed overlays was added
// mechanically by build_semantic_summaries.js.
const PRE_EXISTING_SUMMARY_IDS = new Set([
  "ema_fih.sem.summary.document_overview",
  "fda_ada.sem.summary.assay_validation",
  "fda_ada_2014.sem.summary.risk_factors",
  "ich_m3_r2.sem.summary.scope",
  "ich_s6_r1.sem.summary.scope"
]);
const PRE_EXISTING_SALIENCE_IDS = new Set([
  "ema_fih.sem.profile.document_overview",
  "fda_ada.sem.profile.assay_validation",
  "fda_ada.sem.profile.screening_performance",
  "fda_ada_2014.sem.profile.risk_factors",
  "ich_m10.sem.profile.run_acceptance",
  "ich_m3_r2.sem.profile.scope",
  "ich_s6_r1.sem.profile.scope"
]);

function sectionForManifest(manifest, overlay, archive) {
  if (manifest.target.type === "section") return archive.sectionsById.get(manifest.target.id);
  if (manifest.target.type !== "facet") return null;
  const facet = overlay.facets.find((item) => item.facet_id === manifest.target.id);
  return facet ? archive.sectionsById.get(facet.scope) : null;
}

function questionFor(manifest, overlay, store) {
  const document = store.archive.byDocumentId.get(overlay.document_id).bundle.documents[0];
  const code = document.guideline_code;
  if (manifest.target.type === "document") return `${code}은 전체적으로 무엇을 다루는 가이드라인이야?`;
  const section = sectionForManifest(manifest, overlay, store.archive);
  if (!section) return `${code}의 ${manifest.manifest_id} 항목은 어떻게 구성돼?`;
  const parent = section.parent_section_id && store.archive.sectionsById.get(section.parent_section_id);
  const context = parent ? `${parent.title}의 ` : "";
  return `${code} §${section.section_number} ${context}${section.title} 항목은 어떻게 구성돼?`;
}

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

  for (const [documentId, overlay] of semanticStore.overlaysByDocumentId) {
    for (const manifest of overlay.coverage_manifests) {
      const newSummary = overlay.summary_specs.find((summary) => {
        if (PRE_EXISTING_SUMMARY_IDS.has(summary.summary_id)) return false;
        const exact = summary.target.type === manifest.target.type && summary.target.id === manifest.target.id;
        const facetSet = new Set((manifest.coverage_groups || []).flatMap((g) => g.facet_ids || []));
        return exact || summary.facet_ids.every((id) => facetSet.has(id));
      });
      const newSalience = overlay.salience_profiles.find((profile) => {
        if (PRE_EXISTING_SALIENCE_IDS.has(profile.profile_id)) return false;
        const exact = profile.target_id === manifest.target.id;
        const facetSet = new Set((manifest.coverage_groups || []).flatMap((g) => g.facet_ids || []));
        return exact || profile.items.every((item) => facetSet.has(item.facet_id));
      });
      if (!newSummary && !newSalience) continue;

      const question = questionFor(manifest, overlay, semanticStore);
      const envelope = await answerEnvelope(question, records, { index, generationPreference: "prefer_structured" });
      const futureCoverage = buildReviewedSemanticCoverage(question, envelope, { store: futureStore });
      const servedManifest = futureCoverage && futureCoverage.manifests.find((item) => item.manifest_id === manifest.manifest_id);
      results.push({
        document_id: documentId,
        manifest_id: manifest.manifest_id,
        question,
        route: envelope.route,
        mode: envelope.mode,
        summary_id: newSummary ? newSummary.summary_id : null,
        summary_attached: newSummary ? Boolean(servedManifest && servedManifest.summary && servedManifest.summary.summary_id === newSummary.summary_id) : null,
        salience_profile_id: newSalience ? newSalience.profile_id : null,
        salience_attached: newSalience ? Boolean(servedManifest && servedManifest.salience && servedManifest.salience.profile_id === newSalience.profile_id) : null
      });
    }
  }

  fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
  fs.writeFileSync(OUTPUT_PATH, `${JSON.stringify(results, null, 2)}\n`, "utf8");
  const summaryMisses = results.filter((item) => item.summary_id && !item.summary_attached);
  const salienceMisses = results.filter((item) => item.salience_profile_id && !item.salience_attached);
  const summaryTotal = results.filter((item) => item.summary_id).length;
  const salienceTotal = results.filter((item) => item.salience_profile_id).length;
  console.log(`Summary/salience routing audit: ${results.length} manifest(s) with newly-added objects`);
  console.log(`summary_specs attached: ${summaryTotal - summaryMisses.length}/${summaryTotal}`);
  console.log(`salience_profiles attached: ${salienceTotal - salienceMisses.length}/${salienceTotal}`);
  console.log(`Output: ${path.relative(ROOT, OUTPUT_PATH)}`);
  for (const item of summaryMisses) console.log(`SUMMARY MISS ${item.manifest_id}: route=${item.route}/${item.mode}`);
  for (const item of salienceMisses) console.log(`SALIENCE MISS ${item.manifest_id}: route=${item.route}/${item.mode}`);
  if (summaryMisses.length > 0 || salienceMisses.length > 0) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error.stack || error.message || error);
  process.exitCode = 1;
});
