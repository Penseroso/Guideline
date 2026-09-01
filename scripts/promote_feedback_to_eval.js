/**
 * scripts/promote_feedback_to_eval.js
 * M5 Phase 5 (history/verification/engine_test_record_through_2026-08-28.md Entry 008 / M5 plan §5): reads
 * untriaged entries from the configured runtime feedback log, re-runs each question live
 * against the current engine, and PRINTS a candidate fixture block for
 * human review. Deliberately does NOT write to
 * test/fixtures/eval_questions.json itself — that file's own header
 * states every entry was checked against live behavior before being
 * added; auto-promoting a user's complaint would violate that guarantee
 * outright (the complaint could itself be wrong).
 *
 * A `wrongly_refused` item is, by definition, a currently-failing case —
 * it can only enter the fixture as `status: "known_gap"` (see
 * engine/eval_harness.js's isKnownGap), never as a normal passing case.
 *
 * Usage: node scripts/promote_feedback_to_eval.js
 */

const fs = require("fs");
const path = require("path");

const { loadStore } = require("../engine/data_store");
const { setUpAnswering } = require("../engine/cli");
const { answerEnvelope } = require("../engine/answer_envelope");
const { readFeedback } = require("../engine/feedback_log");

async function main() {
  const feedback = readFeedback().filter((f) => f.triage === null || f.triage === undefined);
  if (feedback.length === 0) {
    console.log("No untriaged feedback in the configured runtime log. Nothing to promote.");
    return;
  }

  const { records, index } = loadStore();
  const setup = setUpAnswering(records);
  const { generatorProvider, generatorModel, verifierProvider, verifierModel, fallbackMode } = setup;
  const routeSummary = fallbackMode === "grounded_generation"
    ? `grounded generation (${generatorProvider}/${generatorModel} + ${verifierProvider}/${verifierModel})`
    : "structured evidence with source-excerpt fallback";
  console.log(`Found ${feedback.length} untriaged feedback entries. Re-running each through ${routeSummary}.\n`);

  for (const entry of feedback) {
    const envelope = await answerEnvelope(entry.question, records, { ...setup, index });
    console.log("=".repeat(70));
    console.log(`feedback_id: ${entry.feedback_id}`);
    console.log(`question:    ${JSON.stringify(entry.question)}`);
    console.log(`verdict:     ${entry.verdict}${entry.note ? ` (${entry.note})` : ""}`);
    console.log(`originally:  answered=${entry.answered}, route=${entry.route || entry.path}, mode=${entry.mode}`);
    console.log(`now:         answered=${envelope.answered}, route=${envelope.route}, mode=${envelope.mode}`);
    console.log(`current answer: ${envelope.prose.split("\n")[0].slice(0, 140)}`);

    if (entry.verdict === "wrongly_refused") {
      if (envelope.answered) {
        console.log(`\n→ This question is now ANSWERED (${envelope.route}/${envelope.mode}) — no longer a gap. Consider a normal fixture entry, not known_gap.`);
        printCandidate(entry, envelope, { asKnownGap: false });
      } else {
        console.log(`\n→ Still refuses. Candidate as a tracked known_gap (excluded from the pass/fail gate, still run and reported):`);
        printCandidate(entry, envelope, { asKnownGap: true });
      }
    } else {
      console.log(`\n→ Candidate fixture entry for manual review (verify the suggested expect_* values against the current answer above before adding):`);
      printCandidate(entry, envelope, { asKnownGap: false });
    }
    console.log("");
  }

  console.log("=".repeat(70));
  console.log(
    "\nNothing was written automatically. To promote a candidate:\n" +
    "  1. Copy the JSON block into test/fixtures/eval_questions.json by hand, after verifying it against the live answer above.\n" +
    "  2. Mark the source feedback entry's `triage` field in the configured runtime log " +
    '(e.g. {"status":"promoted","eval_question_id":"<id>"}) so it is not re-suggested next run.\n'
  );
}

function slugify(question) {
  return question
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40);
}

function printCandidate(entry, envelope, { asKnownGap }) {
  const id = `q_fb_${slugify(entry.question) || entry.feedback_id}`;
  const candidate = {
    id,
    question: entry.question,
    expect_answered: !asKnownGap && envelope.answered,
    note: `Promoted from feedback ${entry.feedback_id} (verdict: ${entry.verdict}).`
  };
  if (asKnownGap) {
    candidate.status = "known_gap";
  } else if (envelope.answered && envelope.claims.length > 0) {
    const firstCitation = envelope.claims[0].citation;
    if (firstCitation) {
      candidate.expect_citation_contains = `${firstCitation.guideline_code} §${firstCitation.section_number}`;
    }
  }
  console.log(JSON.stringify(candidate, null, 2));
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

module.exports = { main };
