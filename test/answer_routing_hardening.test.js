const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const { loadStore } = require("../engine/data_store");
const { answerEnvelope } = require("../engine/answer_envelope");
const { structuredQuery } = require("../engine/query_router");
const { loadSemanticOverlayStore } = require("../engine/semantic_overlay_store");
const { reviewedRoutingEligibility, selectReviewedRoutingManifest } = require("../engine/semantic_routing");
const { runAudit } = require("../scripts/audit_answer_routing_hardening");

const { records, index } = loadStore();

test("current production inventory has 55 reviewed, fresh, evidence-bearing routing manifests", () => {
  const store = loadSemanticOverlayStore();
  const eligibility = reviewedRoutingEligibility(store);
  assert.equal(store.staleDocumentIds.size, 0);
  assert.equal(eligibility.eligible.length, 55);
  assert.equal(eligibility.ineligible.length, 0);
});

test("deterministic established cases match the pre-Workstream-1 production baseline", async () => {
  const baseline = JSON.parse(fs.readFileSync(path.join(__dirname, "fixtures", "pre_workstream_1_production_baseline.json"), "utf8"));
  const design = fs.readFileSync(path.join(__dirname, "..", "docs", "answer_suitability_evaluation.md"), "utf8");
  const questions = new Map([...design.matchAll(/^\| (Q\d{2}) \| [A-Z0-9]+ \| (.*?) \|/gm)].map((match) => [match[1], match[2]]));
  assert.equal(baseline.baseline_id, "pre_workstream_1_production_baseline");
  assert.equal(baseline.cases.length, 16);
  for (const expected of baseline.cases.filter((item) => item.route === "structured")) {
    const envelope = await answerEnvelope(questions.get(expected.id), records, { index });
    const claimIds = envelope.claims.map((claim) => claim.record.id).sort();
    const hash = crypto.createHash("sha256").update(claimIds.join("\n")).digest("hex");
    assert.equal(envelope.route, expected.route, expected.id);
    assert.equal(envelope.mode, expected.mode, expected.id);
    assert.equal(claimIds.length, expected.claim_count, expected.id);
    assert.equal(hash, expected.claim_set_sha256, expected.id);
  }
});

test("all 220 eligible manifest probes stay structured, grounded, and in the intended document scope", async () => {
  const report = await runAudit();
  assert.equal(report.eligible_manifest_count, 55);
  assert.equal(report.ineligible_manifests.length, 0);
  assert.equal(report.probe_count, 220);
  assert.equal(report.passed, 220);
});

test("bare ADA in an ADC species question is a topic, not an FDA document hard gate", async () => {
  const envelope = await answerEnvelope("ADC에서 ADA 확인하기 위해서 어떤 동물종을 사용해야 하는지?", records, { index });
  assert.equal(envelope.route, "structured");
  assert.deepEqual([...new Set(envelope.claims.map((claim) => claim.record.document_id))], ["ich_s6_r1"]);
  assert.ok(envelope.claims.some((claim) => claim.record.id === "ich_s6_r1.kr.part2.2_1.014"));
});

// Real defect (retrieval-scope-correctness follow-up, fifty_q_Q11): "ADA
// 평가는 보통 어떤 흐름으로 시작해?" has no competing target_topic/assay/
// molecule ontology signal, yet used to structurally route to ich_s6_r1
// (an unrelated document) via a generic-keyword collision -- two Korean-
// synonym-expanded words ("evaluation"/"assessment") happened to double-
// match an unrelated section heading there, outscoring fda_ada's own
// document-identity match. Fixed at document resolution, before any
// record-level scoring: resolveRequestedDocumentIds now also treats bare
// "ADA" as naming the ADA document family when no OTHER ontology scope
// (extractQueryScope) claims the question instead -- reusing the exact
// signal that already protects the ADC/species-selection case above, not
// a new mechanism.
test("bare ADA with no competing ontology scope resolves to the ADA document family, not an unrelated document via keyword collision", async () => {
  const envelope = await answerEnvelope("ADA 평가는 보통 어떤 흐름으로 시작해?", records, { index });
  assert.equal(envelope.route, "structured");
  assert.deepEqual([...new Set(envelope.claims.map((claim) => claim.record.document_id))], ["fda_ada"]);
});

// The same fix must not disable the existing, deliberate cross-document
// topic_overview participation rule (tryCoverageCompositeQuery) for a
// genuine multi-document family identity: bare "ADA" now resolves
// requestedDocumentIds to {fda_ada, fda_ada_2014} (size 2), which is a
// family, not a single explicit document -- the "explicit identity is a
// hard single-document gate" protection must only apply to an actual
// single document. Found live as a second-order regression while fixing
// Q11 above: fifty_q_Q25's real, legitimate two-document answer
// (fda_ada + fda_ada_2014, both independently grounded) collapsed to
// fda_ada only until this was also fixed.
test("a resolved multi-document family identity still allows genuine cross-document topic_overview participation", async () => {
  const envelope = await answerEnvelope("ADA가 생기면 임상적으로 어떤 영향을 볼 수 있어?", records, { index });
  assert.equal(envelope.route, "structured");
  assert.deepEqual([...new Set(envelope.claims.map((claim) => claim.record.document_id))].sort(), ["fda_ada", "fda_ada_2014"]);
});

