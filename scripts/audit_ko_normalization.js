const { loadBundles, buildIndex, loadKoPresentation, sourceTextFor } = require("../engine/data_store");
const { sourceHash, validateKoPresentation } = require("../validation/validate_ko_presentation");

function numericTokens(text) {
  return (String(text || "").match(/(?:[<>]=?|\u00b1)?\s*\d+(?:\.\d+)?(?:\/\d+)?/g) || [])
    .map((token) => token.replace(/\s+/g, ""));
}

function missingNumericTokens(record) {
  const atomic = [record.subject, record.action, record.object, record.original_modal_text].filter(Boolean).join(" ");
  const normalized = String(record.normalized_ko || "").replace(/\s+/g, "");
  return numericTokens(atomic).filter((token) => !normalized.includes(token));
}

function barePredicateRisk(text) {
  const value = String(text || "").trim();
  if ([...value].length > 12) return false;
  if (/(?:\uc740|\ub294|\uc774|\uac00|\uc5d0\ub294|\uc5d0\uc11c\ub294|\uc73c\ub85c\ub294|\ub85c\ub294)\s/.test(value)) return false;
  return /(?:\ud55c\ub2e4|\ub41c\ub2e4|\uc774\ub2e4|\uc788\ub2e4|\uc5c6\ub2e4|\ud544\uc694\ud558\ub2e4|\uad8c\uc7a5\ud55c\ub2e4|\uace0\ub824\ud55c\ub2e4|\ud574\uc57c \ud55c\ub2e4|\uc218 \uc788\ub2e4|\ud3ec\ud568\ud55c\ub2e4|\uc801\uc6a9\ud55c\ub2e4)[.]?$/.test(value);
}

function auditKnowledgeNormalization() {
  const bundles = loadBundles();
  const index = buildIndex(bundles);
  const attestations = loadKoPresentation();
  const validator = validateKoPresentation();
  const documents = [];
  const issues = [];
  for (const { bundle } of bundles) {
    const documentId = bundle.documents[0].document_id;
    const records = bundle.knowledge_records || [];
    const summary = { document_id: documentId, total: records.length, reviewed: 0, needs_review: 0, short_informational: 0, issue_count: 0 };
    for (const record of records) {
      const entry = attestations.get(record.knowledge_record_id);
      const sourceText = sourceTextFor(index, record.source_unit_ids);
      const fresh = entry && entry.record_type === "knowledge_record" && entry.normalization_status === "reviewed" &&
        entry.source_text_sha256 === sourceHash(sourceText) && entry.normalized_ko_sha256 === sourceHash(record.normalized_ko);
      if (fresh) summary.reviewed += 1;
      else {
        summary.needs_review += 1;
        issues.push({ record_id: record.knowledge_record_id, kind: "untrusted_attestation" });
      }
      if ([...String(record.normalized_ko || "")].length <= 12) summary.short_informational += 1;
      if (barePredicateRisk(record.normalized_ko)) issues.push({ record_id: record.knowledge_record_id, kind: "bare_predicate" });
      const missing = missingNumericTokens(record);
      if (missing.length) issues.push({ record_id: record.knowledge_record_id, kind: "missing_numeric_tokens", tokens: missing });
      if (!/[\uac00-\ud7af]/.test(record.normalized_ko || "")) issues.push({ record_id: record.knowledge_record_id, kind: "missing_hangul" });
      if (/[\ufffd\u0900-\u097f\u4e00-\u9fff]/.test(record.normalized_ko || "")) {
        issues.push({ record_id: record.knowledge_record_id, kind: "unexpected_script" });
      }
    }
    summary.issue_count = issues.filter((issue) => issue.record_id && issue.record_id.startsWith(`${documentId}.`)).length;
    documents.push(summary);
  }
  if (!validator.ok) issues.push(...validator.errors.map((message) => ({ kind: "overlay_validation", message })));
  return { ok: issues.length === 0, documents, issues };
}

function main() {
  const result = auditKnowledgeNormalization();
  console.log(JSON.stringify(result, null, 2));
  if (!result.ok) process.exit(1);
}

if (require.main === module) main();

module.exports = { auditKnowledgeNormalization, barePredicateRisk, missingNumericTokens, numericTokens };
