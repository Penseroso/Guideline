/**
 * Promote the semantic overlay's summary_specs/salience_profiles
 * (built by build_semantic_summaries.js) only after deterministic
 * validation, the offline attachment audit
 * (audit_semantic_summary_routing.js) showing every new object reaches
 * its intended manifest, and a complete live 50-question run against the
 * *exact* on-disk state this promotion produces (see
 * semantic_promotion_lifecycle.js's computeSemanticStateFingerprint),
 * with the route-keyed established-16-suitable-case regression policy
 * (evaluateEstablishedCase).
 *
 * Prepare-then-verify, not verify-then-prepare: reviewing a manifest's
 * semantic_coverage requires the manifest's summary/salience to actually be
 * `reviewed` when the live audit runs, so a "prove it's safe" audit
 * generated *before* activation proves nothing about that activation (this
 * is exactly what the original promotion of this layer got wrong the first
 * time — see history/verification/semantic_stage_f_2026-09-08.md's
 * "Post-activation re-verification" section). `--prepare` writes the flip
 * to disk and stops; a fresh live audit run after that (in a separate
 * command) is the only kind `--verify` will accept — its embedded
 * fingerprint must match exactly what `--prepare` left on disk, and either
 * step's failure rolls back only this promotion's own flip.
 *
 * Lifecycle: default (no flags) checks every verify precondition before
 * touching disk, then runs prepare immediately followed by verify — the
 * same single-command behavior every prior release used.
 */
const fs = require("node:fs");
const path = require("node:path");

const { validateSemanticOverlays } = require("../validation/validate_semantic_overlay");
const { ENVELOPE_VERSION } = require("../engine/answer_envelope");
const {
  ESTABLISHED_SUITABLE_IDS,
  prepareTargetState,
  rollbackPreparedState,
  verifyAndFinalizePromotion
} = require("./semantic_promotion_lifecycle");

const LABEL = "semantic-summaries";
const ROOT = path.resolve(__dirname, "..");
const OVERLAY_DIR = path.join(ROOT, "data", "derived", "semantic");
const AUDIT_PATH = process.env.GUIDELINE_SEMANTIC_SUMMARIES_AUDIT_INPUT
  ? path.resolve(process.env.GUIDELINE_SEMANTIC_SUMMARIES_AUDIT_INPUT)
  : path.join(ROOT, "logs", "runtime", "semantic_stage_f_audit.json");

const COLLECTIONS = [
  { dir: OVERLAY_DIR, collectionKey: "summary_specs", idField: "summary_id" },
  { dir: OVERLAY_DIR, collectionKey: "salience_profiles", idField: "profile_id" }
];

function assertOfflineAudit() {
  if (!fs.existsSync(AUDIT_PATH)) throw new Error(`Run scripts/audit_semantic_summary_routing.js first (expected ${path.relative(ROOT, AUDIT_PATH)})`);
  const results = JSON.parse(fs.readFileSync(AUDIT_PATH, "utf8"));
  const misses = results.filter((item) => (item.summary_id && !item.summary_attached) || (item.salience_profile_id && !item.salience_attached));
  if (misses.length > 0) throw new Error(`Offline routing audit has unattached object(s): ${misses.map((item) => item.manifest_id).join(", ")}`);
  return results;
}

function assertVerifyPreconditions() {
  if (!process.env.GUIDELINE_SEMANTIC_SUMMARIES_LIVE_AUDIT_INPUT) throw new Error(`Set GUIDELINE_SEMANTIC_SUMMARIES_LIVE_AUDIT_INPUT to a live 50-question audit run AFTER activating this promotion on disk (answer contract ${ENVELOPE_VERSION})`);
  if (process.env.GUIDELINE_SEMANTIC_SUMMARIES_AUDIT_REVIEW_ATTESTED !== "true") {
    throw new Error("Set GUIDELINE_SEMANTIC_SUMMARIES_AUDIT_REVIEW_ATTESTED=true only after reviewing the live audit against its per-question minimum contracts");
  }
}

function parseArgs(argv) {
  const args = { prepare: argv.includes("--prepare"), verify: argv.includes("--verify"), rollback: argv.includes("--rollback") };
  args.combined = !args.prepare && !args.verify && !args.rollback;
  return args;
}

function prepare() {
  const validationBefore = validateSemanticOverlays();
  if (!validationBefore.ok) throw new Error(`Semantic overlay validation failed:\n${validationBefore.errors.join("\n")}`);
  const offlineResults = assertOfflineAudit();
  const receipt = prepareTargetState(LABEL, COLLECTIONS);
  const promotedSummaries = receipt.changed.filter((item) => item.collectionKey === "summary_specs").length;
  const promotedSalience = receipt.changed.filter((item) => item.collectionKey === "salience_profiles").length;
  console.log(`Prepared "${LABEL}": ${promotedSummaries} summary_spec(s) and ${promotedSalience} salience_profile(s) flipped to reviewed. Fingerprint: ${receipt.post_fingerprint}`);
  console.log(`Offline audit: ${offlineResults.length} manifest(s) checked, all attached.`);
  return receipt;
}

function verify() {
  assertVerifyPreconditions();
  const livePath = path.resolve(process.env.GUIDELINE_SEMANTIC_SUMMARIES_LIVE_AUDIT_INPUT);
  const { live } = verifyAndFinalizePromotion(LABEL, livePath, ENVELOPE_VERSION, process.env.GUIDELINE_SEMANTIC_SUMMARIES_BASELINE_AUDIT);

  const validationAfter = validateSemanticOverlays();
  if (!validationAfter.ok) throw new Error(`Post-promotion semantic validation failed:\n${validationAfter.errors.join("\n")}`);
  console.log(`Live audit: ${path.relative(ROOT, livePath)} (${live.length}/50, answer contract ${ENVELOPE_VERSION}, semantic_state_fingerprint matched current disk state)`);
  console.log(`Established suitable regression guard: ${ESTABLISHED_SUITABLE_IDS.length}/${ESTABLISHED_SUITABLE_IDS.length} unchanged`);
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

if (require.main === module) main();

module.exports = { main, prepare, verify, parseArgs, LABEL, COLLECTIONS };
