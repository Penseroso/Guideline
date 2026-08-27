/**
 * engine/comparison_engine.js
 * M4: Cross-Guideline Comparison Engine
 * Compares requirements, criteria, and conditions across multiple regulatory guidelines.
 */

const { tokenize, REGULATORY_SYNONYMS } = require("./text_utils");

const COMPARISON_MARKERS = [
  "비교", "차이", "차이점", "대조", "다른점", "상이", "구분",
  "vs", "versus", "compare", "comparison", "differ", "difference", "divergence"
];

const DOC_KEYWORDS = {
  ich_m10: ["m10", "ich_m10", "ich m10", "바이오분석", "생체시료", "bioanalytical", "lba", "크로마토그래피"],
  fda_ada: ["fda", "ada", "fda_ada", "면역원성", "항약물항체", "immunogenicity", "cut point", "컷포인트", "nab"],
  ema_fih: ["ema", "fih", "ema_fih", "초기임상", "임상1상", "first in human", "mabel", "sentinel", "stopping rule"],
  ich_s6_r1: ["s6", "s6(r1)", "ich_s6", "ich s6", "비임상", "동물종", "종선택", "preclinical", "생명공학", "biotechnology"],
  ich_m3_r2: ["m3", "m3(r2)", "ich_m3", "ich m3", "탐색적", "마이크로도즈", "microdose", "독성시험기간", "고용량", "wocbp", "가임기"],
  fda_ada_2014: ["2014", "임상면역원성", "샘플링", "내인성", "교차반응", "clinical immunogenicity", "sampling", "risk assessment", "prca", "anaphylaxis"]
};

function isComparisonQuery(question) {
  if (!question || typeof question !== "string") return false;
  const qLower = question.toLowerCase();
  let hasMarker = false;
  for (const marker of COMPARISON_MARKERS) {
    if (qLower.includes(marker)) {
      hasMarker = true;
      break;
    }
  }
  if (!hasMarker) return false;
  const targetDocs = identifyTargetDocs(question);
  return targetDocs.length >= 2;
}

function identifyTargetDocs(question) {
  const qLower = question.toLowerCase();
  const matchedDocs = new Set();

  for (const [docId, keywords] of Object.entries(DOC_KEYWORDS)) {
    for (const kw of keywords) {
      if (qLower.includes(kw)) {
        matchedDocs.add(docId);
        break;
      }
    }
  }

  // Disambiguate FDA ADA 2014 vs FDA ADA 2019
  if (qLower.includes("2014") && !qLower.includes("2019") && !qLower.includes("vs") && !qLower.includes("비교")) {
    matchedDocs.delete("fda_ada");
  }

  if (matchedDocs.size >= 2) {
    return Array.from(matchedDocs);
  }

  if (matchedDocs.size === 1) {
    return Array.from(matchedDocs);
  }

  if (qLower.includes("면역원성") || qLower.includes("ada") || qLower.includes("cut point") || qLower.includes("lba")) {
    return ["fda_ada", "ich_m10"];
  }
  if (qLower.includes("시작용량") || qLower.includes("starting dose") || qLower.includes("noael") || qLower.includes("mabel")) {
    return ["ema_fih", "ich_s6_r1"];
  }
  if (qLower.includes("비임상") || qLower.includes("동물종") || qLower.includes("독성")) {
    return ["ich_s6_r1", "ema_fih"];
  }

  return ["ich_m10", "fda_ada"];
}

function extractTopicTokens(question) {
  const qTokens = tokenize(question);
  const comparisonStopwords = new Set([
    "비교", "차이", "차이점", "대조", "다른점", "어떻게", "무엇", "알려줘", "설명해줘",
    "vs", "versus", "compare", "comparison", "difference", "기준", "요건", "항목",
    "fda", "ema", "ich", "m10", "s6", "ada", "fih"
  ]);
  return qTokens.filter((t) => !comparisonStopwords.has(t));
}

function scoreRecordForTopic(record, topicTokens, targetDocId) {
  if (record.document_id !== targetDocId) return 0;
  let score = 0;
  const searchable = (record.searchableText || record.action || record.parameter || record.source_text || "").toLowerCase();
  const koText = (record.normalized_ko || "").toLowerCase();

  for (const token of topicTokens) {
    if (searchable.includes(token)) score += 3;
    if (koText.includes(token)) score += 3;
    const syns = REGULATORY_SYNONYMS[token] || [];
    for (const syn of syns) {
      if (searchable.includes(syn) || koText.includes(syn)) score += 2;
    }
  }

  if (record.type === "quantitative_criterion") score += 2;
  return score;
}

