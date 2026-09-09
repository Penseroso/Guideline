const fs = require("node:fs");
const path = require("node:path");

const { answerEnvelope } = require("../engine/answer_envelope");
const { loadStore } = require("../engine/data_store");
const { createStore } = require("../engine/vector_store");
const { loadSemanticOverlayStore } = require("../engine/semantic_overlay_store");
const { reviewedRoutingEligibility } = require("../engine/semantic_routing");

const ROOT = path.resolve(__dirname, "..");
const OUTPUT_PATH = process.env.GUIDELINE_ROUTING_AUDIT_OUTPUT
  ? path.resolve(process.env.GUIDELINE_ROUTING_AUDIT_OUTPUT)
  : path.join(ROOT, "logs", "runtime", "answer_routing_hardening_audit.json");

const DOCUMENT_LABELS = {
  ema_fih: "EMA FIH",
  fda_ada: "FDA ADA 2019",
  fda_ada_2014: "FDA ADA 2014",
  ich_m10: "ICH M10",
  ich_m3_r2: "ICH M3(R2)",
  ich_s6_r1: "ICH S6(R1)"
};

const FACET_TOPICS = {
  "ich_m10.sem.manifest.isr_process": "ISR 수행 절차와 순서",
  "ich_m10.sem.manifest.run_acceptance": "분석 run의 calibration standard와 QC acceptance 기준",
  "fda_ada.sem.manifest.multi_tier_testing": "multi-tier testing 절차와 순서",
  "fda_ada.sem.manifest.screening_performance": "screening assay performance 기준",
  "fda_ada_2014.sem.manifest.clinical_risk_mitigation": "임상 면역원성 검체 채취와 위험 완화 절차",
  "ich_m3_r2.sem.manifest.high_dose_selection": "일반독성시험 high dose 선택 기준",
  "ich_s6_r1.sem.manifest.species_number_conditions": "독성시험에 한 종 또는 두 종을 쓰는 조건"
};

function sectionLabel(section, semanticStore) {
  const parent = section.parent_section_id && semanticStore.archive.sectionsById.get(section.parent_section_id);
  return `${parent ? `${parent.title}의 ` : ""}${section.title}`;
}

function questionsFor(entry, semanticStore) {
  const code = DOCUMENT_LABELS[entry.document_id];
  const { manifest } = entry;
  if (manifest.target.type === "document") {
    return [
      `${code}은 전체적으로 무엇을 다루는 가이드라인이야?`,
      `${code} 전체 구성을 정리해줘.`,
      `${code} 가이드라인 전체를 설명해줘.`,
      `${code}에는 전체적으로 뭐가 있어?`
    ];
  }
  if (manifest.target.type === "section") {
    const section = semanticStore.archive.sectionsById.get(manifest.target.id);
    const prefix = `${code} §${section.section_number} ${sectionLabel(section, semanticStore)}`;
    return [
      `${prefix} 항목은?`,
      `${prefix} 구성을 정리해줘.`,
      `${prefix} 설명해줘.`,
      `${prefix}에는 뭐가 있어?`
    ];
  }
  const topic = FACET_TOPICS[manifest.manifest_id];
  if (!topic) throw new Error(`No routing-audit topic for ${manifest.manifest_id}`);
  return [
    `${code} ${topic} 항목은?`,
    `${code} ${topic} 정리해줘.`,
    `${code} ${topic} 설명해줘.`,
    `${code} ${topic}에는 뭐가 있어?`
  ];
}

function buildEligibleProbes(semanticStore = loadSemanticOverlayStore()) {
  const eligibility = reviewedRoutingEligibility(semanticStore);
  const probes = eligibility.eligible.flatMap((entry) => questionsFor(entry, semanticStore).map((question, variant) => ({
    probe_id: `${entry.manifest_id}.v${variant + 1}`,
    document_id: entry.document_id,
    manifest_id: entry.manifest_id,
    answer_intent: entry.manifest.answer_intent,
    target_type: entry.manifest.target.type,
    question
  })));
  return { eligibility, probes };
}

