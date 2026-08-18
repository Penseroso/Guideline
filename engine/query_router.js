const { loadStore } = require("./data_store");
const { tokenize } = require("./text_utils");
const { verifyClaim } = require("./verification_agent");

/**
 * Fields searched for Option A structured matching. Kept explicit
 * (not "search everything") so a match reflects a real structured
 * field hit, not an accidental substring in unrelated free text.
 */
function searchableText(record) {
  return [
    record.section_number,
    record.guideline_code,
    record.parameter,
    record.record_type,
    record.condition_type,
    record.comparator,
    record.denominator_or_reference,
    record.source_text
  ]
    .filter(Boolean)
    .join(" ");
}

/**
 * Option A: structured keyword match, no generation. Returns the
 * best-scoring answerable record plus a confidence score, or null
 * if nothing scores above MIN_CONFIDENT_MATCHES shared tokens.
 */
const MIN_CONFIDENT_MATCHES = 2;

// When scores are close, prefer the more precise structured type over
// the raw paragraph it was extracted from — a long KnowledgeRecord
// paragraph tends to share more query tokens by sheer length than the
// terse QuantitativeCriterion/Condition it contains, which would
// otherwise bury the more useful, more precise answer.
const TYPE_PRIORITY = { quantitative_criterion: 0, condition: 1, knowledge_record: 2 };
// Exact ties only. A margin > 0 was tried and found to let a barely-relevant
// QuantitativeCriterion (e.g. score 1) outrank a clearly better-matched
// KnowledgeRecord (e.g. score 2) purely on type, which is worse than doing
// no type preference at all — verified against real query data before fixing.
const NEAR_MAX_MARGIN = 0;

function structuredQuery(question, records) {
  const qTokens = new Set(tokenize(question));
  if (qTokens.size === 0) return null;

  const scored = [];
  for (const record of records) {
    const recordTokens = new Set(tokenize(searchableText(record)));
    let shared = 0;
    for (const t of qTokens) if (recordTokens.has(t)) shared += 1;
    if (shared > 0) scored.push({ record, score: shared });
  }
  if (scored.length === 0) return null;

  const maxScore = Math.max(...scored.map((s) => s.score));
  if (maxScore < MIN_CONFIDENT_MATCHES) return null;

  const nearMax = scored.filter((s) => s.score >= maxScore - NEAR_MAX_MARGIN);
  nearMax.sort((a, b) => {
    const typeDelta = TYPE_PRIORITY[a.record.type] - TYPE_PRIORITY[b.record.type];
    if (typeDelta !== 0) return typeDelta;
    return b.score - a.score;
  });

  return nearMax[0];
}

function formatCitation(citation) {
  if (!citation) return "(citation unavailable)";
  const page = citation.printed_page_label
    ? `p.${citation.printed_page_label}`
    : `pdf page ${citation.pdf_page_index_zero_based}`;
  return `${citation.guideline_code || citation.document_id} §${citation.section_number || "?"}, ${page} [${citation.source_unit_id}]`;
}

function formatAnswer(record) {
  const citation = record.citations[0];
  const cite = formatCitation(citation);

  if (record.type === "quantitative_criterion") {
    const value = record.value_fraction
      ? `${record.value_fraction.numerator}/${record.value_fraction.denominator}`
      : record.value;
    return `${record.parameter}: ${record.comparator} ${value}${record.unit ? " " + record.unit : ""}` +
      (record.denominator_or_reference ? ` (${record.denominator_or_reference})` : "") +
      `\nSource: "${record.source_text}" — ${cite}`;
  }

  if (record.type === "condition") {
    return `Condition (${record.condition_type}): "${record.source_text}" — ${cite}`;
  }

  return `"${record.source_text}" — ${cite}`;
}

const NOT_FOUND = "Not found in the current archive.";

const OPTION_B_TOP_K = 5;

/**
 * Option B: schema-anchored grounded RAG fallback (product_roadmap.md
 * §2.2 Option B, §2.5.1). Retrieves top-k candidates from the vector
 * store, constrains generation to those excerpts only, then runs the
 * generated answer back through verification_agent's entailment check
 * before ever returning it — an answer that fails verification is
 * refused, never shown "maybe right."
 */
async function answerOptionB(question, records, { client, store }) {
  const candidates = await store.search(question, OPTION_B_TOP_K);
  if (candidates.length === 0) {
    return { answered: false, text: NOT_FOUND, record: null, path: "B" };
  }

  const context = candidates
    .map((c, i) => `[${i + 1}] (${c.record.type}, ${formatCitation(c.record.citations[0])}) "${c.record.source_text}"`)
    .join("\n");

  const system =
    "Answer the question using ONLY the numbered excerpts below. Quote or closely paraphrase — " +
    `never add information not present in them. If the excerpts don't answer the question, reply with exactly "${NOT_FOUND}" and nothing else.`;

  const generation = await client.complete({
    system,
    messages: [{ role: "user", content: `Excerpts:\n${context}\n\nQuestion: ${question}` }]
  });

  const generatedText = (generation.text || "").trim();
  if (!generatedText || generatedText === NOT_FOUND) {
    return { answered: false, text: NOT_FOUND, record: null, path: "B" };
  }

  const combinedSource = candidates.map((c) => c.record.source_text).join("\n");
  const verification = await verifyClaim({ claim: generatedText, sourceText: combinedSource, client });
  if (!verification.entailed) {
    return {
      answered: false,
      text: `${NOT_FOUND} (a generated answer failed citation verification: ${verification.reason})`,
      record: null,
      path: "B"
    };
  }

  const citations = candidates.map((c) => formatCitation(c.record.citations[0])).join("; ");
  return {
    answered: true,
    text: `${generatedText}\nSources: ${citations}`,
    record: null,
    candidates: candidates.map((c) => c.record),
    path: "B",
    review_status: candidates.some((c) => c.record.review_status !== "reviewed") ? "needs_review" : "reviewed"
  };
}

/**
 * Answers a question: Option A (structured query, no LLM) first;
 * Option B (grounded RAG fallback) only when A finds nothing AND a
 * `client` (engine/llm_client.js) and `store` (engine/vector_store.js)
 * are supplied — omit both to run Option A only, with zero LLM cost
 * (product_roadmap.md §2.4.1).
 */
async function answer(question, records, { client, store } = {}) {
  const match = structuredQuery(question, records);
  if (match) {
    return {
      answered: true,
      text: formatAnswer(match.record),
      record: match.record,
      score: match.score,
      path: "A",
      review_status: match.record.review_status
    };
  }
  if (!client || !store) {
    return { answered: false, text: NOT_FOUND, record: null, score: 0, path: null };
  }
  return answerOptionB(question, records, { client, store });
}

async function main() {
  const { records } = loadStore();
  const question = process.argv.slice(2).join(" ");
  if (!question) {
    console.error("Usage: node engine/query_router.js <question>");
    process.exit(2);
  }
  const result = await answer(question, records);
  console.log(result.text);
  if (result.answered && result.review_status !== "reviewed") {
    console.log(`[review_status: ${result.review_status} — not fully reviewed]`);
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  tokenize,
  searchableText,
  structuredQuery,
  formatCitation,
  formatAnswer,
  answer,
  answerOptionB,
  NOT_FOUND
};
