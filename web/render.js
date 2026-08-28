/**
 * web/render.js
 * M5 Phase 4, third pass after design-taste-frontend audit + direct user
 * critique ("still non-minimalist, too AI", "visibility too low"). The
 * first pass removed the obvious tells (card boxes, emoji, em-dash) but
 * kept the deeper one: a small bordered pill/badge for every piece of
 * metadata (modality, condition type, value-status), a colored-border
 * "verdict bar", icon-plus-tinted-background blocks. That accumulation
 * of little bordered tags IS the AI-generated-dashboard signature, just
 * at data-density scale rather than marketing-eyebrow scale. Real
 * minimalism (the user's stated reference: Google) leans on typography,
 * weight, color, size, and whitespace, not on chrome. This pass:
 *   - Modality, condition type, value-status: plain colored/weighted
 *     text, no border, no pill, no background.
 *   - Verdict: one small plain text line, no colored border strip.
 *   - Conditions / cross-references: plain indented text, no icon, no
 *     tinted background block.
 *   - No icons at all (the two SVGs from the previous pass are gone too,
 *     since a text link ("Open PDF") reads just as clearly without one
 *     and removing it removes one more piece of chrome).
 *
 * TPP invariants unchanged by any of this (still tested):
 *   - A claim with no citation renders an error state, never the claim
 *     itself (§1.1).
 *   - review_status gets no per-claim treatment (2484/2484 "reviewed"
 *     today would misleadingly read as human sign-off, §2.5.1); one
 *     line in a page-level footer instead. value_status does get a
 *     per-claim note, since it actually varies.
 *   - modality always renders, including an explicit "NONE".
 *   - Refusal is first-class and neutral, never styled as an error.
 *   - Path A/B is shown, never a numeric confidence score.
 */

