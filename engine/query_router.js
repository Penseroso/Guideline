const { loadStore } = require("./data_store");
const { tokenize, extractQueryScope } = require("./text_utils");
const { verifyClaim } = require("./verification_agent");
const { isComparisonQuery, answerComparison, formatComparativeAnswer } = require("./comparison_engine");
const { isAmendmentQuery, answerAmendment, formatAmendmentAnswer } = require("./amendment_engine");

/**
 * Minimum score and token count required for Option A structured matching.
 */
const MIN_CONFIDENT_MATCH_SCORE = 3.0;
const MIN_MATCHED_TOKENS = 2;

// When scores are close, prefer the more precise structured type over
// the raw paragraph it was extracted from.
const TYPE_PRIORITY = { quantitative_criterion: 0, condition: 1, knowledge_record: 2 };

/**
 * Scores a record against query tokens using field-weighted matching and Scope Guard.
 * Structural fields (parameter, section, condition) receive higher weights
 * than unconstrained source text. Exception mentions (e.g. 'except LLOQ')
 * are penalized when the query did not ask for exclusions.
 * Scope Guard rejects records that conflict with the query's molecule, assay, or topic.
 */
function scoreRecord(record, qTokens, queryScope = {}) {
  // 1. Scope Guard: Hard exclusion and mismatch checks
  if (queryScope.target_molecule && record.explicit_exclusions && record.explicit_exclusions.includes(queryScope.target_molecule)) {
    return { score: 0, matchedCount: 0 };
  }
  if (queryScope.target_assay && record.explicit_exclusions && record.explicit_exclusions.includes(queryScope.target_assay)) {
    return { score: 0, matchedCount: 0 };
  }
  if (queryScope.target_assay && record.assay_technology_scope && record.assay_technology_scope !== "none" && record.assay_technology_scope !== queryScope.target_assay) {
    return { score: 0, matchedCount: 0 };
  }
  if (queryScope.target_topic === "species_selection") {
    if (record.topic_scope !== "species_selection") {
      return { score: 0, matchedCount: 0 };
    }
  }
  if (queryScope.target_topic === "starting_dose") {
    // If asking about starting dose, hard-reject study duration or repeated dose toxicity
    if (record.topic_scope !== "starting_dose") {
      return { score: 0, matchedCount: 0 };
    }
  }

  // 2. Base field scoring
  let score = 0;
  const matchedTokens = new Set();

  const paramTokens = new Set(tokenize(record.parameter));
  const denomTokens = new Set(tokenize(record.denominator_or_reference));
  const sourceTokens = new Set(tokenize(record.source_text));
  const secTokens = new Set(tokenize(record.section_number));
  const codeTokens = new Set(tokenize(record.guideline_code));
  const actionTokens = new Set(tokenize(record.action));
  const objectTokens = new Set(tokenize(record.object));
  const condTypeTokens = new Set(tokenize(record.condition_type));
  const sectionPathTokens = new Set(tokenize((record.section_path || []).join(" ")));
  const docTitleTokens = new Set(tokenize(record.document_title || ""));

  const hasNegativeQueryToken = qTokens.has("except") || qTokens.has("excluding") || qTokens.has("제외");

  // If query asks for criteria/acceptance, quantitative_criterion records represent that entity type
  if (record.type === "quantitative_criterion") {
    if (qTokens.has("criteria") || qTokens.has("criterion")) {
      matchedTokens.add("criteria");
      score += 2.0;
    }
    if (qTokens.has("acceptance")) {
      matchedTokens.add("acceptance");
      score += 1.5;
    }
  }

  const paramLower = (record.parameter || "").toLowerCase().trim();

  for (const t of qTokens) {
    if (t === "criteria" || t === "criterion" || t === "acceptance") continue;
    let tokenScore = 0;
    if (paramLower === t) {
      tokenScore = Math.max(tokenScore, 5.0);
    } else if (paramTokens.has(t)) {
      tokenScore = Math.max(tokenScore, 3.5);
    }
    if (condTypeTokens.has(t)) {
      tokenScore = Math.max(tokenScore, 3.0);
    }
    if (secTokens.has(t) || codeTokens.has(t) || sectionPathTokens.has(t)) {
      tokenScore = Math.max(tokenScore, 2.5);
    }
    if (denomTokens.has(t)) {
      const denomLower = (record.denominator_or_reference || "").toLowerCase();
      const isNegativeMention = denomLower.includes(`except ${t}`) ||
                                denomLower.includes(`except at the ${t}`) ||
                                denomLower.includes(`except at ${t}`) ||
                                denomLower.includes(`excluding ${t}`);

      if (isNegativeMention && !hasNegativeQueryToken) {
        tokenScore = Math.max(tokenScore, 0.1);
      } else {
        tokenScore = Math.max(tokenScore, 2.5);
      }
    }
    if (actionTokens.has(t) || objectTokens.has(t)) {
      tokenScore = Math.max(tokenScore, 1.5);
    }
    if (docTitleTokens.has(t)) {
      tokenScore = Math.max(tokenScore, 1.5);
    }
    if (sourceTokens.has(t)) {
      tokenScore = Math.max(tokenScore, 0.5);
    }

    if (tokenScore > 0) {
      matchedTokens.add(t);
      score += tokenScore;
    }
  }

  // Topic bonus: if record's topic_scope matches query's target_topic
  if (queryScope.target_topic && record.topic_scope === queryScope.target_topic) {
    score += 2.0;
  }
  // Molecule bonus: if record's molecule_scope matches query's target_molecule
  if (queryScope.target_molecule && record.molecule_scope === queryScope.target_molecule) {
    score += 1.5;
  }

  return { score, matchedCount: matchedTokens.size };
}

