/**
 * `npm run applicability` — the scripted entry point for the Applicability
 * Engine (Applicability Layer 0.1.0, docs/schema.md, docs/milestone_log.md
 * M6). Two subcommands, matching the plan's explicit propose/confirm
 * separation:
 *
 *   node engine/applicability_cli.js propose "<question text>"
 *     Prints an LLM-*proposed* RegulatoryContext candidate as JSON. This
 *     is never applied automatically — save it to a file, review and edit
 *     it, then pass that file to `evaluate --context`. Requires an LLM
 *     provider (.env); with none configured, prints an empty proposal
 *     rather than fabricating one (engine/regulatory_context.js
 *     proposeContext's fail-closed behavior).
 *
 *   node engine/applicability_cli.js evaluate --context <file> --rules <id1,id2,...>
 *     Loads and validates the RegulatoryContext file (createContext() —
 *     fails fast on any unknown slot or out-of-vocabulary value), then
 *     prints each rule's ApplicabilityFinding: verdict, conditional_reason,
 *     every condition's own outcome with its verbatim condition_text and
 *     citation, unresolved_slots, and scope_basis. No LLM call happens
 *     here — every judgment was already made offline by
 *     engine/binding_agent.js and is frozen into data/derived/
 *     condition_bindings/.
 */

const fs = require("fs");

const { loadStore } = require("./data_store");
const { evaluateRule } = require("./applicability");
const { createContext, proposeContext } = require("./regulatory_context");
const { createClient, availableProviders } = require("./llm_client");

function formatCitation(citation) {
  if (!citation) return "(citation unavailable)";
  const page = citation.printed_page_label ? `p.${citation.printed_page_label}` : `pdf page ${citation.pdf_page_index_zero_based}`;
  return `${citation.guideline_code || citation.document_id} §${citation.section_number || "?"}, ${page} [${citation.source_unit_id}]`;
}

function formatFinding(finding) {
  const lines = [];
  lines.push(`Rule ${finding.rule_id} (${finding.rule_type}, review_status=${finding.rule_review_status})`);
  lines.push(`  Verdict: ${finding.verdict}${finding.conditional_reason ? ` (${finding.conditional_reason})` : ""}`);
  lines.push(`  Citation: ${finding.citations.map(formatCitation).join("; ")}`);

  if (finding.scope_basis.exclusions_triggered.length > 0) {
    lines.push(`  Scope exclusion: ${finding.scope_basis.exclusions_triggered.map((e) => `${e.slot}=${e.value} excluded by ${finding.scope_basis.document_id}`).join("; ")}`);
  }
  if (finding.unresolved_slots.length > 0) {
    lines.push(`  Unresolved context slots: ${finding.unresolved_slots.join(", ")}`);
  }
  if (finding.basis.length === 0) {
    lines.push(`  Basis: no attached conditions.`);
  } else {
    lines.push(`  Basis:`);
    for (const b of finding.basis) {
      lines.push(`    [${b.outcome}] (${b.condition_type}) "${b.condition_text}"${b.binding_id ? ` — binding ${b.binding_id} (${b.binding_verification_status})` : ""}`);
    }
  }
  return lines.join("\n");
}

async function runPropose(question) {
  const providers = availableProviders();
  const client = providers.length > 0 ? createClient() : null;
  if (!client) {
    console.log("No LLM provider configured (see .env.example) — proposal is empty. Nothing was fabricated.");
  }
  const candidate = await proposeContext(question, { client });
  console.log("Proposed RegulatoryContext candidate (NOT applied — review, edit, and save to a file before using --context):");
  console.log(JSON.stringify(candidate, null, 2));
}

function runEvaluate({ contextFile, ruleIds }) {
  if (!contextFile) {
    console.error("evaluate requires --context <file>");
    process.exit(2);
  }
  if (ruleIds.length === 0) {
    console.error("evaluate requires --rules <id1,id2,...>");
    process.exit(2);
  }

  let context;
  try {
    context = createContext(JSON.parse(fs.readFileSync(contextFile, "utf8")));
  } catch (error) {
    console.error(`Failed to load --context ${contextFile}: ${error.message}`);
    process.exit(1);
  }

  const { index } = loadStore();
  console.log(`RegulatoryContext: ${JSON.stringify(context)}\n`);

  for (const ruleId of ruleIds) {
    try {
      const finding = evaluateRule(ruleId, context, { index });
      console.log(formatFinding(finding));
      console.log("");
    } catch (error) {
      console.error(`${ruleId}: ${error.message}`);
    }
  }
}

function parseArgs(argv) {
  const flags = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith("--")) {
      flags[argv[i].slice(2)] = argv[i + 1];
      i++;
    }
  }
  return flags;
}

async function main() {
  const [subcommand, ...rest] = process.argv.slice(2);

  if (subcommand === "propose") {
    const question = rest.join(" ");
    if (!question) {
      console.error("Usage: node engine/applicability_cli.js propose \"<question text>\"");
      process.exit(2);
    }
    await runPropose(question);
    return;
  }

  if (subcommand === "evaluate") {
    const flags = parseArgs(rest);
    const ruleIds = flags.rules ? flags.rules.split(",").map((s) => s.trim()).filter(Boolean) : [];
    runEvaluate({ contextFile: flags.context, ruleIds });
    return;
  }

  console.error(
    "Usage:\n" +
    "  node engine/applicability_cli.js propose \"<question text>\"\n" +
    "  node engine/applicability_cli.js evaluate --context <file> --rules <id1,id2,...>"
  );
  process.exit(2);
}

if (require.main === module) {
  main();
}

module.exports = { formatCitation, formatFinding, parseArgs, runEvaluate };
