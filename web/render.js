/**
 * web/render.js
 * M5 Phase 4 (docs/test_record.md Entry 008 / M5 plan §4): pure
 * envelope -> HTML-string functions. No DOM access here at all — that's
 * the whole point: it's the only way to unit-test the UI under node:test
 * with zero devDependencies (no jsdom). app.js owns DOM mutation and
 * escapes nothing extra; every string that reaches innerHTML here is
 * already escaped at the point it's interpolated.
 *
 * Design intent (not just plumbing) — the reader this UI is built for is
 * an adversarial domain expert whose job is catching a wrong citation
 * (product_roadmap.md §1.2), not a casual chat user:
 *   - A claim with no citation renders an error placeholder, NEVER the
 *     claim itself. Hard, tested invariant (§1.1).
 *   - review_status gets no per-card badge (2484/2484 "reviewed" today
 *     would misleadingly read as human sign-off, forbidden by §2.5.1) —
 *     one line in the transparency footer instead. value_status gets the
 *     per-card badge, since it actually varies.
 *   - modality always renders, including an explicit "NONE" chip rather
 *     than silent omission (§1.4).
 *   - Refusal is a first-class, neutrally-styled result, not an error.
 *   - Path A/B is shown structurally (border style), never as a numeric
 *     confidence score (§1.4 non-goal).
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

  function renderCitationStrip(citation, i18n) {
    if (!citation) return "";
    const page = citation.printed_page_label ? `p.${escapeHtml(citation.printed_page_label)}` : (typeof citation.pdf_page_index_zero_based === "number" ? `pdf p.${citation.pdf_page_index_zero_based}` : "");
    const section = citation.section_title
      ? `§${escapeHtml(citation.section_number || "?")} (${escapeHtml(citation.section_title)})`
      : `§${escapeHtml(citation.section_number || "?")}`;
    const url = pdfUrl(citation);
    const openLink = url ? `<a class="citation-pdf-link" href="${url}" target="_blank" rel="noopener">${escapeHtml(i18n.openPdf)}</a>` : "";
    const sectionPath = citation.section_path && citation.section_path.length
      ? `<div class="citation-path">${citation.section_path.map(escapeHtml).join(" › ")}</div>`
      : "";
    return `
      <div class="citation-strip">
        <span class="citation-main">${escapeHtml(citation.guideline_code || citation.document_id || "")} ${section}, ${page} <span class="citation-id">[${escapeHtml(citation.source_unit_id)}]</span></span>
        ${openLink}
      </div>
      ${sectionPath}
    `;
  }

  const MODALITY_CLASS = { must: "modality-must", should: "modality-should", may: "modality-may", other: "modality-other", none: "modality-none" };

  function renderModalityChip(record) {
    if (!record || record.type !== "knowledge_record") return "";
    const modal = (record.modality || "none").toLowerCase();
    const cls = MODALITY_CLASS[modal] || "modality-other";
    const original = record.original_modal_text;
    const suffix = original && original.toLowerCase() !== modal
      ? `<span class="modality-original">— "${escapeHtml(original)}"</span>`
      : "";
    return `<span class="modality-chip ${cls}">${escapeHtml(modal.toUpperCase())}</span>${suffix}`;
  }

  const VALUE_STATUS_LABEL = {
    unknown: "value not confirmed in source",
    not_applicable: "not applicable as a numeric criterion",
    needs_review: "flagged needs_review — not yet independently verified"
  };

  function renderValueStatusBadge(record) {
    if (!record || record.type !== "quantitative_criterion") return "";
    const status = record.value_status;
    if (!status || status === "known") return "";
    return `<div class="value-status-badge value-status-${escapeHtml(status)}">⚠ ${escapeHtml(VALUE_STATUS_LABEL[status] || status)}</div>`;
  }

  function renderCriterionValue(record) {
    const value = record.value_fraction ? `${record.value_fraction.numerator}/${record.value_fraction.denominator}` : record.value;
    const unit = record.unit ? ` ${escapeHtml(record.unit)}` : "";
    const qualifier = record.is_illustrative_example
      ? `<div class="criterion-qualifier">${escapeHtml("예시일 뿐, 규정값 아님 / illustrative example, not a specified requirement")}</div>`
      : record.is_default_with_exception
        ? `<div class="criterion-qualifier">${escapeHtml("기본값 — 예외 적용 가능 / default value, exceptions may apply")}</div>`
        : "";
    const denom = record.denominator_or_reference ? `<div class="criterion-scope">(${escapeHtml(record.denominator_or_reference)})</div>` : "";
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
    const items = conditions.map((c) => `<li><span class="condition-type">(${escapeHtml(c.condition_type)})</span> "${escapeHtml(c.condition_text)}"</li>`).join("");
    return `
      <div class="conditions-block">
        <div class="conditions-header">⚠ ${escapeHtml(i18n.applicableConditions)} (${conditions.length})</div>
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
        <div class="xref-header">🔗 ${escapeHtml(i18n.crossReferences)}</div>
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
      return `<div class="claim-card claim-card-error">⚠ ${escapeHtml(i18n.claimMissingCitation)}</div>`;
    }
    const record = claim.record || {};
    const isCriterion = record.type === "quantitative_criterion";
    const isCondition = record.type === "condition";

    const body = isCriterion
      ? renderCriterionValue(record)
      : `<div class="claim-source-text">"${escapeHtml(record.source_text || "")}"</div>`;

    const normalizedKo = record.normalized_ko
      ? `<div class="claim-normalized-ko"><span class="claim-normalized-label">${escapeHtml(i18n.normalizedKoLabel)}</span> ${escapeHtml(record.normalized_ko)}</div>`
      : "";

    const conditionTypeBadge = isCondition ? `<span class="condition-badge">${escapeHtml(record.condition_type || "")}</span>` : "";

    return `
      <div class="claim-card">
        <div class="claim-header">
          ${renderModalityChip(record)}
          ${conditionTypeBadge}
        </div>
        ${renderValueStatusBadge(record)}
        ${body}
        ${normalizedKo}
        ${renderCitationStrip(claim.citation, i18n)}
        ${renderApplicableConditions(record.applicable_conditions, i18n)}
        ${renderCrossReferences(record.cross_references, i18n)}
      </div>
    `;
  }

  function renderVerdictBar(envelope, i18n) {
    if (envelope.path === "A") {
      return `
        <div class="verdict-bar verdict-a">
          <div class="verdict-title">${escapeHtml(i18n.pathALabel)}</div>
          <div class="verdict-sub">${escapeHtml(i18n.pathASub)}</div>
        </div>
      `;
    }
    if (envelope.path === "B") {
      return `
        <div class="verdict-bar verdict-b">
          <div class="verdict-title">${escapeHtml(i18n.pathBLabel)}</div>
          <div class="verdict-sub">${escapeHtml(i18n.pathBSub)}</div>
        </div>
      `;
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
      <div class="refusal-card">
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
        <div class="amendment-version amendment-parent">
          <div class="amendment-version-label">${escapeHtml(i18n.parentVersion)}</div>
        </div>
        <div class="amendment-version amendment-current">
          <div class="amendment-version-label">${escapeHtml(i18n.currentVersion)}</div>
        </div>
      </div>
      ${claimCards}
    `;
  }

  function renderReviewStatusFooter(envelope, i18n) {
    if (!envelope.answered) return "";
    return `
      <div class="transparency-footer">
        <div class="transparency-line">${escapeHtml(i18n.reviewStatusMeaning)}</div>
      </div>
    `;
  }

  /**
   * Full render for one answer envelope. Dispatches on `mode`, but every
   * mode ultimately renders from the same claim-card component — no
   * bespoke per-mode schema, per the M5 plan's minimal-contract decision.
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
      <div class="claims-container">${body}</div>
      ${renderReviewStatusFooter(envelope, i18n)}
    `;
  }

  return {
    escapeHtml,
    pdfUrl,
    renderCitationStrip,
    renderModalityChip,
    renderValueStatusBadge,
    renderClaimCard,
    renderVerdictBar,
    renderRefusalCard,
    renderComparison,
    renderAmendment,
    renderEnvelope
  };
});
