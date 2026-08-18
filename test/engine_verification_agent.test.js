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

test("claimTextFor builds a compact claim from a quantitative_criterion record", () => {
  const { records } = loadStore();
  const qc = records.find((r) => r.type === "quantitative_criterion" && r.parameter === "replicates");
  assert.equal(claimTextFor(qc), "replicates at_least 5 replicates");
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
