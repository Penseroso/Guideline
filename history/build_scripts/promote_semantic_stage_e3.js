/**
 * Promote Stage E3 (docs/derived_semantic_layer.md §10 단계 E3) only after
 * deterministic validation, the offline salience-attachment audit showing
 * every existing salience_profile reaches its intended manifest, a complete
 * live 50-question run on answer contract 2.5.0, and the same route-keyed
 * established-16-suitable-case regression policy Stage D/E1/E2 used
 * (scripts/stage_e_promotion_shared.js's evaluateEstablishedCase). Narrow
 * scope only: promotes the 7 pre-existing pilot salience_profiles, not a
 * Stage F hierarchy expansion.
 *
 * Lifecycle: default (no flags) checks every verify precondition before
 * touching disk, then runs prepare immediately followed by verify — same
 * single-command behavior every prior release used. `--prepare` flips this
 * stage's needs_review salience_profiles to reviewed and stops; run a
 * fresh live audit against that on-disk state separately, then `--verify`
 * checks it and finalizes. `--rollback` reverts a pending prepare.
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
} = require("./stage_e_promotion_shared");

const LABEL = "stage-e3";
const ROOT = path.resolve(__dirname, "..");
const OVERLAY_DIR = path.join(ROOT, "data", "derived", "semantic");
const AUDIT_PATH = process.env.GUIDELINE_STAGE_E3_AUDIT_INPUT
  ? path.resolve(process.env.GUIDELINE_STAGE_E3_AUDIT_INPUT)
  : path.join(ROOT, "logs", "runtime", "semantic_stage_e3_audit.json");

const COLLECTIONS = [{ dir: OVERLAY_DIR, collectionKey: "salience_profiles", idField: "profile_id" }];

function assertOfflineAudit() {
  if (!fs.existsSync(AUDIT_PATH)) throw new Error(`Run scripts/run_semantic_stage_e3_audit.js first (expected ${path.relative(ROOT, AUDIT_PATH)})`);
  const results = JSON.parse(fs.readFileSync(AUDIT_PATH, "utf8"));
  const misses = results.filter((item) => !item.salience_attached);
  if (misses.length > 0) throw new Error(`Stage E3 offline audit has unattached salience_profile(s): ${misses.map((item) => item.profile_id).join(", ")}`);
  return results;
}

function assertVerifyPreconditions() {
  if (!process.env.GUIDELINE_STAGE_E3_LIVE_AUDIT_INPUT) throw new Error(`Set GUIDELINE_STAGE_E3_LIVE_AUDIT_INPUT to a complete live 50-question audit on answer contract ${ENVELOPE_VERSION}`);
  if (process.env.GUIDELINE_STAGE_E3_AUDIT_REVIEW_ATTESTED !== "true") {
    throw new Error("Set GUIDELINE_STAGE_E3_AUDIT_REVIEW_ATTESTED=true only after reviewing the live audit against its per-question minimum contracts");
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
  assertOfflineAudit();
  const receipt = prepareTargetState(LABEL, COLLECTIONS);
  console.log(`Prepared "${LABEL}": ${receipt.changed.length} salience_profile(s) flipped to reviewed. Fingerprint: ${receipt.post_fingerprint}`);
  return receipt;
}

function verify() {
  assertVerifyPreconditions();
  const offlineResults = assertOfflineAudit();
  const livePath = path.resolve(process.env.GUIDELINE_STAGE_E3_LIVE_AUDIT_INPUT);
  const { live } = verifyAndFinalizePromotion(LABEL, livePath, ENVELOPE_VERSION, process.env.GUIDELINE_STAGE_E3_BASELINE_AUDIT);

  const validationAfter = validateSemanticOverlays();
  if (!validationAfter.ok) throw new Error(`Post-promotion semantic validation failed:\n${validationAfter.errors.join("\n")}`);
  console.log(`Offline audit: ${offlineResults.length}/${offlineResults.length} attached to their intended manifest.`);
  console.log(`Live audit: ${path.relative(ROOT, livePath)} (${live.length}/50, answer contract ${ENVELOPE_VERSION})`);
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
