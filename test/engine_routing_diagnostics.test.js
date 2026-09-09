const test = require("node:test");
const assert = require("node:assert/strict");

// Response Intelligence Workstream 3: structuredQuery/selectReviewedRoutingManifest
// abstain silently today (return null with no observable reason). These tests
// confirm the additive, non-behavior-changing telemetry events added so
// Workstream 3's taxonomy audit can classify real routing failures instead of
// re-reading code per question. None of these tests assert on match/return
// values changing — only that the right diagnostic event is recorded.

const { loadStore } = require("../engine/data_store");
const { structuredQuery, tryListCompositeQuery } = require("../engine/query_router");
const { selectReviewedRoutingManifest } = require("../engine/semantic_routing");
const { createAnswerTelemetry } = require("../engine/answer_telemetry");

const { records } = loadStore();

function eventNames(telemetry) {
  return telemetry.events.map((e) => e.event);
}

test("structuredQuery on a real no-evidence question records routing_ambiguous_tie (the real archive's near-duplicate sibling QCs tie, not a below-floor miss)", () => {
  const telemetry = createAnswerTelemetry();
  const match = structuredQuery("unknown ambiguous non-existing random protocol", records, null, { telemetry });
  assert.equal(match, null);
  assert.ok(eventNames(telemetry).includes("routing_ambiguous_tie"));
});

test("structuredQuery records routing_below_confidence_floor when only a single-token, sub-threshold match exists", () => {
  const weak = [{
    id: "test.kr.weak",
    type: "knowledge_record",
    document_id: "doc_weak",
    section_id: "doc_weak.sec.1",
    source_unit_ids: ["su_weak"],
    source_text: "xenial otters gather quietly near the reservoir"
  }];
  const telemetry = createAnswerTelemetry();
  const match = structuredQuery("xenial quokka marmalade", weak, null, { telemetry });
  assert.equal(match, null);
  const event = telemetry.events.find((e) => e.event === "routing_below_confidence_floor");
  assert.ok(event, "expected a routing_below_confidence_floor diagnostic event");
  assert.equal(event.best_sub_floor_document_id, "doc_weak");
});

test("structuredQuery abstains on a genuine ambiguous tie between two unrelated records and records routing_ambiguous_tie", () => {
  const twins = [
    {
      id: "test.kr.a",
      type: "knowledge_record",
      document_id: "doc_a",
      section_id: "doc_a.sec.1",
      source_unit_ids: ["su_a"],
      source_text: "purple lighthouse keepers photograph seventeen wandering pelicans"
    },
    {
      id: "test.kr.b",
      type: "knowledge_record",
      document_id: "doc_b",
      section_id: "doc_b.sec.1",
      source_unit_ids: ["su_b"],
      source_text: "purple lighthouse keepers photograph seventeen wandering pelicans"
    }
  ];
  const telemetry = createAnswerTelemetry();
  const match = structuredQuery("purple lighthouse keepers photograph seventeen wandering pelicans", twins, null, { telemetry });
  assert.equal(match, null, "an unresolved tie between different documents must abstain, not pick arbitrarily");
  const tieEvent = telemetry.events.find((e) => e.event === "routing_ambiguous_tie");
  assert.ok(tieEvent, "expected a routing_ambiguous_tie diagnostic event");
  assert.deepEqual(tieEvent.tied_document_ids.sort(), ["doc_a", "doc_b"]);
  assert.deepEqual(tieEvent.tied_record_ids.sort(), ["test.kr.a", "test.kr.b"]);
});

test("a broad question with only one scoring candidate cascades through coverage-threshold, manifest-no-candidate, and broad-no-composite events", () => {
  const lone = {
    id: "test.kr.lone",
    type: "knowledge_record",
    document_id: "doc_solo",
    section_id: "doc_solo.sec.1",
    source_unit_ids: ["su_solo"],
    source_text: "crimson accordion festival organizers rehearse quietly downstream"
  };
  const telemetry = createAnswerTelemetry();
  const match = structuredQuery("crimson accordion festival organizers rehearse quietly downstream 항목", [lone], null, { telemetry });
  assert.equal(match, null);
  const names = eventNames(telemetry);
  assert.ok(names.includes("routing_coverage_composite_below_threshold"), names.join(","));
  assert.ok(names.includes("manifest_no_eligible_candidate"), names.join(","));
  assert.ok(names.includes("routing_broad_no_composite"), names.join(","));
});

