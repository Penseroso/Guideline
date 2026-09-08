/**
 * Promote Stage E2 (docs/derived_semantic_layer.md §10 단계 E2) only after
 * deterministic validation, the offline presentation-text audit showing
 * every existing presentation entry renders in the right sentence_roles
 * order, a complete live 50-question run on answer contract 2.4.0, and the
 * same route-keyed established-16-suitable-case regression policy Stage
 * D/E1 used (scripts/stage_e_promotion_shared.js's evaluateEstablishedCase).
 * Narrow scope only: promotes the 3 existing presentation entries (ema_fih,
 * ich_m3_r2, ich_s6_r1). fda_ada and fda_ada_2014 have a summary_spec but
 * no presentation file at all — nothing to promote there until Stage F
 * authors one.
 *
 * Lifecycle: default (no flags) checks every verify precondition before
 * touching disk, then runs prepare immediately followed by verify — same
 * single-command behavior every prior release used. `--prepare` flips this
 * stage's needs_review entries to reviewed and stops; run a fresh live
 * audit against that on-disk state separately, then `--verify` checks it
 * and finalizes. `--rollback` reverts a pending (not yet verified) prepare.
 */
const fs = require("node:fs");
const path = require("node:path");

const { validateSemanticOverlays } = require("../validation/validate_semantic_overlay");
const { PRESENTATION_DIR } = require("../engine/semantic_overlay_store");
const { ENVELOPE_VERSION } = require("../engine/answer_envelope");
const {
  ESTABLISHED_SUITABLE_IDS,
  prepareTargetState,
  rollbackPreparedState,
  verifyAndFinalizePromotion
} = require("./stage_e_promotion_shared");

const LABEL = "stage-e2";
const ROOT = path.resolve(__dirname, "..");
const AUDIT_PATH = process.env.GUIDELINE_STAGE_E2_AUDIT_INPUT
  ? path.resolve(process.env.GUIDELINE_STAGE_E2_AUDIT_INPUT)
  : path.join(ROOT, "logs", "runtime", "semantic_stage_e2_audit.json");

const COLLECTIONS = [{ dir: PRESENTATION_DIR, collectionKey: "entries", idField: "semantic_id" }];

function assertOfflineAudit() {
  if (!fs.existsSync(AUDIT_PATH)) throw new Error(`Run scripts/run_semantic_stage_e2_audit.js first (expected ${path.relative(ROOT, AUDIT_PATH)})`);
  const results = JSON.parse(fs.readFileSync(AUDIT_PATH, "utf8"));
  const misses = results.filter((item) => !item.text_rendered || !item.sentence_roles_match);
  if (misses.length > 0) throw new Error(`Stage E2 offline audit has failing case(s): ${misses.map((item) => item.summary_id).join(", ")}`);
  return results;
}

function assertVerifyPreconditions() {
  if (!process.env.GUIDELINE_STAGE_E2_LIVE_AUDIT_INPUT) throw new Error(`Set GUIDELINE_STAGE_E2_LIVE_AUDIT_INPUT to a complete live 50-question audit on answer contract ${ENVELOPE_VERSION}`);
  if (process.env.GUIDELINE_STAGE_E2_AUDIT_REVIEW_ATTESTED !== "true") {
    throw new Error("Set GUIDELINE_STAGE_E2_AUDIT_REVIEW_ATTESTED=true only after reviewing the live audit against its per-question minimum contracts");
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
  console.log(`Prepared "${LABEL}": ${receipt.changed.length} presentation entry(ies) flipped to reviewed. Fingerprint: ${receipt.post_fingerprint}`);
  return receipt;
}

function verify() {
  assertVerifyPreconditions();
  const offlineResults = assertOfflineAudit();
  const livePath = path.resolve(process.env.GUIDELINE_STAGE_E2_LIVE_AUDIT_INPUT);
  const { live } = verifyAndFinalizePromotion(LABEL, livePath, ENVELOPE_VERSION, process.env.GUIDELINE_STAGE_E2_BASELINE_AUDIT);

  const validationAfter = validateSemanticOverlays();
  if (!validationAfter.ok) throw new Error(`Post-promotion semantic validation failed:\n${validationAfter.errors.join("\n")}`);
  console.log(`Offline audit: ${offlineResults.length}/${offlineResults.length} rendered correctly.`);
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
