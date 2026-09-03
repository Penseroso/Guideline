/**
 * engine/semantic_shadow.js
 * Stage B (docs/derived_semantic_layer.md §10): "의미 오버레이로 answer
 * plan을 만들되 사용자 응답에는 아직 적용하지 않는다." This module builds
 * that second, semantic-overlay-derived plan next to the answer the
 * existing router already produced, for logging/comparison only. Nothing
 * here changes `envelope` or picks records for the real answer — see
 * engine/server.js's /api/ask handler, where this runs strictly after the
 * envelope that is actually sent to the client has already been built.
 *
 * Deliberately does not gate a document's coverage_manifests by matching
 * the router's own `answer_intent` label: the audit that motivated Stage A
 * (history/verification/answer_suitability_audit_2026-09-02.md, Q26) found
 * the router itself sometimes under-classifies a document-wide question as
 * `topic_overview`. Reporting every manifest for a resolved document, each
 * annotated with whether it matches the router's own label, keeps that
 * exact kind of mismatch visible in the shadow log instead of hiding it
 * behind intent-string equality.
 */
const { extractQueryScope } = require("./text_utils");
const { loadSemanticOverlayStore } = require("./semantic_overlay_store");

let cachedDefaultStore = null;
function defaultStore() {
  if (!cachedDefaultStore) cachedDefaultStore = loadSemanticOverlayStore();
  return cachedDefaultStore;
}

// engine/query_router.js's classifyAnswerIntent() kind values that don't
// share a spelling with data/schemas/derived_semantic_overlay.schema.json's
// coverage_manifest.answer_intent enum.
const INTENT_LABELS = {
  within_document_comparison: "comparison"
};

function labelIntent(intent) {
  if (!intent) return null;
  return INTENT_LABELS[intent] || intent;
}

/**
 * Prefers the documents that actually contributed evidence to the answer
 * (claim.record.document_id) over the router's own `scope` block, because
 * some routes (comparison_engine's composite path, at least as of this
 * writing) return null scope/coverage on the envelope even though the
 * claims themselves are fully document-tagged.
 */
function resolveCandidateDocumentIds(envelope) {
  const ids = new Set();
  for (const claim of envelope.claims || []) {
    const documentId = claim && claim.record && claim.record.document_id;
    if (documentId) ids.add(documentId);
  }
  const scope = envelope.scope || {};
  for (const id of scope.resolved_document_ids || []) ids.add(id);
  for (const id of scope.requested_document_ids || []) ids.add(id);
  return [...ids];
}

function claimIdSet(envelope) {
  const ids = new Set();
  for (const claim of envelope.claims || []) {
    if (claim && claim.record && claim.record.id) ids.add(claim.record.id);
  }
  return ids;
}

function claimSectionIdSet(envelope) {
  const ids = new Set();
  for (const claim of envelope.claims || []) {
    if (claim && claim.record && claim.record.section_id) ids.add(claim.record.section_id);
  }
  return ids;
}

/**
 * "applicable" / "not_applicable" / "ambiguous" per
 * docs/derived_semantic_layer.md §4.5's coverage_group.when: a group with
 * no `when` is unconditional; one whose slot has no extracted value is
 * ambiguous (the case on_ambiguity=present_branches exists to handle).
 */
function evaluateWhen(when, queryScope) {
  if (!when) return "applicable";
  if (!(when.slot_id in queryScope)) return "ambiguous";
  const actual = queryScope[when.slot_id];
  if (actual == null) return "ambiguous";
  return actual === when.value ? "applicable" : "not_applicable";
}

/**
 * Two signals, not one. `member_record_ids` is a single representative
 * sample per facet in the Stage A data (docs/derived_semantic_layer.md's
 * own design keeps facets narrow and evidenced, not exhaustive), so exact
 * record-id overlap alone under-counts real coverage whenever the router
 * cited different-but-equally-valid evidence from the same section — which
 * is common (e.g. fda_ada's five validation-tier facets each carry one
 * sample record, but a real generated answer usually cites other records
 * from that same section instead). `exact` is the strict signal (this
 * precise declared fact appears); `topical` is the weaker one (some claim
 * at least touched the facet's own section). Status prefers `exact` and
 * only falls back to `topical` when no member was cited at all, so a
 * facet is never reported "covered" on topical grounds alone.
 */
function facetCoverage(facet, claimIds, claimSectionIds, sectionsById) {
  if (!facet) return { status: "unknown", covered: 0, total: 0, topical_only: false };
  const members = facet.member_record_ids || [];
  if (members.length === 0) return { status: "not_applicable", covered: 0, total: 0, topical_only: false };
  const covered = members.filter((id) => claimIds.has(id)).length;
  if (covered === members.length) return { status: "covered", covered, total: members.length, topical_only: false };
  if (covered > 0) return { status: "partial", covered, total: members.length, topical_only: false };
  const topical = Boolean(facet.scope) && [...claimSectionIds].some((sectionId) => sectionsAreRelated(facet.scope, sectionId, sectionsById));
  return { status: topical ? "partial" : "missing", covered, total: members.length, topical_only: topical };
}

