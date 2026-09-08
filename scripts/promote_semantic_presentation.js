/**
 * Promote (sign off on) the semantic-presentation layer
 * (data/derived/presentation/ko/*.json's summary entries) after a fresh
 * post-activation live 50-question audit and the route-keyed
 * established-16-suitable-case regression policy
 * (scripts/semantic_promotion_lifecycle.js's evaluateEstablishedCase).
 *
 * Unlike summary_specs/salience_profiles, presentation entries are already `reviewed` at
 * authoring time (scripts/author_semantic_presentation.js sets
 * review_status directly from its own verification step) — there is no
 * separate needs_review -> reviewed flip to make here. `prepare()` still
 * runs the same lifecycle step for consistency: it asserts
 * auditSemanticPresentation() is clean (the intended target state really
 * is what's on disk) and records a receipt with the current fingerprint,
 * so `verify()` can gate on "no drift since prepare" exactly like every
 * other promotion, and a stale/pre-activation live audit can never pass
 * here either.
 *
 * Lifecycle: default (no flags) checks every verify precondition before
 * recording anything, then runs prepare immediately followed by verify —
 * the same single-command behavior every prior release used. `--prepare`
 * records the receipt and stops; run a fresh live audit in a separate
 * command, then `--verify` checks it and finalizes. `--rollback` cancels a
 * pending (not yet verified) prepare.
 */
const path = require("node:path");

const { auditSemanticPresentation } = require("./audit_semantic_presentation");
const { ENVELOPE_VERSION } = require("../engine/answer_envelope");
const {
  prepareTargetState,
  rollbackPreparedState,
  verifyAndFinalizePromotion
} = require("./semantic_promotion_lifecycle");

const LABEL = "presentation";
const ROOT = path.resolve(__dirname, "..");
const DEFAULT_BASELINE = path.join(ROOT, "logs", "runtime", "answer_suitability_50_raw_2026-09-08_stage_f.json");

function assertVerifyPreconditions() {
  if (!process.env.GUIDELINE_SEMANTIC_PRESENTATION_LIVE_AUDIT_INPUT) {
    throw new Error(`Set GUIDELINE_SEMANTIC_PRESENTATION_LIVE_AUDIT_INPUT to a complete post-activation 50-question audit on answer contract ${ENVELOPE_VERSION}`);
  }
  if (process.env.GUIDELINE_SEMANTIC_PRESENTATION_AUDIT_REVIEW_ATTESTED !== "true") {
    throw new Error("Set GUIDELINE_SEMANTIC_PRESENTATION_AUDIT_REVIEW_ATTESTED=true only after reviewing the live audit and explicit gap inventory");
  }
}

function parseArgs(argv) {
  const args = { prepare: argv.includes("--prepare"), verify: argv.includes("--verify"), rollback: argv.includes("--rollback") };
  args.combined = !args.prepare && !args.verify && !args.rollback;
  return args;
}

function prepare() {
  const audit = auditSemanticPresentation();
  if (!audit.ok) throw new Error(`Semantic presentation audit failed:\n${audit.errors.join("\n")}`);
  const receipt = prepareTargetState(LABEL, []);
  const gapCount = audit.rows.reduce((sum, row) => sum + row.gap_count, 0);
  console.log(`Prepared "${LABEL}": ${audit.rows.length}/${audit.rows.length} fresh reviewed summary entries already on disk (nothing to flip — presentation entries are reviewed at authoring time).`);
  console.log(`Explicit no-structured-evidence facet gaps: ${gapCount}.`);
  console.log(`Fingerprint: ${receipt.post_fingerprint}`);
  return receipt;
}

function verify() {
  assertVerifyPreconditions();
  const livePath = path.resolve(process.env.GUIDELINE_SEMANTIC_PRESENTATION_LIVE_AUDIT_INPUT);
  const baseline = process.env.GUIDELINE_SEMANTIC_PRESENTATION_BASELINE_AUDIT
    ? path.resolve(process.env.GUIDELINE_SEMANTIC_PRESENTATION_BASELINE_AUDIT)
    : DEFAULT_BASELINE;
  const { live } = verifyAndFinalizePromotion(LABEL, livePath, ENVELOPE_VERSION, baseline);
  console.log(`Live audit: ${path.relative(ROOT, livePath)} (${live.length}/50, answer contract ${ENVELOPE_VERSION}, semantic fingerprint matched).`);
  console.log("Promoted semantic presentation: sign-off complete.");
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.rollback) {
    rollbackPreparedState(LABEL);
    console.log(`Rolled back pending promotion "${LABEL}".`);
    return;
  }
  if (args.prepare) { prepare(); return; }
  if (args.verify) { verify(); return; }
  assertVerifyPreconditions();
  prepare();
  verify();
}

if (require.main === module) {
  try { main(); }
  catch (error) { console.error(error.stack || error.message); process.exit(1); }
}

module.exports = { main, prepare, verify, parseArgs, LABEL };