// Real defect (retrieval-scope-correctness follow-up, fifty_q_Q22):
// within the correctly-resolved ADA document family (Q11's fix above),
// tryCoverageCompositeQuery's document ranking still picked fda_ada over
// the expected fda_ada_2014. Both tie on bestScore, and the tie-break
// (aggregate, a flat sum of the top 8 deduped records' scores) favored
// fda_ada purely because its 8 top records all sit in the SAME section
// (§VII.A) -- many records about one narrow point -- while
// fda_ada_2014's spanned 5 different sections including the one genuinely
// correct record ("Pre-treatment baseline samples... Scheduled serial
// sampling..."). Fixed by making `aggregate` section-deduped (best score
// per distinct section, not a flat sum), so it reflects how many
// DISTINCT points a document makes rather than how many records restate
// the same one -- a volume/specificity conflation, not a document-
// identity problem, so it needed a different fix than Q11's.
test("document ranking prefers the more topically-distributed document over one with many records about a single narrow point", async () => {
  const envelope = await answerEnvelope("면역원성 샘플은 baseline부터 언제 채취해야 해?", records, { index });
  assert.equal(envelope.route, "structured");
  assert.deepEqual([...new Set(envelope.claims.map((claim) => claim.record.document_id))], ["fda_ada_2014"]);
  assert.ok(envelope.claims.some((claim) => claim.record.id === "fda_ada_2014.kr.4.001"));
});

test("manifest routing is invariant to record order and unrelated candidate volume", () => {
  const question = "ICH M10 §3 CHROMATOGRAPHY 설명해줘.";
  const baseline = structuredQuery(question, records, index);
  const unrelated = records.filter((record) => record.document_id !== "ich_m10").slice(0, 100)
    .map((record, i) => ({ ...record, id: `synthetic.unrelated.${i}` }));
  const perturbed = structuredQuery(question, [...records].reverse().concat(unrelated), index);
  assert.ok(baseline && perturbed);
  assert.equal(baseline.routingManifestId, "ich_m10.sem.manifest.section_3_chromatography");
  assert.equal(perturbed.routingManifestId, baseline.routingManifestId);
  assert.deepEqual(new Set(perturbed.scope.section_ids), new Set(baseline.scope.section_ids));
  assert.deepEqual(new Set(perturbed.groundedRoutingFacetIds), new Set(baseline.groundedRoutingFacetIds));
});

test("one grounded facet may produce a partial structured answer only when every uncovered facet is disclosed", async () => {
  const oneFacetRecord = records.find((record) => record.id === "ich_m10.kr.3_1.001");
  const envelope = await answerEnvelope("ICH M10 §3 CHROMATOGRAPHY 설명해줘.", [oneFacetRecord], { index });
  assert.equal(envelope.route, "structured");
  assert.equal(envelope.mode, "section_overview");
  const manifest = envelope.semantic_coverage.manifests
    .find((item) => item.manifest_id === "ich_m10.sem.manifest.section_3_chromatography");
  assert.ok(manifest);
  const facets = manifest.groups.flatMap((group) => group.facets);
  assert.equal(facets.length, 3);
  assert.ok(facets.some((facet) => facet.effective && facet.effective.covered > 0));
  assert.ok(facets.some((facet) => facet.status === "missing"));
});

test("a broad target with no facet-grounded record abstains instead of using an incidental detail hit", () => {
  const unrelated = records.find((record) => record.document_id === "ich_m10" && record.section_id === "ich_m10.sec.8_1");
  assert.ok(unrelated);
  assert.equal(structuredQuery("ICH M10 §3 CHROMATOGRAPHY 설명해줘.", [unrelated], index), null);
});

test("equal semantic targets with the same title remain ambiguous without section or parent context", () => {
  const selection = selectReviewedRoutingManifest("ICH M10 Accuracy and Precision 설명해줘.", {
    requestedDocumentIds: new Set(["ich_m10"]),
    intent: { kind: "detail", breadth: "detail" },
    queryScope: {},
    scored: []
  });
  assert.equal(selection, null);
});

test("unreviewed and stale manifests never participate in semantic routing", () => {
  const original = loadSemanticOverlayStore();
  const unreviewedStore = { ...original, overlaysByDocumentId: new Map(original.overlaysByDocumentId) };
  const overlay = original.overlaysByDocumentId.get("ich_m10");
  unreviewedStore.overlaysByDocumentId.set("ich_m10", {
    ...overlay,
    coverage_manifests: overlay.coverage_manifests.map((manifest) => manifest.manifest_id === "ich_m10.sem.manifest.section_3_chromatography"
      ? { ...manifest, review_status: "needs_review" }
      : manifest)
  });
  const eligibility = reviewedRoutingEligibility(unreviewedStore);
  assert.ok(eligibility.ineligible.some((entry) => entry.manifest_id === "ich_m10.sem.manifest.section_3_chromatography"));

  const staleStore = {
    ...original,
    overlaysByDocumentId: new Map([...original.overlaysByDocumentId].filter(([id]) => id !== "ich_m10")),
    staleDocumentIds: new Set([...original.staleDocumentIds, "ich_m10"])
  };
  const selection = selectReviewedRoutingManifest("ICH M10 §3 CHROMATOGRAPHY 설명해줘.", {
    requestedDocumentIds: new Set(["ich_m10"]),
    intent: { kind: "detail", breadth: "detail" },
    queryScope: {},
    scored: [],
    store: staleStore
  });
  assert.equal(selection, null);
});

test("legitimate unrelated and scope-excluded refusals remain intact", async () => {
  const unrelated = await answerEnvelope("what is the meaning of life", records, { index });
  assert.equal(unrelated.route, "refusal");
  const excluded = await answerEnvelope("저분자 화합물의 독성 시험에서 종 선택 기준은?", records, { index });
  assert.equal(excluded.route, "refusal");
  assert.equal(excluded.refusal.kind, "scope_excluded");
});
