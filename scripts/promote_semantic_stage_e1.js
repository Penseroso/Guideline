/**
 * Promote Stage E1 (docs/derived_semantic_layer.md §10 단계 E1) only after
 * deterministic validation, the offline summary-attachment audit showing
 * every existing summary_spec reaching its intended manifest, a complete
 * live 50-question run on answer contract 2.3.0, and an exact regression
 * check for the established 16 suitable cases (same list Stage D used —
 * this stage adds no new field to claims/route/mode, so those cases must
 * be byte-for-byte unaffected). Narrow scope only: this promotes the 5
 * pre-existing pilot summary_specs, not a Stage F hierarchy expansion.
 */
const fs = require("node:fs");
const path = require("node:path");

const { validateSemanticOverlays } = require("../validation/validate_semantic_overlay");
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
  if (!livePathValue) throw new Error("Set GUIDELINE_STAGE_E1_LIVE_AUDIT_INPUT to a complete live 50-question audit on answer contract 2.3.0");
  if (process.env.GUIDELINE_STAGE_E1_AUDIT_REVIEW_ATTESTED !== "true") {
    throw new Error("Set GUIDELINE_STAGE_E1_AUDIT_REVIEW_ATTESTED=true only after reviewing the live audit against its per-question minimum contracts");
  }
  const livePath = path.resolve(livePathValue);
  assertLiveAuditRegression(livePath, "2.3.0", process.env.GUIDELINE_STAGE_E1_BASELINE_AUDIT);

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
  console.log(`Live audit: ${path.relative(ROOT, livePath)} (50/50, answer contract 2.3.0)`);
  console.log(`Established suitable regression guard: ${ESTABLISHED_SUITABLE_IDS.length}/${ESTABLISHED_SUITABLE_IDS.length} unchanged`);
}

if (require.main === module) main();

module.exports = { main };
