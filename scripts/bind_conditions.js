/**
 * Runs the automated binding pipeline (engine/binding_agent.js) over a
 * slice of a document's Conditions and writes the result to
 * data/derived/condition_bindings/<document_id>.json (Applicability
 * Layer 0.1.0, docs/schema.md, docs/milestone_log.md M6).
 *
 * Usage:
 *   node scripts/bind_conditions.js <document_id> [section_number ...]
 *
 * With no section_number arguments, binds every Condition in the
 * document (used for the ICH S6(R1) slice — the whole 30-condition
 * bundle). With one or more section_number arguments, binds only
 * Conditions whose own SourceUnit resolves to one of those sections
 * (used for the EMA FIH and FDA ADA slices, which only cover specific
 * sections of much larger bundles).
 *
 * Sequential (not parallel) LLM calls, to stay well under rate limits
 * and keep failures attributable to one condition at a time — this is
 * a one-off spike ingestion script, not a production hot path.
 */

const fs = require("fs");
const path = require("path");

const { loadBundles, buildIndex } = require("../engine/data_store");
const { createClient } = require("../engine/llm_client");
const { proposeAndVerifyBinding } = require("../engine/binding_agent");

const ROOT = path.resolve(__dirname, "..");
const OUT_DIR = path.join(ROOT, "data", "derived", "condition_bindings");

function sectionNumberFor(index, condition) {
  const su = index.sourceUnits.get(condition.source_unit_id);
  if (!su) return null;
  const section = index.sections.get(su.section_id);
  return section ? section.section_number : null;
}

function selectConditions(index, documentId, sectionFilter) {
  const selected = [];
  for (const c of index.conditions.values()) {
    if (!c.condition_id.startsWith(`${documentId}.`)) continue;
    if (sectionFilter.length > 0) {
      const sectionNumber = sectionNumberFor(index, c);
      if (!sectionFilter.includes(sectionNumber)) continue;
    }
    selected.push(c);
  }
  return selected;
}

/**
 * "Other conditions attached to the same rule" for the full_scope gate
 * (engine/binding_agent.js checkFullScopeGate) — any other Condition in
 * the same document sharing at least one applies_to_ids target with this
 * one. Searches the whole document, not just the selected slice, since a
 * sibling condition on the same rule could sit just outside the slice.
 */
function siblingConditionTextsFor(condition, allConditionsInDocument) {
  const targets = new Set(condition.applies_to_ids || []);
  if (targets.size === 0) return [];
  return allConditionsInDocument
    .filter((other) => other.condition_id !== condition.condition_id)
    .filter((other) => (other.applies_to_ids || []).some((id) => targets.has(id)))
    .map((other) => other.condition_text);
}

async function main() {
  const [documentId, ...sectionFilter] = process.argv.slice(2);
  if (!documentId) {
    console.error("Usage: node scripts/bind_conditions.js <document_id> [section_number ...]");
    process.exit(2);
  }

  const bundles = loadBundles();
  const index = buildIndex(bundles);

  const allConditionsInDocument = [...index.conditions.values()].filter((c) => c.condition_id.startsWith(`${documentId}.`));
  const conditions = selectConditions(index, documentId, sectionFilter);

  if (conditions.length === 0) {
    console.error(`No conditions found for document_id="${documentId}"${sectionFilter.length ? ` sections=${sectionFilter.join(",")}` : ""}.`);
    process.exit(1);
  }

  console.log(`Binding ${conditions.length} condition(s) for ${documentId}${sectionFilter.length ? ` (sections: ${sectionFilter.join(", ")})` : " (whole document)"}...`);

  const client = createClient();
  const bindings = [];
  const failures = [];

  for (const [i, condition] of conditions.entries()) {
    const hasTargetRule = (condition.applies_to_ids || []).length > 0;
    const siblingConditionTexts = siblingConditionTextsFor(condition, allConditionsInDocument);

    process.stdout.write(`  [${i + 1}/${conditions.length}] ${condition.condition_id} ... `);
    try {
      const { binding, reasons } = await proposeAndVerifyBinding({
        condition,
        siblingConditionTexts,
        hasTargetRule,
        client
      });
      bindings.push(binding);
      console.log(`${binding.bindability}/${binding.binding_role || "-"} -> ${binding.verification_status}${reasons.length ? ` (${reasons.join("; ")})` : ""}`);
    } catch (error) {
      failures.push({ condition_id: condition.condition_id, error: error.message });
      console.log(`ERROR: ${error.message}`);
    }
  }

  fs.mkdirSync(OUT_DIR, { recursive: true });
  const outFile = path.join(OUT_DIR, `${documentId}.json`);
  fs.writeFileSync(outFile, JSON.stringify({ document_id: documentId, bindings }, null, 2) + "\n", "utf8");

  const byBindability = {};
  const byRole = {};
  const byStatus = {};
  for (const b of bindings) {
    byBindability[b.bindability] = (byBindability[b.bindability] || 0) + 1;
    byRole[b.binding_role || "null"] = (byRole[b.binding_role || "null"] || 0) + 1;
    byStatus[b.verification_status] = (byStatus[b.verification_status] || 0) + 1;
  }

  console.log(`\nWrote ${bindings.length} binding(s) to ${path.relative(ROOT, outFile)}`);
  console.log("bindability:", JSON.stringify(byBindability));
  console.log("binding_role:", JSON.stringify(byRole));
  console.log("verification_status:", JSON.stringify(byStatus));
  if (failures.length) {
    console.log(`\n${failures.length} call failure(s):`);
    for (const f of failures) console.log(`  ${f.condition_id}: ${f.error}`);
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}

module.exports = { selectConditions, siblingConditionTextsFor };
