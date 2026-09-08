/**
 * Promote Stage F (docs/derived_semantic_layer.md §10 단계 F) only after
 * deterministic validation, the offline attachment audit showing every new
 * summary_spec/salience_profile reaches its intended manifest, and a
 * complete live 50-question run against the *exact* on-disk state this
 * promotion produces (see scripts/stage_e_promotion_shared.js's
 * computeSemanticStateFingerprint), with the established-16-suitable-case
 * regression guard Stage D/E used.
 *
 * Flip-then-verify, not verify-then-flip: reviewing a manifest's
 * semantic_coverage requires the manifest's summary/salience to actually be
 * `reviewed` when the live audit runs, so a "prove it's safe" audit
 * generated *before* today's flip proves nothing about today's flip. This
 * script writes the flip first, then requires a live audit whose embedded
 * fingerprint matches that exact post-flip state, and auto-reverts the
 * flip if the audit or regression check then fails.
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

/** Flips every needs_review summary_spec/salience_profile to reviewed, writing to disk immediately. Returns the exact {file, kind, id} list changed, for revert(). */
function flipToReviewed() {
  const changed = [];
  for (const name of fs.readdirSync(OVERLAY_DIR).filter((item) => item.endsWith(".json")).sort()) {
    const file = path.join(OVERLAY_DIR, name);
    const overlay = JSON.parse(fs.readFileSync(file, "utf8"));
    let touched = false;
    for (const summary of overlay.summary_specs || []) {
      if (summary.review_status !== "needs_review") continue;
      summary.review_status = "reviewed";
      changed.push({ file, kind: "summary_specs", id: summary.summary_id });
      touched = true;
    }
    for (const profile of overlay.salience_profiles || []) {
      if (profile.review_status !== "needs_review") continue;
      profile.review_status = "reviewed";
      changed.push({ file, kind: "salience_profiles", id: profile.profile_id });
      touched = true;
    }
    if (touched) fs.writeFileSync(file, `${JSON.stringify(overlay, null, 2)}\n`, "utf8");
  }
  return changed;
}

/** Undoes exactly the flips flipToReviewed() just made, by id — never touches anything promoted in an earlier run. */
function revert(changed) {
  const byFile = new Map();
  for (const item of changed) {
    if (!byFile.has(item.file)) byFile.set(item.file, []);
    byFile.get(item.file).push(item);
  }
  for (const [file, items] of byFile) {
    const overlay = JSON.parse(fs.readFileSync(file, "utf8"));
    for (const item of items) {
      const collection = overlay[item.kind] || [];
      const idField = item.kind === "summary_specs" ? "summary_id" : "profile_id";
      const object = collection.find((entry) => entry[idField] === item.id);
      if (object) object.review_status = "needs_review";
    }
    fs.writeFileSync(file, `${JSON.stringify(overlay, null, 2)}\n`, "utf8");
  }
}

function main() {
  const validationBefore = validateSemanticOverlays();
  if (!validationBefore.ok) throw new Error(`Semantic overlay validation failed:\n${validationBefore.errors.join("\n")}`);

  const offlineResults = assertOfflineAudit();

  const livePathValue = process.env.GUIDELINE_STAGE_F_LIVE_AUDIT_INPUT;
  if (!livePathValue) throw new Error(`Set GUIDELINE_STAGE_F_LIVE_AUDIT_INPUT to a live 50-question audit run AFTER activating Stage F on disk (answer contract ${ENVELOPE_VERSION})`);
  if (process.env.GUIDELINE_STAGE_F_AUDIT_REVIEW_ATTESTED !== "true") {
    throw new Error("Set GUIDELINE_STAGE_F_AUDIT_REVIEW_ATTESTED=true only after reviewing the live audit against its per-question minimum contracts");
  }
  const livePath = path.resolve(livePathValue);

  const changed = flipToReviewed();
  try {
    assertLiveAuditRegression(livePath, ENVELOPE_VERSION, process.env.GUIDELINE_STAGE_F_BASELINE_AUDIT);
    const validationAfter = validateSemanticOverlays();
    if (!validationAfter.ok) throw new Error(`Post-promotion semantic validation failed:\n${validationAfter.errors.join("\n")}`);
  } catch (error) {
    if (changed.length > 0) {
      revert(changed);
      console.error(`Reverted ${changed.length} object(s) back to needs_review after the check below failed.`);
    }
    throw error;
  }

  const promotedSummaries = changed.filter((item) => item.kind === "summary_specs").length;
  const promotedSalience = changed.filter((item) => item.kind === "salience_profiles").length;
  console.log(`Promoted ${promotedSummaries} summary_spec(s) and ${promotedSalience} salience_profile(s) to reviewed.`);
  console.log(`Offline audit: ${offlineResults.length} manifest(s) checked, all attached.`);
  console.log(`Live audit: ${path.relative(ROOT, livePath)} (50/50, answer contract ${ENVELOPE_VERSION}, semantic_state_fingerprint matched current disk state)`);
  console.log(`Established suitable regression guard: ${ESTABLISHED_SUITABLE_IDS.length}/${ESTABLISHED_SUITABLE_IDS.length} unchanged`);
}

if (require.main === module) main();

module.exports = { main };
