const test = require("node:test");
const assert = require("node:assert/strict");

const { loadStore, buildIndex, citationFor, sourceTextFor } = require("../engine/data_store");

test("loadStore joins all pilot bundles into one index", () => {
  const { index, records } = loadStore();
  assert.equal(index.documents.size, 4, "ICH M10 + ICH S6(R1) + EMA FIH + FDA ADA");
  assert.equal(
    records.length,
    index.knowledgeRecords.size + index.quantitativeCriteria.size + index.conditions.size
  );
  assert.ok(records.length > 0);
});

test("every answerable record carries at least one resolvable citation", () => {
  const { records } = loadStore();
  for (const record of records) {
    assert.ok(record.citations.length > 0, `${record.id} has no citation`);
    for (const citation of record.citations) {
      assert.ok(citation.source_unit_id, `${record.id} citation missing source_unit_id`);
      assert.ok(citation.guideline_code, `${record.id} citation missing guideline_code`);
    }
  }
});

test("citationFor resolves page trace fields from the real M10 3.2.5.2 pilot", () => {
  const { index } = loadStore();
  const citation = citationFor(index, "ich_m10.su.3_2_5_2.003");
  assert.equal(citation.printed_page_label, "14");
  assert.equal(citation.pdf_page_index_zero_based, 13);
  assert.equal(citation.guideline_code, "M10");
  assert.equal(citation.section_number, "3.2.5.2");
});

test("citationFor returns null for an unknown source_unit_id", () => {
  const { index } = loadStore();
  assert.equal(citationFor(index, "does.not.exist"), null);
});

test("buildIndex handles an empty bundle set", () => {
  const index = buildIndex([]);
  assert.equal(index.documents.size, 0);
  assert.equal(index.knowledgeRecords.size, 0);
});

test("sourceTextFor orders multiple source units by unit_order", () => {
  const { index } = loadStore();
  const ids = ["ich_m10.su.6_1.003", "ich_m10.su.6_1.002"]; // deliberately out of order
  const text = sourceTextFor(index, ids);
  const su2 = index.sourceUnits.get("ich_m10.su.6_1.002").source_text;
  assert.ok(text.startsWith(su2.slice(0, 20)), "unit_order 2 should come before unit_order 3");
});
