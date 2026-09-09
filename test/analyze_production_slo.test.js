const test = require("node:test");
const assert = require("node:assert/strict");

const { claimGroundingRate, retrievalGrounded, answerabilityMatch, checkAgainstSlo, SLO_TARGETS, crossScopeSafe } = require("../scripts/analyze_production_slo");

test("claimGroundingRate is the fraction of claims whose source_unit_id resolves", () => {
  const sourceUnits = new Set(["su1", "su2"]);
  assert.equal(claimGroundingRate([{ source_unit_id: "su1" }, { source_unit_id: "su2" }], sourceUnits), 1);
  assert.equal(claimGroundingRate([{ source_unit_id: "su1" }, { source_unit_id: "unknown" }], sourceUnits), 0.5);
  assert.equal(claimGroundingRate([], sourceUnits), null);
});

test("retrievalGrounded requires every claim to resolve, not just some", () => {
  const sourceUnits = new Set(["su1"]);
  assert.equal(retrievalGrounded({ answered: true, claims: [{ source_unit_id: "su1" }] }, sourceUnits), true);
  assert.equal(retrievalGrounded({ answered: true, claims: [{ source_unit_id: "su1" }, { source_unit_id: "unknown" }] }, sourceUnits), false);
  assert.equal(retrievalGrounded({ answered: true, claims: [] }, sourceUnits), false);
  assert.equal(retrievalGrounded({ answered: false, claims: [] }, sourceUnits), null);
});

test("answerabilityMatch is skipped (null) when a question has no fixed expectation", () => {
  assert.equal(answerabilityMatch({ expect_answered: null, envelope: { answered: true } }), null);
  assert.equal(answerabilityMatch({ expect_answered: true, envelope: { answered: true } }), true);
  assert.equal(answerabilityMatch({ expect_answered: true, envelope: { answered: false } }), false);
});

// Response Intelligence Workstream 7: an earlier version of SLO_TARGETS
// rounded the real 18/19 ambiguous-type baseline to the decimal literal
// 0.9474, which is *higher* than the true 18/19 and made the very run that
// established the baseline fail its own check. This pins the fix (the
// exact fraction, not a rounded literal) so it can't silently regress.
test("checkAgainstSlo does not flag the exact measured routing_abstention_rate baseline as a breach", () => {
  const report = {
    total_questions: 1,
    overall: { latency_cost: null },
    by_type: {
      ambiguous: {
        answerability: null,
        claim_grounding_rate: null,
        retrieval_grounded_rate: null,
        routing_abstention_rate: 18 / 19
      }
    }
  };
  assert.deepEqual(checkAgainstSlo(report), []);
  assert.equal(SLO_TARGETS.min_routing_abstention_rate, 18 / 19);
});

test("checkAgainstSlo flags a real drop below the routing_abstention_rate baseline", () => {
  const report = {
    total_questions: 1,
    overall: { latency_cost: null },
    by_type: { ambiguous: { answerability: null, claim_grounding_rate: null, retrieval_grounded_rate: null, routing_abstention_rate: 17 / 19 } }
  };
  const breaches = checkAgainstSlo(report);
  assert.equal(breaches.length, 1);
  assert.match(breaches[0], /routing_abstention_rate/);
});

// Response Intelligence Workstream 7 (post-close review): routing
// abstention firing internally is not the same as the final answer being
// safe. Workstream 3 already found the real failure this closes: router
// notices an ambiguous tie, abstains, then an ordinary fallback silently
// blends claims from two unrelated documents into one answer with no
// disclosure. crossScopeSafe is the check for that specific failure, and
// -- unlike routing_abstention_rate -- its SLO target stays at the
// correct 1.0 rather than being lowered to match a baseline that still
// contains one real, unfixed instance of it.
function claim(documentId) {
  return { record: { document_id: documentId } };
}

test("crossScopeSafe does not apply to a question with no routing-abstention expectation", () => {
  assert.equal(crossScopeSafe({ expect_routing_abstention: false, envelope: { answered: true, claims: [claim("a"), claim("b")] } }), null);
});

test("crossScopeSafe treats a correct refusal as safe regardless of claims", () => {
  assert.equal(crossScopeSafe({ expect_routing_abstention: true, envelope: { answered: false, route: "refusal", claims: [] } }), true);
});

test("crossScopeSafe treats explicit comparison mode as safe even across multiple documents", () => {
  assert.equal(crossScopeSafe({ expect_routing_abstention: true, envelope: { answered: true, route: "structured", mode: "comparison", claims: [claim("a"), claim("b")] } }), true);
});

test("crossScopeSafe is safe when the final answer narrowed to a single document", () => {
  assert.equal(crossScopeSafe({ expect_routing_abstention: true, envelope: { answered: true, route: "grounded_generation", mode: "generated", claims: [claim("a"), claim("a")] } }), true);
});

test("crossScopeSafe is UNSAFE when a non-comparison answer silently blends claims from two documents -- the real Workstream 3 failure shape", () => {
  const unsafe = { expect_routing_abstention: true, envelope: { answered: true, route: "grounded_generation", mode: "generated", claims: [claim("fda_ada"), claim("ich_m10")] } };
  assert.equal(crossScopeSafe(unsafe), false);
});

test("checkAgainstSlo flags a real cross_scope_safe_rate breach and names the unsafe question ids", () => {
  const report = {
    total_questions: 1,
    overall: { latency_cost: null },
    by_type: {
      ambiguous: {
        answerability: null,
        claim_grounding_rate: null,
        retrieval_grounded_rate: null,
        routing_abstention_rate: null,
        cross_scope_safe_rate: 18 / 19,
        cross_scope_unsafe_ids: ["ws3_ambiguous_tie.days"]
      }
    }
  };
  const breaches = checkAgainstSlo(report);
  assert.equal(breaches.length, 1);
  assert.match(breaches[0], /cross_scope_safe_rate/);
  assert.match(breaches[0], /ws3_ambiguous_tie\.days/);
});
