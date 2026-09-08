/**
 * Promote Stage F (docs/derived_semantic_layer.md §10 단계 F) only after
 * deterministic validation, the offline attachment audit showing every new
 * summary_spec/salience_profile reaches its intended manifest, a complete
 * live 50-question run on the current answer contract, and the same
 * established-16-suitable-case regression guard Stage D/E used. Promotes
 * every needs_review summary_spec/salience_profile across all 6 overlays —
 * by this point that is exactly Stage F's new objects, since Stage E0-E3
 * already promoted the 5/7 pre-existing pilot objects.
 */
const fs = require("node:fs");
const path = require("node:path");

const { validateSemanticOverlays } = require("../validation/validate_semantic_overlay");
const { ENVELOPE_VERSION } = require("../engine/answer_envelope");
const { ESTABLISHED_SUITABLE_IDS, assertLiveAuditRegression } = require("./stage_e_promotion_shared");

const ROOT = path.resolve(__dirname, "..");
const OVERLAY_DIR = path.join(ROOT, "data", "derived", "semantic");
const AUDIT_PATH = process.env.GUIDELINE_STAGE_F_AUDIT_INPUT
  ? path.resolve(process.env.GUIDELINE_STAGE_F_AUDIT_INPUT)
  : path.join(ROOT, "logs", "runtime", "semantic_stage_f_audit.json");

function assertOfflineAudit() {
  if (!fs.existsSync(AUDIT_PATH)) throw new Error(`Run scripts/run_semantic_stage_f_audit.js first (expected ${path.relative(ROOT, AUDIT_PATH)})`);
  const results = JSON.parse(fs.readFileSync(AUDIT_PATH, "utf8"));
  const misses = results.filter((item) => (item.summary_id && !item.summary_attached) || (item.salience_profile_id && !item.salience_attached));
  if (misses.length > 0) throw new Error(`Stage F offline audit has unattached object(s): ${misses.map((item) => item.manifest_id).join(", ")}`);
  return results;
}

function main() {
  const validationBefore = validateSemanticOverlays();
  if (!validationBefore.ok) throw new Error(`Semantic overlay validation failed:\n${validationBefore.errors.join("\n")}`);

  const offlineResults = assertOfflineAudit();

  const livePathValue = process.env.GUIDELINE_STAGE_F_LIVE_AUDIT_INPUT;
  if (!livePathValue) throw new Error(`Set GUIDELINE_STAGE_F_LIVE_AUDIT_INPUT to a complete live 50-question audit on answer contract ${ENVELOPE_VERSION}`);
  if (process.env.GUIDELINE_STAGE_F_AUDIT_REVIEW_ATTESTED !== "true") {
    throw new Error("Set GUIDELINE_STAGE_F_AUDIT_REVIEW_ATTESTED=true only after reviewing the live audit against its per-question minimum contracts");
  }
  const livePath = path.resolve(livePathValue);
  assertLiveAuditRegression(livePath, ENVELOPE_VERSION, process.env.GUIDELINE_STAGE_F_BASELINE_AUDIT);

  let promotedSummaries = 0;
  let promotedSalience = 0;
  for (const name of fs.readdirSync(OVERLAY_DIR).filter((item) => item.endsWith(".json")).sort()) {
    const file = path.join(OVERLAY_DIR, name);
    const overlay = JSON.parse(fs.readFileSync(file, "utf8"));
    for (const summary of overlay.summary_specs || []) {
      if (summary.review_status !== "needs_review") continue;
      summary.review_status = "reviewed";
      promotedSummaries += 1;
    }
    for (const profile of overlay.salience_profiles || []) {
      if (profile.review_status !== "needs_review") continue;
      profile.review_status = "reviewed";
      promotedSalience += 1;
    }
    fs.writeFileSync(file, `${JSON.stringify(overlay, null, 2)}\n`, "utf8");
  }

  const validationAfter = validateSemanticOverlays();
  if (!validationAfter.ok) throw new Error(`Post-promotion semantic validation failed:\n${validationAfter.errors.join("\n")}`);
  console.log(`Promoted ${promotedSummaries} summary_spec(s) and ${promotedSalience} salience_profile(s) to reviewed.`);
  console.log(`Offline audit: ${offlineResults.length} manifest(s) checked, all attached.`);
  console.log(`Live audit: ${path.relative(ROOT, livePath)} (50/50, answer contract ${ENVELOPE_VERSION})`);
  console.log(`Established suitable regression guard: ${ESTABLISHED_SUITABLE_IDS.length}/${ESTABLISHED_SUITABLE_IDS.length} unchanged`);
}

if (require.main === module) main();

module.exports = { main };
