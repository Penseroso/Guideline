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

  function renderEvidenceSourceHeader(citation) {
    if (!citation) return "";
    const guideline = citation.guideline_code || citation.document_id || "";
    const sectionNumber = citation.section_number ? `§${citation.section_number}` : "";
    const path = Array.isArray(citation.section_path) ? citation.section_path : [];
    const sectionTitle = citation.section_title || path[path.length - 1] || "";
    return `<header class="evidence-source-header">
      <div class="evidence-source-location"><strong class="evidence-guideline">${escapeHtml(guideline)}</strong>${sectionNumber ? `<span class="evidence-section-number">${escapeHtml(sectionNumber)}</span>` : ""}</div>
      ${sectionTitle ? `<h3>${escapeHtml(sectionTitle)}</h3>` : ""}
    </header>`;
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
    return ({ within: i18n.comparatorWithin, not_exceed: i18n.comparatorNotExceed, at_least: i18n.comparatorAtLeast, equals: i18n.comparatorEquals,
      between: i18n.comparatorBetween, below: i18n.comparatorBelow, above: i18n.comparatorAbove, approximately: i18n.comparatorApproximately })[value] || value;
  }

  function renderCriterionValue(record, i18n) {
    const value = record.value_fraction ? `${record.value_fraction.numerator}/${record.value_fraction.denominator}`
      : record.value_range ? `${record.value_range.lower}-${record.value_range.upper}`
        : record.value_text !== null && record.value_text !== undefined ? record.value_text : record.value;
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

  function evidenceDomId(claim) {
    const source = claim && (claim.source_unit_id || claim.citation && claim.citation.source_unit_id) || "source";
    const record = claim && claim.record && claim.record.id || "record";
    return `evidence-${source}-${record}`;
  }

  function renderClaimCard(claim, i18n) {
    if (!claim || !claim.citation || !claim.citation.source_unit_id) return `<div class="claim claim-error" role="alert">${escapeHtml(i18n.claimMissingCitation)}</div>`;
    const record = claim.record || {};
    const structured = record.type === "quantitative_criterion" ? renderCriterionValue(record, i18n) : "";
    const conditionLabel = record.type === "condition" ? `<span class="condition-type-label">${escapeHtml(conditionTypeLabel(record.condition_type, i18n))}</span>` : "";
    return `<article class="claim" id="${escapeHtml(evidenceDomId(claim))}">
      ${renderEvidenceSourceHeader(claim.citation)}
      <header class="claim-header">${renderModalityLabel(record, i18n)}${conditionLabel}</header>
      ${renderValueStatusNote(record, i18n)}<blockquote class="source-excerpt">${escapeHtml(record.source_text || "")}</blockquote>${structured}
      ${renderCitationLine(claim.citation, i18n)}${renderCrossReferences(record.cross_references, i18n)}
    </article>`;
  }

  function claimForUnit(unit, claims) {
    const available = claims || [];
    if (unit && unit.record_id) {
      const exact = available.find((claim) => claim.record && claim.record.id === unit.record_id);
      if (exact) return exact;
    }
    if (!unit || !unit.source_unit_id) return undefined;
    return available.find((claim) => (claim.source_unit_id || claim.citation && claim.citation.source_unit_id) === unit.source_unit_id);
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
      document_id: claim.record ? claim.record.document_id : null,
      overview_group: claim.overview_group || null,
      comparison_dimension: claim.comparison_dimension || claim.record && claim.record.comparison_dimension || null
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
      <a class="inline-citation" href="#${escapeHtml(evidenceDomId(claim))}">${escapeHtml(compactCitation(claim.citation))}
        <span class="citation-id">${escapeHtml(claim.source_unit_id)}</span></a>
      ${renderApplicableConditions(record.applicable_conditions, i18n)}
    </article>`;
  }

  function renderGeneratedUnit(unit, claims, i18n) {
    const claim = claimForUnit(unit, claims);
    if (!claim || !claim.citation) return `<div class="generated-unit claim-error" role="alert">${escapeHtml(i18n.claimMissingCitation)}</div>`;
    // The citation used to be an inline <a> flowing right after the
    // paragraph text inside the same <p> — harmless when it happened to
    // fit on the text's last line, but when it didn't fit and wrapped to
    // its own line, inline-wrap positioning (plus the template's own
    // whitespace before the tag) left it a few pixels off the paragraph's
    // left edge instead of flush with it, reading as a stray indent. Now
    // a proper block sibling below the text, same pattern renderCitationLine
    // already uses for the structured route's citation line.
    return `<div class="generated-unit"><p>${escapeHtml(unit.text)}</p><a class="generated-citation" href="#${escapeHtml(evidenceDomId(claim))}">${escapeHtml(compactCitation(claim.citation))}</a></div>`;
  }

  function renderSourceExcerptUnit(unit, claims, i18n) {
    const claim = claimForUnit(unit, claims);
    if (!claim || !claim.citation) return `<div class="excerpt-unit claim-error" role="alert">${escapeHtml(i18n.claimMissingCitation)}</div>`;
    return `<article class="excerpt-unit" id="${escapeHtml(evidenceDomId(claim))}">${renderEvidenceSourceHeader(claim.citation)}<blockquote>${escapeHtml(unit.text)}</blockquote>
      ${renderCitationLine(claim.citation, i18n)}${renderApplicableConditions((claim.record || {}).applicable_conditions, i18n)}</article>`;
  }

  function renderOverviewSummaryUnit(unit, claim, i18n) {
    if (!claim || !claim.citation) return `<div class="overview-unit claim-error" role="alert">${escapeHtml(i18n.claimMissingCitation)}</div>`;
    const url = pdfUrl(claim.citation);
    return `<article class="overview-unit overview-summary-unit"><p>${escapeHtml(unit.text)}</p>
      ${url ? `<a class="inline-citation" href="${url}" target="_blank" rel="noopener">${escapeHtml(compactCitation(claim.citation))}</a>` : `<span class="inline-citation">${escapeHtml(compactCitation(claim.citation))}</span>`}
      ${renderApplicableConditions((claim.record || {}).applicable_conditions, i18n)}</article>`;
  }

  function renderOverviewCriterionUnit(unit, claim, i18n) {
    if (!claim || !claim.citation) return `<div class="overview-criterion claim-error" role="alert">${escapeHtml(i18n.claimMissingCitation)}</div>`;
    const record = claim.record || {};
    const url = pdfUrl(claim.citation);
    return `<article class="overview-criterion">${renderCriterionValue(record, i18n)}<p>${escapeHtml(unit.text)}</p>
      ${url ? `<a class="inline-citation" href="${url}" target="_blank" rel="noopener">${escapeHtml(compactCitation(claim.citation))}</a>` : `<span class="inline-citation">${escapeHtml(compactCitation(claim.citation))}</span>`}
      ${renderApplicableConditions(record.applicable_conditions, i18n)}</article>`;
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
    const documents = new Map();
    for (const unit of answerUnits(envelope, i18n)) {
      const claim = claimForUnit(unit, envelope.claims);
      const id = unit.document_id || claim && claim.record && claim.record.document_id || "unknown";
      const title = claim && claim.record && claim.record.document_title ? claim.record.document_title : id;
      if (!documents.has(id)) documents.set(id, { id, title, items: [] });
      documents.get(id).items.push({ unit, claim });
    }
    const docs = [...documents.values()];
    const rows = new Map();
    for (const doc of docs) {
      doc.items.forEach(({ unit, claim }, index) => {
        const explicit = unit.comparison_dimension || claim && (claim.comparison_dimension || claim.record && claim.record.comparison_dimension);
        const key = explicit ? `dimension:${explicit}` : `position:${index}`;
        if (!rows.has(key)) rows.set(key, { label: explicit || i18n.comparisonItem.replace("{count}", index + 1), cells: new Map() });
        if (!rows.get(key).cells.has(doc.id)) rows.get(key).cells.set(doc.id, []);
        rows.get(key).cells.get(doc.id).push(unit);
      });
    }
    const head = docs.map((doc) => `<th scope="col">${escapeHtml(doc.title)}</th>`).join("");
    const body = [...rows.values()].map((row) => `<tr><th scope="row">${escapeHtml(row.label)}</th>${docs.map((doc) => `<td>${(row.cells.get(doc.id) || []).map((unit) => renderAnswerUnit(unit, envelope.claims, i18n)).join("") || `<span class="comparison-empty">${escapeHtml(i18n.valueNotApplicable)}</span>`}</td>`).join("")}</tr>`).join("");
    return `<p class="comparison-note">${escapeHtml(i18n.comparisonNote)}</p><div class="comparison-table-wrap"><table class="comparison-table"><thead><tr><th scope="col">${escapeHtml(i18n.comparisonDimension)}</th>${head}</tr></thead><tbody>${body}</tbody></table></div>`;
  }

  function renderProcess(envelope, i18n) {
    const units = answerUnits(envelope, i18n);
    return `<p class="process-intro">${escapeHtml(i18n.processIntro)}</p><ol class="process-list">${units.map((unit) => `<li>${renderAnswerUnit(unit, envelope.claims, i18n)}</li>`).join("")}</ol>`;
  }

  function renderAmendment(envelope, i18n) {
    return `<div class="amendment-versions"><span class="amendment-version amendment-parent">${escapeHtml(i18n.parentVersion)}</span><strong class="amendment-version amendment-current">${escapeHtml(i18n.currentVersion)}</strong></div>
      ${answerUnits(envelope, i18n).map((unit) => renderAnswerUnit(unit, envelope.claims, i18n)).join("")}`;
  }

  function uniqueClaims(claims) {
    const seen = new Set();
    return (claims || []).filter((claim) => {
      const id = claim.record && claim.record.id || claim.source_unit_id || claim.citation && claim.citation.source_unit_id;
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

  function renderGeneratedEvidence(envelope, i18n) {
    const claims = uniqueClaims(envelope.claims);
    return `<section class="generated-evidence" aria-labelledby="generated-evidence-heading"><div class="section-label" id="generated-evidence-heading">${escapeHtml(i18n.generatedEvidenceTitle)}</div>
      <div class="generated-evidence-list">${claims.map((claim) => renderClaimCard(claim, i18n)).join("")}</div></section>`;
  }

  function renderReviewStatusFooter(envelope, i18n) {
    return envelope.answered ? `<div class="transparency-footer">${escapeHtml(i18n.reviewStatusMeaning)}</div>` : "";
  }

  function renderRouteIndicator(envelope, i18n) {
    const route = envelope.route || "unknown";
    const mode = envelope.mode || route;
    const routeLabels = { structured: i18n.routeStructuredUser, grounded_generation: i18n.routeGeneratedUser, source_excerpts: i18n.routeExcerptsUser, refusal: i18n.routeRefusalUser };
    const modeLabels = { structured: i18n.modeStructuredUser, criterion_composite: i18n.modeCriterionCompositeUser, list: i18n.modeListUser,
      document_overview: i18n.modeDocumentOverviewUser, section_overview: i18n.modeSectionOverviewUser,
      comparison: i18n.modeComparisonUser, within_document_comparison: i18n.modeWithinComparisonUser, process: i18n.modeProcessUser,
      amendment: i18n.modeAmendmentUser, generated: i18n.modeGeneratedUser, source_excerpts: i18n.modeSourceExcerptsUser, refusal: i18n.modeRefusalUser };
    return `<span class="route-indicator route-${escapeHtml(route)}"><strong>${escapeHtml(routeLabels[route] || i18n.routeUnknownUser)}</strong><span class="route-user-mode">${escapeHtml(modeLabels[mode] || mode)}</span>
      <details class="route-technical"><summary>${escapeHtml(i18n.routeTechnicalSummary)}</summary><div><span>${escapeHtml(i18n.routeIndicatorLabel)}</span> <code>${escapeHtml(route)}</code><br><span>${escapeHtml(i18n.modeIndicatorLabel)}</span> <code>${escapeHtml(mode)}</code></div></details></span>`;
  }

  function coverageStatus(envelope) {
    const coverage = envelope && envelope.coverage;
    if (typeof coverage === "string") return coverage;
    return envelope && envelope.coverage_status || coverage && coverage.status || (coverage && coverage.partial === true ? "partial" : null);
  }

  /**
   * Grouped by guideline so the same guideline_code doesn't repeat on
   * every pill (the common single-document case previously rendered two
   * pills each starting with the full "EMA/CHMP/SWP/28367/07 Rev. 1..." —
   * visually much wider than the compact per-facet pills in
   * renderSemanticCoverage right below it). One heading per guideline,
   * short §-only pills under it; a guideline with no section info at all
   * (rare — a citation missing section_number/section_title) still shows
   * as its own single pill rather than an empty group.
   */
  function renderAnswerScope(envelope, i18n) {
    const seen = new Set();
    const entries = [];
    for (const claim of envelope.claims || []) {
      const citation = claim.citation;
      if (!citation) continue;
      const key = `${citation.document_id || citation.guideline_code}|${citation.section_number || ""}`;
      if (seen.has(key)) continue;
      seen.add(key);
      entries.push({
        guideline: citation.guideline_code || citation.document_id || "",
        section: `${citation.section_number ? `§${citation.section_number}` : ""}${citation.section_title ? ` ${citation.section_title}` : ""}`.trim()
      });
    }
    if (!entries.length) return "";

    const visible = entries.slice(0, 4);
    const more = entries.length > 4
      ? `<div class="scope-more">${escapeHtml(i18n.answerScopeMore.replace("{count}", entries.length - 4))}</div>`
      : "";

    const order = [];
    const groups = new Map();
    for (const entry of visible) {
      if (!groups.has(entry.guideline)) { groups.set(entry.guideline, []); order.push(entry.guideline); }
      if (entry.section) groups.get(entry.guideline).push(entry.section);
    }
    const groupsHtml = order.map((guideline) => {
      const sections = groups.get(guideline);
      if (sections.length === 0) {
        return `<div class="answer-scope-group"><ul><li>${escapeHtml(guideline)}</li></ul></div>`;
      }
      return `<div class="answer-scope-group"><span class="answer-scope-guideline">${escapeHtml(guideline)}</span><ul>${sections.map((section) => `<li>${escapeHtml(section)}</li>`).join("")}</ul></div>`;
    }).join("");

    const status = coverageStatus(envelope);
    const warning = ["partial", "representative", "section_representative", "retrieved_excerpts", "generated_from_retrieved_excerpts"].includes(status) ? `<div class="coverage-warning" role="status"><strong>${escapeHtml(i18n.coveragePartialTitle)}</strong><span>${escapeHtml(i18n.coveragePartialBody)}</span></div>`
      : status === "complete" ? `<p class="coverage-complete">${escapeHtml(i18n.coverageComplete)}</p>` : "";
    return `<section class="answer-scope" aria-label="${escapeHtml(i18n.answerScopeTitle)}"><div class="answer-scope-label">${escapeHtml(i18n.answerScopeTitle)}</div>${groupsHtml}${more}${warning}</section>`;
  }

  /**
   * Stage C (docs/derived_semantic_layer.md §10): the first served-answer
   * use of the derived semantic layer. `envelope.semantic_coverage` is only
   * ever present when engine/answer_envelope.js found a `reviewed`,
   * non-stale coverage_manifest for the grounded_generation synthesis this
   * envelope carries (engine/semantic_shadow.js's same Stage B math, now
   * gated to reviewed-only) — every other route/mode leaves it absent, and
   * this renders nothing for those, same as before Stage C existed.
   * Facet ids are shown by their own last segment (no curated Korean
   * facet labels exist yet — data/derived/presentation/ko/ only carries
   * whole-synopsis sentences, not per-facet short labels).
   */
  function facetShortLabel(facetId) {
    return String(facetId || "").split(".").pop().replace(/_/g, " ");
  }

  function statusLabel(i18n, status) {
    const key = `semanticCoverageStatus${status.charAt(0).toUpperCase()}${status.slice(1)}`;
    return i18n[key] || status;
  }

  // No curated guideline-label lookup exists in this pure render module —
  // reuse whatever the claims already carry (the same citations answer-scope
  // itself renders from) so a comparison axis reads "M3(R2): partial" rather
  // than the raw document_id.
  function guidelineLabelForDocument(envelope, documentId) {
    for (const claim of envelope.claims || []) {
      if (claim.citation && claim.citation.document_id === documentId) return claim.citation.guideline_code || documentId;
    }
    return documentId;
  }

  function renderSemanticCoverage(envelope, i18n) {
    const semanticCoverage = envelope && envelope.semantic_coverage;
    const manifests = semanticCoverage && Array.isArray(semanticCoverage.manifests) ? semanticCoverage.manifests : [];
    const comparisons = semanticCoverage && Array.isArray(semanticCoverage.comparison) ? semanticCoverage.comparison : [];
    if (manifests.length === 0 && comparisons.length === 0) return "";

    const manifestBlocks = manifests.map((manifest) => {
      const facets = (manifest.groups || []).flatMap((group) => group.facets || []);
      const missing = facets.filter((facet) => facet.status === "missing" || facet.status === "partial");
      const missingList = missing.length
        ? `<ul class="semantic-coverage-missing">${missing.map((facet) => `<li>${escapeHtml(facetShortLabel(facet.facet_id))}</li>`).join("")}</ul>`
        : "";
      return `<div class="semantic-coverage-manifest" data-status="${escapeHtml(manifest.status)}"><p>${escapeHtml(statusLabel(i18n, manifest.status))}</p>${missing.length ? `<span class="semantic-coverage-missing-label">${escapeHtml(i18n.semanticCoverageMissingLabel)}</span>${missingList}` : ""}</div>`;
    }).join("");

    const comparisonBlocks = comparisons.map((axis) => {
      const sides = axis.bindings.map((binding) => {
        const label = guidelineLabelForDocument(envelope, binding.document_id);
        return `<li><strong>${escapeHtml(label)}</strong> ${escapeHtml(statusLabel(i18n, binding.coverage.status))}</li>`;
      }).join("");
      return `<div class="semantic-coverage-comparison" data-both-sides-evidenced="${axis.both_sides_evidenced}"><span class="semantic-coverage-axis-label">${escapeHtml(i18n.semanticCoverageComparisonLabel)}</span><ul>${sides}</ul></div>`;
    }).join("");

    return `<section class="semantic-coverage" aria-label="${escapeHtml(i18n.semanticCoverageTitle)}"><div class="semantic-coverage-label">${escapeHtml(i18n.semanticCoverageTitle)}</div>${manifestBlocks}${comparisonBlocks}</section>`;
  }

  function renderGeneratedLayout(envelope, i18n) {
    const units = answerUnits(envelope, i18n);
    return `<div class="generated-layout"><section class="generated-answer-panel" aria-labelledby="answer-heading">
      <div class="generated-answer-heading"><span class="section-label" id="answer-heading">${escapeHtml(i18n.generatedAnswerTitle)}</span></div>
      <div class="generated-answer-body">${units.map((unit) => renderGeneratedUnit(unit, envelope.claims, i18n)).join("")}</div>
      ${renderVerdictBar(envelope, i18n)}${renderReviewStatusFooter(envelope, i18n)}</section>${renderGeneratedEvidence(envelope, i18n)}</div>`;
  }

  function renderSourceExcerptsLayout(envelope, i18n) {
    const seen = new Set();
    const units = answerUnits(envelope, i18n).filter((unit) => {
      const claim = claimForUnit(unit, envelope.claims);
      const sourceId = claim && (claim.source_unit_id || claim.citation && claim.citation.source_unit_id) || unit.source_unit_id;
      if (!sourceId || seen.has(sourceId)) return false;
      seen.add(sourceId);
      return true;
    });
    return `<div class="excerpts-layout"><section class="excerpt-intro"><span class="section-label">${escapeHtml(i18n.sourceExcerptsRouteLabel)}</span>
      <p>${escapeHtml(i18n.sourceExcerptIntro)}</p></section><div class="fallback-warning" role="status"><strong>${escapeHtml(i18n.sourceExcerptWarningTitle)}</strong><span>${escapeHtml(i18n.sourceExcerptWarningBody)}</span></div>
      <div class="excerpt-list">${units.map((unit) => renderSourceExcerptUnit(unit, envelope.claims, i18n)).join("")}</div>
      ${renderVerdictBar(envelope, i18n)}${renderReviewStatusFooter(envelope, i18n)}</div>`;
  }

  function synopsisText(text) {
    const clean = String(text || "").trim();
    if (!clean) return "";
    const sentence = clean.match(/^.*?(?:[.!?。]|$)/);
    const first = sentence ? sentence[0].trim() : clean;
    return first.length > 260 ? `${first.slice(0, 257).trim()}...` : first;
  }

  function renderSectionOverviewLayout(envelope, i18n) {
    const grouped = new Map();
    for (const unit of answerUnits(envelope, i18n)) {
      const claim = claimForUnit(unit, envelope.claims);
      const group = unit.overview_group || claim && claim.overview_group;
      if (!claim || !group) continue;
      if (!grouped.has(group.section_id)) grouped.set(group.section_id, { ...group, items: [] });
      grouped.get(group.section_id).items.push({ unit, claim });
    }
    const groups = [...grouped.values()].sort((a, b) => a.order - b.order);
    const firstClaim = envelope.claims && envelope.claims[0];
    const parentPath = firstClaim && firstClaim.record && firstClaim.record.section_path || [];
    const parentTitle = parentPath.length > 1 ? parentPath[parentPath.length - 2] : i18n.sectionOverviewTitle;
    const guideline = firstClaim && firstClaim.citation && (firstClaim.citation.guideline_code || firstClaim.citation.document_id) || "";

    const indexLinks = groups.map((group, index) => `<li><a href="#overview-section-${index}"><span>§${escapeHtml(group.section_number)}</span>${escapeHtml(group.title)}</a></li>`).join("");
    const sections = groups.map((group, index) => {
      const summaries = group.items.filter(({ claim }) => claim.record && claim.record.type !== "quantitative_criterion");
      const criteria = group.items.filter(({ claim }) => claim.record && claim.record.type === "quantitative_criterion");
      const synopsis = summaries[0] ? synopsisText(summaries[0].unit.text) : "";
      const primaryCriteria = criteria.slice(0, 3);
      const additionalCriteria = criteria.slice(3);
      const sourceDetails = summaries.length ? `<details class="overview-more overview-source-details"><summary>${escapeHtml(i18n.originalEvidence)} <span>${summaries.length}</span></summary>
        <div>${summaries.map(({ unit, claim }) => renderOverviewSummaryUnit({ ...unit, text: claim.record && claim.record.source_text || unit.text }, claim, i18n)).join("")}</div></details>` : "";
      const additionalCriteriaBlock = additionalCriteria.length ? `<details class="overview-more"><summary>${escapeHtml(i18n.additionalCriteria)} <span>${additionalCriteria.length}</span></summary>
        <div class="overview-criteria-list">${additionalCriteria.map(({ unit, claim }) => renderOverviewCriterionUnit(unit, claim, i18n)).join("")}</div></details>` : "";
      return `<section class="overview-section" aria-labelledby="overview-section-${index}"><header class="overview-section-header">
        <span class="overview-section-number">${escapeHtml(guideline)} · §${escapeHtml(group.section_number)}</span><div><h2 id="overview-section-${index}">${escapeHtml(group.title)}</h2>
        <p>${escapeHtml(i18n.sectionEvidenceCount.replace("{summaries}", summaries.length).replace("{criteria}", criteria.length))}</p></div></header>
        ${synopsis ? `<div class="overview-synopsis"><span>${escapeHtml(i18n.sectionSynopsisTitle)}</span><p>${escapeHtml(synopsis)}</p></div>` : ""}
        ${criteria.length ? `<div class="overview-criteria-heading">${escapeHtml(i18n.criteriaTitle)}</div><div class="overview-criteria-list">${primaryCriteria.map(({ unit, claim }) => renderOverviewCriterionUnit(unit, claim, i18n)).join("")}</div>${additionalCriteriaBlock}` : ""}
        ${sourceDetails}
      </section>`;
    }).join("");

    return `<div class="section-overview-layout"><header class="section-overview-intro"><span class="section-label">${escapeHtml(i18n.sectionOverviewTitle)}</span>
      <h2>${escapeHtml(guideline)} · ${escapeHtml(parentTitle)}</h2><p>${escapeHtml(i18n.sectionOverviewIntro.replace("{count}", groups.length))}</p></header>
      <nav class="overview-index" aria-label="${escapeHtml(i18n.sectionOverviewIndex)}"><span>${escapeHtml(i18n.sectionOverviewIndex)}</span><ol>${indexLinks}</ol></nav>
      <div class="overview-sections">${sections}</div>${renderVerdictBar(envelope, i18n)}${renderReviewStatusFooter(envelope, i18n)}</div>`;
  }

  /**
   * The "이 답변의 근거 범위" (answer-scope) + Stage C semantic-coverage
   * blocks used to sit stacked in the header, above the answer itself —
   * a tall block of metadata the reader had to scroll past before
   * reaching any actual content. Moved into a side rail instead, next to
   * the content rather than on top of it. Returns "" when there's
   * nothing to show (answerScope/semanticCoverage are both already
   * empty-safe), so a mode with no citations/coverage gets no empty
   * <aside>.
   */
  function renderAnswerRail(envelope, i18n) {
    const scope = renderAnswerScope(envelope, i18n);
    const coverage = renderSemanticCoverage(envelope, i18n);
    if (!scope && !coverage) return "";
    return `<aside class="answer-rail">${scope}${coverage}</aside>`;
  }

  function renderEnvelope(envelope, i18n, question) {
    // The sticky ask-form input above already shows the question text
    // persistently once results are in — repeating it as a visible <h1>
    // here just duplicated it. Kept as a visually-hidden heading (not
    // deleted outright) so the page still has a real top-level heading
    // and document title for screen readers/the a11y tree.
    const questionBlock = question ? `<header class="question-context"><div class="question-meta">${renderRouteIndicator(envelope, i18n)}</div><h1 class="visually-hidden">${escapeHtml(i18n.questionLabel)}: ${escapeHtml(question)}</h1></header>` : "";
    if (!envelope.answered) return `<article class="answer-page">${questionBlock}${renderRefusalCard(envelope, i18n)}</article>`;

    const rail = renderAnswerRail(envelope, i18n);
    const shellClass = rail ? " has-rail" : "";

    if (envelope.route === "grounded_generation") {
      return `<article class="answer-page mode-generated${shellClass}">${questionBlock}<div class="answer-shell">${renderGeneratedLayout(envelope, i18n)}${rail}</div></article>`;
    }
    if (envelope.route === "source_excerpts") {
      return `<article class="answer-page mode-source-excerpts${shellClass}">${questionBlock}<div class="answer-shell">${renderSourceExcerptsLayout(envelope, i18n)}${rail}</div></article>`;
    }
    if (envelope.mode === "section_overview") {
      return `<article class="answer-page mode-section-overview${shellClass}">${questionBlock}<div class="answer-shell">${renderSectionOverviewLayout(envelope, i18n)}${rail}</div></article>`;
    }
    const body = envelope.mode === "comparison" ? renderComparison(envelope, i18n)
      : envelope.mode === "process" ? renderProcess(envelope, i18n)
      : envelope.mode === "amendment" ? renderAmendment(envelope, i18n)
        : answerUnits(envelope, i18n).map((unit) => renderAnswerUnit(unit, envelope.claims, i18n)).join("");
    // This mode already had its own right-hand evidence column
    // (renderEvidencePanel) — the rail joins it in the same column,
    // stacked above, rather than adding a third column.
    return `<article class="answer-page mode-${escapeHtml(envelope.mode)}">${questionBlock}<div class="answer-layout">
      <section class="answer-primary" aria-labelledby="answer-heading"><div class="section-label" id="answer-heading">${escapeHtml(i18n.answerTitle)}</div>
      ${body}${renderVerdictBar(envelope, i18n)}${renderReviewStatusFooter(envelope, i18n)}</section>
      <div class="answer-side">${rail}${renderEvidencePanel(envelope, i18n)}</div></div></article>`;
  }

  return { escapeHtml, pdfUrl, renderCitationLine, renderEvidenceSourceHeader, renderModalityLabel, renderValueStatusNote, renderClaimCard, claimForUnit, renderVerdictBar, renderRouteIndicator,
    renderGeneratedUnit, renderSourceExcerptUnit, renderSectionOverviewLayout, renderRefusalCard, renderComparison, renderProcess, renderAmendment, renderSemanticCoverage, renderAnswerRail, renderEnvelope };
});
