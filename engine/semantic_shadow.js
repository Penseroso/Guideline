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
 *
 * Revised after the first shadow run (history/verification/
 * semantic_shadow_stage_b_2026-09-03.md §6) surfaced five structural gaps
 * — not per-question quirks, but general weaknesses in the plan-building
 * algorithm itself: (1) section relevance ignored sibling sections, (2)
 * facet coverage depended entirely on a single hand-curated sample record
 * per facet, (3) comparison bindings were reported with no check that
 * either side actually had cited evidence, (4) the existing engine's own
 * presentation order was never captured so there was nothing to diff the
 * new layer's proposed order against, and (5) a stale overlay was
 * indistinguishable in the log from one that was never authored. All five
 * are fixed below; see each function's comment for the specific mechanism.
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

/**
 * Fix (4): the existing engine's actual presentation order, captured the
 * same way the UI would read it — `envelope.claims` is already the order
 * claims are rendered in (engine/answer_presenter.js consumes it as-is).
 * Recorded so a reader can directly diff this against
 * `semantic_plan.salience[].order` instead of only ever seeing the new
 * layer's proposed order in isolation.
 */
function claimOrder(envelope) {
  return (envelope.claims || [])
    .map((claim) => claim && claim.record && claim.record.id)
    .filter(Boolean);
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

function sectionAncestors(sectionId, sectionsById) {
  const ancestors = [];
  let current = sectionsById.get(sectionId);
  while (current && current.parent_section_id) {
    ancestors.push(current.parent_section_id);
    current = sectionsById.get(current.parent_section_id);
  }
  return ancestors;
}

/**
 * Fix (1): used only to decide whether a manifest is worth *showing* at
 * all for this query (isManifestRelevant below) — a coarse gate, not the
 * facet coverage census. Ancestor/descendant alone missed the common case
 * of immediate siblings under the same parent (e.g. ich_m10's §3.3.1
 * Analytical Run and §3.3.2 Acceptance Criteria are siblings under §3.3,
 * genuinely close enough that touching one is a signal the other's
 * manifest is worth surfacing). Deliberately stops at *immediate*
 * siblings rather than "any shared ancestor at any depth", which would
 * degrade to "same document" and defeat the point of filtering at all.
 */
function sectionsAreRelated(a, b, sectionsById) {
  if (a === b) return true;
  const ancestorsOfA = sectionAncestors(a, sectionsById);
  if (ancestorsOfA.includes(b)) return true;
  const ancestorsOfB = sectionAncestors(b, sectionsById);
  if (ancestorsOfB.includes(a)) return true;
  const parentA = ancestorsOfA[0] ?? null;
  const parentB = ancestorsOfB[0] ?? null;
  return parentA !== null && parentA === parentB;
}

/**
 * Strict subtree only (facet.scope plus every descendant section) — never
 * siblings. A sibling section is a different sub-topic; folding its
 * records into this facet's coverage denominator would make "covered"
 * mean something looser than what the facet actually declares.
 */
function descendantSectionIds(sectionId, childrenBySectionId) {
  const result = [];
  const queue = [...(childrenBySectionId.get(sectionId) || [])];
  while (queue.length > 0) {
    const current = queue.shift();
    result.push(current);
    for (const child of childrenBySectionId.get(current) || []) queue.push(child);
  }
  return result;
}

/**
 * Every core-archive record (knowledge_record / quantitative_criterion /
 * condition) filed under `sectionId` or one of its descendant sections —
 * the raw building block both branches of measureSectionCoverage use.
 */
function sectionSubtreeRecordIds(sectionId, sectionIndex) {
  const ids = new Set();
  for (const id of [sectionId, ...descendantSectionIds(sectionId, sectionIndex.childrenBySectionId)]) {
    for (const recordId of sectionIndex.recordIdsBySectionId.get(id) || []) ids.add(recordId);
  }
  return ids;
}

/**
 * Fix (2), revised: a facet's real coverage census, at the granularity
 * that actually matches its own scope. Two shapes:
 *
 * - **leaf scope** (e.g. ich_m10's chromatography branch, §3.3.2, no
 *   sub-sections of its own): `granularity: "record"` — every record
 *   filed there, same fine-grained recall as before.
 * - **chapter scope** (e.g. ema_fih's dose_selection facet, §7, which has
 *   7 real sub-sections §7.1–§7.7): `granularity: "section"` — how many
 *   of the facet's own *named sub-topics* (direct child sections) had at
 *   least one citation anywhere in their own subtree, not how many of the
 *   hundreds of atomic records under the whole chapter were cited.
 *
 * The first shadow run measured every facet with flat record recall
 * regardless of scope shape, which was fine for leaf facets but produced
 * denominators like 197 and 294 for ema_fih's chapter-level facets
 * (history/verification/semantic_shadow_stage_b_2026-09-03.md §8) — a
 * bar no single answer could ever meaningfully approach, making the
 * signal read as permanently near-zero regardless of answer quality.
 * Switching denominator shape based on whether the scope section actually
 * has children is a general rule, not a per-facet override: it applies
 * automatically to any future facet authored either way.
 */
function measureSectionCoverage(facet, overlay, claimIds, sectionIndex) {
  if (!facet.scope || facet.scope === overlay.document_id) return null;
  const children = [...(sectionIndex.childrenBySectionId.get(facet.scope) || [])];
  if (children.length === 0) {
    const ids = sectionSubtreeRecordIds(facet.scope, sectionIndex);
    return { granularity: "record", covered: [...ids].filter((id) => claimIds.has(id)).length, total: ids.size };
  }
  const touchedChildren = children.filter((childId) => {
    const childRecordIds = sectionSubtreeRecordIds(childId, sectionIndex);
    return [...childRecordIds].some((id) => claimIds.has(id));
  });
  return { granularity: "section", covered: touchedChildren.length, total: children.length };
}

/**
 * Two independently reported signals rather than one blended boolean:
 * `exact` is against the facet's hand-curated `member_record_ids` (the
 * strict "this precise declared fact was cited" signal); `section` is
 * against measureSectionCoverage above (the "was this facet's topic area
 * touched at all, and how much of it" signal, at whatever granularity
 * fits the facet's own scope). `status` still collapses to one label for
 * summarizeManifestStatus's roll-up, and prefers the exact signal — but
 * only when the facet actually has curated members to check. A facet
 * with real children and zero curated members (e.g. fda_ada_2014's
 * patient/product risk-factor category facets, whose section headers
 * carry no direct content of their own — every real fact lives one
 * level down, in each named sub-factor) has nothing for `exact` to ever
 * confirm, so relying on `exact.total > 0` to gate "covered" would trap
 * it at "partial" forever regardless of how completely its sub-topics
 * were actually covered. When there are no curated members at all,
 * `status` is derived purely from `section` instead — including
 * "covered" when every sub-topic was touched.
 */
function facetCoverage(facet, overlay, claimIds, sectionIndex) {
  if (!facet) return { status: "unknown", exact: { covered: 0, total: 0 }, section: null };

  const members = facet.member_record_ids || [];
  const exactCovered = members.filter((id) => claimIds.has(id)).length;
  const exact = { covered: exactCovered, total: members.length };
  const section = measureSectionCoverage(facet, overlay, claimIds, sectionIndex);

  if (members.length === 0 && section === null) return { status: "not_applicable", exact, section };

  if (exact.total > 0) {
    if (exactCovered === exact.total) return { status: "covered", exact, section };
    if (exactCovered > 0) return { status: "partial", exact, section };
  }
  if (section) {
    if (section.total > 0 && section.covered === section.total) return { status: "covered", exact, section };
    if (section.covered > 0) return { status: "partial", exact, section };
  }
  return { status: "missing", exact, section };
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

// A manifest declaring itself document_overview/topic_overview intent is,
// by its own design, meant to answer "what does this whole area cover" —
// exactly the shape of question where the router landing somewhere
// unrelated *is* the finding, not a reason to hide the manifest. Detail-
// oriented intents (multi_criterion, process, comparison, section_overview)
// stay gated by section proximity below, since those are legitimately
// about precision within one topic, not breadth.
const ALWAYS_RELEVANT_ANSWER_INTENTS = new Set(["document_overview", "topic_overview"]);

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
 *
 * The same reasoning turned out not to be specific to target.type=document:
 * fda_ada_2014's risk_factors manifest targets a facet (target.type=facet),
 * not the document, but is just as much an overview-shaped manifest — and
 * its real Q20 case (history/verification/semantic_shadow_stage_b_2026-09-03.md
 * §9) showed the router landing in completely unrelated sections (§III
 * clinical consequences, §VI conclusion — no shared ancestor or sibling
 * with §V.A/§V.B at all). Gating purely on target.type=document would have
 * hidden that exact case, so the exemption is keyed on the manifest's own
 * declared breadth (answer_intent) instead.
 */
function isManifestRelevant(overlay, manifest, resolvedSectionIds, sectionsById) {
  if (manifest.target && manifest.target.type === "document") return true;
  if (ALWAYS_RELEVANT_ANSWER_INTENTS.has(manifest.answer_intent)) return true;
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

function buildManifestPlan(overlay, manifest, envelopeAnswerIntent, queryScope, claimIds, sectionIndex) {
  const facetsById = new Map((overlay.facets || []).map((facet) => [facet.facet_id, facet]));
  const sortedGroups = [...(manifest.coverage_groups || [])].sort((a, b) => a.display_order - b.display_order);
  const groups = sortedGroups.map((group) => {
    const applicability = evaluateWhen(group.when, queryScope);
    const facets = applicability === "not_applicable"
      ? []
      : group.facet_ids.map((facetId) => ({
          facet_id: facetId,
          ...facetCoverage(facetsById.get(facetId), overlay, claimIds, sectionIndex)
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
 * Fix (3): a shared axis definition is necessary but not sufficient to
 * call a comparison "usable" for this specific answer — each binding is
 * now annotated with the same facetCoverage() used for manifests, so a
 * side that was never actually cited (`status: "missing"`) is visible
 * instead of implied-covered by the axis merely existing. `both_sides_evidenced`
 * summarizes that per axis: true only when at least two distinct
 * documents on the axis have non-"missing" coverage.
 */
function buildComparisonPlan(overlaysByDocumentId, documentIds, claimIds, sectionIndex) {
  if (documentIds.length < 2) return null;
  const axisUsage = new Map();
  for (const documentId of documentIds) {
    const overlay = overlaysByDocumentId.get(documentId);
    if (!overlay) continue;
    const facetsById = new Map((overlay.facets || []).map((facet) => [facet.facet_id, facet]));
    for (const binding of overlay.comparison_bindings || []) {
      if (!axisUsage.has(binding.axis_id)) axisUsage.set(binding.axis_id, []);
      axisUsage.get(binding.axis_id).push({
        document_id: documentId,
        facet_id: binding.facet_id,
        binding_id: binding.binding_id,
        review_status: binding.review_status,
        coverage: facetCoverage(facetsById.get(binding.facet_id), overlay, claimIds, sectionIndex)
      });
    }
  }
  const shared = [...axisUsage.entries()]
    .filter(([, bindings]) => new Set(bindings.map((entry) => entry.document_id)).size >= 2)
    .map(([axisId, bindings]) => {
      const evidencedDocuments = new Set(
        bindings.filter((entry) => entry.coverage.status !== "missing").map((entry) => entry.document_id)
      );
      return { axis_id: axisId, bindings, both_sides_evidenced: evidencedDocuments.size >= 2 };
    });
  return shared.length > 0 ? shared : null;
}

function buildShadowPlan(question, envelope, { store } = {}) {
  const semanticStore = store || defaultStore();
  const documentIds = resolveCandidateDocumentIds(envelope);
  const availableDocumentIds = documentIds.filter((id) => semanticStore.overlaysByDocumentId.has(id));
  // Fix (5): surfaced in every return path (not just the early-return
  // below) so a query resolving several documents, some stale and some
  // fine, never has the stale ones silently vanish from the log.
  const staleDocumentIds = documentIds.filter((id) => semanticStore.staleDocumentIds.has(id));

  if (availableDocumentIds.length === 0) {
    let reason = "no_overlay_for_document";
    if (documentIds.length === 0) reason = "no_resolved_document";
    else if (staleDocumentIds.length > 0) reason = "overlay_stale";
    return { applicable: false, reason, document_ids: documentIds, stale_document_ids: staleDocumentIds };
  }

  const queryScope = extractQueryScope(question);
  const claimIds = claimIdSet(envelope);

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
        ...buildManifestPlan(overlay, manifest, envelope.answer_intent, queryScope, claimIds, semanticStore.sectionIndex)
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

  const comparison = buildComparisonPlan(semanticStore.overlaysByDocumentId, availableDocumentIds, claimIds, semanticStore.sectionIndex);
  const applicable = manifests.length > 0 || comparison !== null;

  return {
    applicable,
    // Only set when !applicable, so a truthy `reason` is always exactly
    // the signal "no plan was built" — never present alongside real
    // manifests/comparison output. Distinct from "no_resolved_document"
    // and "no_overlay_for_document"/"overlay_stale" above: this document
    // has a working overlay, it just has no coverage_manifest and (if
    // only one document resolved, or none shares a comparison axis) no
    // comparison binding either — e.g. ich_m3_r2's overlay is
    // comparison-only and produces nothing outside a multi-document
    // comparison query.
    ...(applicable ? {} : { reason: "no_applicable_manifest_or_axis" }),
    document_ids: availableDocumentIds,
    stale_document_ids: staleDocumentIds,
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
      claim_count: (envelope.claims || []).length,
      claim_order: claimOrder(envelope)
    },
    semantic_plan: shadowPlan
  };
}

/**
 * Stage C (docs/derived_semantic_layer.md §10): "reviewed이고 hash가
 * 최신인 객체만 답변에 사용한다." Everything above (buildShadowPlan,
 * comparePlans) stays Stage B — it deliberately reports every manifest
 * regardless of review_status, because that's what a human reviewing the
 * shadow log needs to see. This is the one function real answer
 * construction is allowed to call: it reuses that exact same plan (same
 * relevance filtering, same facet-coverage math — nothing duplicated) and
 * then throws away every manifest that isn't `review_status: "reviewed"`.
 * A manifest whose overlay went stale never reaches this point at all —
 * engine/semantic_overlay_store.js already dropped it before
 * buildShadowPlan ever saw it.
 *
 * Returns null (not an empty object) when there's nothing reviewed to
 * show, so a caller can treat "no semantic_coverage field" and "field is
 * present but empty" as the same thing — never render an empty box.
 */
function buildReviewedSemanticCoverage(question, envelope, options) {
  const shadowPlan = buildShadowPlan(question, envelope, options);
  if (!shadowPlan.applicable) return null;

  const manifests = (shadowPlan.manifests || []).filter((manifest) => manifest.review_status === "reviewed");

  // Same reviewed-only filter applied per binding, then an axis is only
  // kept if at least two distinct documents still have a reviewed binding
  // on it afterward — a comparison row needs two reviewed sides to mean
  // anything, same as buildComparisonPlan's own >=2-documents rule above.
  const comparison = (shadowPlan.comparison || [])
    .map((axis) => ({
      axis_id: axis.axis_id,
      bindings: (axis.bindings || []).filter((binding) => binding.review_status === "reviewed")
    }))
    .filter((axis) => new Set(axis.bindings.map((binding) => binding.document_id)).size >= 2)
    .map((axis) => ({
      axis_id: axis.axis_id,
      bindings: axis.bindings,
      both_sides_evidenced: new Set(
        axis.bindings.filter((binding) => binding.coverage.status !== "missing").map((binding) => binding.document_id)
      ).size >= 2
    }));

  if (manifests.length === 0 && comparison.length === 0) return null;
  return { manifests, comparison };
}

module.exports = { buildShadowPlan, comparePlans, buildReviewedSemanticCoverage, defaultStore };
