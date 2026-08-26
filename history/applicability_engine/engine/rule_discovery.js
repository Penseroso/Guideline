/**
 * Rule discovery: reuses the existing keyword search
 * (engine/vector_store.js createKeywordStore, zero LLM cost) over only the
 * KnowledgeRecord/QuantitativeCriterion records — the two types
 * engine/applicability.js's evaluateRule() actually accepts as a rule_id
 * (resolveRule). Condition entries are deliberately excluded from the
 * search space: they are evidence attached to a rule, not rules to
 * evaluate themselves.
 *
 * Shared by engine/cli.js (the ":applicable" REPL command) and
 * engine/applicability_cli.js (the scripted `evaluate --question` path) —
 * split out to a standalone module so neither has to import from the
 * other's CLI entry point.
 */

const { createKeywordStore } = require("./vector_store");

async function discoverRuleCandidates(question, records, topK = 5) {
  const ruleRecords = records.filter((r) => r.type === "knowledge_record" || r.type === "quantitative_criterion");
  const store = createKeywordStore();
  store.index(ruleRecords);
  const results = await store.search(question, topK);
  return results.map(({ record, score }) => ({
    rule_id: record.id,
    rule_type: record.type,
    score,
    source_text: record.source_text,
    citation: record.citations ? record.citations[0] : null
  }));
}

module.exports = { discoverRuleCandidates };
