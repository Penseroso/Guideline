const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

/**
 * M5 Phase 5 (history/verification/engine_test_record_through_2026-08-28.md Entry 008 / M5 plan §5): a parallel,
 * derived log for user-flagged answers — never a new field on
 * data/pilots/*.json records, since the archive schema is closed
 * (precedent: verification rejection reasons live in a parallel report,
 * never a record field, docs/milestone_log.md M1). Sibling to
 * engine/query_log.js, same append-only-JSONL shape.
 *
 * Deliberately a closed defect taxonomy, not a rating scale — a 1-5 star
 * field would be a scoring system (product_roadmap.md §1.4 non-goal) and
 * wouldn't say what to fix. Each verdict maps to a specific TPP promise
 * it alleges was broken, which is what keeps this a defect taxonomy
 * instead of a quality metric:
 *   wrong_citation      - §1.3(2): the citation doesn't support the claim
 *   unsupported_claim   - §1.3(1)/(4): a claim with no real grounding
 *   wrongly_refused     - a real coverage gap, not a defect in what shipped
 *   should_have_refused - §1.3(4): answered when it should have declined
 *   modality_wrong       - §1.4: blurred may/should/must
 *   incomplete           - real content exists but wasn't surfaced
 *   correct               - explicit positive confirmation
 *
 * Explicitly forbidden, and must stay that way: computing an aggregate
 * answer-quality score, ranking documents by feedback volume, or feeding
 * feedback into retrieval ranking. The only downstream consumer is the
 * eval fixture, via scripts/promote_feedback_to_eval.js, and only after
 * human review.
 */
const DEFAULT_FEEDBACK_PATH = path.resolve(__dirname, "..", "logs", "runtime", "feedback.jsonl");

const VALID_VERDICTS = [
  "wrong_citation",
  "unsupported_claim",
  "wrongly_refused",
  "should_have_refused",
  "modality_wrong",
  "incomplete",
  "correct"
];
const VALID_VERDICT_SET = new Set(VALID_VERDICTS);

function recordFeedback(entry, logPath = process.env.GUIDELINE_FEEDBACK_LOG_PATH || DEFAULT_FEEDBACK_PATH) {
  if (!entry || typeof entry.question !== "string" || !entry.question) {
    throw new Error("feedback_log: entry.question is required");
  }
  if (!VALID_VERDICT_SET.has(entry.verdict)) {
    throw new Error(`feedback_log: verdict must be one of ${VALID_VERDICTS.join(", ")}, got ${JSON.stringify(entry.verdict)}`);
  }
  const record = {
    feedback_id: `fb_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`,
    timestamp: new Date().toISOString(),
    interaction_id: entry.interaction_id ?? null,
    question: entry.question,
    verdict: entry.verdict,
    note: entry.note ?? null,
    path: entry.path ?? null,
    mode: entry.mode ?? null,
    answered: entry.answered ?? null,
    cited_source_unit_ids: entry.cited_source_unit_ids || [],
    answer_text: entry.answer_text ?? null,
    triage: null
  };
  fs.mkdirSync(path.dirname(logPath), { recursive: true });
  fs.appendFileSync(logPath, JSON.stringify(record) + "\n", "utf8");
  return record;
}

function readFeedback(logPath = process.env.GUIDELINE_FEEDBACK_LOG_PATH || DEFAULT_FEEDBACK_PATH) {
  if (!fs.existsSync(logPath)) return [];
  return fs.readFileSync(logPath, "utf8")
    .trim()
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

module.exports = { recordFeedback, readFeedback, VALID_VERDICTS, DEFAULT_FEEDBACK_PATH };
