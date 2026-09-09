const fs = require("node:fs");
const path = require("node:path");

const { tokenize } = require("../engine/text_utils");

const ROOT = path.resolve(__dirname, "..");
// Reuses an already-collected real production-path run rather than paying
// for new API calls -- this is real generated output from real questions,
// not a constructed probe. Response Intelligence Workstream 4/5 established
// this reuse pattern (reading back an existing run's telemetry) when the
// question is answerable from data already on disk.
const INPUT_PATH = process.env.GUIDELINE_QUALIFIER_FIDELITY_INPUT
  ? path.resolve(process.env.GUIDELINE_QUALIFIER_FIDELITY_INPUT)
  : path.join(ROOT, "logs", "runtime", "answer_suitability_50_workstream_5.json");
const OUTPUT_PATH = process.env.GUIDELINE_QUALIFIER_FIDELITY_OUTPUT
  ? path.resolve(process.env.GUIDELINE_QUALIFIER_FIDELITY_OUTPUT)
  : path.join(ROOT, "logs", "runtime", "response_intelligence_workstream_6_qualifier_fidelity.json");

// A keyword-overlap heuristic, not a semantic judgment -- this script's job
// is to surface real cases for human review (per the Workstream 6 plan),
// not to gate anything automatically. tokenize() already strips stopwords
// and Korean particles, so no additional length filter is applied here: an
// earlier version filtered tokens shorter than 4 characters (reasonable
// for English) but that zeroed out short, meaningful Korean condition
// phrases entirely (e.g. "가능한 경우" / "실행 가능한 경우" -- a real
// paraphrase match -- tokenizes to 2-3 character words and was wrongly
// scored as unassessable). Caught by manually inspecting this script's own
// first real output before drawing any conclusion from it.
function conditionKeywords(conditionText) {
  return new Set(tokenize(conditionText));
}

function overlapFraction(conditionText, generatedText) {
  const condTokens = conditionKeywords(conditionText);
  if (condTokens.size === 0) return null;
  const genTokens = new Set(tokenize(generatedText || ""));
  let matched = 0;
  for (const token of condTokens) if (genTokens.has(token)) matched++;
  return Math.round((matched / condTokens.size) * 100) / 100;
}

function findGeneratedUnit(units, claim) {
  const recordId = claim.record && claim.record.id;
  return units.find((unit) => (recordId && unit.record_id === recordId) || unit.source_unit_id === claim.source_unit_id);
}

// The archive's condition_text is always English; this project's audited
// production runs request response_language: "ko", so generated prose is
// Korean. Comparing English condition_text against Korean generated text
// would score ~0 overlap regardless of real fidelity -- caught by manually
// inspecting this script's own first real output (every top "omitted" case
// was a Korean/English language mismatch, not a real omission). Each
// condition's own reviewed normalized_ko (when present) is the fields
// generation-language-correct comparison target; a condition without one
// cannot be assessed by this heuristic and is marked, not silently
// miscounted as omitted.
function comparisonTextFor(condition) {
  if (condition.normalization_status === "reviewed" && condition.normalized_ko) return condition.normalized_ko;
  return null;
}

function analyze() {
  const results = JSON.parse(fs.readFileSync(INPUT_PATH, "utf8"));
  const probes = [];
  for (const item of results) {
    const envelope = item.envelope;
    if (!envelope || envelope.route !== "grounded_generation") continue;
    const units = envelope.answer_units || [];
    for (const claim of envelope.claims || []) {
      const conditions = (claim.record && claim.record.applicable_conditions) || [];
      if (conditions.length === 0) continue;
      const unit = findGeneratedUnit(units, claim);
      const seen = new Set();
      for (const condition of conditions) {
        const comparisonText = comparisonTextFor(condition);
        const dedupeKey = comparisonText || condition.condition_text;
        if (!dedupeKey || seen.has(dedupeKey)) continue;
        seen.add(dedupeKey);
        const assessable = Boolean(unit) && comparisonText !== null;
        const overlap = assessable ? overlapFraction(comparisonText, unit.text) : null;
        probes.push({
          question_id: item.id,
          record_id: claim.record && claim.record.id,
          condition_text: condition.condition_text,
          comparison_text_ko: comparisonText,
          assessable,
          generated_unit_present: Boolean(unit),
          generated_text: unit ? unit.text : null,
          keyword_overlap_fraction: overlap
        });
      }
    }
  }

  const assessable = probes.filter((p) => p.assessable);
  const notAssessable = probes.length - assessable.length;
  const likelyPreserved = assessable.filter((p) => p.keyword_overlap_fraction !== null && p.keyword_overlap_fraction >= 0.5);
  const likelyOmitted = assessable.filter((p) => p.keyword_overlap_fraction === null || p.keyword_overlap_fraction < 0.5);

  return {
    generated_at: new Date().toISOString(),
    source: path.relative(ROOT, INPUT_PATH),
    total_condition_instances: probes.length,
    not_assessable_no_reviewed_normalized_ko_or_no_unit: notAssessable,
    assessable: assessable.length,
    likely_preserved: likelyPreserved.length,
    likely_omitted: likelyOmitted.map((p) => ({ question_id: p.question_id, record_id: p.record_id, condition_text: p.condition_text, comparison_text_ko: p.comparison_text_ko, generated_text: p.generated_text, keyword_overlap_fraction: p.keyword_overlap_fraction })),
    probes
  };
}

function main() {
  const report = analyze();
  fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
  fs.writeFileSync(OUTPUT_PATH, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  console.log(`Condition instances found: ${report.total_condition_instances} (${report.assessable} assessable, ${report.not_assessable_no_reviewed_normalized_ko_or_no_unit} not assessable -- no reviewed normalized_ko or no matching generated unit)`);
  console.log(`Likely preserved (keyword overlap >= 0.5): ${report.likely_preserved}`);
  console.log(`Likely omitted (for human review): ${report.likely_omitted.length}`);
  console.log(`Output: ${path.relative(ROOT, OUTPUT_PATH)}`);
}

if (require.main === module) main();

module.exports = { analyze, conditionKeywords, overlapFraction };
