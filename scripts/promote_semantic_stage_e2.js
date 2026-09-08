/**
 * Promote Stage E2 (docs/derived_semantic_layer.md §10 단계 E2) only after
 * deterministic validation, the offline presentation-text audit showing
 * every existing presentation entry renders in the right sentence_roles
 * order, a complete live 50-question run on answer contract 2.4.0, and the
 * same established-16-suitable-case regression guard Stage D/E1 used.
 * Narrow scope only: promotes the 3 existing presentation entries
 * (ema_fih, ich_m3_r2, ich_s6_r1). fda_ada and fda_ada_2014 have a
 * summary_spec but no presentation file at all — nothing to promote there
 * until Stage F authors one.
 */
const fs = require("node:fs");
const path = require("node:path");

const { validateSemanticOverlays } = require("../validation/validate_semantic_overlay");
const { PRESENTATION_DIR } = require("../engine/semantic_overlay_store");
const { ENVELOPE_VERSION } = require("../engine/answer_envelope");
const { ESTABLISHED_SUITABLE_IDS, assertLiveAuditRegression } = require("./stage_e_promotion_shared");

const ROOT = path.resolve(__dirname, "..");
const AUDIT_PATH = process.env.GUIDELINE_STAGE_E2_AUDIT_INPUT
  ? path.resolve(process.env.GUIDELINE_STAGE_E2_AUDIT_INPUT)
  : path.join(ROOT, "logs", "runtime", "semantic_stage_e2_audit.json");

function assertOfflineAudit() {
  if (!fs.existsSync(AUDIT_PATH)) throw new Error(`Run scripts/run_semantic_stage_e2_audit.js first (expected ${path.relative(ROOT, AUDIT_PATH)})`);
  const results = JSON.parse(fs.readFileSync(AUDIT_PATH, "utf8"));
  const misses = results.filter((item) => !item.text_rendered || !item.sentence_roles_match);
  if (misses.length > 0) throw new Error(`Stage E2 offline audit has failing case(s): ${misses.map((item) => item.summary_id).join(", ")}`);
  return results;
}

function main() {
  const validationBefore = validateSemanticOverlays();
  if (!validationBefore.ok) throw new Error(`Semantic overlay validation failed:\n${validationBefore.errors.join("\n")}`);

  const offlineResults = assertOfflineAudit();

  const livePathValue = process.env.GUIDELINE_STAGE_E2_LIVE_AUDIT_INPUT;
  if (!livePathValue) throw new Error(`Set GUIDELINE_STAGE_E2_LIVE_AUDIT_INPUT to a complete live 50-question audit on answer contract ${ENVELOPE_VERSION}`);
  if (process.env.GUIDELINE_STAGE_E2_AUDIT_REVIEW_ATTESTED !== "true") {
    throw new Error("Set GUIDELINE_STAGE_E2_AUDIT_REVIEW_ATTESTED=true only after reviewing the live audit against its per-question minimum contracts");
  }
  const livePath = path.resolve(livePathValue);
  assertLiveAuditRegression(livePath, ENVELOPE_VERSION, process.env.GUIDELINE_STAGE_E2_BASELINE_AUDIT);

  let promoted = 0;
  for (const name of fs.readdirSync(PRESENTATION_DIR).filter((item) => item.endsWith(".json")).sort()) {
    const file = path.join(PRESENTATION_DIR, name);
    const presentation = JSON.parse(fs.readFileSync(file, "utf8"));
    for (const entry of presentation.entries || []) {
      if (entry.review_status !== "needs_review") continue;
      entry.review_status = "reviewed";
      promoted += 1;
    }
    fs.writeFileSync(file, `${JSON.stringify(presentation, null, 2)}\n`, "utf8");
  }

  const validationAfter = validateSemanticOverlays();
  if (!validationAfter.ok) throw new Error(`Post-promotion semantic validation failed:\n${validationAfter.errors.join("\n")}`);
  console.log(`Promoted ${promoted} presentation entry(ies) to reviewed.`);
  console.log(`Offline audit: ${offlineResults.length}/${offlineResults.length} rendered correctly.`);
  console.log(`Live audit: ${path.relative(ROOT, livePath)} (50/50, answer contract ${ENVELOPE_VERSION})`);
  console.log(`Established suitable regression guard: ${ESTABLISHED_SUITABLE_IDS.length}/${ESTABLISHED_SUITABLE_IDS.length} unchanged`);
}

if (require.main === module) main();

module.exports = { main };
