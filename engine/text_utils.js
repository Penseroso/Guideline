const fs = require("fs");
const path = require("path");

const CONTEXT_SLOTS_PATH = path.join(__dirname, "..", "data", "ontology", "context_slots.json");
let contextSlotsCache = null;
function loadContextSlots() {
  if (!contextSlotsCache) {
    contextSlotsCache = JSON.parse(fs.readFileSync(CONTEXT_SLOTS_PATH, "utf8"));
  }
  return contextSlotsCache;
}

const STOPWORDS = new Set([
  "the", "a", "an", "is", "are", "was", "were", "of", "for", "to", "in", "on",
  "and", "or", "what", "how", "does", "do", "should", "must", "may", "at",
  "least", "with", "be", "it", "this", "that", "as", "per", "from", "each", "all",
  // Korean common stop words / particles
  "은", "는", "이", "가", "을", "를", "의", "에", "에서", "로", "으로", "과", "와",
  "도", "만", "몇", "개", "해", "돼", "되나", "어떻게", "뭐야", "얼마나", "어느",
  "정도", "해야", "하는", "할", "때", "관련", "대해", "위해", "있어", "어디까지"
]);

const KO_PARTICLES = /(에서는|으로는|에게는|에서도|에서|으로는|으로|에게|까지|부터|보다|하고|이나|나|은|는|이|가|을|를|의|에|와|과|도|만|라|며|할때|때|해야|돼|되나|인가|인가요|인지|까지는)$/;

const SINGLE_LETTER_KO_WHITELIST = new Set(["종", "상", "일", "월", "년"]);

const REGULATORY_SYNONYMS = {
  "정확도": ["accuracy"],
  "정밀도": ["precision"],
  "정량한계": ["lloq"],
  "정량하한": ["lloq"],
  "품질관리": ["qc"],
  "품질관리시료": ["qc"],
  "부분검증": ["partial", "validation"],
  "부분밸리데이션": ["partial", "validation"],
  "전체검증": ["full", "validation"],
  "완전검증": ["full", "validation"],
  "풀밸리데이션": ["full", "validation"],
  "허용기준": ["acceptance", "criteria"],
  "허용범위": ["acceptance", "criteria"],
  "기준": ["criteria"],
  "종": ["species"],
  "동물종": ["species"],
  "생체종": ["species"],
  "선택": ["selection"],
  "선정": ["selection"],
  "저분자": ["small", "molecule"],
  "저분자의약품": ["small", "molecule"],
  "저분자화합물": ["small", "molecule"],
  "합성의약품": ["small", "molecule"],
  "소분자": ["small", "molecule"],
  "바이오": ["biotechnology", "biopharmaceutical"],
  "바이오의약품": ["biotechnology", "biopharmaceutical"],
  "생물의약품": ["biotechnology", "biopharmaceutical"],
  "생물학적제제": ["biotechnology", "biopharmaceutical"],
  "단백질": ["protein"],
  "항체": ["antibody"],
  "크로마토그래피": ["chromatography"],
  "면역분석": ["ligand", "binding", "assay"],
  "면역원성": ["immunogenicity", "ada"],
  "중화항체": ["neutralizing", "antibody"],
  "기간": ["duration"],
  "시험기간": ["duration"],
  "투여기간": ["duration"],
  "반복수": ["replicates"],
  "반복": ["replicates"],
  "회수율": ["recovery"],
  "안정성": ["stability"],
  "농도": ["concentration"],
  "시작용량": ["starting", "dose"],
  "독성시험": ["toxicology"],
  "독성": ["toxicology"],
  "생식독성": ["reproduction", "toxicity"],
  "생식독성시험": ["reproduction", "toxicity"],
  "발암성": ["carcinogenicity"],
  "발암성시험": ["carcinogenicity"],
  "수용체": ["receptor"],
  "결합": ["binding"],
  "컷포인트": ["cut-point", "cut", "point"],
  "선별": ["screening"],
  "확인": ["confirmatory"],
  "약물간섭": ["drug", "tolerance", "interference"],
  "약물내성": ["drug", "tolerance"],
  "중단기준": ["stopping", "rules"],
  "순차투여": ["sentinel", "dosing"]
};

