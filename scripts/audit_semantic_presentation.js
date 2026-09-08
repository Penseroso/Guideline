const fs = require("node:fs");
const path = require("node:path");

const {
  validateSemanticOverlays,
  summarySpecSha256,
  loadCoreArchive,
  recordSourceText
} = require("../validation/validate_semantic_overlay");

const ROOT = path.resolve(__dirname, "..");
const SEMANTIC_DIR = path.join(ROOT, "data", "derived", "semantic");
const PRESENTATION_DIR = path.join(ROOT, "data", "derived", "presentation", "ko");

function readJson(file) { return JSON.parse(fs.readFileSync(file, "utf8")); }

const ALLOWED_NO_EVIDENCE_GAPS = new Set([
  "ich_s6_r1.sem.facet.section_3_2_biological_activity_pharmacodynamics",
  "ich_s6_r1.sem.facet.section_3_4_exploratory_clinical_trials",
  "ich_s6_r1.sem.facet.section_3_5_administration_dose_selection",
  "ich_s6_r1.sem.facet.section_4_2_exposure_assessment",
  "ich_s6_r1.sem.facet.section_4_3_single_dose_toxicity_studies",
  "ich_s6_r1.sem.facet.section_4_5_immunotoxicity_studies",
  "ich_s6_r1.sem.facet.section_4_6_reproductive_performance_and_developmental_toxicity_studies",
  "ich_s6_r1.sem.facet.section_4_8_carcinogenicity_studies",
  "ich_s6_r1.sem.facet.section_4_9_local_tolerance_studies",
  "ich_s6_r1.sem.facet.section_5_1_general_comments",
  "ich_s6_r1.sem.facet.section_5_2_fertility",
  "ich_s6_r1.sem.facet.section_5_3_embryo_fetal_development_efd",
  "ich_s6_r1.sem.facet.section_5_4_pre_and_post_natal_development_ppnd"
]);

function numericTokens(text) {
  return (String(text || "").match(/(?:[<>]=?|±)?\s*\d+(?:\.\d+)?(?:\/\d+)?/g) || [])
    .map((token) => token.replace(/\s+/g, ""));
}

function auditSemanticPresentation({ documentId = null } = {}) {
  const validation = validateSemanticOverlays();
  const errors = [...validation.errors];
  const rows = [];
  const archive = loadCoreArchive();
  const semanticFiles = fs.readdirSync(SEMANTIC_DIR).filter((item) => item.endsWith(".json")).sort();
  for (const name of semanticFiles) {
    const overlay = readJson(path.join(SEMANTIC_DIR, name));
    if (documentId && overlay.document_id !== documentId) continue;
    const presentationFile = path.join(PRESENTATION_DIR, name);
    const presentation = fs.existsSync(presentationFile) ? readJson(presentationFile) : null;
    const entries = new Map((presentation && presentation.entries || []).map((entry) => [entry.semantic_id, entry]));
    for (const summary of overlay.summary_specs) {
      const entry = entries.get(summary.summary_id);
      const gaps = entry ? entry.facet_dispositions.filter((item) => item.status === "gap") : [];
      const row = {
        document_id: overlay.document_id,
        summary_id: summary.summary_id,
        present: Boolean(entry),
        reviewed: Boolean(entry && entry.review_status === "reviewed"),
        fresh: Boolean(entry && entry.summary_spec_sha256 === summarySpecSha256(summary)),
        gap_count: gaps.length,
        gap_reasons: [...new Set(gaps.map((item) => item.gap_reason))]
      };
      rows.push(row);
      if (!entry) errors.push(`${summary.summary_id}: missing presentation entry`);
      else if (entry.review_status !== "reviewed") errors.push(`${summary.summary_id}: presentation is not reviewed`);
      else if (!row.fresh) errors.push(`${summary.summary_id}: summary_spec hash is stale`);
      for (const gap of gaps) {
        if (gap.gap_reason !== "no_structured_evidence") errors.push(`${summary.summary_id}: unresolved gap ${gap.facet_id} (${gap.gap_reason})`);
        else if (!ALLOWED_NO_EVIDENCE_GAPS.has(gap.facet_id)) errors.push(`${summary.summary_id}: unapproved no-evidence gap ${gap.facet_id}`);
      }
      for (const unit of entry && entry.units || []) {
        if (!/[\uac00-\ud7af]/.test(unit.text) || /[\ufffd\u0900-\u097f\u4e00-\u9fff]/.test(unit.text)) {
          errors.push(`${summary.summary_id}/${unit.unit_id}: unexpected or missing Korean writing system`);
        }
        const source = unit.evidence_refs.map((ref) => {
          const core = archive.recordsById.get(ref.record_id);
          return core ? recordSourceText({ ...core, evidenceSourceUnitId: ref.source_unit_id }, archive.sourceUnitsById) || "" : "";
        }).join(" ").replace(/\s+/g, "");
        const missingNumbers = numericTokens(unit.text).filter((token) => !source.includes(token));
        if (missingNumbers.length) errors.push(`${summary.summary_id}/${unit.unit_id}: ungrounded numeric token(s): ${missingNumbers.join(", ")}`);
      }
    }
  }
  return { ok: errors.length === 0, errors, rows };
}

function parseArgs(argv) {
  let documentId = null;
  for (let i = 0; i < argv.length; i++) if (argv[i] === "--document") documentId = argv[++i];
  return { documentId };
}

function main() {
  const result = auditSemanticPresentation(parseArgs(process.argv.slice(2)));
  const reviewed = result.rows.filter((row) => row.reviewed && row.fresh).length;
  const gaps = result.rows.reduce((sum, row) => sum + row.gap_count, 0);
  console.log(`Semantic presentation audit: ${reviewed}/${result.rows.length} fresh reviewed summaries; ${gaps} explicit facet gap(s).`);
  if (!result.ok) {
    for (const error of result.errors) console.error(`- ${error}`);
    process.exit(1);
  }
}

if (require.main === module) main();

module.exports = { auditSemanticPresentation, ALLOWED_NO_EVIDENCE_GAPS, numericTokens };