function answerComparison(question, records, index) {
  const targetDocIds = identifyTargetDocs(question);
  if (targetDocIds.length < 2) {
    return null;
  }

  const topicTokens = extractTopicTokens(question);
  const docResults = [];

  for (const docId of targetDocIds) {
    const docMeta = (index && index.documents && index.documents.get(docId)) || { document_id: docId, title: docId };
    const scored = records
      .filter((r) => r.document_id === docId)
      .map((r) => ({ record: r, score: scoreRecordForTopic(r, topicTokens, docId) }))
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score);

    const topRecords = scored.slice(0, 5).map((x) => x.record);
    docResults.push({
      docId,
      docTitle: docMeta.title,
      records: topRecords
    });
  }

  const validResults = docResults.filter((d) => d.records.length > 0);
  if (validResults.length < 2) {
    return null;
  }

  return {
    isComparison: true,
    question,
    topicTokens,
    docResults: validResults
  };
}

function formatRecordCitation(citation) {
  if (!citation) return "";
  const page = citation.printed_page_label
    ? `p.${citation.printed_page_label}`
    : `pdf page ${citation.pdf_page_index_zero_based}`;
  return `${citation.guideline_code || citation.document_id} §${citation.section_number || "?"}, ${page} [${citation.source_unit_id}]`;
}

function formatComparativeAnswer(compMatch) {
  const { docResults, question } = compMatch;
  const lines = [];

  lines.push("⚖️ [규제 가이던스 상호 비교 분석]");
  lines.push(`질의: "${question}"\n`);

  for (let i = 0; i < docResults.length; i++) {
    const { docId, docTitle, records } = docResults[i];
    const docHeader = docId === "fda_ada" ? "FDA (FDA-2019-ADA)"
                    : docId === "ich_m10" ? "ICH (ICH M10)"
                    : docId === "ema_fih" ? "EMA (EMA FIH Rev.1)"
                    : docId === "ich_s6_r1" ? "ICH (ICH S6(R1))"
                    : docTitle;

    lines.push(`📌 ${i + 1}. ${docHeader} 핵심 요건 및 기준:`);

    for (const r of records) {
      const cite = formatRecordCitation(r.citations ? r.citations[0] : null);
      if (r.type === "quantitative_criterion") {
        const valStr = r.value_fraction ? `${r.value_fraction.numerator}/${r.value_fraction.denominator}` : (r.value !== null ? r.value : "");
        const bound = (r.comparator || "equals") + " " + valStr + (r.unit ? " " + r.unit : "");
        lines.push(`  • [수치 기준] ${r.parameter}: ${bound} (출처: ${cite})`);
      } else {
        const text = r.normalized_ko || r.action || r.source_text || "";
        const preview = text.length > 180 ? text.slice(0, 177) + "..." : text;
        lines.push(`  • [${r.modality || r.record_type || "요건"}] ${preview} (출처: ${cite})`);
      }
    }
    lines.push("");
  }

  lines.push("🔍 3. 규제 요건 비교 요약 (Key Comparison Takeaway):");
  if (docResults.some((d) => d.docId === "fda_ada") && docResults.some((d) => d.docId === "ich_m10")) {
    lines.push("  • [FDA vs ICH]: FDA ADA는 면역원성 다단계(Screening -> Confirmatory -> Titer -> NAb) 및 통계적 Cut-point 산정에 중점을 두며, ICH M10은 생체시료 분석법 전반(LBA 및 크로마토그래피)의 정확도(Accuracy), 정밀도(Precision), 선택성 등 정량적 유효성 검증 기준을 규정합니다.");
  } else if (docResults.some((d) => d.docId === "ema_fih") && docResults.some((d) => d.docId === "ich_s6_r1")) {
    lines.push("  • [EMA vs ICH]: ICH S6(R1)은 바이오의약품의 약리학적 관련 동물종(Relevant Species) 선정 및 비임상 안전성 평가 원칙을 제공하며, EMA FIH는 이를 바탕으로 사람에서의 첫 투여 시작용량(NOAEL vs MABEL), 증량 비율, Sentinel dosing 및 임상 중단 기준을 규정합니다.");
  } else {
    lines.push("  • 각 규제 기관의 가이던스는 동일한 개발 단계에 대해 상호 보완적인 세부 요건을 규정하며, 글로벌 임상 및 품목허가 제출 시 두 기준의 엄격한 요건을 모두 충족하도록 프로토콜을 수립해야 합니다.");
  }

  return lines.join("\n");
}

module.exports = {
  isComparisonQuery,
  identifyTargetDocs,
  extractTopicTokens,
  answerComparison,
  formatComparativeAnswer
};
