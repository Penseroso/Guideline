const test = require("node:test");
const assert = require("node:assert/strict");

const {
  validateContext,
  createContext,
  matchSlotsFromText,
  proposeContext,
  regulatoryContextSlots
} = require("../engine/regulatory_context");

test("validateContext accepts an empty context", () => {
  assert.deepEqual(validateContext({}), { ok: true, errors: [] });
});

test("validateContext rejects an unknown slot key", () => {
  const result = validateContext({ made_up_slot: "x" });
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((e) => e.includes("unknown slot")));
});

test("validateContext rejects a value outside the slot's declared vocabulary", () => {
  const result = validateContext({ molecule_class: "not_a_real_value" });
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((e) => e.includes("is not declared for slot")));
});

test("validateContext accepts a real slot/value pair", () => {
  assert.deepEqual(validateContext({ molecule_class: "biotechnology" }), { ok: true, errors: [] });
});

test("createContext returns the context unchanged when valid", () => {
  const ctx = createContext({ molecule_class: "biotechnology", relevant_species_availability: "one" });
  assert.deepEqual(ctx, { molecule_class: "biotechnology", relevant_species_availability: "one" });
});

test("createContext throws on an unknown slot rather than silently dropping it", () => {
  assert.throws(() => createContext({ molecule_class: "biotechnology", bogus: "x" }), /invalid context/);
});

test("createContext throws on an out-of-vocabulary value", () => {
  assert.throws(() => createContext({ relevant_species_availability: "three" }), /invalid context/);
});

test("matchSlotsFromText matches an English phrase from context_slots.json's own match_terms", () => {
  const candidate = matchSlotsFromText("If there are two relevant species for the candidate");
  assert.equal(candidate.relevant_species_availability, "two_rodent_and_nonrodent");
});

test("matchSlotsFromText matches a Korean phrase from the same slot", () => {
  const candidate = matchSlotsFromText("건강한 자원자를 대상으로 한 시험입니다");
  assert.equal(candidate.subject_population, "healthy_volunteer");
});

test("matchSlotsFromText returns an empty object when nothing matches", () => {
  assert.deepEqual(matchSlotsFromText("completely unrelated text about lunch"), {});
});

test("matchSlotsFromText's output is a candidate, not guaranteed to pass validateContext blindly — but in practice always does, since match_terms values are drawn from the same declared vocabulary", () => {
  const candidate = matchSlotsFromText("only one relevant species is available");
  const result = validateContext(candidate);
  assert.equal(result.ok, true, JSON.stringify(result.errors));
});

test("proposeContext returns an empty object when no client is supplied (fails closed, never fabricates)", async () => {
  const candidate = await proposeContext("what about monoclonal antibodies");
  assert.deepEqual(candidate, {});
});

test("proposeContext returns an empty object when the client throws (fails closed)", async () => {
  const client = { complete: async () => { throw new Error("network error"); } };
  const candidate = await proposeContext("some question", { client });
  assert.deepEqual(candidate, {});
});

test("proposeContext only includes slots the model actually set (drops null-valued slots)", async () => {
  const allNull = Object.fromEntries(regulatoryContextSlots().map((s) => [s.slot_id, null]));
  const client = { complete: async () => ({ ...allNull, molecule_class: "biotechnology" }) };
  const candidate = await proposeContext("this is about a biologic", { client });
  assert.deepEqual(candidate, { molecule_class: "biotechnology" });
});

test("proposeContext's output always passes validateContext, since the schema constrains values to the declared enum", async () => {
  const allNull = Object.fromEntries(regulatoryContextSlots().map((s) => [s.slot_id, null]));
  const client = { complete: async () => ({ ...allNull, product_modality: "adc", development_stage: "nonclinical" }) };
  const candidate = await proposeContext("an ADC in nonclinical development", { client });
  const result = validateContext(candidate);
  assert.equal(result.ok, true, JSON.stringify(result.errors));
});
