/**
 * Promote Stage E1 (docs/derived_semantic_layer.md §10 단계 E1) only after
 * deterministic validation, the offline summary-attachment audit showing
 * every existing summary_spec reaching its intended manifest, a complete
 * live 50-question run on the current answer contract, and an exact
 * regression check for the established 16 suitable cases (same list Stage D
 * used — this stage adds no new field to claims/route/mode, so those cases
 * must be byte-for-byte unaffected). Narrow scope only: this promotes the 5
 * pre-existing pilot summary_specs, not a Stage F hierarchy expansion.
 *
 * Checks the live audit against the CURRENT `ENVELOPE_VERSION`, not a
 * hardcoded per-stage string: once E1/E2/E3 all merged into the same
 * codebase, every live audit run necessarily exercises all three at once
 * (there is no way to run the code "as it was" at the E1-only commit), so
 * there is only ever one meaningful version to check against — whatever
 * engine/answer_envelope.js currently declares.
 */
const fs = require("node:fs");
const path = require("node:path");

const { validateSemanticOverlays } = require("../validation/validate_semantic_overlay");
const { ENVELOPE_VERSION } = require("../engine/answer_envelope");
const { ESTABLISHED_SUITABLE_IDS, assertLiveAuditRegression } = require("./stage_e_promotion_shared");

const ROOT = path.resolve(__dirname, "..");
const OVERLAY_DIR = path.join(ROOT, "data", "derived", "semantic");
const AUDIT_PATH = process.env.GUIDELINE_STAGE_E1_AUDIT_INPUT
  ? path.resolve(process.env.GUIDELINE_STAGE_E1_AUDIT_INPUT)
  : path.join(ROOT, "logs", "runtime", "semantic_stage_e1_audit.json");

function assertOfflineAudit() {
  if (!fs.existsSync(AUDIT_PATH)) throw new Error(`Run scripts/run_semantic_stage_e1_audit.js first (expected ${path.relative(ROOT, AUDIT_PATH)})`);
  const results = JSON.parse(fs.readFileSync(AUDIT_PATH, "utf8"));
  const misses = results.filter((item) => !item.summary_attached);
  if (misses.length > 0) throw new Error(`Stage E1 offline audit has unattached summaries: ${misses.map((item) => item.summary_id).join(", ")}`);
  return results;
}

function main() {
  const validationBefore = validateSemanticOverlays();
  if (!validationBefore.ok) throw new Error(`Semantic overlay validation failed:\n${validationBefore.errors.join("\n")}`);

  const offlineResults = assertOfflineAudit();

  const livePathValue = process.env.GUIDELINE_STAGE_E1_LIVE_AUDIT_INPUT;
  if (!livePathValue) throw new Error(`Set GUIDELINE_STAGE_E1_LIVE_AUDIT_INPUT to a complete live 50-question audit on answer contract ${ENVELOPE_VERSION}`);
  if (process.env.GUIDELINE_STAGE_E1_AUDIT_REVIEW_ATTESTED !== "true") {
    throw new Error("Set GUIDELINE_STAGE_E1_AUDIT_REVIEW_ATTESTED=true only after reviewing the live audit against its per-question minimum contracts");
  }
  const livePath = path.resolve(livePathValue);
  assertLiveAuditRegression(livePath, ENVELOPE_VERSION, process.env.GUIDELINE_STAGE_E1_BASELINE_AUDIT);

  let promoted = 0;
  for (const name of fs.readdirSync(OVERLAY_DIR).filter((item) => item.endsWith(".json")).sort()) {
    const file = path.join(OVERLAY_DIR, name);
    const overlay = JSON.parse(fs.readFileSync(file, "utf8"));
    for (const summary of overlay.summary_specs || []) {
      if (summary.review_status !== "needs_review") continue;
      summary.review_status = "reviewed";
      promoted += 1;
    }
    fs.writeFileSync(file, `${JSON.stringify(overlay, null, 2)}\n`, "utf8");
  }

  const validationAfter = validateSemanticOverlays();
  if (!validationAfter.ok) throw new Error(`Post-promotion semantic validation failed:\n${validationAfter.errors.join("\n")}`);
  console.log(`Promoted ${promoted} summary_spec(s) to reviewed.`);
  console.log(`Offline audit: ${offlineResults.length}/${offlineResults.length} attached to their intended manifest.`);
  console.log(`Live audit: ${path.relative(ROOT, livePath)} (50/50, answer contract ${ENVELOPE_VERSION})`);
  console.log(`Established suitable regression guard: ${ESTABLISHED_SUITABLE_IDS.length}/${ESTABLISHED_SUITABLE_IDS.length} unchanged`);
}

if (require.main === module) main();

module.exports = { main };
