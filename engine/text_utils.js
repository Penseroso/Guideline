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
  "도", "만", "몇", "개", "해", "돼", "되나", "어떻게", "뭐야", "얼마나", "어느", "어떤", "어떠한",
  "정도", "해야", "하는", "할", "때", "관련", "대해", "위해", "있어", "어디까지",
  "이란", "란", "이란은", "란은", "이란게", "란게", "무엇인가", "무엇인가요", "무엇인지", "인가", "인가요", "인지"
]);

const KO_PARTICLES = /(에서는|으로는|에게는|에서도|에서는|에서|으로는|으로|에게|까지|부터|보다|하고|이나|나|은|는|이|가|을|를|의|에|와|과|도|만|라|며|할때|때|해야|돼|되나|인가|인가요|인지|까지는|이란|란|이란\?|란\?|이란은|란은|의한|에따른|에따라|따라|따른)$/;

const SINGLE_LETTER_KO_WHITELIST = new Set(["종", "상", "일", "월", "년"]);

const REGULATORY_SYNONYMS = {
  // Accuracy / Precision / Analytical Criteria (ICH M10)
  "정확도": ["accuracy"],
  "정확성": ["accuracy"],
  "정밀도": ["precision"],
  "정밀성": ["precision"],
  "정량한계": ["lloq"],
  "정량하한": ["lloq"],
  "정량상한": ["uloq"],
  "품질관리": ["qc"],
  "품질관리시료": ["qc"],
  "밸리데이션": ["validation"],
  "벨리데이션": ["validation"],
  "검증": ["validation"],
  "부분검증": ["partial", "validation"],
  "부분밸리데이션": ["partial", "validation"],
  "부분벨리데이션": ["partial", "validation"],
  "전체검증": ["full", "validation"],
  "완전검증": ["full", "validation"],
  "풀밸리데이션": ["full", "validation"],
  "풀벨리데이션": ["full", "validation"],
  "교차검증": ["cross", "validation"],
  "교차밸리데이션": ["cross", "validation"],
  "허용기준": ["acceptance", "criteria"],
  "허용범위": ["acceptance", "criteria"],
  "기준": ["criteria"],
  "선택성": ["selectivity"],
  "특이성": ["specificity"],
  "기질효과": ["matrix", "effect"],
  "기질간섭": ["matrix", "effect"],
  "검량선": ["calibration", "curve"],
  "표준곡선": ["calibration", "curve"],
  "검량범위": ["calibration", "range"],
  "잔류효과": ["carryover", "carry-over"],
  "오염": ["carryover"],
  "희석선형성": ["dilution", "linearity", "dilution", "integrity"],
  "희석타당성": ["dilution", "integrity"],
  "후크효과": ["hook", "effect", "prozone"],
  "내부표준물질": ["internal", "standard", "is"],
  "회수율": ["recovery"],
  "안정성": ["stability"],
  "재주입": ["reinjection", "reproducibility"],
  "재분석": ["incurred", "sample", "reanalysis", "isr"],
  "건조혈반": ["dried", "blood", "spot", "dbs", "dmm"],
  "건조시료": ["dried", "matrix", "dmm"],
  "농도": ["concentration"],
  "반복수": ["replicates"],
  "반복": ["replicates"],
  "몇개": ["replicates"],
  "개수": ["replicates"],
  "수량": ["replicates"],

  // Assays & Technologies (ICH M10 & FDA ADA)
  "elisa": ["ligand", "binding", "assay", "lba"],
  "lba": ["ligand", "binding", "assay", "lba"],
  "ecl": ["ligand", "binding", "assay", "lba"],
  "ria": ["ligand", "binding", "assay", "lba"],
  "spr": ["surface", "plasmon", "resonance", "binding"],
  "lc-ms": ["chromatography"],
  "lc-ms/ms": ["chromatography"],
  "lcms": ["chromatography"],
  "lcmsms": ["chromatography"],
  "hplc": ["chromatography"],
  "uplc": ["chromatography"],
  "gc-ms": ["chromatography"],
  "gc-ms/ms": ["chromatography"],
  "크로마토그래피": ["chromatography"],
  "면역분석": ["ligand", "binding", "assay"],
  "면역분석법": ["ligand", "binding", "assay"],
  "분석": ["assay"],
  "분석법": ["assay"],
  "상용키트": ["commercial", "kit", "ruo"],
  "키트": ["kit"],

  // Immunogenicity & ADA (FDA ADA)
  "면역원성": ["immunogenicity", "ada"],
  "항약물항체": ["anti", "drug", "antibody", "ada"],
  "중화항체": ["neutralizing", "antibody", "nab"],
  "컷포인트": ["cut-point", "cut", "point"],
  "선별컷포인트": ["screening", "cut-point", "scp"],
  "확증컷포인트": ["confirmatory", "cut-point", "ccp"],
  "적정컷포인트": ["titration", "cut-point", "tcp"],
  "선별": ["screening"],
  "확인": ["confirmatory"],
  "확증": ["confirmatory"],
  "적정": ["titration"],
  "역가": ["titration", "titer"],
  "중화": ["neutralization", "neutralizing"],
  "다계층": ["multi", "tiered"],
  "약물간섭": ["drug", "tolerance", "interference"],
  "약물내성": ["drug", "tolerance"],
  "산해리": ["acid", "dissociation"],
  "기존항체": ["pre-existing", "antibody"],
  "치료유도": ["treatment", "induced"],
  "치료증폭": ["treatment", "boosted"],
  "음성대조": ["negative", "control"],
  "양성대조": ["positive", "control"],
  "최저혈중농도": ["trough"],
  "검체": ["sample", "samples"],
  "채취": ["sampling", "drawn", "collection"],
  "시점": ["schedule", "timing"],
  "베이스라인": ["baseline", "pre-treatment", "pre-dose"],
  "피하투여": ["subcutaneous", "sc"],
  "피하": ["subcutaneous", "sc"],
  "정맥투여": ["intravenous", "iv"],
  "정맥": ["intravenous", "iv"],
  "근육투여": ["intramuscular", "im"],
  "투여경로": ["route", "administration"],
  "응집체": ["aggregate", "aggregates", "particles"],
  "미립자": ["particles", "sub-visible"],
  "당화": ["glycosylation", "glycan"],
  "소실기간": ["washout", "clearance"],
  "워시아웃": ["washout"],

  // Molecules & Biological Contexts
  "저분자": ["small", "molecule"],
  "저분자의약품": ["small", "molecule"],
  "저분자화합물": ["small", "molecule"],
  "합성의약품": ["small", "molecule"],
  "소분자": ["small", "molecule"],
  "바이오": ["biotechnology", "biopharmaceutical"],
  "바이오의약품": ["biotechnology", "biopharmaceutical"],
  "생물의약품": ["biotechnology", "biopharmaceutical"],
  "생물학적제제": ["biotechnology", "biopharmaceutical"],
  "유전자재조합": ["recombinant", "dna"],
  "단백질": ["protein"],
  "펩타이드": ["peptide"],
  "단클론항체": ["monoclonal", "antibody", "mab"],
  "항체": ["antibody"],
  "adc": ["antibody", "drug", "conjugate", "adc"],
  "항체약물접합체": ["antibody", "drug", "conjugate", "adc"],
  "동종단백질": ["homologous", "protein"],
  "형질전환": ["transgenic"],
  "내인성": ["endogenous"],
  "외래": ["foreign"],
  "표적": ["target"],
  "수용체": ["receptor"],
  "결합": ["binding"],
  "친화도": ["affinity"],
  "수용체점유율": ["receptor", "occupancy"],

  // Preclinical Safety & Species Selection (ICH S6(R1))
  "종": ["species"],
  "동물종": ["species"],
  "생체종": ["species"],
  "선택": ["selection"],
  "선정": ["selection"],
  "관련종": ["relevant", "species"],
  "관련동물종": ["relevant", "species"],
  "설치류": ["rodent"],
  "비설치류": ["non", "rodent"],
  "영장류": ["non", "human", "primate", "nhp", "monkey"],
  "원숭이": ["non", "human", "primate", "nhp", "monkey"],
  "조직교차반응": ["tissue", "cross", "reactivity", "tcr"],
  "조직교차반응성": ["tissue", "cross", "reactivity", "tcr"],
  "tcr": ["tissue", "cross", "reactivity", "tcr"],
  "독성시험": ["toxicology"],
  "독성": ["toxicology"],
  "안전성약리": ["safety", "pharmacology"],
  "단회투여": ["single", "dose"],
  "반복투여": ["repeated", "dose"],
  "만성독성": ["chronic", "toxicity", "repeated", "dose"],
  "기간": ["duration"],
  "시험기간": ["duration"],
  "투여기간": ["duration"],
  "고용량": ["high", "dose"],
  "용량선택": ["dose", "selection"],
  "노출배수": ["exposure", "multiple", "margin"],
  "안전역": ["safety", "margin"],
  "안전마진": ["safety", "margin"],
  "회복": ["recovery"],
  "회복기간": ["recovery", "period"],
  "가역성": ["reversibility", "reversible"],
  "면역독성": ["immunotoxicity"],
  "유전독성": ["genotoxicity"],
  "유전독성시험": ["genotoxicity"],
  "소핵시험": ["micronucleus"],
  "발암성": ["carcinogenicity"],
  "발암성시험": ["carcinogenicity"],
  "생식독성": ["reproduction", "toxicity", "reproductive"],
  "생식독성시험": ["reproduction", "toxicity", "reproductive"],
  "발생독성": ["developmental", "toxicity"],
  "수태능": ["fertility"],
  "배태자발생": ["embryo", "fetal", "development", "efd"],
  "배태자발생독성": ["embryo", "fetal", "development", "efd"],
  "efd": ["embryo", "fetal", "development", "efd"],
  "산전산후발생": ["pre", "post", "natal", "development", "ppnd"],
  "산전산후발생독성": ["pre", "post", "natal", "development", "ppnd"],
  "ppnd": ["pre", "post", "natal", "development", "ppnd"],
  "eppnd": ["enhanced", "pre", "post", "natal", "development", "eppnd"],
  "국소자극성": ["local", "tolerance"],

  // FIH & Clinical Study Design (EMA FIH)
  "fih": ["first", "human", "fih", "starting", "dose"],
  "최초임상": ["first", "human", "fih", "starting", "dose"],
  "임상1상": ["first", "human", "fih", "phase", "1"],
  "1상": ["phase", "1"],
  "시작용량": ["starting", "dose"],
  "mabel": ["mabel", "starting", "dose"],
  "noael": ["noael", "starting", "dose"],
  "hnstd": ["hnstd", "starting", "dose"],
  "mrsd": ["mrsd", "starting", "dose"],
  "pad": ["pharmacologically", "active", "dose", "pad"],
  "sad": ["single", "ascending", "dose", "sad"],
  "단회증량": ["single", "ascending", "dose", "sad"],
  "mad": ["multiple", "ascending", "dose", "mad"],
  "반복증량": ["multiple", "ascending", "dose", "mad"],
  "용량증량": ["dose", "escalation"],
  "센티넬": ["sentinel", "dosing"],
  "센티널": ["sentinel", "dosing"],
  "순차투여": ["sentinel", "dosing"],
  "투약간격": ["dosing", "interval", "staggering"],
  "중단기준": ["stopping", "rules"],
  "용량제한독성": ["dose", "limiting", "toxicity", "dlt"],
  "dlt": ["dose", "limiting", "toxicity", "dlt"],
  "고위험": ["high", "risk"],
  "작용기전": ["mode", "of", "action", "mechanism"],
  "사이토카인": ["cytokine", "release", "storm"],
  "사이토카인폭풍": ["cytokine", "release", "storm"],
  "사이토카인방출": ["cytokine", "release", "storm"],
  "crs": ["cytokine", "release", "syndrome", "crs"],
  "atmp": ["advanced", "therapy", "medicinal", "product", "atmp"],
  "건강인": ["healthy", "volunteer"],
  "환자": ["patient"],
  "중증질환": ["severe", "disease"],
  "말기질환": ["life-limiting", "disease"]
};

