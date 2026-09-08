/**
 * Promote Stage E1 (docs/derived_semantic_layer.md §10 단계 E1) only after
 * deterministic validation, the offline summary-attachment audit showing
 * every existing summary_spec reaching its intended manifest, a complete
 * live 50-question run on the current answer contract, and the
 * route-keyed regression policy for the established 16 suitable cases
 * (scripts/stage_e_promotion_shared.js's evaluateEstablishedCase — same
 * list Stage D used; this stage adds no new field to claims/route/mode, so
 * a deterministic established case must still match exactly). Narrow scope
 * only: this promotes the 5 pre-existing pilot summary_specs, not a Stage F
 * hierarchy expansion.
 *
 * Checks the live audit against the CURRENT `ENVELOPE_VERSION`, not a
 * hardcoded per-stage string: once E1/E2/E3 all merged into the same
 * codebase, every live audit run necessarily exercises all three at once
 * (there is no way to run the code "as it was" at the E1-only commit), so
 * there is only ever one meaningful version to check against — whatever
 * engine/answer_envelope.js currently declares.
 *
 * Lifecycle: default (no flags) checks every verify precondition (env vars
 * present) BEFORE touching disk, then runs prepare immediately followed by
 * verify — matching every prior release's single-command usage exactly,
 * with no partial/dangling flip if a precondition is missing. `--prepare`
 * flips this stage's needs_review objects to reviewed and stops — run a
 * fresh live audit against that on-disk state in a separate command, then
 * run `--verify` to check it and finalize. `--rollback` reverts a pending
 * (not yet verified) prepare.
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

const LABEL = "stage-e1";
const ROOT = path.resolve(__dirname, "..");
const OVERLAY_DIR = path.join(ROOT, "data", "derived", "semantic");
const AUDIT_PATH = process.env.GUIDELINE_STAGE_E1_AUDIT_INPUT
  ? path.resolve(process.env.GUIDELINE_STAGE_E1_AUDIT_INPUT)
  : path.join(ROOT, "logs", "runtime", "semantic_stage_e1_audit.json");

const COLLECTIONS = [{ dir: OVERLAY_DIR, collectionKey: "summary_specs", idField: "summary_id" }];

function assertOfflineAudit() {
  if (!fs.existsSync(AUDIT_PATH)) throw new Error(`Run scripts/run_semantic_stage_e1_audit.js first (expected ${path.relative(ROOT, AUDIT_PATH)})`);
  const results = JSON.parse(fs.readFileSync(AUDIT_PATH, "utf8"));
  const misses = results.filter((item) => !item.summary_attached);
  if (misses.length > 0) throw new Error(`Stage E1 offline audit has unattached summaries: ${misses.map((item) => item.summary_id).join(", ")}`);
  return results;
}

/** Throws before any disk write if verify() could not possibly succeed later — same fail-fast guarantee the single-command flow always had. */
function assertVerifyPreconditions() {
  if (!process.env.GUIDELINE_STAGE_E1_LIVE_AUDIT_INPUT) throw new Error(`Set GUIDELINE_STAGE_E1_LIVE_AUDIT_INPUT to a complete live 50-question audit on answer contract ${ENVELOPE_VERSION}`);
  if (process.env.GUIDELINE_STAGE_E1_AUDIT_REVIEW_ATTESTED !== "true") {
    throw new Error("Set GUIDELINE_STAGE_E1_AUDIT_REVIEW_ATTESTED=true only after reviewing the live audit against its per-question minimum contracts");
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
  console.log(`Prepared "${LABEL}": ${receipt.changed.length} summary_spec(s) flipped to reviewed. Fingerprint: ${receipt.post_fingerprint}`);
  return receipt;
}

function verify() {
  assertVerifyPreconditions();
  const offlineResults = assertOfflineAudit();
  const livePath = path.resolve(process.env.GUIDELINE_STAGE_E1_LIVE_AUDIT_INPUT);
  const { live } = verifyAndFinalizePromotion(LABEL, livePath, ENVELOPE_VERSION, process.env.GUIDELINE_STAGE_E1_BASELINE_AUDIT);

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
  // combined (legacy default): fail fast on missing preconditions before
  // touching disk, then prepare, then verify — in one invocation.
  assertVerifyPreconditions();
  prepare();
  verify();
}

if (require.main === module) main();

module.exports = { main, prepare, verify, parseArgs, LABEL, COLLECTIONS };
