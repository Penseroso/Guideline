/**
 * web/i18n.js
 * M5 Phase 4: chrome-language strings only (labels/headers/explainers).
 * NOT for content language — source_text is always shown verbatim in its
 * original language regardless of this toggle; normalized_ko is shown
 * underneath only when the underlying record has it (KnowledgeRecord
 * only, ~54% coverage — QuantitativeCriterion/Condition have no
 * normalized_ko field in the schema at all). Two independent axes, never
 * conflated — see web/render.js and the M5 plan §4.5.
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.GuidelineI18n = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  const ko = {
    title: "규제 가이드라인 아카이브",
    askPlaceholder: "질문을 입력하세요 (한국어/영어 모두 가능)",
    askButton: "질의",
    askButtonLoadingSearch: "검색 중…",
    askButtonLoadingGenerate: "생성 중…",
    askButtonLoadingVerify: "검증 중…",
    archiveScopeTitle: "아카이브 범위",
    archiveScopeNote: "이 6개 문서 범위 내에서만 답변합니다.",
    optionBToggleOn: "Option B 켜짐",
    optionBToggleOff: "Option B 꺼짐 (구조화 조회만 사용)",
    healthOk: "정상",
    healthError: "연결 오류",
    openPdf: "원문 PDF 열기",
    applicableConditions: "적용 조건",
    crossReferences: "관련/개정 조항",
    claimMissingCitation: "인용 근거를 확인할 수 없어 이 항목은 표시하지 않습니다 (내부 오류)",
    normalizedKoLabel: "한국어 정규화 (참고, 원문 아님)",
    pathALabel: "근거 직접 인용 (Option A)",
    pathASub: "이 답변에는 LLM이 생성한 문장이 없습니다.",
    pathBLabel: "생성 후 검증 (Option B)",
    pathBSub: "문장은 생성된 것이며, 인용된 원문과의 함의 검사를 통과했습니다. 원문을 직접 확인하십시오.",
    refusalTitle: "현재 아카이브에서 근거를 찾지 못했습니다",
    refusalBody: "이것은 \"해당 요건이 없다\"는 뜻이 아니라, \"이 아카이브에 수록되어 있지 않다\"는 뜻입니다.",
    refusalNoMatch: "질의와 일치하는 구조화된 근거가 없습니다.",
    refusalScopeExcluded: "질의된 범위(물질/적응증 등)가 이 아카이브 문서들의 명시적 적용 범위를 벗어납니다.",
    refusalNoProvider: "Option B(생성형 검색)가 설정되어 있지 않습니다 — 구조화 조회만 사용 중입니다.",
    refusalVerificationFailed: "생성된 답변이 인용 검증을 통과하지 못해 표시하지 않습니다.",
    comparisonNote: "두 문서의 요건을 나란히 제시합니다 — 어느 쪽이 적용되는지는 판단하지 않습니다.",
    parentVersion: "원본 (Parent)",
    currentVersion: "현행 (Effective)",
    reviewStatusMeaning: "이 답변의 근거 레코드는 추출·검증·검사 파이프라인을 통과했습니다. 사람이 직접 읽고 검토했다는 뜻은 아닙니다.",
    feedbackPrompt: "이 답변에 대한 의견",
    feedbackWrongCitation: "인용이 틀림",
    feedbackUnsupportedClaim: "근거 없는 주장",
    feedbackWronglyRefused: "부당하게 거절됨",
    feedbackShouldHaveRefused: "거절했어야 함",
    feedbackModalityWrong: "강도 표현 오류(must/should/may)",
    feedbackIncomplete: "불완전한 답변",
    feedbackCorrect: "정확함",
    feedbackSent: "피드백이 전송되었습니다.",
    feedbackNotePlaceholder: "추가 설명 (선택)"
  };

  const en = {
    title: "Regulatory Guideline Archive",
    askPlaceholder: "Ask a question (Korean or English)",
    askButton: "Ask",
    askButtonLoadingSearch: "Searching…",
    askButtonLoadingGenerate: "Generating…",
    askButtonLoadingVerify: "Verifying…",
    archiveScopeTitle: "Archive scope",
    archiveScopeNote: "Answers only within these 6 documents.",
    optionBToggleOn: "Option B on",
    optionBToggleOff: "Option B off (structured lookup only)",
    healthOk: "OK",
    healthError: "Connection error",
    openPdf: "Open source PDF",
    applicableConditions: "Applicable conditions",
    crossReferences: "Related / amending provisions",
    claimMissingCitation: "Citation could not be confirmed — this item is withheld (internal error)",
    normalizedKoLabel: "Korean normalized text (reference only, not the source)",
    pathALabel: "Quoted directly from archive (Option A)",
    pathASub: "No LLM-generated sentence appears in this answer.",
    pathBLabel: "Generated, then verified (Option B)",
    pathBSub: "This text was generated and passed an entailment check against the cited source — verify the source directly.",
    refusalTitle: "No grounding found in the current archive",
    refusalBody: "This does not mean the requirement doesn't exist — it means it isn't in this archive.",
    refusalNoMatch: "No structured record matched this question.",
    refusalScopeExcluded: "The requested scope (molecule/indication/etc.) falls outside what these archive documents explicitly cover.",
    refusalNoProvider: "Option B (generative search) is not configured — structured lookup only.",
    refusalVerificationFailed: "A generated answer failed citation verification and is withheld.",
    comparisonNote: "Presented side by side. This tool does not judge which one applies.",
    parentVersion: "Parent (original)",
    currentVersion: "Current (effective)",
    reviewStatusMeaning: "The records behind this answer passed the extraction + verification + validator pipeline. This does not mean a human read them.",
    feedbackPrompt: "Feedback on this answer",
    feedbackWrongCitation: "Wrong citation",
    feedbackUnsupportedClaim: "Unsupported claim",
    feedbackWronglyRefused: "Wrongly refused",
    feedbackShouldHaveRefused: "Should have refused",
    feedbackModalityWrong: "Modality wrong (must/should/may)",
    feedbackIncomplete: "Incomplete",
    feedbackCorrect: "Correct",
    feedbackSent: "Feedback sent.",
    feedbackNotePlaceholder: "Additional note (optional)"
  };

  return { ko, en };
});
