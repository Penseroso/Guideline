const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const DESIGN_PATH = path.join(ROOT, "docs", "answer_suitability_evaluation.md");
const WS3_TAXONOMY_PATH = path.join(ROOT, "logs", "runtime", "response_intelligence_workstream_3_taxonomy.json");
const EVAL_QUESTIONS_PATH = path.join(ROOT, "test", "fixtures", "eval_questions.json");
const OUTPUT_PATH = path.join(ROOT, "data", "eval", "typed_questions.json");

/**
 * Response Intelligence Workstream 7: the milestone's named question-type
 * taxonomy (detail/list/overview/process/comparison/ambiguous/refusal) does
 * not exist anywhere in the repo. B0/B1/D1/D2/X (docs/answer_suitability_
 * evaluation.md's depth codes) map cleanly (B0->overview, B1->list,
 * D1+D2->detail, X->comparison); B2 ("procedure/relationship/judgment
 * factors") does not -- it spans genuinely sequential questions and other
 * multi-factor synthesis that isn't strictly procedural. This split is a
 * documented human judgment call (each question's own Korean phrasing is
 * quoted in the comments below as the basis), not a mechanical rule.
 *
 * PROCESS: explicit sequence/stage/flow wording in the question or its
 * expected-answer-shape column ("단계별로", "그다음엔", "시간 흐름으로",
 * "순서와", "하나의 운영 흐름으로", "어느 시점까지").
 */
const B2_PROCESS_IDS = new Set(["Q08", "Q12", "Q16", "Q19", "Q22", "Q31", "Q34", "Q40"]);
// Genuine two-thing comparisons among the B2 remainder (not sequential, but
// explicitly contrasting/equating two named concepts) join `comparison`
// alongside the 2 X-coded (cross-document) questions.
const B2_COMPARISON_IDS = new Set(["Q17", "Q32"]);
// Everything else in B2 is single-topic, multi-factor synthesis closer to
// `detail` (specific technical considerations for one topic) than to
// `list` (B1's exhaustive full-section enumeration) or `comparison` (no
// second thing being contrasted).

function typeForDepth(depth, id) {
  if (depth === "B0") return "overview";
  if (depth === "B1") return "list";
  if (depth === "D1" || depth === "D2") return "detail";
  if (depth === "X") return "comparison";
  if (depth === "B2") {
    if (B2_PROCESS_IDS.has(id)) return "process";
    if (B2_COMPARISON_IDS.has(id)) return "comparison";
    return "detail";
  }
  throw new Error(`Unknown depth code ${depth} for ${id}`);
}

function questionsFromDesign() {
  const text = fs.readFileSync(DESIGN_PATH, "utf8");
  const questions = [];
  for (const line of text.split(/\r?\n/)) {
    const match = line.match(/^\| (Q\d{2}) \| ([A-Z0-9]+) \| (.*?) \|/);
    if (match) questions.push({ id: match[1], depth: match[2], question: match[3] });
  }
  if (questions.length !== 50) throw new Error(`Expected 50 questions from ${DESIGN_PATH}, found ${questions.length}`);
  return questions;
}

function build50Q() {
  return questionsFromDesign().map(({ id, depth, question }) => ({
    id: `fifty_q_${id}`,
    type: typeForDepth(depth, id),
    question,
    expect_answered: true,
    source: `answer_suitability_evaluation.md#${id} (depth ${depth})`
  }));
}

function buildAmbiguous() {
  if (!fs.existsSync(WS3_TAXONOMY_PATH)) {
    throw new Error(`Missing ${WS3_TAXONOMY_PATH} -- run npm run audit:query-resolution first (Workstream 3's probe run).`);
  }
  const taxonomy = JSON.parse(fs.readFileSync(WS3_TAXONOMY_PATH, "utf8"));
  const entries = [];
  // Only probes Workstream 3 itself confirmed actually tied (real,
  // validated ambiguity) -- e.g. "precision (%cv) acceptance criteria"
  // did NOT tie in that run and is correctly excluded here.
  for (const probe of taxonomy.corpora.ambiguous_tie_probes.results) {
    if (!probe.categories.includes("ambiguous_scope")) continue;
    entries.push({
      id: `ws3_${probe.probe_id}`,
      type: "ambiguous",
      question: probe.question,
      // Not a hard-refusal expectation: Workstream 3 already found the real
      // behavior here is routing abstention (a tie event fires) followed
      // by an ordinary fallback attempt, which usually still answers
      // (via grounded_generation/source_excerpts). expect_answered is
      // deliberately null -- scripts/analyze_production_slo.js checks this
      // type's success via the routing/manifest tie telemetry event
      // instead, not via envelope.answered.
      expect_answered: null,
      expect_routing_abstention: true,
      source: "workstream_3_ambiguous_tie_probes (logs/runtime/response_intelligence_workstream_3_taxonomy.json)"
    });
  }
  for (const probe of taxonomy.corpora.manifest_ambiguity_probes.results) {
    if (!probe.categories.includes("ambiguous_scope")) continue;
    entries.push({
      id: `ws3_${probe.probe_id}`,
      type: "ambiguous",
      question: probe.question,
      // Same reasoning as the routing-tie probes above: "ambiguous" means
      // the manifest/routing layer abstains, not that the final envelope
      // necessarily refuses -- checked via telemetry event, not
      // envelope.answered.
      expect_answered: null,
      expect_routing_abstention: true,
      source: "workstream_3_manifest_ambiguity_probe (logs/runtime/response_intelligence_workstream_3_taxonomy.json)"
    });
  }
  return entries;
}

function buildRefusal() {
  const fixture = JSON.parse(fs.readFileSync(EVAL_QUESTIONS_PATH, "utf8"));
  // Only the 3 refusal-expected gold questions whose refusal does not
  // depend on whether a generator/verifier happen to be configured (q6 is
  // deliberately excluded -- its own note says "a grounded generated
  // answer remains allowed when configured," so under this workstream's
  // full-production-path run with generation enabled it may legitimately
  // answer, not refuse; asserting expect_answered: false for it here would
  // be a false expectation, not a real one).
  const stableRefusalIds = new Set(["q7_refusal", "q14_scope_small_molecule_species_refusal", "q16_scope_atmp_fih_refusal"]);
  return fixture.questions
    .filter((q) => stableRefusalIds.has(q.id))
    .map((q) => ({
      id: `gold_${q.id}`,
      type: "refusal",
      question: q.question,
      expect_answered: false,
      source: `test/fixtures/eval_questions.json#${q.id}`
    }));
}

function build() {
  const entries = [...build50Q(), ...buildAmbiguous(), ...buildRefusal()];
  const byType = {};
  for (const entry of entries) byType[entry.type] = (byType[entry.type] || 0) + 1;
  return { generated_at: new Date().toISOString(), total: entries.length, by_type: byType, questions: entries };
}

function main() {
  const corpus = build();
  fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
  fs.writeFileSync(OUTPUT_PATH, `${JSON.stringify(corpus, null, 2)}\n`, "utf8");
  console.log(`Total questions: ${corpus.total}`);
  console.log(`By type: ${JSON.stringify(corpus.by_type)}`);
  console.log(`Output: ${path.relative(ROOT, OUTPUT_PATH)}`);
}

if (require.main === module) main();

module.exports = { build, typeForDepth };
