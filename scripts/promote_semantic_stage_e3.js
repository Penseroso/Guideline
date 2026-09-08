/**
 * Promote Stage E3 (docs/derived_semantic_layer.md §10 단계 E3) only after
 * deterministic validation, the offline salience-attachment audit showing
 * every existing salience_profile reaches its intended manifest, a complete
 * live 50-question run on answer contract 2.5.0, and the same
 * established-16-suitable-case regression guard Stage D/E1/E2 used. Narrow
 * scope only: promotes the 7 pre-existing pilot salience_profiles, not a
 * Stage F hierarchy expansion.
 */
const fs = require("node:fs");
const path = require("node:path");

const { validateSemanticOverlays } = require("../validation/validate_semantic_overlay");
const { ESTABLISHED_SUITABLE_IDS, assertLiveAuditRegression } = require("./stage_e_promotion_shared");

const ROOT = path.resolve(__dirname, "..");
const OVERLAY_DIR = path.join(ROOT, "data", "derived", "semantic");
const AUDIT_PATH = process.env.GUIDELINE_STAGE_E3_AUDIT_INPUT
  ? path.resolve(process.env.GUIDELINE_STAGE_E3_AUDIT_INPUT)
  : path.join(ROOT, "logs", "runtime", "semantic_stage_e3_audit.json");

function assertOfflineAudit() {
  if (!fs.existsSync(AUDIT_PATH)) throw new Error(`Run scripts/run_semantic_stage_e3_audit.js first (expected ${path.relative(ROOT, AUDIT_PATH)})`);
  const results = JSON.parse(fs.readFileSync(AUDIT_PATH, "utf8"));
  const misses = results.filter((item) => !item.salience_attached);
  if (misses.length > 0) throw new Error(`Stage E3 offline audit has unattached salience_profile(s): ${misses.map((item) => item.profile_id).join(", ")}`);
  return results;
}

function main() {
  const validationBefore = validateSemanticOverlays();
  if (!validationBefore.ok) throw new Error(`Semantic overlay validation failed:\n${validationBefore.errors.join("\n")}`);

  const offlineResults = assertOfflineAudit();

  const livePathValue = process.env.GUIDELINE_STAGE_E3_LIVE_AUDIT_INPUT;
  if (!livePathValue) throw new Error("Set GUIDELINE_STAGE_E3_LIVE_AUDIT_INPUT to a complete live 50-question audit on answer contract 2.5.0");
  if (process.env.GUIDELINE_STAGE_E3_AUDIT_REVIEW_ATTESTED !== "true") {
    throw new Error("Set GUIDELINE_STAGE_E3_AUDIT_REVIEW_ATTESTED=true only after reviewing the live audit against its per-question minimum contracts");
  }
  const livePath = path.resolve(livePathValue);
  assertLiveAuditRegression(livePath, "2.5.0", process.env.GUIDELINE_STAGE_E3_BASELINE_AUDIT);

  let promoted = 0;
  for (const name of fs.readdirSync(OVERLAY_DIR).filter((item) => item.endsWith(".json")).sort()) {
    const file = path.join(OVERLAY_DIR, name);
    const overlay = JSON.parse(fs.readFileSync(file, "utf8"));
    for (const profile of overlay.salience_profiles || []) {
      if (profile.review_status !== "needs_review") continue;
      profile.review_status = "reviewed";
      promoted += 1;
    }
    fs.writeFileSync(file, `${JSON.stringify(overlay, null, 2)}\n`, "utf8");
  }

  const validationAfter = validateSemanticOverlays();
  if (!validationAfter.ok) throw new Error(`Post-promotion semantic validation failed:\n${validationAfter.errors.join("\n")}`);
  console.log(`Promoted ${promoted} salience_profile(s) to reviewed.`);
  console.log(`Offline audit: ${offlineResults.length}/${offlineResults.length} attached to their intended manifest.`);
  console.log(`Live audit: ${path.relative(ROOT, livePath)} (50/50, answer contract 2.5.0)`);
  console.log(`Established suitable regression guard: ${ESTABLISHED_SUITABLE_IDS.length}/${ESTABLISHED_SUITABLE_IDS.length} unchanged`);
}

if (require.main === module) main();

module.exports = { main };
