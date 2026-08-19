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
  "동물종": ["species"],
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
  "결합": ["binding"]
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
      if (candidate && !STOPWORDS.has(candidate) && candidate.length > 1) {
        tokens.push(candidate);
      }
    } else {
      if (!STOPWORDS.has(lower)) {
        tokens.push(lower);
      }
    }
  }

  return tokens;
}

module.exports = { tokenize, STOPWORDS, REGULATORY_SYNONYMS };