function areSiblings(a, b) {
  if (a.type !== "quantitative_criterion" || b.type !== "quantitative_criterion") return false;
  if (a.parameter !== b.parameter) return false;
  if (a.knowledge_record_id && b.knowledge_record_id && a.knowledge_record_id === b.knowledge_record_id) return true;
  if (a.source_unit_ids && b.source_unit_ids && a.source_unit_ids[0] && b.source_unit_ids[0] && a.source_unit_ids[0] === b.source_unit_ids[0]) return true;
  return false;
}

function isListQuery(question, qTokens) {
  const lowerQ = (question || "").toLowerCase();
  const listTerms = [
    "항목", "리스트", "목록", "요건", "요구사항", "체크리스트", "사항", "원칙들", "기준들",
    "list", "items", "requirements", "checklist", "principles", "components", "factors", "steps", "rules"
  ];
  return listTerms.some((k) => lowerQ.includes(k) || qTokens.has(k));
}

function tryListCompositeQuery(scored, qTokens, question) {
  if (!isListQuery(question, qTokens)) return null;

  // Group scored records by section_id (or topic_scope if section_id is missing)
  const groups = new Map();
  for (const { record, score, matchedCount } of scored) {
    const key = record.section_id || record.topic_scope || "global";
    if (!groups.has(key)) {
      const cite = record.citations ? record.citations[0] : null;
      const title = `${record.guideline_code || record.document_id || 'Guideline'} §${record.section_number || ''} ${(record.section_path && record.section_path.slice(-1)[0]) || record.topic_scope || ''}`;
      groups.set(key, { key, title, maxScore: 0, totalScore: 0, items: [] });
    }
    const g = groups.get(key);
    g.maxScore = Math.max(g.maxScore, score);
    g.totalScore += score;
    // Deduplicate records by source_text to keep list concise
    if (!g.items.some((it) => it.source_text === record.source_text || (it.parameter && it.parameter === record.parameter))) {
      g.items.push(record);
    }
  }

  const sortedGroups = [...groups.values()].sort((a, b) => {
    if (b.maxScore !== a.maxScore) return b.maxScore - a.maxScore;
    return b.totalScore - a.totalScore;
  });

  if (sortedGroups.length === 0) return null;
  const topGroup = sortedGroups[0];

  // Must have a confident score and at least 2 distinct items
  if (topGroup.maxScore < 4.0 || topGroup.items.length < 2) {
    return null;
  }

  // If there is a second group with an equal max score and comparable total score from a completely different document/topic, abstain
  if (sortedGroups.length > 1) {
    const secondGroup = sortedGroups[1];
    if (secondGroup.maxScore === topGroup.maxScore && secondGroup.totalScore >= topGroup.totalScore * 0.9) {
      return null;
    }
  }

  return {
    record: topGroup.items[0],
    score: topGroup.maxScore,
    isComposite: true,
    isListComposite: true,
    bundleTitle: topGroup.title,
    compositeRecords: topGroup.items.slice(0, 10)
  };
}

