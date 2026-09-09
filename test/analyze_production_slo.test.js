const test = require("node:test");
const assert = require("node:assert/strict");

const { claimGroundingRate, retrievalGrounded, answerabilityMatch, checkAgainstSlo, SLO_TARGETS } = require("../scripts/analyze_production_slo");

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
