const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const Ajv = require("ajv");

const { discoverJsonFiles } = require("./validate_pilots");

const ROOT = path.resolve(__dirname, "..");
const PILOTS_DIR = path.join(ROOT, "data", "pilots");
const OVERLAY_DIR = path.join(ROOT, "data", "derived", "semantic");
const PRESENTATION_DIR = path.join(ROOT, "data", "derived", "presentation", "ko");
const OVERLAY_SCHEMA_PATH = path.join(ROOT, "data", "schemas", "derived_semantic_overlay.schema.json");
const PRESENTATION_SCHEMA_PATH = path.join(ROOT, "data", "schemas", "derived_semantic_presentation.schema.json");
const CONCEPTS_PATH = path.join(ROOT, "data", "ontology", "semantic_concepts.json");
const CONTEXT_SLOTS_PATH = path.join(ROOT, "data", "ontology", "context_slots.json");

const RECORD_COLLECTIONS = [
  ["knowledge_records", "knowledge_record_id", "knowledge_record"],
  ["quantitative_criteria", "criterion_id", "quantitative_criterion"],
  ["conditions", "condition_id", "condition"]
];

const PROCEDURAL_RELATION_TYPES = new Set(["precedes", "follows", "triggers"]);

function sha256(text) {
  return crypto.createHash("sha256").update(String(text || ""), "utf8").digest("hex");
}

