const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const { validateBindingFiles, buildSlotIndex } = require("../validation/validate_bindings");

function tempBindingsDir() {
  const dir = path.join(os.tmpdir(), `condition_bindings_test_${Date.now()}_${Math.random().toString(36).slice(2)}`);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function writeBindingFile(dir, name, doc) {
  const file = path.join(dir, name);
  fs.writeFileSync(file, JSON.stringify(doc), "utf8");
  return file;
}

// Synthetic archive index — a Map with the same shape as engine/data_store's
// index.conditions, so tests don't depend on the live archive's exact content.
function fakeIndex(conditions) {
  const map = new Map();
  for (const c of conditions) map.set(c.condition_id, c);
  return { conditions: map };
}

const REAL_SLOTS = buildSlotIndex();

function validBindable(overrides = {}) {
  return {
    binding_id: "test.bind.001",
    condition_id: "test.cond.001",
    bindability: "bindable",
    non_bindable_reason: null,
    binding_role: "partial_scope",
    predicate: { all_of: [{ slot: "relevant_species_availability", operator: "equals", value: "two_rodent_and_nonrodent" }] },
    evidence_span: "two relevant species",
    verification_status: "verified",
    ...overrides
  };
}

const CONDITION = { condition_id: "test.cond.001", condition_text: "If there are two relevant species, do X." };

test("a fully valid bindable binding passes all gates", () => {
  const dir = tempBindingsDir();
  try {
    const file = writeBindingFile(dir, "a.json", { document_id: "test_doc", bindings: [validBindable()] });
    const result = validateBindingFiles([file], { index: fakeIndex([CONDITION]), slotById: REAL_SLOTS });
    assert.equal(result.ok, true, JSON.stringify(result.errors));
    assert.equal(result.bindingCount, 1);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("a valid non_bindable binding passes (predicate/binding_role null, reason set)", () => {
  const dir = tempBindingsDir();
  try {
    const doc = {
      document_id: "test_doc",
      bindings: [
        {
          binding_id: "test.bind.002",
          condition_id: "test.cond.001",
          bindability: "non_bindable",
          non_bindable_reason: "epistemic_hedge",
          binding_role: null,
          predicate: null,
          evidence_span: "there are",
          verification_status: "needs_review"
        }
      ]
    };
    const file = writeBindingFile(dir, "a.json", doc);
    const result = validateBindingFiles([file], { index: fakeIndex([CONDITION]), slotById: REAL_SLOTS });
    assert.equal(result.ok, true, JSON.stringify(result.errors));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("schema rejects a bindable binding with a non-null non_bindable_reason", () => {
  const dir = tempBindingsDir();
  try {
    const file = writeBindingFile(dir, "a.json", {
      document_id: "test_doc",
      bindings: [validBindable({ non_bindable_reason: "epistemic_hedge" })]
    });
    const result = validateBindingFiles([file], { index: fakeIndex([CONDITION]), slotById: REAL_SLOTS });
    assert.equal(result.ok, false);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("schema rejects a non_bindable binding with a non-null predicate", () => {
  const dir = tempBindingsDir();
  try {
    const file = writeBindingFile(dir, "a.json", {
      document_id: "test_doc",
      bindings: [
        {
          binding_id: "test.bind.003",
          condition_id: "test.cond.001",
          bindability: "non_bindable",
          non_bindable_reason: "discourse_marker",
          binding_role: null,
          predicate: { all_of: [{ slot: "relevant_species_availability", operator: "equals", value: "one" }] },
          evidence_span: "there are",
          verification_status: "needs_review"
        }
      ]
    });
    const result = validateBindingFiles([file], { index: fakeIndex([CONDITION]), slotById: REAL_SLOTS });
    assert.equal(result.ok, false);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("schema rejects a bindable binding missing binding_role", () => {
  const dir = tempBindingsDir();
  try {
    const file = writeBindingFile(dir, "a.json", {
      document_id: "test_doc",
      bindings: [validBindable({ binding_role: null })]
    });
    const result = validateBindingFiles([file], { index: fakeIndex([CONDITION]), slotById: REAL_SLOTS });
    assert.equal(result.ok, false);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("referential check rejects a condition_id that does not exist in the archive", () => {
  const dir = tempBindingsDir();
  try {
    const file = writeBindingFile(dir, "a.json", {
      document_id: "test_doc",
      bindings: [validBindable({ condition_id: "does.not.exist" })]
    });
    const result = validateBindingFiles([file], { index: fakeIndex([CONDITION]), slotById: REAL_SLOTS });
    assert.equal(result.ok, false);
    assert.ok(result.errors.some((e) => e.includes("does not exist in the archive")));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("referential check rejects an evidence_span that is not a verbatim substring of condition_text", () => {
  const dir = tempBindingsDir();
  try {
    const file = writeBindingFile(dir, "a.json", {
      document_id: "test_doc",
      bindings: [validBindable({ evidence_span: "text that is not in the condition" })]
    });
    const result = validateBindingFiles([file], { index: fakeIndex([CONDITION]), slotById: REAL_SLOTS });
    assert.equal(result.ok, false);
    assert.ok(result.errors.some((e) => e.includes("verbatim substring")));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("referential check rejects a predicate slot that is not a declared RegulatoryContext slot", () => {
  const dir = tempBindingsDir();
  try {
    const file = writeBindingFile(dir, "a.json", {
      document_id: "test_doc",
      bindings: [
        validBindable({
          predicate: { all_of: [{ slot: "made_up_slot", operator: "equals", value: "x" }] }
        })
      ]
    });
    const result = validateBindingFiles([file], { index: fakeIndex([CONDITION]), slotById: REAL_SLOTS });
    assert.equal(result.ok, false);
    assert.ok(result.errors.some((e) => e.includes("unknown slot")));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("referential check rejects a predicate value outside the slot's declared values", () => {
  const dir = tempBindingsDir();
  try {
    const file = writeBindingFile(dir, "a.json", {
      document_id: "test_doc",
      bindings: [
        validBindable({
          predicate: { all_of: [{ slot: "relevant_species_availability", operator: "equals", value: "three_species" }] }
        })
      ]
    });
    const result = validateBindingFiles([file], { index: fakeIndex([CONDITION]), slotById: REAL_SLOTS });
    assert.equal(result.ok, false);
    assert.ok(result.errors.some((e) => e.includes("is not in slot")));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("rejects duplicate binding_id across two files", () => {
  const dir = tempBindingsDir();
  try {
    const fileA = writeBindingFile(dir, "a.json", { document_id: "test_doc", bindings: [validBindable()] });
    const fileB = writeBindingFile(dir, "b.json", { document_id: "test_doc", bindings: [validBindable()] });
    const result = validateBindingFiles([fileA, fileB], { index: fakeIndex([CONDITION]), slotById: REAL_SLOTS });
    assert.equal(result.ok, false);
    assert.ok(result.errors.some((e) => e.includes("duplicate binding_id")));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("bindable requires a non-null predicate", () => {
  const dir = tempBindingsDir();
  try {
    const file = writeBindingFile(dir, "a.json", { document_id: "test_doc", bindings: [validBindable({ predicate: null })] });
    const result = validateBindingFiles([file], { index: fakeIndex([CONDITION]), slotById: REAL_SLOTS });
    assert.equal(result.ok, false);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
