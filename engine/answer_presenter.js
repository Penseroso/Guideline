const KO_COMPARATOR = {
  within: "이내",
  not_exceed: "초과하지 않음",
  at_least: "이상",
  equals: "정확히"
};

const EN_COMPARATOR = {
  within: "within",
  not_exceed: "not more than",
  at_least: "at least",
  equals: "exactly"
};

function criterionValue(record) {
  if (record.value_fraction) return `${record.value_fraction.numerator}/${record.value_fraction.denominator}`;
  return record.value;
}

function presentCriterion(record, language) {
  if (language === "ko" && record.normalized_ko && record.normalization_status === "reviewed") {
    return record.normalized_ko;
  }
  const value = criterionValue(record);
  if (record.value_status !== "known" || value === null || value === undefined) {
    return language === "ko"
      ? `${record.parameter}의 수치 기준은 원문에서 확정되지 않았습니다.`
      : `The numeric value for ${record.parameter} is not confirmed in the source.`;
  }
  const comparator = (language === "ko" ? KO_COMPARATOR : EN_COMPARATOR)[record.comparator] || record.comparator;
  const unit = record.unit ? ` ${record.unit}` : "";
  const reference = record.denominator_or_reference
    ? language === "ko" ? ` (${record.denominator_or_reference} 기준)` : ` (${record.denominator_or_reference})`
    : "";
  if (language === "ko") return `${record.parameter} 기준은 ${value}${unit} ${comparator}입니다${reference}.`;
  return `${record.parameter}: ${comparator} ${value}${unit}${reference}.`;
}

function presentRecord(record, language = "ko") {
  if (!record) return "";
  if (record.type === "quantitative_criterion") return presentCriterion(record, language);
  if (language === "ko" && record.normalized_ko && record.normalization_status === "reviewed") {
    return record.normalized_ko;
  }
  if (record.type === "knowledge_record") {
    const semanticText = [record.subject, record.action, record.object].filter(Boolean).join(" ").trim();
    return semanticText || record.source_text || "";
  }
  return record.source_text || "";
}

function presentClaims(claims, language = "ko") {
  return (claims || []).map((claim) => ({
    text: presentRecord(claim.record, language),
    record_id: claim.record ? claim.record.id : null,
    source_unit_id: claim.source_unit_id || null,
    document_id: claim.record ? claim.record.document_id : null
  })).filter((unit) => unit.text && unit.source_unit_id);
}

module.exports = { presentRecord, presentClaims };