/**
 * complete/partial/unavailable/ambiguous per §4.5 — "저장된 규제 판단이
 * 아니라 현재 검색 결과의 설명 coverage" of this one answer, recomputed
 * every time rather than cached on the manifest.
 */
function summarizeManifestStatus(groups) {
  if (groups.some((group) => group.applicability === "ambiguous")) return "ambiguous";
  const applicable = groups.filter((group) => group.applicability === "applicable");
  const facetStatuses = applicable.flatMap((group) => group.facets.map((facet) => facet.status));
  if (facetStatuses.length === 0) return "unavailable";
  if (facetStatuses.every((status) => status === "covered")) return "complete";
  if (facetStatuses.some((status) => status === "covered" || status === "partial")) return "partial";
  return "unavailable";
}

function sectionAncestors(sectionId, sectionsById) {
  const ancestors = [];
  let current = sectionsById.get(sectionId);
  while (current && current.parent_section_id) {
    ancestors.push(current.parent_section_id);
    current = sectionsById.get(current.parent_section_id);
  }
  return ancestors;
}

function sectionsAreRelated(a, b, sectionsById) {
  if (a === b) return true;
  if (sectionAncestors(a, sectionsById).includes(b)) return true;
  return sectionAncestors(b, sectionsById).includes(a);
}

function manifestScopeSectionIds(overlay, manifest) {
  const facetsById = new Map((overlay.facets || []).map((facet) => [facet.facet_id, facet]));
  const sectionIds = new Set();
  for (const group of manifest.coverage_groups || []) {
    for (const facetId of group.facet_ids || []) {
      const facet = facetsById.get(facetId);
      // A facet whose own `scope` is the whole document (an abstraction
      // spanning multiple sections, e.g. ich_m10's run_acceptance parent
      // facet) says nothing about section-level relevance by itself.
      if (facet && facet.scope && facet.scope !== overlay.document_id) sectionIds.add(facet.scope);
    }
  }
  if (manifest.target && manifest.target.type === "section") sectionIds.add(manifest.target.id);
  return sectionIds;
}

/**
 * A document having *some* overlay is necessary but not sufficient: most
 * documents here have exactly one narrow manifest (e.g. ich_m10's is
 * scoped to run-acceptance criteria, §3.3.2/§4.3.2 only), and attaching it
 * to every query that merely resolves to that document — including ones
 * about a completely different section — would flood the shadow log with
 * "unavailable" noise instead of signal. A document-level manifest
 * (target.type=document, e.g. ema_fih's document_overview) always stays
 * relevant, matching the exact case this was built to catch (Q26): the
 * router itself resolved only a narrow slice of sections, and that
 * narrowing is precisely the finding worth surfacing, not a reason to
 * suppress the manifest.
 */
function isManifestRelevant(overlay, manifest, resolvedSectionIds, sectionsById) {
  if (manifest.target && manifest.target.type === "document") return true;
  if (!resolvedSectionIds || resolvedSectionIds.length === 0) return true;
  const scopeSectionIds = manifestScopeSectionIds(overlay, manifest);
  if (scopeSectionIds.size === 0) return true;
  for (const scopeSectionId of scopeSectionIds) {
    for (const resolvedId of resolvedSectionIds) {
      if (sectionsAreRelated(scopeSectionId, resolvedId, sectionsById)) return true;
    }
  }
  return false;
}

function buildManifestPlan(overlay, manifest, envelopeAnswerIntent, queryScope, claimIds, claimSectionIds, sectionsById) {
  const facetsById = new Map((overlay.facets || []).map((facet) => [facet.facet_id, facet]));
  const sortedGroups = [...(manifest.coverage_groups || [])].sort((a, b) => a.display_order - b.display_order);
  const groups = sortedGroups.map((group) => {
    const applicability = evaluateWhen(group.when, queryScope);
    const facets = applicability === "not_applicable"
      ? []
      : group.facet_ids.map((facetId) => ({
          facet_id: facetId,
          ...facetCoverage(facetsById.get(facetId), claimIds, claimSectionIds, sectionsById)
        }));
    return { group_id: group.group_id, applicability, selection: group.selection, on_ambiguity: group.on_ambiguity, facets };
  });

  return {
    manifest_id: manifest.manifest_id,
    manifest_answer_intent: manifest.answer_intent,
    intent_match: labelIntent(envelopeAnswerIntent) === manifest.answer_intent,
    review_status: manifest.review_status,
    status: summarizeManifestStatus(groups),
    groups
  };
}

function buildSaliencePlans(overlay) {
  return (overlay.salience_profiles || []).map((profile) => ({
    profile_id: profile.profile_id,
    context: profile.context,
    order: [...profile.items]
      .sort((a, b) => a.display_order - b.display_order)
      .map((item) => ({ facet_id: item.facet_id, tier: item.tier }))
  }));
}