/**
 * Option A: structured match, no generation. Returns the best-scoring
 * answerable match (single or sibling composite), or null if nothing scores
 * above the confidence threshold or if top candidates are in conflict (abstention).
 */
function structuredQuery(question, records, index = null) {
  if (!question || typeof question !== "string" || !records || records.length === 0) {
    return null;
  }

  // M4: Check for Cross-Guideline Comparison queries
  if (isComparisonQuery(question)) {
    const compMatch = answerComparison(question, records, index);
    if (compMatch) return compMatch;
  }

  // M4: Check for Guideline Amendment & Revision queries
  if (isAmendmentQuery(question)) {
    const amendMatch = answerAmendment(question, records, index);
    if (amendMatch) return amendMatch;
  }

  const qTokens = new Set(tokenize(question));
  if (qTokens.size === 0) return null;

  const queryScope = extractQueryScope(question, qTokens);

  const scored = [];
  for (const record of records) {
    const { score, matchedCount } = scoreRecord(record, qTokens, queryScope);
    if (score >= MIN_CONFIDENT_MATCH_SCORE && matchedCount >= MIN_MATCHED_TOKENS) {
      scored.push({ record, score, matchedCount });
    }
  }
  if (scored.length === 0) return null;

  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    const typeDelta = TYPE_PRIORITY[a.record.type] - TYPE_PRIORITY[b.record.type];
    if (typeDelta !== 0) return typeDelta;
    return b.matchedCount - a.matchedCount;
  });

  // Check if this is a multi-item list / requirements query
  const listCompositeMatch = tryListCompositeQuery(scored, qTokens, question);
  if (listCompositeMatch) {
    return listCompositeMatch;
  }

  const maxScore = scored[0].score;
  const topTied = scored.filter((s) => s.score === maxScore);

  // Case 1: Single clear winner
  if (topTied.length === 1) {
    return {
      record: topTied[0].record,
      score: topTied[0].score,
      isComposite: false
    };
  }

  // Case 2: Sibling criteria forming a composite rule set (e.g. default + exception)
  const allQCs = topTied.every((t) => t.record.type === "quantitative_criterion");
  if (allQCs) {
    const first = topTied[0].record;
    const allSiblings = topTied.every((t) => areSiblings(first, t.record));
    if (allSiblings) {
      return {
        record: first,
        score: maxScore,
        isComposite: true,
        compositeRecords: topTied.map((t) => t.record)
      };
    }
  }

  // Case 3: All top-tied records refer to the exact same source_unit and same text
  const firstUnit = topTied[0].record.source_unit_ids ? topTied[0].record.source_unit_ids[0] : null;
  const sameUnit = firstUnit && topTied.every((t) => t.record.source_unit_ids && t.record.source_unit_ids[0] === firstUnit);
  if (sameUnit && topTied[0].record.type === "knowledge_record") {
    return {
      record: topTied[0].record,
      score: maxScore,
      isComposite: false
    };
  }

  // Case 4: Ambiguous / conflicting tie between different records
  // -> ABSTAIN to prevent arbitrary lottery winner, safely delegate to Option B
  return null;
}

function formatCitation(citation) {
  if (!citation) return "(citation unavailable)";
  const page = citation.printed_page_label
    ? `p.${citation.printed_page_label}`
    : `pdf page ${citation.pdf_page_index_zero_based}`;
  return `${citation.guideline_code || citation.document_id} §${citation.section_number || "?"}, ${page} [${citation.source_unit_id}]`;
}

