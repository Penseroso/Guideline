const fs = require("node:fs");
const path = require("node:path");

const { createClient } = require("../engine/llm_client");
const {
  canonicalize,
  sha256,
  recordSourceText,
  summarySpecSha256
} = require("../validation/validate_semantic_overlay");

const ROOT = path.resolve(__dirname, "..");
const GUIDELINES_DIR = path.join(ROOT, "data", "guidelines");
const SEMANTIC_DIR = path.join(ROOT, "data", "derived", "semantic");
const PRESENTATION_DIR = path.join(ROOT, "data", "derived", "presentation", "ko");
const KO_DIR = path.join(ROOT, "data", "presentation", "ko");

function readJson(file) { return JSON.parse(fs.readFileSync(file, "utf8")); }

function parseArgs(argv) {
  const args = { document: null, summary: null, limit: null, force: false, dryRun: false };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--document") args.document = argv[++i];
    else if (argv[i] === "--summary") args.summary = argv[++i];
    else if (argv[i] === "--limit") args.limit = Number(argv[++i]);
    else if (argv[i] === "--force") args.force = true;
    else if (argv[i] === "--dry-run") args.dryRun = true;
  }
  if (!args.document) throw new Error("--document is required");
  if (args.limit !== null && (!Number.isInteger(args.limit) || args.limit < 1)) throw new Error("--limit must be a positive integer");
  return args;
}

function loadBundle(documentId) {
  for (const name of fs.readdirSync(GUIDELINES_DIR).filter((item) => item.endsWith(".json"))) {
    const bundle = readJson(path.join(GUIDELINES_DIR, name));
    if (bundle.documents.some((document) => document.document_id === documentId)) return bundle;
  }
  throw new Error(`Unknown document: ${documentId}`);
}

function buildArchive(bundle, koOverlay) {
  const sourceUnitsById = new Map(bundle.source_units.map((unit) => [unit.source_unit_id, unit]));
  const sectionsById = new Map(bundle.sections.map((section) => [section.section_id, section]));
  const childrenById = new Map();
  for (const section of bundle.sections) {
    if (!section.parent_section_id) continue;
    if (!childrenById.has(section.parent_section_id)) childrenById.set(section.parent_section_id, []);
    childrenById.get(section.parent_section_id).push(section.section_id);
  }
  const koById = new Map((koOverlay.entries || []).map((entry) => [entry.record_id, entry]));
  const recordsById = new Map();
  for (const record of bundle.knowledge_records) {
    recordsById.set(record.knowledge_record_id, {
      id: record.knowledge_record_id,
      kind: "knowledge_record",
      record,
      evidenceSourceUnitId: record.source_unit_ids[0],
      sectionId: sourceUnitsById.get(record.source_unit_ids[0])?.section_id,
      normalizedKo: record.normalized_ko
    });
  }
  for (const record of bundle.quantitative_criteria) {
    const ko = koById.get(record.criterion_id);
    recordsById.set(record.criterion_id, {
      id: record.criterion_id,
      kind: "quantitative_criterion",
      record,
      evidenceSourceUnitId: record.source_unit_id,
      sectionId: sourceUnitsById.get(record.source_unit_id)?.section_id,
      normalizedKo: ko && ko.normalization_status === "reviewed" ? ko.normalized_ko : null
    });
  }
  for (const record of bundle.conditions) {
    const ko = koById.get(record.condition_id);
    recordsById.set(record.condition_id, {
      id: record.condition_id,
      kind: "condition",
      record,
      evidenceSourceUnitId: record.source_unit_id,
      sectionId: sourceUnitsById.get(record.source_unit_id)?.section_id,
      normalizedKo: ko && ko.normalization_status === "reviewed" ? ko.normalized_ko : null
    });
  }
  return { sourceUnitsById, sectionsById, childrenById, recordsById };
}

function descendants(sectionId, childrenById) {
  const result = new Set([sectionId]);
  const queue = [sectionId];
  while (queue.length) {
    for (const child of childrenById.get(queue.shift()) || []) {
      if (!result.has(child)) { result.add(child); queue.push(child); }
    }
  }
  return result;
}

function sectionPath(sectionId, sectionsById) {
  const parts = [];
  let current = sectionsById.get(sectionId);
  while (current) {
    parts.unshift(`${current.section_number} ${current.title}`.trim());
    current = current.parent_section_id ? sectionsById.get(current.parent_section_id) : null;
  }
  return parts.join(" > ");
}