function tokenize(text) {
  if (!text) return [];
  const rawMatches = String(text).match(/[a-z0-9%._-]+|[\uAC00-\uD7A3]+/gi) || [];
  const tokens = [];

  for (const raw of rawMatches) {
    const lower = raw.toLowerCase();

    // Check if it contains Hangul syllables
    if (/[\uAC00-\uD7A3]/.test(lower)) {
      // 1. Direct synonym check
      if (REGULATORY_SYNONYMS[lower]) {
        tokens.push(...REGULATORY_SYNONYMS[lower]);
        continue;
      }

      // 2. Particle stripping
      const stripped = lower.replace(KO_PARTICLES, "");
      if (stripped && REGULATORY_SYNONYMS[stripped]) {
        tokens.push(...REGULATORY_SYNONYMS[stripped]);
        continue;
      }

      const candidate = stripped || lower;
      if (candidate && !STOPWORDS.has(candidate) && (candidate.length > 1 || SINGLE_LETTER_KO_WHITELIST.has(candidate))) {
        tokens.push(candidate);
      }
    } else {
      if (!STOPWORDS.has(lower)) {
        tokens.push(lower);
        // If hyphenated word, also add subwords so 'cut-point' matches 'cut' and 'point'
        if (lower.includes("-")) {
          const parts = lower.split("-").filter((p) => p && !STOPWORDS.has(p));
          tokens.push(...parts);
        }
      }
    }
  }

  return tokens;
}

/**
 * Evaluates one match_rule (data/ontology/context_slots.json retrieval_slots)
 * against a question. "token" checks tokenizer output (post particle-stripping
 * and REGULATORY_SYNONYMS mapping); "substring" checks the raw lowercased
 * question text (needed for Korean multi-syllable phrases, which tokenize()
 * maps to their English synonym tokens and so would never appear verbatim in
 * `tokens`); "token_all" requires every listed token to be present — the one
 * AND-group in the original chain (species_selection required both "species"
 * and "selection" as separate tokens, not an OR).
 */
function matchRule(rule, lowerQ, tokens) {
  if (rule.type === "token") return tokens.has(rule.term);
  if (rule.type === "substring") return lowerQ.includes(rule.term);
  if (rule.type === "token_all") return rule.terms.every((t) => tokens.has(t));
  return false;
}

/**
 * First-match-wins lookup over one retrieval_slots entry's ordered values —
 * table-driven equivalent of the original if/else-if chain, so slot vocabulary
 * lives in data/ontology/context_slots.json instead of a hardcoded chain here.
 */
function matchRetrievalSlot(slot, lowerQ, tokens) {
  for (const candidate of slot.values) {
    if (candidate.match_rules.some((rule) => matchRule(rule, lowerQ, tokens))) {
      return candidate.value;
    }
  }
  return null;
}

/**
 * Extracts 5-dimensional query-level scope constraints
 */
function extractQueryScope(question, qTokens) {
  const lowerQ = (question || "").toLowerCase();
  const tokens = qTokens instanceof Set ? qTokens : new Set(qTokens || tokenize(question));

  const retrievalSlots = loadContextSlots().retrieval_slots;
  const slotById = Object.fromEntries(retrievalSlots.map((s) => [s.slot_id, s]));

  return {
    target_molecule: matchRetrievalSlot(slotById.target_molecule, lowerQ, tokens),
    target_assay: matchRetrievalSlot(slotById.target_assay, lowerQ, tokens),
    target_topic: matchRetrievalSlot(slotById.target_topic, lowerQ, tokens)
  };
}

module.exports = { tokenize, extractQueryScope, STOPWORDS, REGULATORY_SYNONYMS, SINGLE_LETTER_KO_WHITELIST };