function formatSingleCriterion(record) {
  const value = record.value_fraction
    ? `${record.value_fraction.numerator}/${record.value_fraction.denominator}`
    : record.value;
  const qualifier = record.is_illustrative_example
    ? "(illustrative example, not a specified requirement) "
    : record.is_default_with_exception
      ? "(default value — exceptions may apply) "
      : "";
  return `${qualifier}${record.parameter}: ${record.comparator} ${value}${record.unit ? " " + record.unit : ""}` +
    (record.denominator_or_reference ? ` (${record.denominator_or_reference})` : "");
}

function formatApplicableConditions(conditions) {
  if (!conditions || conditions.length === 0) return "";
  const lines = conditions.map((c) => `  - (${c.condition_type}) "${c.condition_text}"`);
  return `\nApplicable conditions:\n${lines.join("\n")}`;
}

function formatCrossReferences(crossReferences) {
  if (!crossReferences || crossReferences.length === 0) return "";
  const lines = [];
  const seen = new Set();
  for (const x of crossReferences) {
    const key = x.target_id || x.raw_reference_text;
    if (seen.has(key)) continue;
    seen.add(key);

    if (x.target_citation && x.target_source_text) {
      lines.push(`  • [관련/개정 조항] ${x.target_citation}: "${x.target_source_text}"`);
    } else if (x.raw_reference_text) {
      lines.push(`  • [참조 조항] "${x.raw_reference_text}"`);
    }
  }
  if (lines.length === 0) return "";
  return `\n\n📎 규제 개정 및 관련 조항 참고 (Note on Guideline History & Related References):\n${lines.join("\n")}`;
}

function formatListCompositeAnswer(match) {
  const records = match.compositeRecords;
  const title = (match.bundleTitle || "").trim();
  const header = title ? `📋 [${title}] 관련 주요 요건 및 기준 목록:` : "📋 관련 주요 요건 및 기준 목록:";

  const items = [];
  for (const r of records) {
    const cite = formatCitation(r.citations ? r.citations[0] : null);
    if (r.type === "quantitative_criterion") {
      items.push(`  • ${formatSingleCriterion(r)} (출처: ${cite})`);
    } else if (r.type === "knowledge_record") {
      items.push(`  • [${r.record_type || '요건'}] "${r.source_text}" — ${cite}`);
    } else if (r.type === "condition") {
      items.push(`  • [단서조항 (${r.condition_type})] "${r.source_text}" — ${cite}`);
    }
  }

  const allConditions = records.flatMap((r) => r.applicable_conditions || []);
  const uniqueConditions = [...new Map(allConditions.map((c) => [c.condition_text, c])).values()];
  const allXrefs = records.flatMap((r) => r.cross_references || []);

  return `${header}\n\n${items.join("\n")}${formatApplicableConditions(uniqueConditions)}${formatCrossReferences(allXrefs)}`;
}

function formatCompositeAnswer(records) {
  const primary = records[0];
  const citation = primary.citations[0];
  const cite = formatCitation(citation);

  const lines = records.map((r) => `• ${formatSingleCriterion(r)}`);
  const allConditions = records.flatMap((r) => r.applicable_conditions || []);
  const uniqueConditions = [...new Map(allConditions.map((c) => [c.condition_text, c])).values()];
  const allXrefs = records.flatMap((r) => r.cross_references || []);
  return `Criteria for ${primary.parameter}:\n${lines.join("\n")}\nSource: "${primary.source_text}" — ${cite}${formatApplicableConditions(uniqueConditions)}${formatCrossReferences(allXrefs)}`;
}