function recordPriority(entry) {
  if (entry.kind === "knowledge_record") {
    const modality = entry.record.modality;
    return modality === "must" ? 0 : modality === "should" || modality === "recommendation" ? 1 : 2;
  }
  if (entry.kind === "condition") return entry.record.condition_type === "exception" ? 0 : 3;
  if (entry.kind === "quantitative_criterion") return entry.record.is_default_with_exception ? 0 : 4;
  return 9;
}

function selectEvidence(entries, max = 2) {
  const reviewed = entries.filter((entry) => entry.record.review_status === "reviewed");
  const byKind = new Map();
  for (const entry of reviewed.sort((a, b) => recordPriority(a) - recordPriority(b) || a.id.localeCompare(b.id))) {
    if (!byKind.has(entry.kind)) byKind.set(entry.kind, entry);
  }
  const selected = [...byKind.values()];
  for (const entry of reviewed) {
    if (selected.length >= max) break;
    if (!selected.some((item) => item.id === entry.id)) selected.push(entry);
  }
  return selected.slice(0, max);
}

function evidenceForFacet(facet, archive) {
  if (facet.coverage_basis === "declared_members") {
    return (facet.member_record_ids || []).map((id) => archive.recordsById.get(id)).filter(Boolean);
  }
  const sectionIds = descendants(facet.scope, archive.childrenById);
  return [...archive.recordsById.values()].filter((entry) => sectionIds.has(entry.sectionId));
}

function evidenceRef(entry, archive) {
  const text = recordSourceText(entry, archive.sourceUnitsById);
  return {
    record_id: entry.id,
    source_unit_id: entry.evidenceSourceUnitId,
    source_text_sha256: sha256(text)
  };
}

function recordPayload(entry, archive) {
  const sourceText = recordSourceText(entry, archive.sourceUnitsById);
  const base = {
    record_id: entry.id,
    record_type: entry.kind,
    section_path: sectionPath(entry.sectionId, archive.sectionsById),
    source_text: sourceText,
    reviewed_korean: entry.normalizedKo || null
  };
  if (entry.kind === "knowledge_record") {
    return { ...base, modality: entry.record.modality, original_modal_text: entry.record.original_modal_text };
  }
  if (entry.kind === "quantitative_criterion") {
    return {
      ...base,
      parameter: entry.record.parameter,
      comparator: entry.record.comparator,
      condition_ids: entry.record.condition_ids,
      is_default_with_exception: entry.record.is_default_with_exception,
      is_illustrative_example: entry.record.is_illustrative_example
    };
  }
  return { ...base, condition_type: entry.record.condition_type, applies_to_ids: entry.record.applies_to_ids };
}

function rolesFor(summary, facets) {
  const roles = new Set();
  roles.add("main_points");
  if (summary.summary_kind === "scope" || facets.some((facet) => facet.semantic_role === "scope")) roles.add("scope");
  if (facets.some((facet) => facet.semantic_role === "boundary")) roles.add("boundary");
  if (facets.some((facet) => facet.semantic_role === "exception")) roles.add("exception");
  const order = ["definition", "scope", "main_points", "boundary", "exception"];
  return order.filter((role) => roles.has(role));
}

function generationSchema(summaryId, roles, recordIds, supportedFacetIds) {
  return {
    type: "object",
    additionalProperties: false,
    required: ["summary_id", "units"],
    properties: {
      summary_id: { type: "string", const: summaryId },
      units: {
        type: "array",
        minItems: 1,
        maxItems: 4,
        items: {
          type: "object",
          additionalProperties: false,
          required: ["text", "sentence_role", "evidence_record_ids", "covered_facet_ids"],
          properties: {
            text: { type: "string", minLength: 1 },
            sentence_role: { type: "string", enum: roles },
            evidence_record_ids: { type: "array", minItems: 1, items: { type: "string", enum: recordIds } },
            covered_facet_ids: { type: "array", items: { type: "string", enum: supportedFacetIds } }
          }
        }
      }
    }
  };
}