/**
 * Only reports axes where >=2 of the *resolved* documents actually bind to
 * the same axis_id — matching data/ontology/semantic_concepts.json's
 * comparison_axes is necessary (validation/validate_semantic_overlay.js
 * already enforces that at authoring time) but not sufficient for this
 * query: a shared axis definition that only one side's document uses here
 * isn't a usable comparison row for this answer.
 */
function buildComparisonPlan(overlaysByDocumentId, documentIds) {
  if (documentIds.length < 2) return null;
  const axisUsage = new Map();
  for (const documentId of documentIds) {
    const overlay = overlaysByDocumentId.get(documentId);
    for (const binding of (overlay && overlay.comparison_bindings) || []) {
      if (!axisUsage.has(binding.axis_id)) axisUsage.set(binding.axis_id, []);
      axisUsage.get(binding.axis_id).push({
        document_id: documentId,
        facet_id: binding.facet_id,
        binding_id: binding.binding_id,
        review_status: binding.review_status
      });
    }
  }
  const shared = [...axisUsage.entries()]
    .filter(([, bindings]) => new Set(bindings.map((entry) => entry.document_id)).size >= 2)
    .map(([axisId, bindings]) => ({ axis_id: axisId, bindings }));
  return shared.length > 0 ? shared : null;
}

function buildShadowPlan(question, envelope, { store } = {}) {
  const semanticStore = store || defaultStore();
  const documentIds = resolveCandidateDocumentIds(envelope);
  const availableDocumentIds = documentIds.filter((id) => semanticStore.overlaysByDocumentId.has(id));

  if (availableDocumentIds.length === 0) {
    return {
      applicable: false,
      reason: documentIds.length === 0 ? "no_resolved_document" : "no_overlay_for_document",
      document_ids: documentIds
    };
  }

  const queryScope = extractQueryScope(question);
  const claimIds = claimIdSet(envelope);
  const claimSectionIds = claimSectionIdSet(envelope);

  const resolvedSectionIds = (envelope.scope && envelope.scope.section_ids) || [];
  const manifests = [];
  const salience = [];
  for (const documentId of availableDocumentIds) {
    const overlay = semanticStore.overlaysByDocumentId.get(documentId);
    const relevantFacetIds = new Set();
    for (const manifest of overlay.coverage_manifests || []) {
      if (!isManifestRelevant(overlay, manifest, resolvedSectionIds, semanticStore.archive.sectionsById)) continue;
      manifests.push({
        document_id: documentId,
        ...buildManifestPlan(overlay, manifest, envelope.answer_intent, queryScope, claimIds, claimSectionIds, semanticStore.archive.sectionsById)
      });
      for (const group of manifest.coverage_groups || []) {
        for (const facetId of group.facet_ids || []) relevantFacetIds.add(facetId);
      }
    }
    // Only surface ordering guidance for facets a relevant manifest above
    // actually pulled in, or for whole-document profiles — otherwise an
    // unrelated document's salience profile (e.g. ich_m10's run-acceptance
    // ordering, for a query about validation taxonomy) would ride along
    // with no corresponding manifest to justify it.
    for (const profilePlan of buildSaliencePlans(overlay)) {
      const isDocumentLevel = profilePlan.target_id === documentId;
      const touchesRelevantFacet = profilePlan.order.some((item) => relevantFacetIds.has(item.facet_id));
      if (isDocumentLevel || touchesRelevantFacet) salience.push({ document_id: documentId, ...profilePlan });
    }
  }

  const comparison = buildComparisonPlan(semanticStore.overlaysByDocumentId, availableDocumentIds);
  const applicable = manifests.length > 0 || comparison !== null;

  return {
    applicable,
    // Only set when !applicable, so a truthy `reason` is always exactly
    // the signal "no plan was built" — never present alongside real
    // manifests/comparison output. Distinct from "no_resolved_document"
    // and "no_overlay_for_document" above: this document has an overlay,
    // it just has no coverage_manifest and (if only one document
    // resolved, or none shares a comparison axis) no comparison binding
    // either — e.g. ich_m3_r2's overlay is comparison-only and produces
    // nothing outside a multi-document comparison query.
    ...(applicable ? {} : { reason: "no_applicable_manifest_or_axis" }),
    document_ids: availableDocumentIds,
    query_scope: queryScope,
    manifests,
    salience,
    comparison
  };
}

function comparePlans(question, envelope, options) {
  const shadowPlan = buildShadowPlan(question, envelope, options);
  return {
    question,
    existing_plan: {
      route: envelope.route ?? null,
      mode: envelope.mode ?? null,
      answer_intent: envelope.answer_intent ?? null,
      scope: envelope.scope ?? null,
      coverage: envelope.coverage ?? null,
      claim_count: (envelope.claims || []).length
    },
    semantic_plan: shadowPlan
  };
}

module.exports = { buildShadowPlan, comparePlans, defaultStore };
