const test = require("node:test");
const assert = require("node:assert/strict");

const { auditKnowledgeNormalization, barePredicateRisk, missingNumericTokens } = require("../scripts/audit_ko_normalization");
const { numericTokensPreserved, parseArgs } = require("../scripts/normalize_ko_knowledge_records");

test("barePredicateRisk distinguishes a dropped subject from a valid short Korean proposition", () => {
  assert.equal(barePredicateRisk("\uc801\uc6a9\ud55c\ub2e4."), true);
  assert.equal(barePredicateRisk("\ud574\uc57c \ud55c\ub2e4."), true);
  assert.equal(barePredicateRisk("\uc124\uce58\ub958\uac00 \uc120\ud638\ub41c\ub2e4."), false);
});

test("missingNumericTokens catches a changed atomic numeric value", () => {
  const record = { subject: "At least 50%", action: "should remain", object: "within \u00b115%", original_modal_text: "should" };
  assert.deepEqual(missingNumericTokens({ ...record, normalized_ko: "\ucd5c\uc18c 50%\ub294 \u00b120% \uc774\ub0b4\uc5ec\uc57c \ud55c\ub2e4." }), ["\u00b115"]);
});

test("normalization preflight preserves signed numeric tokens and validates batch bounds", () => {
  const target = { subject: "QC", action: "should be", object: "within \u00b115%" };
  assert.equal(numericTokensPreserved(target, "QC\ub294 \u00b115% \uc774\ub0b4\uc5ec\uc57c \ud55c\ub2e4."), true);
  assert.equal(numericTokensPreserved(target, "QC\ub294 \u00b120% \uc774\ub0b4\uc5ec\uc57c \ud55c\ub2e4."), false);
  assert.equal(parseArgs(["--document", "ich_m10", "--batch-size", "20"]).batchSize, 20);
  assert.throws(() => parseArgs(["--document", "ich_m10", "--batch-size", "21"]), /1\.\.20/);
});

test("all committed KnowledgeRecord normalizations have fresh reviewed attestations and no critical risk flags", () => {
  const result = auditKnowledgeNormalization();
  assert.equal(result.ok, true, JSON.stringify(result.issues.slice(0, 10), null, 2));
  assert.equal(result.documents.reduce((sum, document) => sum + document.total, 0), 1495);
  assert.equal(result.documents.reduce((sum, document) => sum + document.reviewed, 0), 1495);
});