function verificationSchema(unitIds, supportedFacetIds) {
  return {
    type: "object",
    additionalProperties: false,
    required: ["unit_verdicts", "facet_verdicts"],
    properties: {
      unit_verdicts: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["unit_id", "entailed", "preserves_modality", "preserves_conditions", "no_overgeneralization", "standalone", "reason"],
          properties: {
            unit_id: { type: "string", enum: unitIds },
            entailed: { type: "boolean" },
            preserves_modality: { type: "boolean" },
            preserves_conditions: { type: "boolean" },
            no_overgeneralization: { type: "boolean" },
            standalone: { type: "boolean" },
            reason: { type: "string" }
          }
        }
      },
      facet_verdicts: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["facet_id", "adequately_represented", "reason"],
          properties: {
            facet_id: { type: "string", enum: supportedFacetIds },
            adequately_represented: { type: "boolean" },
            reason: { type: "string" }
          }
        }
      }
    }
  };
}

function generatedNumbersAreGrounded(unit, entriesById, archive) {
  const generated = unit.text.match(/(?:[<>]=?|±)?\s*\d+(?:\.\d+)?(?:\/\d+)?/g) || [];
  const source = unit.evidence_record_ids.map((id) => {
    const entry = entriesById.get(id);
    return entry ? recordSourceText(entry, archive.sourceUnitsById) : "";
  }).join(" ").replace(/\s+/g, "");
  return generated.every((token) => source.includes(token.replace(/\s+/g, "")));
}

function hasUnexpectedScript(text) {
  return /[\ufffd\u0900-\u097f\u4e00-\u9fff]/.test(String(text || "")) || !/[\uac00-\ud7af]/.test(String(text || ""));
}

function buildTargetEvidence(summary, archive) {
  if (summary.target.type === "section") {
    return [...archive.recordsById.values()].filter((entry) => entry.sectionId === summary.target.id);
  }
  if (summary.target.type === "facet") return [];
  return [];
}