test("tryListCompositeQuery abstains on a near-tied list bundle across two different sections and records routing_list_ambiguous_tie", () => {
  const scored = [
    { record: { id: "a1", section_id: "sec.top", source_text: "alpha text one" }, score: 5.0, matchedCount: 3 },
    { record: { id: "a2", section_id: "sec.top", source_text: "alpha text two" }, score: 5.0, matchedCount: 3 },
    { record: { id: "b1", section_id: "sec.second", source_text: "beta text one" }, score: 5.0, matchedCount: 3 },
    { record: { id: "b2", section_id: "sec.second", source_text: "beta text two" }, score: 4.5, matchedCount: 2 }
  ];
  const telemetry = createAnswerTelemetry();
  const result = tryListCompositeQuery(scored, new Set(), "list requirements test", telemetry);
  assert.equal(result, null);
  const tieEvent = telemetry.events.find((e) => e.event === "routing_list_ambiguous_tie");
  assert.ok(tieEvent, "expected a routing_list_ambiguous_tie diagnostic event");
});

function documentTargetOverlay(documentId, recordId) {
  return {
    document_id: documentId,
    facets: [{
      facet_id: `${documentId}.f1`,
      review_status: "reviewed",
      coverage_basis: "declared_members",
      member_record_ids: [recordId]
    }],
    coverage_manifests: [{
      manifest_id: `${documentId}.sem.manifest.overview`,
      review_status: "reviewed",
      target: { type: "document", id: documentId },
      answer_intent: "document_overview",
      coverage_groups: [{ display_order: 1, facet_ids: [`${documentId}.f1`] }]
    }]
  };
}

function syntheticSemanticStore(documentIds) {
  return {
    overlaysByDocumentId: new Map(documentIds.map((id) => [id, documentTargetOverlay(id, "rec1")])),
    archive: { recordsById: new Map([["rec1", { id: "rec1" }]]), sectionsById: new Map() },
    sectionIndex: { childrenBySectionId: new Map(), recordIdsBySectionId: new Map() }
  };
}

test("selectReviewedRoutingManifest records manifest_no_eligible_candidate when no manifest survives the document gate", () => {
  const telemetry = createAnswerTelemetry();
  const result = selectReviewedRoutingManifest("document overview test", {
    requestedDocumentIds: new Set(["doc_other"]),
    intent: { kind: "document_overview", breadth: "broad", documentOverview: true },
    queryScope: {},
    scored: [],
    store: syntheticSemanticStore(["doc1"]),
    telemetry
  });
  assert.equal(result, null);
  const event = telemetry.events.find((e) => e.event === "manifest_no_eligible_candidate");
  assert.ok(event);
  assert.equal(event.eligible_manifest_count, 1);
});

test("selectReviewedRoutingManifest abstains and records manifest_ambiguous_tie when two document-target manifests tie exactly", () => {
  const telemetry = createAnswerTelemetry();
  const result = selectReviewedRoutingManifest("document overview test", {
    requestedDocumentIds: new Set(["doc1", "doc2"]),
    intent: { kind: "document_overview", breadth: "broad", documentOverview: true },
    queryScope: {},
    scored: [],
    store: syntheticSemanticStore(["doc1", "doc2"]),
    telemetry
  });
  assert.equal(result, null, "an unresolved tie between two document-target manifests must abstain");
  const event = telemetry.events.find((e) => e.event === "manifest_ambiguous_tie");
  assert.ok(event, "expected a manifest_ambiguous_tie diagnostic event");
  assert.deepEqual(event.tied_manifest_ids.sort(), ["doc1.sem.manifest.overview", "doc2.sem.manifest.overview"]);
});