// Approximates RFC 8785 JSON Canonicalization (recursive key-sort serialization) for
// hashing purposes. This archive's bundles contain only strings/booleans/nulls/safe
// integers, so JS's default JSON.stringify number formatting already agrees with JCS;
// a full JCS implementation is not pulled in as a dependency for that reason.
function canonicalize(value) {
  if (Array.isArray(value)) {
    return `[${value.map(canonicalize).join(",")}]`;
  }
  if (value && typeof value === "object") {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalize(value[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function addError(errors, file, id, field, message) {
  const parts = [file];
  if (id) parts.push(id);
  if (field) parts.push(field);
  errors.push(`${parts.join(" ")}: ${message}`);
}

function loadJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function loadCoreArchive(pilotsDir = PILOTS_DIR) {
  const byDocumentId = new Map();
  const sourceUnitsById = new Map();
  const sectionsById = new Map();
  const recordsById = new Map(); // id -> { kind, record, documentId }

  for (const file of discoverJsonFiles(pilotsDir)) {
    const bundle = loadJson(file);
    for (const document of bundle.documents || []) {
      byDocumentId.set(document.document_id, { file, bundle });
    }
    for (const section of bundle.sections || []) {
      sectionsById.set(section.section_id, section);
    }
    for (const unit of bundle.source_units || []) {
      sourceUnitsById.set(unit.source_unit_id, unit);
    }
    for (const record of bundle.knowledge_records || []) {
      const firstUnit = sourceUnitsById.get((record.source_unit_ids || [])[0]);
      recordsById.set(record.knowledge_record_id, {
        kind: "knowledge_record",
        record,
        documentId: firstUnit ? firstUnit.document_id : null
      });
    }
    for (const criterion of bundle.quantitative_criteria || []) {
      const unit = sourceUnitsById.get(criterion.source_unit_id);
      recordsById.set(criterion.criterion_id, {
        kind: "quantitative_criterion",
        record: criterion,
        documentId: unit ? unit.document_id : null
      });
    }
    for (const condition of bundle.conditions || []) {
      const unit = sourceUnitsById.get(condition.source_unit_id);
      recordsById.set(condition.condition_id, {
        kind: "condition",
        record: condition,
        documentId: unit ? unit.document_id : null
      });
    }
  }

  return { byDocumentId, sourceUnitsById, sectionsById, recordsById };
}

function recordSourceText(entry, sourceUnitsById) {
  if (entry.kind === "knowledge_record") {
    const unit = sourceUnitsById.get(entry.evidenceSourceUnitId);
    return unit ? unit.source_text : null;
  }
  if (entry.kind === "quantitative_criterion") return entry.record.source_text;
  if (entry.kind === "condition") return entry.record.condition_text;
  return null;
}

function checkEvidenceRef({ file, ownerId, field, ref, errors, archive, expectedDocumentId }) {
  const entry = archive.recordsById.get(ref.record_id);
  if (!entry) {
    addError(errors, file, ownerId, field, `evidence record_id does not resolve in core archive: ${ref.record_id}`);
    return;
  }

  if (entry.kind === "knowledge_record") {
    if (!(entry.record.source_unit_ids || []).includes(ref.source_unit_id)) {
      addError(errors, file, ownerId, field, `evidence source_unit_id ${ref.source_unit_id} is not linked to knowledge_record ${ref.record_id}`);
      return;
    }
  } else if (entry.record.source_unit_id !== ref.source_unit_id) {
    addError(errors, file, ownerId, field, `evidence source_unit_id ${ref.source_unit_id} does not match ${ref.record_id}.source_unit_id`);
    return;
  }

  if (expectedDocumentId && entry.documentId !== expectedDocumentId) {
    addError(errors, file, ownerId, field, `evidence record ${ref.record_id} belongs to document ${entry.documentId}, not ${expectedDocumentId}`);
  }

  const sourceText = recordSourceText({ kind: entry.kind, record: entry.record, evidenceSourceUnitId: ref.source_unit_id }, archive.sourceUnitsById);
  if (sourceText === null || sourceText === undefined) {
    addError(errors, file, ownerId, field, `evidence source text could not be resolved for ${ref.record_id}`);
    return;
  }
  const expectedHash = sha256(sourceText);
  if (ref.source_text_sha256 !== expectedHash) {
    addError(errors, file, ownerId, field, `evidence is stale: source_text_sha256 no longer matches ${ref.record_id}`);
  }
}

function checkRef({ file, ownerId, field, ref, errors, archive, facetIds, expectedDocumentId }) {
  if (ref.ref_type === "facet") {
    if (!facetIds.has(ref.ref_id)) {
      addError(errors, file, ownerId, field, `facet reference does not resolve inside this overlay: ${ref.ref_id}`);
    }
    return;
  }
  const entry = archive.recordsById.get(ref.ref_id);
  if (!entry || entry.kind !== ref.ref_type) {
    addError(errors, file, ownerId, field, `reference does not resolve to a ${ref.ref_type} in core archive: ${ref.ref_id}`);
    return;
  }
  if (expectedDocumentId && entry.documentId !== expectedDocumentId) {
    addError(errors, file, ownerId, field, `reference ${ref.ref_id} belongs to a different document`);
  }
}

function checkTarget({ file, ownerId, field, target, errors, archive, facetIds, expectedDocumentId }) {
  if (target.type === "document") {
    if (target.id !== expectedDocumentId) {
      addError(errors, file, ownerId, field, `document target must be ${expectedDocumentId}`);
    }
    return;
  }
  if (target.type === "section") {
    const section = archive.sectionsById.get(target.id);
    if (!section) {
      addError(errors, file, ownerId, field, `section target does not resolve: ${target.id}`);
    } else if (section.document_id !== expectedDocumentId) {
      addError(errors, file, ownerId, field, `section target ${target.id} belongs to a different document`);
    }
    return;
  }
  if (target.type === "facet" && !facetIds.has(target.id)) {
    addError(errors, file, ownerId, field, `facet target does not resolve inside this overlay: ${target.id}`);
  }
}

function checkScope({ file, ownerId, scope, errors, archive, expectedDocumentId }) {
  if (scope === expectedDocumentId) return;
  const section = archive.sectionsById.get(scope);
  if (!section) {
    addError(errors, file, ownerId, "scope", `does not resolve to the document or one of its sections: ${scope}`);
    return;
  }
  if (section.document_id !== expectedDocumentId) {
    addError(errors, file, ownerId, "scope", `section ${scope} belongs to a different document`);
  }
}

function checkFacetParentCycles(file, facets, errors) {
  const parentOf = new Map(facets.map((facet) => [facet.facet_id, facet.parent_facet_id]));
  for (const facet of facets) {
    const seen = new Set();
    let cursor = facet.facet_id;
    while (cursor !== null && cursor !== undefined) {
      if (seen.has(cursor)) {
        addError(errors, file, facet.facet_id, "parent_facet_id", "facet parent graph contains a cycle");
        break;
      }
      seen.add(cursor);
      cursor = parentOf.has(cursor) ? parentOf.get(cursor) : null;
    }
  }
}

function checkProceduralRelationCycles(file, relations, errors) {
  const edges = new Map(); // node -> Set(node)
  const addEdge = (from, to) => {
    if (!edges.has(from)) edges.set(from, new Set());
    edges.get(from).add(to);
  };
  const nodeKey = (ref) => `${ref.ref_type}:${ref.ref_id}`;

  for (const relation of relations) {
    if (!PROCEDURAL_RELATION_TYPES.has(relation.relation_type)) continue;
    const from = nodeKey(relation.from_ref);
    const to = nodeKey(relation.to_ref);
    if (relation.relation_type === "follows") {
      addEdge(to, from);
    } else {
      addEdge(from, to);
    }
  }

  const WHITE = 0;
  const GRAY = 1;
  const BLACK = 2;
  const color = new Map();

  function visit(node) {
    color.set(node, GRAY);
    for (const next of edges.get(node) || []) {
      const state = color.get(next) || WHITE;
      if (state === GRAY) {
        addError(errors, file, null, "relations", `procedural relation graph contains a cycle involving ${node} -> ${next}`);
      } else if (state === WHITE) {
        visit(next);
      }
    }
    color.set(node, BLACK);
  }

  for (const node of edges.keys()) {
    if ((color.get(node) || WHITE) === WHITE) visit(node);
  }
}

function checkWhenCondition({ file, ownerId, field, when, errors, contextSlots }) {
  if (when === null || when === undefined) return;
  const slot = contextSlots.retrieval_slots.find((entry) => entry.slot_id === when.slot_id);
  if (!slot) {
    addError(errors, file, ownerId, field, `unknown context slot_id: ${when.slot_id}`);
    return;
  }
  const hasValue = (slot.values || []).some((entry) => entry.value === when.value);
  if (!hasValue) {
    addError(errors, file, ownerId, field, `unknown value ${when.value} for context slot ${when.slot_id}`);
  }
}

function validateOverlayFile(file, overlay, ajvValidate, archive, concepts, contextSlots, errors) {
  if (!ajvValidate(overlay)) {
    for (const error of ajvValidate.errors || []) {
      addError(errors, file, null, error.instancePath || "/", error.message);
    }
    return;
  }

  const documentId = overlay.document_id;
  const coreEntry = archive.byDocumentId.get(documentId);
  if (!coreEntry) {
    addError(errors, file, documentId, "document_id", `does not resolve to a core archive document`);
    return;
  }

  const expectedHash = sha256(canonicalize(coreEntry.bundle));
  if (overlay.source_bundle_sha256 !== expectedHash) {
    addError(errors, file, documentId, "source_bundle_sha256", "is stale: does not match the current core bundle");
  }

  const facetIds = new Set(overlay.facets.map((facet) => facet.facet_id));

  const idNamespaces = [
    ["summary_specs", "summary_id"],
    ["facets", "facet_id"],
    ["relations", "relation_id"],
    ["coverage_manifests", "manifest_id"],
    ["comparison_bindings", "binding_id"],
    ["salience_profiles", "profile_id"]
  ];
  for (const [collection, idField] of idNamespaces) {
    const seen = new Set();
    for (const item of overlay[collection]) {
      if (seen.has(item[idField])) {
        addError(errors, file, item[idField], collection, `duplicate ${idField} inside ${collection}`);
      }
      seen.add(item[idField]);
    }
  }

  for (const facet of overlay.facets) {
    checkScope({ file, ownerId: facet.facet_id, scope: facet.scope, errors, archive, expectedDocumentId: documentId });
    if (facet.parent_facet_id !== null && !facetIds.has(facet.parent_facet_id)) {
      addError(errors, file, facet.facet_id, "parent_facet_id", `does not resolve inside this overlay: ${facet.parent_facet_id}`);
    }
    for (const memberId of facet.member_record_ids) {
      const entry = archive.recordsById.get(memberId);
      if (!entry) {
        addError(errors, file, facet.facet_id, "member_record_ids", `does not resolve in core archive: ${memberId}`);
      } else if (entry.documentId !== documentId) {
        addError(errors, file, facet.facet_id, "member_record_ids", `${memberId} belongs to a different document`);
      }
    }
  }
  checkFacetParentCycles(file, overlay.facets, errors);

  for (const summary of overlay.summary_specs) {
    checkTarget({ file, ownerId: summary.summary_id, field: "target", target: summary.target, errors, archive, facetIds, expectedDocumentId: documentId });
    for (const facetId of summary.facet_ids) {
      if (!facetIds.has(facetId)) {
        addError(errors, file, summary.summary_id, "facet_ids", `does not resolve inside this overlay: ${facetId}`);
      }
    }
    for (const ref of summary.evidence_refs) {
      checkEvidenceRef({ file, ownerId: summary.summary_id, field: "evidence_refs", ref, errors, archive, expectedDocumentId: documentId });
    }
  }

  for (const relation of overlay.relations) {
    checkRef({ file, ownerId: relation.relation_id, field: "from_ref", ref: relation.from_ref, errors, archive, facetIds, expectedDocumentId: documentId });
    checkRef({ file, ownerId: relation.relation_id, field: "to_ref", ref: relation.to_ref, errors, archive, facetIds, expectedDocumentId: documentId });
    for (const ref of relation.evidence_refs) {
      checkEvidenceRef({ file, ownerId: relation.relation_id, field: "evidence_refs", ref, errors, archive, expectedDocumentId: documentId });
    }
  }
  checkProceduralRelationCycles(file, overlay.relations, errors);

  for (const manifest of overlay.coverage_manifests) {
    checkTarget({ file, ownerId: manifest.manifest_id, field: "target", target: manifest.target, errors, archive, facetIds, expectedDocumentId: documentId });
    for (const selector of manifest.scope_selectors) {
      checkWhenCondition({ file, ownerId: manifest.manifest_id, field: "scope_selectors", when: selector, errors, contextSlots });
    }
    for (const group of manifest.coverage_groups) {
      const seenInGroup = new Set();
      for (const facetId of group.facet_ids) {
        if (!facetIds.has(facetId)) {
          addError(errors, file, manifest.manifest_id, "coverage_groups.facet_ids", `does not resolve inside this overlay: ${facetId}`);
        }
        if (seenInGroup.has(facetId)) {
          addError(errors, file, manifest.manifest_id, "coverage_groups.facet_ids", `duplicate facet_id inside group ${group.group_id}: ${facetId}`);
        }
        seenInGroup.add(facetId);
      }
      checkWhenCondition({ file, ownerId: manifest.manifest_id, field: "coverage_groups.when", when: group.when, errors, contextSlots });
    }
  }

  for (const binding of overlay.comparison_bindings) {
    const axisExists = concepts.comparison_axes.some((axis) => axis.axis_id === binding.axis_id);
    if (!axisExists) {
      addError(errors, file, binding.binding_id, "axis_id", `does not resolve in ontology: ${binding.axis_id}`);
    }
    if (!facetIds.has(binding.facet_id)) {
      addError(errors, file, binding.binding_id, "facet_id", `does not resolve inside this overlay: ${binding.facet_id}`);
    }
    for (const ref of binding.evidence_refs) {
      checkEvidenceRef({ file, ownerId: binding.binding_id, field: "evidence_refs", ref, errors, archive, expectedDocumentId: documentId });
    }
  }

  for (const profile of overlay.salience_profiles) {
    if (profile.target_id !== documentId && !archive.sectionsById.has(profile.target_id) && !facetIds.has(profile.target_id)) {
      addError(errors, file, profile.profile_id, "target_id", `does not resolve to the document, a section, or a facet: ${profile.target_id}`);
    }
    const orderByTier = new Map();
    for (const item of profile.items) {
      if (!facetIds.has(item.facet_id)) {
        addError(errors, file, profile.profile_id, "items.facet_id", `does not resolve inside this overlay: ${item.facet_id}`);
      }
      if (!orderByTier.has(item.tier)) orderByTier.set(item.tier, new Set());
      const seenOrders = orderByTier.get(item.tier);
      if (seenOrders.has(item.display_order)) {
        addError(errors, file, profile.profile_id, "items.display_order", `duplicate display_order ${item.display_order} within tier ${item.tier}`);
      }
      seenOrders.add(item.display_order);
    }
  }
}

function validatePresentationFile(file, presentation, ajvValidate, archive, overlaysByDocumentId, errors) {
  if (!ajvValidate(presentation)) {
    for (const error of ajvValidate.errors || []) {
      addError(errors, file, null, error.instancePath || "/", error.message);
    }
    return;
  }

  const documentId = presentation.document_id;
  const overlay = overlaysByDocumentId.get(documentId);
  if (!overlay) {
    addError(errors, file, documentId, "document_id", "has no corresponding derived semantic overlay file");
    return;
  }

  const semanticIds = new Set([
    ...overlay.summary_specs.map((summary) => summary.summary_id),
    ...overlay.facets.map((facet) => facet.facet_id)
  ]);

  const seen = new Set();
  for (const entry of presentation.entries) {
    if (seen.has(entry.semantic_id)) {
      addError(errors, file, entry.semantic_id, "semantic_id", "duplicate presentation entry");
    }
    seen.add(entry.semantic_id);
    if (!semanticIds.has(entry.semantic_id)) {
      addError(errors, file, entry.semantic_id, "semantic_id", "does not resolve to a summary_spec or facet in the corresponding semantic overlay");
    }
    for (const unit of entry.units) {
      for (const ref of unit.evidence_refs) {
        checkEvidenceRef({ file, ownerId: `${entry.semantic_id}/${unit.unit_id}`, field: "evidence_refs", ref, errors, archive, expectedDocumentId: documentId });
      }
    }
  }
}

function validateSemanticOverlays({
  pilotsDir = PILOTS_DIR,
  overlayDir = OVERLAY_DIR,
  presentationDir = PRESENTATION_DIR
} = {}) {
  const errors = [];
  const archive = loadCoreArchive(pilotsDir);
  const concepts = loadJson(CONCEPTS_PATH);
  const contextSlots = loadJson(CONTEXT_SLOTS_PATH);

  const overlaySchema = loadJson(OVERLAY_SCHEMA_PATH);
  const presentationSchema = loadJson(PRESENTATION_SCHEMA_PATH);
  const ajv = new Ajv({ allErrors: true, strict: false });
  const validateOverlaySchema = ajv.compile(overlaySchema);
  const validatePresentationSchema = ajv.compile(presentationSchema);

  const overlayFiles = fs.existsSync(overlayDir) ? discoverJsonFiles(overlayDir) : [];
  const overlaysByDocumentId = new Map();
  const globalFacetIds = new Map();

  for (const file of overlayFiles) {
    const overlay = loadJson(file);
    if (overlay && typeof overlay.document_id === "string") {
      if (overlaysByDocumentId.has(overlay.document_id)) {
        addError(errors, file, overlay.document_id, "document_id", `duplicate semantic overlay for the same document (also in ${overlaysByDocumentId.get(overlay.document_id).file})`);
      } else {
        overlaysByDocumentId.set(overlay.document_id, { file, overlay });
      }
    }
    validateOverlayFile(file, overlay, validateOverlaySchema, archive, concepts, contextSlots, errors);

    for (const facet of overlay.facets || []) {
      if (globalFacetIds.has(facet.facet_id)) {
        addError(errors, file, facet.facet_id, "facets", `facet_id also used in ${globalFacetIds.get(facet.facet_id)}`);
      } else {
        globalFacetIds.set(facet.facet_id, file);
      }
    }
  }

  const overlaysForPresentation = new Map(
    Array.from(overlaysByDocumentId.entries()).map(([documentId, { overlay }]) => [documentId, overlay])
  );

  const presentationFiles = fs.existsSync(presentationDir) ? discoverJsonFiles(presentationDir) : [];
  for (const file of presentationFiles) {
    const presentation = loadJson(file);
    validatePresentationFile(file, presentation, validatePresentationSchema, archive, overlaysForPresentation, errors);
  }

  return {
    ok: errors.length === 0,
    errors,
    overlayCount: overlayFiles.length,
    presentationCount: presentationFiles.length
  };
}

function main() {
  const result = validateSemanticOverlays();
  if (!result.ok) {
    console.error(`Semantic overlay validation failed with ${result.errors.length} error(s):`);
    for (const error of result.errors) console.error(`- ${error}`);
    process.exit(1);
  }
  console.log(`Validated ${result.overlayCount} semantic overlay file(s) and ${result.presentationCount} presentation file(s).`);
}

if (require.main === module) main();

module.exports = {
  OVERLAY_DIR,
  PRESENTATION_DIR,
  loadCoreArchive,
  canonicalize,
  sha256,
  validateSemanticOverlays
};