function expectedMode(probe) {
  if (probe.answer_intent === "document_overview") return "document_overview";
  if (probe.answer_intent === "section_overview") return "section_overview";
  if (probe.answer_intent === "process") return "process";
  if (probe.answer_intent === "multi_criterion") return "multi_criterion";
  return null;
}

async function runAudit() {
  const semanticStore = loadSemanticOverlayStore();
  const { eligibility, probes } = buildEligibleProbes(semanticStore);
  const { records, index } = loadStore();
  const store = createStore();
  store.index(records);
  const results = [];

  for (const probe of probes) {
    const envelope = await answerEnvelope(probe.question, records, { index, store, fallbackMode: "source_excerpts" });
    const selectedManifests = (envelope.semantic_coverage && envelope.semantic_coverage.manifests || [])
      .map((manifest) => manifest.manifest_id);
    const claimDocuments = [...new Set((envelope.claims || []).map((claim) => claim.record.document_id))];
    const claimsGrounded = (envelope.claims || []).length > 0 && (envelope.claims || []).every((claim) =>
      claim.record && claim.record.review_status === "reviewed" && claim.source_unit_id && claim.citation
    );
    const mode = expectedMode(probe);
    const checks = {
      structured: envelope.route === "structured",
      manifest_selected: selectedManifests.includes(probe.manifest_id),
      correct_document_scope: claimDocuments.length === 1 && claimDocuments[0] === probe.document_id,
      claims_grounded: claimsGrounded,
      expected_mode: mode === null || envelope.mode === mode,
      expected_answer_intent: envelope.answer_intent === probe.answer_intent
    };
    const hardGateChecks = [
      checks.structured,
      checks.manifest_selected,
      checks.correct_document_scope,
      checks.claims_grounded
    ];
    results.push({
      ...probe,
      route: envelope.route,
      mode: envelope.mode,
      actual_answer_intent: envelope.answer_intent,
      claim_count: (envelope.claims || []).length,
      claim_documents: claimDocuments,
      selected_manifest_ids: selectedManifests,
      checks,
      passed: hardGateChecks.every(Boolean)
    });
  }

  return {
    generated_at: new Date().toISOString(),
    eligible_manifest_count: eligibility.eligible.length,
    ineligible_manifests: eligibility.ineligible.map(({ document_id, manifest_id, reason }) => ({ document_id, manifest_id, reason })),
    probe_count: probes.length,
    passed: results.filter((result) => result.passed).length,
    mode_or_intent_diagnostics: results.filter((result) => !result.checks.expected_mode || !result.checks.expected_answer_intent).length,
    results
  };
}

async function main() {
  const report = await runAudit();
  fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
  fs.writeFileSync(OUTPUT_PATH, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  console.log(`Eligible manifests: ${report.eligible_manifest_count}`);
  console.log(`Structured routing audit: ${report.passed}/${report.probe_count}`);
  console.log(`Ineligible manifests: ${report.ineligible_manifests.length}`);
  console.log(`Mode/intent diagnostics: ${report.mode_or_intent_diagnostics}`);
  console.log(`Output: ${path.relative(ROOT, OUTPUT_PATH)}`);
  for (const result of report.results.filter((item) => !item.passed)) {
    const failed = Object.entries(result.checks).filter(([, ok]) => !ok).map(([name]) => name).join(",");
    console.log(`FAIL ${result.probe_id}: ${result.route}/${result.mode}, intent=${result.actual_answer_intent}, checks=${failed}`);
  }
  if (report.passed !== report.probe_count || report.probe_count !== 220 || report.ineligible_manifests.length !== 0) process.exitCode = 1;
}

if (require.main === module) main().catch((error) => {
  console.error(error.stack || error.message || error);
  process.exitCode = 1;
});

module.exports = { buildEligibleProbes, runAudit, expectedMode };
