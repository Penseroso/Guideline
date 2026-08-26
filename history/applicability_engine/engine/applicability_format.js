/**
 * Presentation helpers for an ApplicabilityFinding (engine/applicability.js
 * evaluateRule() output) — shared by engine/cli.js (the ":applicable" REPL
 * command) and engine/applicability_cli.js (the scripted `evaluate`
 * subcommand) so the two entry points render findings identically.
 */

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

function truncate(text, maxLength) {
  return text.length > maxLength ? `${text.slice(0, maxLength)}...` : text;
}

module.exports = { formatCitation, formatFinding, truncate };
