const path = require("node:path");

const { auditSemanticPresentation } = require("./audit_semantic_presentation");
const { assertLiveAuditRegression, ESTABLISHED_SUITABLE_IDS } = require("./stage_e_promotion_shared");
const { ENVELOPE_VERSION } = require("../engine/answer_envelope");

const ROOT = path.resolve(__dirname, "..");
const DEFAULT_BASELINE = path.join(ROOT, "logs", "runtime", "answer_suitability_50_raw_2026-09-08_stage_f.json");

function main() {
  const audit = auditSemanticPresentation();
  if (!audit.ok) throw new Error(`Semantic presentation audit failed:\n${audit.errors.join("\n")}`);
  const liveValue = process.env.GUIDELINE_SEMANTIC_PRESENTATION_LIVE_AUDIT_INPUT;
  if (!liveValue) throw new Error(`Set GUIDELINE_SEMANTIC_PRESENTATION_LIVE_AUDIT_INPUT to a complete post-activation 50-question audit on answer contract ${ENVELOPE_VERSION}`);
  if (process.env.GUIDELINE_SEMANTIC_PRESENTATION_AUDIT_REVIEW_ATTESTED !== "true") {
    throw new Error("Set GUIDELINE_SEMANTIC_PRESENTATION_AUDIT_REVIEW_ATTESTED=true only after reviewing the live audit and explicit gap inventory");
  }
  const livePath = path.resolve(liveValue);
  const baseline = process.env.GUIDELINE_SEMANTIC_PRESENTATION_BASELINE_AUDIT
    ? path.resolve(process.env.GUIDELINE_SEMANTIC_PRESENTATION_BASELINE_AUDIT)
    : DEFAULT_BASELINE;
  assertLiveAuditRegression(livePath, ENVELOPE_VERSION, baseline);
  const gapCount = audit.rows.reduce((sum, row) => sum + row.gap_count, 0);
  console.log(`Promoted semantic presentation: ${audit.rows.length}/${audit.rows.length} fresh reviewed summary entries.`);
  console.log(`Explicit no-structured-evidence facet gaps: ${gapCount}.`);
  console.log(`Live audit: ${path.relative(ROOT, livePath)} (50/50, answer contract ${ENVELOPE_VERSION}, semantic fingerprint matched).`);
  console.log(`Established suitable regression guard: ${ESTABLISHED_SUITABLE_IDS.length}/${ESTABLISHED_SUITABLE_IDS.length} unchanged from Stage F.`);
}

if (require.main === module) {
  try { main(); }
  catch (error) { console.error(error.stack || error.message); process.exit(1); }
}

module.exports = { main };

