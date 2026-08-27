/**
 * engine/amendment_engine.js
 * M4: Guideline Amendment & Revision History Engine
 * Resolves version evolution, addendum notes, and effective regulatory states.
 */

const { tokenize } = require("./text_utils");

const AMENDMENT_MARKERS = [
  "개정", "수정", "변경", "히스토리", "이력", "변화", "추가된", "신설",
  "amendment", "revision", "history", "note", "notes", "addendum", "version", "evolution"
];

const GUIDELINE_REVISIONS = {
  ich_s6_r1: {
    docId: "ich_s6_r1",
    title: "ICH S6(R1) Preclinical Safety Evaluation of Biotechnology-Derived Pharmaceuticals",
    parentVersion: "ICH S6 (1997 원본)",
    currentVersion: "ICH S6(R1) Addendum (2011 완료 및 통합)",
    keyNotes: [
      {
        note: "Note 1",
        section: "NOTES (p. 9)",
        topic: "질환 동물 모델(Animal models of disease)의 활용 및 대조군 데이터 확보 원칙",
        sourceUnitId: "ich_s6_r1.su.part1.notes.note1.001"
      },
      {
        note: "Note 2",
        section: "NOTES (p. 9)",
        topic: "단클론항체(mAbs)의 비설치류 1종 시험 적격성 및 불필요한 2번째 종 사용 지양",
        sourceUnitId: "ich_s6_r1.su.part1.notes.note2.001"
      },
      {
        note: "Note 3",
        section: "NOTES (p. 10)",
        topic: "반복투여 독성시험 기간: 만성 적응증에 대해 6개월(설치류/비설치류) 기간의 표준화",
        sourceUnitId: "ich_s6_r1.su.part1.notes.note3.001"
      },
      {
        note: "Note 4 & 5",
        section: "NOTES (p. 10-11)",
        topic: "면역원성(ADA) 발생 시 독성 평가 해석 및 생식발생독성(DART) 시험 설계 간소화",
        sourceUnitId: "ich_s6_r1.su.part1.notes.note4.001"
      },
      {
        note: "Note 6 & 7",
        section: "NOTES (p. 11)",
        topic: "발암성 평가 대체 시험법 및 면역계 특이적 안전성 약리/독성 종말점",
        sourceUnitId: "ich_s6_r1.su.part1.notes.note6.001"
      }
    ]
  },
  ema_fih: {
    docId: "ema_fih",
    title: "EMA Guideline on Strategies to Identify and Mitigate Risks for FIH and Early Clinical Trials",
    parentVersion: "EMEA/CHMP/SWP/28367/07 (2007 초판)",
    currentVersion: "Rev. 1 (2017 개정판)",
    keyNotes: [
      {
        note: "Integrated Protocols",
        section: "§8.2.2 (p. 15)",
        topic: "단일 증량(SAD), 반복 증량(MAD), 음식물/약물 상호작용(DDI)을 단일 프로토콜로 통합 운영하는 기준 신설",
        sourceUnitId: "ema_fih.su.8_2_2.001"
      },
      {
        note: "Sentinel Dosing & Precaution",
        section: "§8.2.6 (p. 17)",
        topic: "동일 코호트 내 1명 활성약 / 1명 위약 순차 투약 및 관찰 간격 의무화",
        sourceUnitId: "ema_fih.su.8_2_6.001"
      },
      {
        note: "Stopping Rules",
        section: "§8.2.9 (p. 18)",
        topic: "1명 심각한 이상반응 또는 동일 코호트 2명 중증 이상반응 발생 시 즉시 투약 중단 및 프로토콜 검토",
        sourceUnitId: "ema_fih.su.8_2_9.001"
      }
    ]
  },
  fda_ada: {
    docId: "fda_ada",
    title: "FDA Immunogenicity Testing of Therapeutic Protein Products (2019)",
    parentVersion: "2016 Draft Guidance",
    currentVersion: "2019 Final Guidance",
    keyNotes: [
      {
        note: "Tiered Approach",
        section: "§V.B (p. 16-19)",
        topic: "선별(Screening 5% FPR) -> 확증(Confirmatory 1% FPR) -> 역가(Titer) -> 중화항체(NAb) 4단계 다계층 시험법 표준화",
        sourceUnitId: "fda_ada.su.5_b.001"
      },
      {
        note: "Drug Tolerance",
        section: "§VI.B (p. 21-22)",
        topic: "체내 잔류 약물 간섭(Drug Interference) 극복을 위한 산 해리(Acid Dissociation) 및 적격성 평가 요건 강화",
        sourceUnitId: "fda_ada.su.6_b.001"
      }
    ]
  },
  ich_m3_r2: {
    docId: "ich_m3_r2",
    title: "ICH M3(R2) Guidance on Nonclinical Safety Studies for Conduct of Clinical Trials",
    parentVersion: "ICH M3(R1) (2000 개정판)",
    currentVersion: "ICH M3(R2) Step 4 (2009 전면 개정판)",
    keyNotes: [
      {
        note: "Exploratory Clinical Trials (Approaches 1-5)",
        section: "§7 (p. 8-16)",
        topic: "마이크로도즈(≤100 µg / 1/100th NOAEL) 및 14일 탐색적 조기 임상 진입을 위한 비임상 시험 패키지 표준화",
        sourceUnitId: "ich_m3_r2.su.7_1.001"
      },
      {
        note: "High Dose Selection (50-fold Margin)",
        section: "§1.5 & Note 1 (p. 2-4, 23)",
        topic: "일반 독성시험 고용량 선정 시 50배 노출도(AUC) 상한선 및 1000 mg/kg 한계용량 기준 명문화",
        sourceUnitId: "ich_m3_r2.su.1_5.001"
      },
      {
        note: "WOCBP & Reproduction Toxicity",
        section: "§11.3 & Note 4 (p. 18-19, 24)",
        topic: "예비 배태자 발생독성(Preliminary DART 6 dams/group) 기반 최대 150명 가임기 여성 3개월 임상 진입 허용",
        sourceUnitId: "ich_m3_r2.su.11_3.001"
      }
    ]
  }
};