function tokenize(text) {
  if (!text) return [];
  const normalizedText = String(text)
    .replace(/몇\s*개/g, "몇개")
    .replace(/lc[\s/-]*ms[\s/-]*ms/gi, "lc-ms/ms")
    .replace(/lc[\s/-]*ms/gi, "lc-ms")
    .replace(/gc[\s/-]*ms[\s/-]*ms/gi, "gc-ms/ms")
    .replace(/gc[\s/-]*ms/gi, "gc-ms")
    .replace(/pk[\s/-]*pd/gi, "pk-pd")
    .replace(/cut[\s/-]*point/gi, "cut-point")
    .replace(/first[\s/-]*in[\s/-]*human/gi, "first-in-human")
    .replace(/non[\s/-]*human[\s/-]*primate/gi, "non-human-primate");

  const rawMatches = normalizedText.match(/[a-z0-9%._\/-]+|[\uAC00-\uD7A3]+/gi) || [];
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
        if (REGULATORY_SYNONYMS[lower]) {
          tokens.push(...REGULATORY_SYNONYMS[lower]);
        } else {
          tokens.push(lower);
        }
        // If hyphenated or slashed word, also add subwords so 'cut-point' matches 'cut' and 'point'
        if (lower.includes("-") || lower.includes("/")) {
          const parts = lower.split(/[-/]/).filter((p) => p && !STOPWORDS.has(p));
          tokens.push(...parts);
        }
      }
    }
  }

  // Expand domain-specific compound concepts
  if (tokens.includes("drug") && tokens.includes("interference") && !tokens.includes("tolerance")) {
    tokens.push("tolerance");
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