function formatAnswer(match) {
  if (!match) return "";

  // M4: Comparative Answering
  if (match.isComparison) {
    return formatComparativeAnswer(match);
  }

  // M4: Amendment History Answering
  if (match.isAmendment) {
    return formatAmendmentAnswer(match);
  }

  // Support both raw record or structured match object
  const isMatchObj = match && match.record;
  const record = isMatchObj ? match.record : match;

  if (isMatchObj && match.isComposite) {
    if (match.isListComposite && match.compositeRecords && match.compositeRecords.length > 1) {
      return formatListCompositeAnswer(match);
    }
    if (match.compositeRecords && match.compositeRecords.length > 1) {
      return formatCompositeAnswer(match.compositeRecords);
    }
  }

  const citation = record.citations ? record.citations[0] : null;
  const cite = formatCitation(citation);
  const xrefBlock = formatCrossReferences(record.cross_references);

  if (record.type === "quantitative_criterion") {
    return `${formatSingleCriterion(record)}\nSource: "${record.source_text}" — ${cite}${formatApplicableConditions(record.applicable_conditions)}${xrefBlock}`;
  }

  if (record.type === "condition") {
    return `Condition (${record.condition_type}): "${record.source_text}" — ${cite}${xrefBlock}`;
  }

  return `"${record.source_text}" — ${cite}${formatApplicableConditions(record.applicable_conditions)}${xrefBlock}`;
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
  const qTokens = new Set(tokenize(question));
  const queryScope = extractQueryScope(question, qTokens);

  let rawCandidates = await store.search(question, OPTION_B_TOP_K * 2);

  // Apply Scope Guard to Option B candidates to prevent cross-domain contamination
  let candidates = rawCandidates;
  if (queryScope.target_molecule || queryScope.target_assay) {
    candidates = rawCandidates.filter(({ record }) => {
      if (queryScope.target_molecule && record.explicit_exclusions && record.explicit_exclusions.includes(queryScope.target_molecule)) {
        return false;
      }
      if (queryScope.target_assay && record.explicit_exclusions && record.explicit_exclusions.includes(queryScope.target_assay)) {
        return false;
      }
      return true;
    });
  }

  candidates = candidates.slice(0, OPTION_B_TOP_K);

  if (candidates.length === 0) {
    return { answered: false, text: NOT_FOUND, record: null, path: "B" };
  }

  const context = candidates
    .map((c, i) => `[${i + 1}] (${c.record.type}, ${formatCitation(c.record.citations[0])}) "${c.record.source_text}"`)
    .join("\n");

  const system =
    "Answer the question using ONLY the numbered excerpts below. Quote or closely paraphrase — " +
    "never add information not present in them. Strictly preserve modal strength: do NOT upgrade discretionary or optional phrasing " +
    "('may', 'can', 'optional') into recommendations ('should') or requirements ('must', 'have to'), and do not upgrade recommendations ('should') " +
    `into requirements ('must'). If the excerpts don't answer the question, reply with exactly "${NOT_FOUND}" and nothing else.`;

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

  const allCandidateXrefs = candidates.flatMap((c) => c.record.cross_references || []);
  const xrefBlock = formatCrossReferences(allCandidateXrefs);
  const citations = candidates.map((c) => formatCitation(c.record.citations[0])).join("; ");
  return {
    answered: true,
    text: `${generatedText}\nSources: ${citations}${xrefBlock}`,
    record: null,
    candidates: candidates.map((c) => c.record),
    path: "B",
    review_status: candidates.some((c) => c.record.review_status !== "reviewed") ? "needs_review" : "reviewed"
  };
}

/**
 * Answers a question: Option A (structured query, no LLM) first;
 * Option B (grounded RAG fallback) only when A finds nothing/abstains AND a
 * `client` (engine/llm_client.js) and `store` (engine/vector_store.js)
 * are supplied — omit both to run Option A only, with zero LLM cost
 * (product_roadmap.md §2.4.1).
 */
async function answer(question, records, { client, store } = {}) {
  const match = structuredQuery(question, records);
  if (match) {
    return {
      answered: true,
      text: formatAnswer(match),
      record: match.record || (match.docResults ? match.docResults[0].records[0] : null),
      score: match.score || 5.0,
      path: "A",
      review_status: (match.record && match.record.review_status) || "reviewed"
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
  scoreRecord,
  structuredQuery,
  formatCitation,
  formatApplicableConditions,
  formatCrossReferences,
  formatAnswer,
  answer,
  answerOptionB,
  NOT_FOUND
};
