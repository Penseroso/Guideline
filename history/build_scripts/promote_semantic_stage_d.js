/**
 * Promote Stage D objects only after deterministic verification, a complete
 * live 50-question run, an exact regression check for the established 16
 * suitable cases, and an explicit review attestation for the remaining set.
 */
const fs = require("node:fs");
const path = require("node:path");

const { validateSemanticOverlays } = require("../validation/validate_semantic_overlay");
const { verifyStageD } = require("./verify_semantic_stage_d");
const { PARENT_SECTIONS } = require("./build_semantic_stage_d");

const ROOT = path.resolve(__dirname, "..");
const OVERLAY_DIR = path.join(ROOT, "data", "derived", "semantic");
const BASELINE_PATH = process.env.GUIDELINE_STAGE_D_BASELINE_AUDIT
  ? path.resolve(process.env.GUIDELINE_STAGE_D_BASELINE_AUDIT)
  : path.join(ROOT, "logs", "runtime", "answer_suitability_50_raw_2026-09-07_complete.json");
const ESTABLISHED_SUITABLE_IDS = [
  "Q02", "Q03", "Q04", "Q08", "Q09", "Q12", "Q14", "Q16",
  "Q17", "Q24", "Q25", "Q29", "Q38", "Q41", "Q45", "Q47"
];

function claimIds(item) {
  return new Set((item.envelope.claims || []).map((claim) => claim.record && claim.record.id || claim.record_id).filter(Boolean));
}

function sameSet(a, b) {
  return a.size === b.size && [...a].every((item) => b.has(item));
}

function assertLiveAudit(file) {
  const live = JSON.parse(fs.readFileSync(file, "utf8"));
  if (live.length !== 50 || new Set(live.map((item) => item.id)).size !== 50) {
    throw new Error("Live audit must contain exactly 50 unique question ids");
  }
  const invalid = live.filter((item) => item.error || !item.envelope || !Array.isArray(item.envelope.claims));
  if (invalid.length > 0) throw new Error(`Live audit has invalid envelopes: ${invalid.map((item) => item.id).join(", ")}`);
  const wrongVersion = live.filter((item) => item.envelope.envelope_version !== "2.2.0");
  if (wrongVersion.length > 0) throw new Error(`Live audit is not fully on answer contract 2.2.0: ${wrongVersion.map((item) => item.id).join(", ")}`);

  const baseline = JSON.parse(fs.readFileSync(BASELINE_PATH, "utf8"));
  for (const id of ESTABLISHED_SUITABLE_IDS) {
    const before = baseline.find((item) => item.id === id);
    const after = live.find((item) => item.id === id);
    if (!before || !after || before.envelope.route !== after.envelope.route || before.envelope.mode !== after.envelope.mode ||
        !sameSet(claimIds(before), claimIds(after))) {
      throw new Error(`Established suitable answer regressed: ${id}`);
    }
  }
  return live;
}

function main() {
  const livePathValue = process.env.GUIDELINE_STAGE_D_LIVE_AUDIT_INPUT;
  if (!livePathValue) throw new Error("Set GUIDELINE_STAGE_D_LIVE_AUDIT_INPUT to the reviewed live 50-question audit");
  if (process.env.GUIDELINE_STAGE_D_AUDIT_REVIEW_ATTESTED !== "true") {
    throw new Error("Set GUIDELINE_STAGE_D_AUDIT_REVIEW_ATTESTED=true only after reviewing the live audit against its per-question minimum contracts");
  }
  const report = verifyStageD();
  if (report.engineering_completion !== "complete") throw new Error("Stage D deterministic verification is not complete");
  const livePath = path.resolve(livePathValue);
  assertLiveAudit(livePath);

  let promoted = 0;
  for (const documentId of Object.keys(PARENT_SECTIONS)) {
    const file = path.join(OVERLAY_DIR, `${documentId}.json`);
    const overlay = JSON.parse(fs.readFileSync(file, "utf8"));
    for (const collection of ["facets", "coverage_manifests", "comparison_bindings"]) {
      for (const item of overlay[collection] || []) {
        if (item.review_status !== "needs_review") continue;
        item.review_status = "reviewed";
        promoted += 1;
      }
    }
    fs.writeFileSync(file, `${JSON.stringify(overlay, null, 2)}\n`, "utf8");
  }
  const validation = validateSemanticOverlays();
  if (!validation.ok) throw new Error(`Post-promotion semantic validation failed:\n${validation.errors.join("\n")}`);
  console.log(`Promoted ${promoted} Stage D facet/manifest/comparison-binding object(s) to reviewed.`);
  console.log(`Live audit: ${path.relative(ROOT, livePath)} (50/50, answer contract 2.2.0)`);
  console.log(`Established suitable regression guard: ${ESTABLISHED_SUITABLE_IDS.length}/${ESTABLISHED_SUITABLE_IDS.length} unchanged`);
}

if (require.main === module) main();

module.exports = { assertLiveAudit, ESTABLISHED_SUITABLE_IDS };