function isAmendmentQuery(question) {
  if (!question || typeof question !== "string") return false;
  const qLower = question.toLowerCase();
  for (const marker of AMENDMENT_MARKERS) {
    if (qLower.includes(marker)) return true;
  }
  return false;
}

function identifyAmendmentDoc(question) {
  const qLower = question.toLowerCase();
  if (qLower.includes("s6") || qLower.includes("ich_s6") || qLower.includes("어덴덤") || qLower.includes("addendum")) {
    return "ich_s6_r1";
  }
  if (qLower.includes("fih") || qLower.includes("ema") || qLower.includes("통합 프로토콜") || qLower.includes("sentinel")) {
    return "ema_fih";
  }
  if (qLower.includes("ada") || qLower.includes("fda") || qLower.includes("면역원성")) {
    return "fda_ada";
  }
  if (qLower.includes("m3") || qLower.includes("ich_m3") || qLower.includes("m3(r2)") || qLower.includes("탐색적")) {
    return "ich_m3_r2";
  }
  if (qLower.includes("m10") || qLower.includes("ich_m10")) {
    return "ich_m10";
  }
  return "ich_s6_r1";
}

function answerAmendment(question, records, index) {
  const docId = identifyAmendmentDoc(question);
  const revInfo = GUIDELINE_REVISIONS[docId];
  if (!revInfo) {
    return null;
  }

  // Retrieve relevant records
  const relevantRecords = records.filter((r) => {
    if (r.document_id !== docId) return false;
    const sId = r.section_id || "";
    return sId.includes("notes") || sId.includes("addendum") || sId.includes("8_2") || sId.includes("5_b");
  }).slice(0, 6);

  return {
    isAmendment: true,
    question,
    docId,
    revInfo,
    relevantRecords
  };
}

function formatRecordCitation(citation) {
  if (!citation) return "";
  const page = citation.printed_page_label
    ? `p.${citation.printed_page_label}`
    : `pdf page ${citation.pdf_page_index_zero_based}`;
  return `${citation.guideline_code || citation.document_id} §${citation.section_number || "?"}, ${page} [${citation.source_unit_id}]`;
}

function formatAmendmentAnswer(amendMatch) {
  const { revInfo, question, relevantRecords } = amendMatch;
  const lines = [];

  lines.push("📜 [가이던스 개정 이력 및 유효 규제 상태]");
  lines.push(`문서: ${revInfo.title}`);
  lines.push(`질의: "${question}"\n`);

  lines.push(`• 원본 가이던스 (Parent/Original): ${revInfo.parentVersion}`);
  lines.push(`• 현재 유효 가이던스 (Effective Status): ${revInfo.currentVersion}\n`);

  lines.push("📋 주요 개정 요건 및 핵심 변경 이력 (Key Amendments & Rationale):");
  for (const item of revInfo.keyNotes) {
    lines.push(`  • [${item.note}] (${item.section}): ${item.topic}`);
  }

  if (relevantRecords && relevantRecords.length > 0) {
    lines.push("\n📎 연계 정형 조항 근거 (Structured Source Records):");
    for (const r of relevantRecords.slice(0, 3)) {
      const cite = formatRecordCitation(r.citations ? r.citations[0] : null);
      const text = r.normalized_ko || r.action || r.source_text || "";
      const preview = text.length > 160 ? text.slice(0, 157) + "..." : text;
      lines.push(`  - [${cite}]: ${preview}`);
    }
  }

  return lines.join("\n");
}

module.exports = {
  isAmendmentQuery,
  identifyAmendmentDoc,
  answerAmendment,
  formatAmendmentAnswer
};
