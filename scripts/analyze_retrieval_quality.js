const fs = require("node:fs");
const path = require("node:path");

const { loadStore } = require("../engine/data_store");
const { createStore } = require("../engine/vector_store");
const { tokenize, REGULATORY_SYNONYMS, STOPWORDS } = require("../engine/text_utils");

const ROOT = path.resolve(__dirname, "..");
const OUTPUT_PATH = process.env.GUIDELINE_RETRIEVAL_AUDIT_OUTPUT
  ? path.resolve(process.env.GUIDELINE_RETRIEVAL_AUDIT_OUTPUT)
  : path.join(ROOT, "logs", "runtime", "response_intelligence_workstream_4_retrieval_benchmark.json");
const TOP_K = 5;

// Real English synonyms for real archive `parameter` vocabulary, verified
// (2026-09-09) absent from REGULATORY_SYNONYMS as both a key and a mapped
// value. Hand-picked, not automatable -- identifying a genuine domain
// synonym needs judgment. Each `context_word` is a second real, distinctive
// word taken from the SAME ground-truth record's own source_text, so every
// probe is a realistic multi-word question -- never an artificial
// single-real-word-plus-nonsense shape.
const UNCOVERED_SYNONYM_CASES = [
  { synonym: "length", record_id: "ich_s6_r1.qc.4_4.003", context_word: "biopharmaceutical", covers_term: "duration" },
  { synonym: "repeats", record_id: "ich_m10.qc.3_2_5_2.001", context_word: "concentration", covers_term: "replicates" },
  { synonym: "cycling", record_id: "ich_m10.qc.4_2_7.003", context_word: "matrix", covers_term: "cycles" }
];

function sourceUnitOf(record) {
  return (record.source_unit_ids && record.source_unit_ids[0]) || null;
}

function pickContextWord(record, excludeTokens) {
  const words = tokenize(record.source_text || "");
  return words
    .filter((w) => w.length >= 5 && !STOPWORDS.has(w) && !excludeTokens.has(w))
    .sort((a, b) => b.length - a.length)[0] || null;
}

/**
 * Real, automatically-generated regression probes: for a sample of
 * REGULATORY_SYNONYMS' Korean entries, find a real record whose canonical
 * English token is its `parameter`, then combine the Korean synonym with a
 * second real, distinctive word from that same record's own source_text --
 * a realistic multi-word question. These synonyms are already mapped, so a
 * miss here would be a real, currently-unnoticed regression, not an
 * expected gap.
 */
function buildKnownSynonymProbes(records, sampleSize = 30) {
  const koreanKeys = Object.keys(REGULATORY_SYNONYMS).filter((k) => /[가-힣]/.test(k));
  const probes = [];
  const seenTerms = new Set();
  for (const key of koreanKeys) {
    if (probes.length >= sampleSize) break;
    const primaryTarget = REGULATORY_SYNONYMS[key][0];
    if (seenTerms.has(primaryTarget)) continue; // one probe per distinct target concept
    // Whole-token match only: a raw substring check would let "anti" match
    // inside "antigen" or "cross" match inside "across" -- a false
    // ground-truth association, not a real synonym test.
    const record = records.find((r) => tokenize(r.parameter || "").includes(primaryTarget));
    if (!record || !record.source_text) continue;
    const contextWord = pickContextWord(record, new Set(tokenize(primaryTarget)));
    if (!contextWord) continue;
    seenTerms.add(primaryTarget);
    probes.push({
      probe_id: `known_synonym.${primaryTarget.replace(/[^a-z0-9]+/gi, "_")}`,
      kind: "known_synonym",
      synonym_key: key,
      covers_term: primaryTarget,
      question: `${key} ${contextWord}`,
      ground_truth_record_id: record.id,
      ground_truth_source_unit_id: sourceUnitOf(record)
    });
  }
  return probes;
}

/**
 * Real, hand-curated probes for genuinely uncovered synonyms (see
 * UNCOVERED_SYNONYM_CASES). This is the real test of the milestone's
 * "synonym/paraphrase/wording-variation" bullet -- unlike the known-synonym
 * probes above, a miss here is expected to be possible.
 */
function buildUncoveredSynonymProbes(records) {
  return UNCOVERED_SYNONYM_CASES.map((entry) => {
    const record = records.find((r) => r.id === entry.record_id);
    return {
      probe_id: `uncovered_synonym.${entry.covers_term}`,
      kind: "uncovered_synonym",
      synonym_key: entry.synonym,
      covers_term: entry.covers_term,
      question: `${entry.context_word} ${entry.synonym}`,
      ground_truth_record_id: record.id,
      ground_truth_source_unit_id: sourceUnitOf(record)
    };
  });
}

/**
 * A hit means the top-K contains either the exact ground-truth record or
 * any sibling record extracted from the same source paragraph
 * (`source_unit_ids[0]`) -- a real user is equally well served by either,
 * since they share the same citation and evidence. Requiring the single
 * literal record id would understate retrieval quality: a
 * quantitative_criterion and its parent knowledge_record are routinely
 * extracted from one paragraph, and either one grounds the same answer.
 */
async function runProbe(probe, store) {
  const results = await store.search(probe.question, TOP_K);
  const hit = results.some((r) => r.record.id === probe.ground_truth_record_id
    || (probe.ground_truth_source_unit_id && sourceUnitOf(r.record) === probe.ground_truth_source_unit_id));
  return { ...probe, hit, top_k_ids: results.map((r) => r.record.id) };
}

function summarize(results) {
  return {
    n: results.length,
    hits: results.filter((r) => r.hit).length,
    misses: results.filter((r) => !r.hit).map((r) => r.probe_id)
  };
}

async function analyze() {
  const { records } = loadStore();
  const store = createStore();
  store.index(records);

  const knownSynonymProbes = buildKnownSynonymProbes(records);
  const uncoveredSynonymProbes = buildUncoveredSynonymProbes(records);

  const knownResults = [];
  for (const probe of knownSynonymProbes) knownResults.push(await runProbe(probe, store));
  const uncoveredResults = [];
  for (const probe of uncoveredSynonymProbes) uncoveredResults.push(await runProbe(probe, store));

  return {
    generated_at: new Date().toISOString(),
    top_k: TOP_K,
    known_synonym_regression: { ...summarize(knownResults), results: knownResults },
    uncovered_synonym_gap: { ...summarize(uncoveredResults), results: uncoveredResults }
  };
}

async function main() {
  const report = await analyze();
  fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
  fs.writeFileSync(OUTPUT_PATH, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  console.log(`Known-synonym regression: ${report.known_synonym_regression.hits}/${report.known_synonym_regression.n}`);
  console.log(`Uncovered-synonym gap: ${report.uncovered_synonym_gap.hits}/${report.uncovered_synonym_gap.n}`);
  console.log(`Output: ${path.relative(ROOT, OUTPUT_PATH)}`);
}

if (require.main === module) main().catch((error) => {
  console.error(error.stack || error.message || error);
  process.exitCode = 1;
});

module.exports = { analyze, buildKnownSynonymProbes, buildUncoveredSynonymProbes, UNCOVERED_SYNONYM_CASES };