async function authorSummary({ summary, overlay, bundle, archive, generator, verifier }) {
  const facetsById = new Map(overlay.facets.map((facet) => [facet.facet_id, facet]));
  const facetPacks = [];
  const supportedFacetIds = [];
  const gapFacetIds = [];
  const allEntries = new Map();
  for (const facetId of summary.facet_ids) {
    const facet = facetsById.get(facetId);
    const selected = selectEvidence(evidenceForFacet(facet, archive));
    if (selected.length === 0) gapFacetIds.push(facetId);
    else supportedFacetIds.push(facetId);
    for (const entry of selected) allEntries.set(entry.id, entry);
    facetPacks.push({
      facet_id: facetId,
      semantic_role: facet.semantic_role,
      section_path: sectionPath(facet.scope, archive.sectionsById),
      evidence: selected.map((entry) => recordPayload(entry, archive))
    });
  }
  const targetEvidence = selectEvidence(buildTargetEvidence(summary, archive));
  for (const entry of targetEvidence) allEntries.set(entry.id, entry);
  if (allEntries.size === 0) throw new Error(`${summary.summary_id}: no evidence available for any summary sentence`);

  summary.sentence_roles = rolesFor(summary, summary.facet_ids.map((id) => facetsById.get(id)));
  const targetSection = summary.target.type === "section" ? archive.sectionsById.get(summary.target.id) : null;
  const payload = {
    document: bundle.documents[0],
    summary: {
      summary_id: summary.summary_id,
      summary_kind: summary.summary_kind,
      target: summary.target,
      target_section_path: targetSection ? sectionPath(targetSection.section_id, archive.sectionsById) : null,
      sentence_roles: summary.sentence_roles
    },
    facets: facetPacks,
    direct_target_evidence: targetEvidence.map((entry) => recordPayload(entry, archive)),
    unsupported_facet_ids: gapFacetIds
  };
  const recordIds = [...allEntries.keys()];
  const generated = await generator.complete({
    system: [
      "Write a concise Korean overview for one regulatory-guideline summary_spec using only the supplied evidence.",
      "This is a presentation overview, not regulatory advice. Prefer descriptive wording such as '이 절은 ...을 다룬다'.",
      "Use one to three short units. The first main_points unit should be a compact topic map and may represent several facets at once.",
      "Every unit must be standalone: name the target topic in Korean and never begin with a context-free phrase such as '하위 절은' or '또한'. Do not use the printed section number as the topic name.",
      "Use Korean and ordinary Latin abbreviations only. Never emit Devanagari, CJK ideographs, replacement characters, or another unrelated writing system.",
      "Do not restate detailed duties, thresholds, actor assignments, or procedural conclusions when a neutral topic description is sufficient. Do not introduce numeric values in an overview.",
      "For a section/document overview with multiple facets, translate and list the facet section_path topics conservatively. Do not add attributes, populations, rationales, or decision rules that are not explicit in the selected cited records.",
      "A safe preferred form is: '[target topic]은 [facet topic A], [facet topic B], ...을 다룬다.'",
      "When joining sibling topics, do not propagate a modifier from one item to another; for example, a positive-control antibody and a negative control must not become positive and negative control antibodies unless both sources say so.",
      "Never strengthen or weaken must/should/may/recommendation language. Never turn an example or one child record into a rule for the parent section.",
      "When the target section has no direct evidence, synthesize only from the evidence-bearing child facets and say that the child sections cover those topics.",
      "Never expose authoring metadata in the Korean text: do not say that direct evidence is absent, that a facet is unsupported, or that records were selected.",
      "Do not mention unsupported_facet_ids as if their content were structured; omit their substantive details.",
      "If an operative claim is indispensable, preserve its material conditions, exceptions, negation, comparator, unit, and abbreviation. Put a scope-defining boundary or exception in its own unit when the allowed roles permit it.",
      "Every unit must cite only record IDs supplied in its evidence and list every supported facet that the unit actually represents.",
      "Across the units, every facet with non-empty evidence must be represented. Do not add background knowledge, interpretations, recommendations, or suitability conclusions."
    ].join(" "),
    messages: [{ role: "user", content: JSON.stringify(payload) }],
    schema: generationSchema(summary.summary_id, summary.sentence_roles, recordIds, supportedFacetIds),
    maxTokens: 5000
  });

  const units = (generated.units || []).map((unit, index) => ({
    unit_id: `${summary.summary_id}.u${index + 1}`,
    text: unit.text.trim(),
    sentence_role: unit.sentence_role,
    evidence_record_ids: [...new Set(unit.evidence_record_ids)],
    covered_facet_ids: [...new Set(unit.covered_facet_ids)]
  }));
  const generatedFacetIds = new Set(units.flatMap((unit) => unit.covered_facet_ids));
  const deterministicFailures = [];
  for (const facetId of supportedFacetIds) if (!generatedFacetIds.has(facetId)) deterministicFailures.push(`facet omitted: ${facetId}`);
  for (const unit of units) {
    if (!generatedNumbersAreGrounded(unit, allEntries, archive)) deterministicFailures.push(`ungrounded numeric token: ${unit.unit_id}`);
    if (hasUnexpectedScript(unit.text)) deterministicFailures.push(`unexpected writing system: ${unit.unit_id}`);
  }

  const verificationPayload = {
    summary: payload.summary,
    facets: facetPacks,
    units: units.map((unit) => ({
      ...unit,
      cited_evidence: unit.evidence_record_ids.map((id) => recordPayload(allEntries.get(id), archive))
    }))
  };
  const verification = await verifier.complete({
    system: [
      "Independently verify Korean regulatory overview units. Verification is conservative; do not rewrite.",
      "For each unit, decide whether every assertion is entailed by its cited evidence, modality is unchanged, conditions/exceptions are preserved, no child/example is generalized to a parent rule, and the sentence is standalone.",
      "For each supported facet, decide whether the overview represents it without adding unsupported substance.",
      "A concise descriptive list of evidence-backed child topics adequately represents a parent overview; it need not restate every detailed rule in those child sections.",
      "Reject any detailed claim that omits material scope, condition, exception, negation, or quantitative qualification."
    ].join(" "),
    messages: [{ role: "user", content: JSON.stringify(verificationPayload) }],
    schema: verificationSchema(units.map((unit) => unit.unit_id), supportedFacetIds),
    maxTokens: 6000
  });
  const unitVerdicts = new Map((verification.unit_verdicts || []).map((item) => [item.unit_id, item]));
  const facetVerdicts = new Map((verification.facet_verdicts || []).map((item) => [item.facet_id, item]));
  for (const unit of units) {
    const verdict = unitVerdicts.get(unit.unit_id);
    if (!verdict || !verdict.entailed || !verdict.preserves_modality || !verdict.preserves_conditions || !verdict.no_overgeneralization || !verdict.standalone) {
      deterministicFailures.push(`${unit.unit_id}: ${verdict ? verdict.reason : "missing verifier verdict"}`);
    }
  }
  for (const facetId of supportedFacetIds) {
    const verdict = facetVerdicts.get(facetId);
    if (!verdict || !verdict.adequately_represented) deterministicFailures.push(`${facetId}: ${verdict ? verdict.reason : "missing facet verdict"}`);
  }

  const reviewed = deterministicFailures.length === 0;
  const finalUnits = units.map((unit) => ({
    unit_id: unit.unit_id,
    text: unit.text,
    sentence_role: unit.sentence_role,
    evidence_refs: unit.evidence_record_ids.map((id) => evidenceRef(allEntries.get(id), archive)),
    source_support: "synthesized"
  }));
  summary.evidence_refs = [...new Map(finalUnits.flatMap((unit) => unit.evidence_refs).map((ref) => [ref.record_id, ref])).values()];
  const failedFacets = new Set(deterministicFailures.filter((item) => item.includes(".sem.facet.")).map((item) => item.split(":")[0]));
  return {
    entry: {
      semantic_id: summary.summary_id,
      language: "ko",
      summary_spec_sha256: summarySpecSha256(summary),
      facet_dispositions: summary.facet_ids.map((facetId) => ({
        facet_id: facetId,
        status: gapFacetIds.includes(facetId) || failedFacets.has(facetId) ? "gap" : "covered",
        gap_reason: gapFacetIds.includes(facetId) ? "no_structured_evidence" : failedFacets.has(facetId) ? "verification_failed" : null
      })),
      units: finalUnits,
      review_status: reviewed ? "reviewed" : "needs_review"
    },
    reviewed,
    failures: deterministicFailures,
    gapFacetIds
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const bundle = loadBundle(args.document);
  const semanticFile = path.join(SEMANTIC_DIR, `${args.document}.json`);
  const presentationFile = path.join(PRESENTATION_DIR, `${args.document}.json`);
  const koFile = path.join(KO_DIR, `${args.document}.json`);
  const overlay = readJson(semanticFile);
  const koOverlay = readJson(koFile);
  const archive = buildArchive(bundle, koOverlay);
  const presentation = fs.existsSync(presentationFile) ? readJson(presentationFile) : {
    presentation_overlay_version: "0.2.0",
    language: "ko",
    document_id: args.document,
    entries: []
  };
  presentation.presentation_overlay_version = "0.2.0";
  const entries = new Map(presentation.entries.map((entry) => [entry.semantic_id, entry]));
  let targets = overlay.summary_specs.filter((summary) => !args.summary || summary.summary_id === args.summary)
    .filter((summary) => args.force || !entries.has(summary.summary_id));
  if (args.limit) targets = targets.slice(0, args.limit);
  if (targets.length === 0) { console.log("No semantic presentation summaries need authoring."); return; }
  if (args.dryRun) {
    console.log(JSON.stringify({ document_id: args.document, summary_ids: targets.map((summary) => summary.summary_id) }, null, 2));
    return;
  }

  const generator = createClient("openai", { model: process.env.GUIDELINE_SEMANTIC_PRESENTATION_GENERATOR_MODEL || "gpt-5.6-terra" });
  const verifier = createClient("openai", { model: process.env.GUIDELINE_SEMANTIC_PRESENTATION_VERIFIER_MODEL || "gpt-5.6-sol" });
  if (generator.model === verifier.model) throw new Error("semantic presentation generator and verifier models must be distinct");
  const report = [];
  for (const summary of targets) {
    const result = await authorSummary({ summary, overlay, bundle, archive, generator, verifier });
    entries.set(summary.summary_id, result.entry);
    report.push({ summary_id: summary.summary_id, reviewed: result.reviewed, gaps: result.gapFacetIds, failures: result.failures });
    console.log(`${summary.summary_id}: ${result.reviewed ? "reviewed" : "needs_review"}, gaps=${result.gapFacetIds.length}`);
  }
  presentation.entries = [...entries.values()].sort((a, b) => a.semantic_id.localeCompare(b.semantic_id));
  fs.writeFileSync(semanticFile, `${JSON.stringify(overlay, null, 2)}\n`, "utf8");
  fs.writeFileSync(presentationFile, `${JSON.stringify(presentation, null, 2)}\n`, "utf8");
  const reportDir = path.join(ROOT, "logs", "runtime");
  fs.mkdirSync(reportDir, { recursive: true });
  fs.writeFileSync(path.join(reportDir, `semantic_presentation_authoring_${args.document}.json`), `${JSON.stringify(report, null, 2)}\n`, "utf8");
}

if (require.main === module) main().catch((error) => { console.error(error.stack || error.message); process.exit(1); });

module.exports = {
  parseArgs,
  descendants,
  selectEvidence,
  generatedNumbersAreGrounded,
  hasUnexpectedScript,
  authorSummary
};