(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.GuidelineRender = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  function escapeHtml(str) {
    if (str === null || str === undefined) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function pdfUrl(citation) {
    if (!citation || !citation.document_id) return null;
    const page = typeof citation.pdf_page_index_zero_based === "number" ? citation.pdf_page_index_zero_based + 1 : null;
    return `/pdf/${encodeURIComponent(citation.document_id)}${page ? `#page=${page}` : ""}`;
  }

  function renderCitationLine(citation, i18n) {
    if (!citation) return "";
    const page = citation.printed_page_label ? `p.${escapeHtml(citation.printed_page_label)}` : (typeof citation.pdf_page_index_zero_based === "number" ? `pdf p.${citation.pdf_page_index_zero_based}` : "");
    const section = citation.section_title
      ? `§${escapeHtml(citation.section_number || "?")} · ${escapeHtml(citation.section_title)}`
      : `§${escapeHtml(citation.section_number || "?")}`;
    const url = pdfUrl(citation);
    const openLink = url ? `<a class="citation-pdf-link" href="${url}" target="_blank" rel="noopener">${escapeHtml(i18n.openPdf)}</a>` : "";
    return `
      <div class="citation-line">
        <span>${escapeHtml(citation.guideline_code || citation.document_id || "")} ${section}, ${page} <span class="citation-id">${escapeHtml(citation.source_unit_id)}</span></span>
        ${openLink}
      </div>
    `;
  }

  const MODALITY_CLASS = { must: "modality-must", should: "modality-should", may: "modality-may", other: "modality-other", none: "modality-none" };

  function renderModalityLabel(record) {
    if (!record || record.type !== "knowledge_record") return "";
    const modal = (record.modality || "none").toLowerCase();
    const cls = MODALITY_CLASS[modal] || "modality-other";
    const original = record.original_modal_text;
    const suffix = original && original.toLowerCase() !== modal
      ? ` <span class="modality-original">"${escapeHtml(original)}"</span>`
      : "";
    return `<span class="modality-label ${cls}">${escapeHtml(modal.toUpperCase())}</span>${suffix}`;
  }

  const VALUE_STATUS_LABEL = {
    unknown: "value not confirmed in source",
    not_applicable: "not applicable as a numeric criterion",
    needs_review: "flagged needs_review, not yet independently verified"
  };

  function renderValueStatusNote(record) {
    if (!record || record.type !== "quantitative_criterion") return "";
    const status = record.value_status;
    if (!status || status === "known") return "";
    return `<div class="value-status-note">${escapeHtml(VALUE_STATUS_LABEL[status] || status)}</div>`;
  }

  function renderCriterionValue(record) {
    const value = record.value_fraction ? `${record.value_fraction.numerator}/${record.value_fraction.denominator}` : record.value;
    const unit = record.unit ? ` ${escapeHtml(record.unit)}` : "";
    const qualifier = record.is_illustrative_example
      ? `<div class="criterion-qualifier">illustrative example, not a specified requirement</div>`
      : record.is_default_with_exception
        ? `<div class="criterion-qualifier">default value, exceptions may apply</div>`
        : "";
    const denom = record.denominator_or_reference ? `<div class="criterion-scope">${escapeHtml(record.denominator_or_reference)}</div>` : "";
    return `
      <div class="criterion-value">
        <span class="criterion-parameter">${escapeHtml(record.parameter)}</span>
        <span class="criterion-bound">${escapeHtml(record.comparator)} ${escapeHtml(value)}${unit}</span>
      </div>
      ${denom}
      ${qualifier}
    `;
  }

  function renderApplicableConditions(conditions, i18n) {
    if (!conditions || conditions.length === 0) return "";
    const items = conditions.map((c) => `<li><span class="condition-type">${escapeHtml(c.condition_type)}:</span> ${escapeHtml(c.condition_text)}</li>`).join("");
    return `
      <div class="conditions-block">
        <div class="conditions-header">${escapeHtml(i18n.applicableConditions)}</div>
        <ul class="conditions-list">${items}</ul>
      </div>
    `;
  }

  function renderCrossReferences(xrefs, i18n) {
    if (!xrefs || xrefs.length === 0) return "";
    const seen = new Set();
    const items = [];
    for (const x of xrefs) {
      const key = x.target_id || x.raw_reference_text;
      if (!key || seen.has(key)) continue;
      seen.add(key);
      if (x.target_citation && x.target_source_text) {
        items.push(`<li>${escapeHtml(x.target_citation)}: "${escapeHtml(x.target_source_text)}"</li>`);
      } else if (x.raw_reference_text) {
        items.push(`<li>"${escapeHtml(x.raw_reference_text)}"</li>`);
      }
    }
    if (items.length === 0) return "";
    return `
      <div class="xref-block">
        <div class="xref-header">${escapeHtml(i18n.crossReferences)}</div>
        <ul class="xref-list">${items.join("")}</ul>
      </div>
    `;
  }

  /**
   * The hard invariant: a claim with no citation renders an error
   * placeholder, never the claim's content. Tested directly.
   */
  function renderClaimCard(claim, i18n) {
    if (!claim || !claim.citation || !claim.citation.source_unit_id) {
      return `<div class="claim claim-error">${escapeHtml(i18n.claimMissingCitation)}</div>`;
    }
    const record = claim.record || {};
    const isCriterion = record.type === "quantitative_criterion";
    const isCondition = record.type === "condition";

    const body = isCriterion
      ? renderCriterionValue(record)
      : `<div class="claim-text">${escapeHtml(record.source_text || "")}</div>`;

    const normalizedKo = record.normalized_ko
      ? `<div class="claim-normalized-ko"><span class="claim-normalized-label">${escapeHtml(i18n.normalizedKoLabel)}</span> ${escapeHtml(record.normalized_ko)}</div>`
      : "";

    const conditionTypeLabel = isCondition ? `<span class="condition-type-label">${escapeHtml(record.condition_type || "")}</span> ` : "";

    return `
      <div class="claim">
        <div class="claim-header">
          ${renderModalityLabel(record)}
          ${conditionTypeLabel}
        </div>
        ${renderValueStatusNote(record)}
        ${body}
        ${normalizedKo}
        ${renderCitationLine(claim.citation, i18n)}
        ${renderApplicableConditions(record.applicable_conditions, i18n)}
        ${renderCrossReferences(record.cross_references, i18n)}
      </div>
    `;
  }

  function renderVerdictBar(envelope, i18n) {
    if (envelope.path === "A") {
      return `<div class="verdict verdict-a">${escapeHtml(i18n.pathALabel)}. ${escapeHtml(i18n.pathASub)}</div>`;
    }
    if (envelope.path === "B") {
      return `<div class="verdict verdict-b">${escapeHtml(i18n.pathBLabel)}. ${escapeHtml(i18n.pathBSub)}</div>`;
    }
    return "";
  }

  const REFUSAL_SUBTEXT = {
    no_match: (i18n) => i18n.refusalNoMatch,
    scope_excluded: (i18n) => i18n.refusalScopeExcluded,
    no_provider: (i18n) => i18n.refusalNoProvider,
    no_candidates: (i18n) => i18n.refusalNoMatch,
    model_declined: (i18n) => i18n.refusalNoMatch,
    verification_failed: (i18n) => i18n.refusalVerificationFailed
  };

  function renderRefusalCard(envelope, i18n) {
    const kind = (envelope.refusal && envelope.refusal.kind) || "no_match";
    const subtextFn = REFUSAL_SUBTEXT[kind] || REFUSAL_SUBTEXT.no_match;
    const reason = envelope.refusal && envelope.refusal.reason
      ? `<div class="refusal-reason">${escapeHtml(envelope.refusal.reason)}</div>`
      : "";
    return `
      <div class="refusal">
        <div class="refusal-title">${escapeHtml(i18n.refusalTitle)}</div>
        <div class="refusal-body">${escapeHtml(i18n.refusalBody)}</div>
        <div class="refusal-kind">${escapeHtml(subtextFn(i18n))}</div>
        ${reason}
      </div>
    `;
  }

  function renderComparison(envelope, i18n) {
    const byDoc = new Map();
    for (const claim of envelope.claims) {
      const docId = (claim.record && claim.record.document_id) || "unknown";
      const title = (claim.record && claim.record.document_title) || docId;
      if (!byDoc.has(docId)) byDoc.set(docId, { title, claims: [] });
      byDoc.get(docId).claims.push(claim);
    }
    const columns = [...byDoc.values()].map((group) => `
      <div class="comparison-column">
        <div class="comparison-column-header">${escapeHtml(group.title)}</div>
        ${group.claims.map((c) => renderClaimCard(c, i18n)).join("")}
      </div>
    `).join("");
    return `
      <div class="comparison-note">${escapeHtml(i18n.comparisonNote)}</div>
      <div class="comparison-grid">${columns}</div>
    `;
  }

  function renderAmendment(envelope, i18n) {
    const claimCards = envelope.claims.map((c) => renderClaimCard(c, i18n)).join("");
    return `
      <div class="amendment-versions">
        <span class="amendment-version amendment-parent">${escapeHtml(i18n.parentVersion)}</span>
        <span class="amendment-version amendment-current">${escapeHtml(i18n.currentVersion)}</span>
      </div>
      ${claimCards}
    `;
  }

  function renderReviewStatusFooter(envelope, i18n) {
    if (!envelope.answered) return "";
    return `<div class="transparency-footer">${escapeHtml(i18n.reviewStatusMeaning)}</div>`;
  }

  /**
   * Full render for one answer envelope. Dispatches on `mode`, but every
   * mode ultimately renders from the same claim component, no bespoke
   * per-mode schema, per the M5 plan's minimal-contract decision.
   */
  function renderEnvelope(envelope, i18n) {
    if (!envelope.answered) {
      return renderRefusalCard(envelope, i18n);
    }

    let body;
    if (envelope.mode === "comparison") {
      body = renderComparison(envelope, i18n);
    } else if (envelope.mode === "amendment") {
      body = renderAmendment(envelope, i18n);
    } else {
      body = envelope.claims.map((c) => renderClaimCard(c, i18n)).join("");
    }

    return `
      ${renderVerdictBar(envelope, i18n)}
      <div class="claims-list">${body}</div>
      ${renderReviewStatusFooter(envelope, i18n)}
    `;
  }

  return {
    escapeHtml,
    pdfUrl,
    renderCitationLine,
    renderModalityLabel,
    renderValueStatusNote,
    renderClaimCard,
    renderVerdictBar,
    renderRefusalCard,
    renderComparison,
    renderAmendment,
    renderEnvelope
  };
});
