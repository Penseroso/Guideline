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

test("claimTextFor asserts 'specified criterion, not illustrative' without hardcoding a must/should/may modality", () => {
  // v1 (bare "parameter at_least N") let a range-description distortion
  // through as entailed=true. v2 ("must be at least N — required
  // minimum") fixed that but then rejected genuine "should"-governed M10
  // criteria as false, because it asserted a stronger modality than the
  // source actually used — comparator (at_least/not_exceed/within) is a
  // math relationship, not a modality, and the claim must not conflate
  // them. This version (v3) must not reintroduce "must"/"required
  // minimum" wording. docs/milestone_log.md M1 has the full history.
  const { records } = loadStore();
  const qc = records.find((r) => r.type === "quantitative_criterion" && r.parameter === "replicates");
  const claim = claimTextFor(qc);
  assert.match(claim, /at least 5/);
  assert.doesNotMatch(claim, /\bmust\b/i);
  assert.doesNotMatch(claim, /required minimum/i);
  assert.match(claim, /specified criterion value/);
});

// --- claimTextFor: is_default_with_exception / is_illustrative_example
// (docs/schema.md Model 0.4.0, found live on S6(R1) 3.3) ---

test("claimTextFor asserts 'default/typical, not absolute' phrasing for is_default_with_exception", () => {
  const qc = { type: "quantitative_criterion", parameter: "relevant species count", comparator: "at_least", value: 2, value_fraction: null, unit: " species", is_default_with_exception: true };
  const claim = claimTextFor(qc);
  assert.match(claim, /normally at least 2/);
  assert.match(claim, /default\/typical value/);
  assert.doesNotMatch(claim, /not merely an illustrative example/);
});

test("claimTextFor asserts the opposite ('illustrative example, not specified') for is_illustrative_example", () => {
  const qc = { type: "quantitative_criterion", parameter: "repeated dose toxicity study duration", comparator: "not_exceed", value: 14, value_fraction: null, unit: " days", is_illustrative_example: true };
  const claim = claimTextFor(qc);
  assert.match(claim, /not exceeding 14/);
  assert.match(claim, /illustrative example/);
  assert.match(claim, /not a specified requirement/);
  assert.doesNotMatch(claim, /specified criterion value/);
});

test("claimTextFor keeps the ordinary 'specified, not illustrative' phrasing when both flags are false/absent", () => {
  const qc = { type: "quantitative_criterion", parameter: "replicates", comparator: "at_least", value: 5, value_fraction: null, unit: " replicates", is_default_with_exception: false, is_illustrative_example: false };
  const claim = claimTextFor(qc);
  assert.match(claim, /specified criterion value/);
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
