const test = require("node:test");
const assert = require("node:assert/strict");

const { verifyClaim, claimTextFor, verifyRecord } = require("../engine/verification_agent");
const { loadStore } = require("../engine/data_store");

test("verifyClaim short-circuits without calling the client when claim or sourceText is missing", async () => {
  let called = false;
  const client = { complete: async () => { called = true; return { entailed: true, reason: "" }; } };
  const result = await verifyClaim({ claim: "", sourceText: "text", client });
  assert.equal(result.entailed, false);
  assert.equal(called, false, "must not call the LLM for a degenerate input");
});

test("verifyClaim sends the source text and claim to the client and returns its verdict", async () => {
  let captured = null;
  const client = {
    complete: async (args) => {
      captured = args;
      return { entailed: true, reason: "the claim restates the source text" };
    }
  };
  const result = await verifyClaim({ claim: "at least 5 replicates", sourceText: "at least 5 replicates at each QC level", client });
  assert.equal(result.entailed, true);
  assert.equal(result.reason, "the claim restates the source text");
  assert.ok(captured.schema, "must request structured (schema-constrained) output");
  assert.match(captured.messages[0].content, /at least 5 replicates at each QC level/);
});

test("claimTextFor makes the comparator's normative force explicit, not just 'parameter comparator value'", () => {
  // Bare "parameter at_least N" was verified as entailed=true against
  // source text that only described a range ("can range from as little
  // as one ... to a nearly full validation") — the model didn't read a
  // bare "at_least" as an asserted requirement. Explicit "must be..."
  // phrasing fixed it (working_docs/milestone_log.md M1); this test
  // guards the fix doesn't silently regress back to the ambiguous form.
  const { records } = loadStore();
  const qc = records.find((r) => r.type === "quantitative_criterion" && r.parameter === "replicates");
  const claim = claimTextFor(qc);
  assert.match(claim, /must be at least 5/);
  assert.match(claim, /required minimum/);
});

test("verifyRecord round-trips a real answerable record through the (mocked) verification agent", async () => {
  const { records } = loadStore();
  const qc = records.find((r) => r.type === "quantitative_criterion" && r.parameter === "replicates");
  const client = { complete: async () => ({ entailed: true, reason: "matches source_text exactly" }) };
  const result = await verifyRecord(qc, { client });
  assert.equal(result.record_id, qc.id);
  assert.equal(result.entailed, true);
});

test("a claim that adds unsupported detail is flagged not entailed (mocked adversarial case)", async () => {
  const client = {
    complete: async () => ({ entailed: false, reason: "source says 'at least 5', claim says 'exactly 10' — contradicts value" })
  };
  const result = await verifyClaim({ claim: "exactly 10 replicates required", sourceText: "at least 5 replicates at each QC level", client });
  assert.equal(result.entailed, false);
});
