(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.GuidelineRender = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  function escapeHtml(str) {
    if (str === null || str === undefined) return "";
    return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  function pdfUrl(citation) {
    if (!citation || !citation.document_id) return null;
    const page = typeof citation.pdf_page_index_zero_based === "number" ? citation.pdf_page_index_zero_based + 1 : null;
    return `/pdf/${encodeURIComponent(citation.document_id)}${page ? `#page=${page}` : ""}`;
  }

  function pageLabel(citation) {
    if (citation.printed_page_label) return `p.${citation.printed_page_label}`;
    if (typeof citation.pdf_page_index_zero_based === "number") return `PDF p.${citation.pdf_page_index_zero_based + 1}`;
    return "";
  }

  function compactCitation(citation) {
    if (!citation) return "";
    const section = citation.section_number ? ` §${citation.section_number}` : "";
    const page = pageLabel(citation);
    return `${citation.guideline_code || citation.document_id || ""}${section}${page ? `, ${page}` : ""}`;
  }

  function renderCitationLine(citation, i18n) {
    if (!citation) return "";
    const sectionTitle = citation.section_title ? ` · ${escapeHtml(citation.section_title)}` : "";
    const url = pdfUrl(citation);
    return `<div class="citation-line">
      <span><strong>${escapeHtml(compactCitation(citation))}</strong>${sectionTitle}</span>
      <span class="citation-actions"><span class="citation-id">${escapeHtml(citation.source_unit_id)}</span>
      ${url ? `<a class="citation-pdf-link" href="${url}" target="_blank" rel="noopener">${escapeHtml(i18n.openPdf)}</a>` : ""}</span>
    </div>`;
  }

  const MODALITY_CLASS = { must: "modality-must", should: "modality-should", may: "modality-may", other: "modality-other", none: "modality-none" };
  function renderModalityLabel(record, i18n) {
    if (!record || record.type !== "knowledge_record") return "";
    const modal = (record.modality || "none").toLowerCase();
    const labelMap = i18n ? { must: i18n.modalityMust, should: i18n.modalityShould, may: i18n.modalityMay, other: i18n.modalityOther, none: i18n.modalityNone } : {};
    const label = labelMap[modal] || modal.toUpperCase();
    const original = record.original_modal_text;
    const suffix = original && original.toLowerCase() !== modal ? ` <span class="modality-original">${escapeHtml(original)}</span>` : "";
    return `<span class="modality-label ${MODALITY_CLASS[modal] || MODALITY_CLASS.other}">${escapeHtml(label)}</span>${suffix}`;
  }

  function valueStatusText(record, i18n) {
    if (!record || record.type !== "quantitative_criterion" || !record.value_status || record.value_status === "known") return "";
    return ({ unknown: i18n.valueUnknown, not_applicable: i18n.valueNotApplicable, needs_review: i18n.valueNeedsReview })[record.value_status] || record.value_status;
  }

  function renderValueStatusNote(record, i18n) {
    const value = valueStatusText(record, i18n || {});
    return value ? `<div class="value-status-note">${escapeHtml(value)}</div>` : "";
  }

  function comparatorLabel(value, i18n) {
    return ({ within: i18n.comparatorWithin, not_exceed: i18n.comparatorNotExceed, at_least: i18n.comparatorAtLeast, equals: i18n.comparatorEquals })[value] || value;
  }

  function renderCriterionValue(record, i18n) {
    const value = record.value_fraction ? `${record.value_fraction.numerator}/${record.value_fraction.denominator}` : record.value;
    const unit = record.unit ? ` ${escapeHtml(record.unit)}` : "";
    const qualifier = record.is_illustrative_example ? `<div class="criterion-qualifier">${escapeHtml(i18n.illustrativeValue)}</div>`
      : record.is_default_with_exception ? `<div class="criterion-qualifier">${escapeHtml(i18n.defaultWithException)}</div>` : "";
    return `<div class="criterion-value"><span class="criterion-parameter">${escapeHtml(record.parameter)}</span>
      <span class="criterion-bound">${escapeHtml(comparatorLabel(record.comparator, i18n))} ${escapeHtml(value)}${unit}</span></div>
      ${record.denominator_or_reference ? `<div class="criterion-scope">${escapeHtml(record.denominator_or_reference)}</div>` : ""}${qualifier}`;
  }

  function conditionTypeLabel(type, i18n) {
    return ({ applicability: i18n.conditionApplicability, scope: i18n.conditionScope, precondition: i18n.conditionPrecondition, exception: i18n.conditionException })[type] || type;
  }

  function conditionText(condition, i18n) {
    if (i18n.locale === "ko" && condition.normalized_ko && condition.normalization_status === "reviewed") return condition.normalized_ko;
    return condition.condition_text;
  }

  function renderApplicableConditions(conditions, i18n) {
    if (!conditions || conditions.length === 0) return "";
    const items = conditions.map((condition) => `<li><span class="condition-type">${escapeHtml(conditionTypeLabel(condition.condition_type, i18n))}</span>
      <span>${escapeHtml(conditionText(condition, i18n))}</span></li>`).join("");
    return `<section class="conditions-block" aria-label="${escapeHtml(i18n.applicableConditions)}"><h3 class="conditions-header">${escapeHtml(i18n.applicableConditions)}</h3>
      <ul class="conditions-list">${items}</ul></section>`;
  }

  function renderCrossReferences(xrefs, i18n) {
    if (!xrefs || xrefs.length === 0) return "";
    const seen = new Set();
    const items = [];
    for (const x of xrefs) {
      const key = x.target_id || x.raw_reference_text;
      if (!key || seen.has(key)) continue;
      seen.add(key);
      if (x.target_citation && x.target_source_text) items.push(`<li>${escapeHtml(x.target_citation)}: “${escapeHtml(x.target_source_text)}”</li>`);
      else if (x.raw_reference_text) items.push(`<li>“${escapeHtml(x.raw_reference_text)}”</li>`);
    }
    return items.length ? `<div class="xref-block"><h4 class="xref-header">${escapeHtml(i18n.crossReferences)}</h4><ul class="xref-list">${items.join("")}</ul></div>` : "";
  }

  function renderClaimCard(claim, i18n) {
    if (!claim || !claim.citation || !claim.citation.source_unit_id) return `<div class="claim claim-error" role="alert">${escapeHtml(i18n.claimMissingCitation)}</div>`;
    const record = claim.record || {};
    const structured = record.type === "quantitative_criterion" ? renderCriterionValue(record, i18n) : "";
    const conditionLabel = record.type === "condition" ? `<span class="condition-type-label">${escapeHtml(conditionTypeLabel(record.condition_type, i18n))}</span>` : "";
    return `<article class="claim" id="evidence-${escapeHtml(claim.source_unit_id)}">
      <header class="claim-header">${renderModalityLabel(record, i18n)}${conditionLabel}</header>
      ${renderValueStatusNote(record, i18n)}<blockquote class="source-excerpt">${escapeHtml(record.source_text || "")}</blockquote>${structured}
      ${renderCitationLine(claim.citation, i18n)}${renderCrossReferences(record.cross_references, i18n)}
    </article>`;
  }

  function claimForUnit(unit, claims) {
    return (claims || []).find((claim) => {
      const sourceUnitId = claim.source_unit_id || claim.citation && claim.citation.source_unit_id;
      return (unit.record_id && claim.record && claim.record.id === unit.record_id) || (unit.source_unit_id && sourceUnitId === unit.source_unit_id);
    });
  }

  function answerUnits(envelope, i18n) {
    // Generated answers and source excerpts must preserve the server-provided
    // units. Structured answers can be re-presented locally on language change.
    if (envelope.route !== "structured" && Array.isArray(envelope.answer_units) && envelope.answer_units.length) return envelope.answer_units;
    return (envelope.claims || []).map((claim) => ({
      text: claim.record && i18n && i18n.locale === "ko" && claim.record.normalized_ko && claim.record.normalization_status === "reviewed"
        ? claim.record.normalized_ko
        : claim.record && claim.record.source_text || "",
      record_id: claim.record ? claim.record.id : null,
      source_unit_id: claim.source_unit_id || claim.citation && claim.citation.source_unit_id,
      document_id: claim.record ? claim.record.document_id : null
    }));
  }

  function renderAnswerUnit(unit, claims, i18n) {
    const claim = claimForUnit(unit, claims);
    if (!claim || !claim.citation) return `<div class="answer-unit claim-error" role="alert">${escapeHtml(i18n.claimMissingCitation)}</div>`;
    const record = claim.record || {};
    const warning = i18n.locale === "ko" && record.normalization_status === "needs_review" && record.type !== "knowledge_record"
      ? `<div class="normalization-warning">${escapeHtml(i18n.normalizationNeedsReview)}</div>` : "";
    return `<article class="answer-unit"><div class="answer-unit-meta">${renderModalityLabel(record, i18n)}${renderValueStatusNote(record, i18n)}</div>
      <p class="answer-unit-text">${escapeHtml(unit.text)}</p>${warning}
      <a class="inline-citation" href="#evidence-${escapeHtml(claim.source_unit_id)}">${escapeHtml(compactCitation(claim.citation))}
        <span class="citation-id">${escapeHtml(claim.source_unit_id)}</span></a>
      ${renderApplicableConditions(record.applicable_conditions, i18n)}
    </article>`;
  }

  function renderVerdictBar(envelope, i18n) {
    if (envelope.route === "structured") return `<div class="verdict verdict-structured">${escapeHtml(i18n.structuredRouteLabel)} · ${escapeHtml(i18n.structuredRouteSub)}</div>`;
    if (envelope.route === "source_excerpts") return `<div class="verdict verdict-excerpts">${escapeHtml(i18n.sourceExcerptsRouteLabel)} · ${escapeHtml(i18n.sourceExcerptsRouteSub)}</div>`;
    if (envelope.route === "grounded_generation") return `<div class="verdict verdict-generated">${escapeHtml(i18n.generatedRouteLabel)} · ${escapeHtml(i18n.generatedRouteSub)}</div>`;
    return "";
  }

  const REFUSAL_SUBTEXT = { no_match: (t) => t.refusalNoMatch, scope_excluded: (t) => t.refusalScopeExcluded,
    no_candidates: (t) => t.refusalNoMatch, model_declined: (t) => t.refusalNoMatch, verification_failed: (t) => t.refusalVerificationFailed };

  function renderRefusalCard(envelope, i18n) {
    const kind = (envelope.refusal && envelope.refusal.kind) || "no_match";
    const reason = envelope.refusal && envelope.refusal.reason ? `<details class="refusal-detail"><summary>${escapeHtml(i18n.technicalDetail)}</summary><div>${escapeHtml(envelope.refusal.reason)}</div></details>` : "";
    return `<section class="refusal"><h2 class="refusal-title">${escapeHtml(i18n.refusalTitle)}</h2><p class="refusal-body">${escapeHtml(i18n.refusalBody)}</p>
      <p class="refusal-kind">${escapeHtml((REFUSAL_SUBTEXT[kind] || REFUSAL_SUBTEXT.no_match)(i18n))}</p>${reason}</section>`;
  }

  function renderComparison(envelope, i18n) {
    const groups = new Map();
    for (const unit of answerUnits(envelope, i18n)) {
      const claim = claimForUnit(unit, envelope.claims);
      const id = unit.document_id || "unknown";
      const title = claim && claim.record && claim.record.document_title ? claim.record.document_title : id;
      if (!groups.has(id)) groups.set(id, { title, units: [] });
      groups.get(id).units.push(unit);
    }
    return `<p class="comparison-note">${escapeHtml(i18n.comparisonNote)}</p><div class="comparison-grid">${[...groups.values()].map((group) => `
      <section class="comparison-column"><h2 class="comparison-column-header">${escapeHtml(group.title)}</h2>
      ${group.units.map((unit) => renderAnswerUnit(unit, envelope.claims, i18n)).join("")}</section>`).join("")}</div>`;
  }

  function renderAmendment(envelope, i18n) {
    return `<div class="amendment-versions"><span class="amendment-version amendment-parent">${escapeHtml(i18n.parentVersion)}</span><strong class="amendment-version amendment-current">${escapeHtml(i18n.currentVersion)}</strong></div>
      ${answerUnits(envelope, i18n).map((unit) => renderAnswerUnit(unit, envelope.claims, i18n)).join("")}`;
  }

  function uniqueClaims(claims) {
    const seen = new Set();
    return (claims || []).filter((claim) => {
      const id = claim.source_unit_id || claim.citation && claim.citation.source_unit_id;
      if (!id || seen.has(id)) return false;
      seen.add(id);
      return true;
    });
  }

  function renderEvidencePanel(envelope, i18n) {
    const claims = uniqueClaims(envelope.claims);
    return `<details class="evidence-panel" id="evidence-panel" open><summary><span>${escapeHtml(i18n.evidenceTitle)}</span>
      <span class="evidence-count">${claims.length}</span></summary><div class="evidence-list">${claims.map((claim) => renderClaimCard(claim, i18n)).join("")}</div></details>`;
  }

  function renderReviewStatusFooter(envelope, i18n) {
    return envelope.answered ? `<div class="transparency-footer">${escapeHtml(i18n.reviewStatusMeaning)}</div>` : "";
  }

  function renderEnvelope(envelope, i18n, question) {
    const questionBlock = question ? `<header class="question-context"><span>${escapeHtml(i18n.questionLabel)}</span><h1>${escapeHtml(question)}</h1></header>` : "";
    if (!envelope.answered) return `<article class="answer-page">${questionBlock}${renderRefusalCard(envelope, i18n)}</article>`;
    const body = envelope.mode === "comparison" ? renderComparison(envelope, i18n)
      : envelope.mode === "amendment" ? renderAmendment(envelope, i18n)
        : answerUnits(envelope, i18n).map((unit) => renderAnswerUnit(unit, envelope.claims, i18n)).join("");
    return `<article class="answer-page mode-${escapeHtml(envelope.mode)}">${questionBlock}<div class="answer-layout">
      <section class="answer-primary" aria-labelledby="answer-heading"><div class="section-label" id="answer-heading">${escapeHtml(i18n.answerTitle)}</div>
      ${body}${renderVerdictBar(envelope, i18n)}${renderReviewStatusFooter(envelope, i18n)}</section>${renderEvidencePanel(envelope, i18n)}</div></article>`;
  }

  return { escapeHtml, pdfUrl, renderCitationLine, renderModalityLabel, renderValueStatusNote, renderClaimCard, renderVerdictBar,
    renderRefusalCard, renderComparison, renderAmendment, renderEnvelope };
});
