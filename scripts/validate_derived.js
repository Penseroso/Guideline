const fs = require("fs");
const path = require("path");
const Ajv = require("ajv");

const ROOT = path.resolve(__dirname, "..");
const DERIVED_SCHEMA_DIR = path.join(ROOT, "structured_data", "schemas", "derived");

const DERIVED_ARTIFACT_SCHEMAS = {
  GuidanceFamily: "https://example.local/regulatory-guideline-archive/derived/artifacts/guidance_family.schema.json",
  DocumentEdition: "https://example.local/regulatory-guideline-archive/derived/artifacts/document_edition.schema.json",
  EditionSource: "https://example.local/regulatory-guideline-archive/derived/artifacts/edition_source.schema.json",
  LifecycleRelationship: "https://example.local/regulatory-guideline-archive/derived/artifacts/lifecycle_relationship.schema.json",
  AmendmentMapping: "https://example.local/regulatory-guideline-archive/derived/artifacts/amendment_mapping.schema.json",
  EffectiveRecord: "https://example.local/regulatory-guideline-archive/derived/artifacts/effective_record.schema.json",
  EffectiveStateSnapshot: "https://example.local/regulatory-guideline-archive/derived/artifacts/effective_state_snapshot.schema.json",
  ReviewAttestation: "https://example.local/regulatory-guideline-archive/derived/artifacts/review_attestation.schema.json",
  RiskAssessment: "https://example.local/regulatory-guideline-archive/derived/artifacts/risk_assessment.schema.json"
};

const LEGACY_SCHEMA_EXEMPT_DERIVED_FILES = new Set([
  "structured_data/derived/s6_r1_amendment_mappings.json",
  "structured_data/derived/s6_r1_effective_records.json"
]);

const RELATION_TYPES = new Set([
  "supplements",
  "clarifies",
  "modifies",
  "narrows",
  "broadens",
  "replaces",
  "supersedes",
  "conflicts_with"
]);

const REVIEW_STATUSES = new Set(["reviewed", "needs_review"]);

const SOURCE_COLLECTIONS = [
  ["documents", "document_id"],
  ["sections", "section_id"],
  ["source_units", "source_unit_id"],
  ["knowledge_records", "knowledge_record_id"],
  ["quantitative_criteria", "criterion_id"],
  ["conditions", "condition_id"],
  ["cross_references", "xref_id"]
];

const EFFECTIVE_ID_ARRAY_FIELDS = [
  "amendment_relation_ids",
  "knowledge_record_ids",
  "condition_ids",
  "quantitative_criterion_ids",
  "cross_reference_ids",
  "source_unit_ids"
];

function location(file, id, field) {
  const parts = [file];
  if (id) parts.push(id);
  if (field) parts.push(field);
  return parts.join(" ");
}

function addError(errors, file, id, field, message) {
  errors.push(`${location(file, id, field)}: ${message}`);
}

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function normalizeRepoPath(inputPath) {
  if (!isNonEmptyString(inputPath)) return inputPath;
  const resolved = path.isAbsolute(inputPath) ? path.normalize(inputPath) : path.resolve(ROOT, inputPath);
  return path.relative(ROOT, resolved).split(path.sep).join("/");
}

function isLegacySchemaExemptFile(file) {
  return LEGACY_SCHEMA_EXEMPT_DERIVED_FILES.has(normalizeRepoPath(file));
}

function collectJsonSchemaFiles(directory) {
  const files = [];
  if (!fs.existsSync(directory)) return files;
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectJsonSchemaFiles(entryPath));
    } else if (entry.isFile() && entry.name.endsWith(".schema.json")) {
      files.push(entryPath);
    }
  }
  return files;
}

let derivedSchemaAjv = null;

function getDerivedSchemaAjv() {
  if (derivedSchemaAjv) return derivedSchemaAjv;
  const ajv = new Ajv({ allErrors: true, strict: false });
  for (const schemaFile of collectJsonSchemaFiles(DERIVED_SCHEMA_DIR)) {
    ajv.addSchema(JSON.parse(fs.readFileSync(schemaFile, "utf8")));
  }
  derivedSchemaAjv = ajv;
  return derivedSchemaAjv;
}

function formatSchemaPath(error) {
  return error.instancePath || "/";
}

function validateDerivedContractArtifact({ artifact, file }) {
  const errors = [];
  if (!isObject(artifact)) {
    addError(errors, file, null, "/", "must be an object");
    return { ok: false, errors };
  }

  const artifactType = artifact.artifact_type;
  const schemaId = DERIVED_ARTIFACT_SCHEMAS[artifactType];
  if (!schemaId) {
    addError(errors, file, null, "artifact_type", `unsupported derived artifact type: ${artifactType}`);
    return { ok: false, errors };
  }

  const validate = getDerivedSchemaAjv().getSchema(schemaId);
  if (!validate) {
    addError(errors, file, null, "schema", `schema not registered for artifact_type ${artifactType}`);
    return { ok: false, errors };
  }

  if (!validate(artifact)) {
    for (const error of validate.errors || []) {
      addError(errors, file, null, formatSchemaPath(error), error.message);
    }
  }

  if (artifact.regulator_profile === "core" && Array.isArray(artifact.records)) {
    artifact.records.forEach((record, index) => {
      if (record && record.profile_details !== null) {
        addError(errors, file, null, `/records/${index}/profile_details`, "must be null for regulator-neutral core artifacts");
      }
    });
  }

  return { ok: errors.length === 0, errors };
}

function compareRepoPath(errors, file, id, field, actual, expected) {
  const actualPath = normalizeRepoPath(actual);
  const expectedPath = normalizeRepoPath(expected);
  if (actualPath !== expectedPath) {
    addError(errors, file, id, field, `must match configured path ${expectedPath}`);
  }
}

function buildIndex(items, idField) {
  const index = new Map();
  for (const item of items || []) {
    if (item && item[idField]) index.set(item[idField], item);
  }
  return index;
}

function buildSourceIndexes(sourceBundle) {
  const indexes = {};
  const idLayers = new Map();
  for (const [collection, idField] of SOURCE_COLLECTIONS) {
    indexes[collection] = buildIndex(sourceBundle[collection], idField);
    for (const id of indexes[collection].keys()) {
      if (!idLayers.has(id)) idLayers.set(id, []);
      idLayers.get(id).push(collection);
    }
  }
  indexes.idLayers = idLayers;
  return indexes;
}

function wrongLayerMessage(indexes, id, expectedCollection) {
  const layers = indexes.idLayers.get(id);
  if (!layers || layers.includes(expectedCollection)) return null;
  return `reference resolves to ${layers.join(", ")}, expected ${expectedCollection}: ${id}`;
}

function requireSourceRef(errors, file, indexes, id, field, ownerId, collection) {
  if (!isNonEmptyString(id)) {
    addError(errors, file, ownerId, field, "must be a non-empty string");
    return null;
  }
  const item = indexes[collection].get(id);
  if (item) return item;
  const wrongLayer = wrongLayerMessage(indexes, id, collection);
  if (wrongLayer) {
    addError(errors, file, ownerId, field, wrongLayer);
  } else {
    addError(errors, file, ownerId, field, `reference does not resolve to ${collection}: ${id}`);
  }
  return null;
}

function checkRequiredObject(errors, file, ownerId, object, field) {
  if (!isObject(object)) {
    addError(errors, file, ownerId, field, "must be an object");
    return false;
  }
  return true;
}

function checkRequiredNonEmptyString(errors, file, ownerId, object, field, label = field) {
  if (!isNonEmptyString(object && object[field])) {
    addError(errors, file, ownerId, label, "is required and must be a non-empty string");
    return false;
  }
  return true;
}

function checkStringOrNull(errors, file, ownerId, object, field) {
  if (!Object.prototype.hasOwnProperty.call(object, field)) {
    addError(errors, file, ownerId, field, "is required");
  } else if (object[field] !== null && typeof object[field] !== "string") {
    addError(errors, file, ownerId, field, "must be a string or null");
  }
}

function checkStringArray(errors, file, ownerId, object, field, options = {}) {
  const value = object && object[field];
  if (!Array.isArray(value)) {
    addError(errors, file, ownerId, field, "must be an array");
    return [];
  }
  if (options.requireNonEmpty && value.length === 0) {
    addError(errors, file, ownerId, field, "must not be empty");
  }
  const seen = new Set();
  for (const item of value) {
    if (!isNonEmptyString(item)) {
      addError(errors, file, ownerId, field, "must contain only non-empty strings");
      continue;
    }
    if (seen.has(item)) {
      addError(errors, file, ownerId, field, `duplicates ID ${item}`);
    }
    seen.add(item);
  }
  return value.filter(isNonEmptyString);
}

function checkReviewStatus(errors, file, ownerId, status, field) {
  if (!REVIEW_STATUSES.has(status)) {
    addError(errors, file, ownerId, field, "must be reviewed or needs_review");
  }
}

function expectedLayerForType(type) {
  if (type === "amendment") return "amendment_mapping";
  if (type === "effective") return "effective_state";
  return null;
}

function validateArtifactMetadata({ errors, file, artifact, sourceIndexes, sourceFile, amendmentFile, type }) {
  if (!checkRequiredObject(errors, file, null, artifact, "artifact")) return;

  const required = [
    "document_id",
    "layer",
    "derivation",
    "provisional",
    "not_a_source_bundle",
    "schema_coverage",
    "source_pilot_file",
    "strategy_reference"
  ];
  if (type === "effective") required.push("amendment_mapping_file", "design_note");

  for (const field of required) {
    if (field === "provisional" || field === "not_a_source_bundle") {
      if (typeof artifact[field] !== "boolean") {
        addError(errors, file, null, `artifact.${field}`, "is required and must be boolean");
      }
    } else {
      checkRequiredNonEmptyString(errors, file, null, artifact, field, `artifact.${field}`);
    }
  }

  const expectedLayer = expectedLayerForType(type);
  if (artifact.layer !== expectedLayer) {
    addError(errors, file, null, "artifact.layer", `must equal ${expectedLayer}; found ${artifact.layer}`);
  }

  requireSourceRef(errors, file, sourceIndexes, artifact.document_id, "artifact.document_id", null, "documents");
  compareRepoPath(errors, file, null, "artifact.source_pilot_file", artifact.source_pilot_file, sourceFile);
  if (type === "effective") {
    compareRepoPath(errors, file, null, "artifact.amendment_mapping_file", artifact.amendment_mapping_file, amendmentFile);
  }
}

function validateAmendments({ amendmentArtifact, files, sourceIndexes, errors }) {
  const file = files.amendmentFile;
  validateArtifactMetadata({
    errors,
    file,
    artifact: amendmentArtifact.artifact,
    sourceIndexes,
    sourceFile: files.sourceFile,
    amendmentFile: files.amendmentFile,
    type: "amendment"
  });

  if (!Array.isArray(amendmentArtifact.amendment_mappings)) {
    addError(errors, file, null, "amendment_mappings", "must be an array");
    return new Map();
  }

  const mappings = new Map();
  for (const mapping of amendmentArtifact.amendment_mappings) {
    const id = mapping && mapping.mapping_id;
    if (!isNonEmptyString(id)) {
      addError(errors, file, null, "mapping_id", "is required and must be a non-empty string");
      continue;
    }
    if (mappings.has(id)) {
      addError(errors, file, id, "mapping_id", "duplicate mapping_id");
    } else {
      mappings.set(id, mapping);
    }

    const addendumIds = checkStringArray(errors, file, id, mapping, "addendum_knowledge_record_ids", { requireNonEmpty: true });
    const parentIds = checkStringArray(errors, file, id, mapping, "parent_knowledge_record_ids", { requireNonEmpty: true });
    const endpoints = [];
    for (const endpointId of addendumIds) {
      const endpoint = requireSourceRef(errors, file, sourceIndexes, endpointId, "addendum_knowledge_record_ids", id, "knowledge_records");
      if (endpoint) endpoints.push(endpoint);
    }
    for (const endpointId of parentIds) {
      const endpoint = requireSourceRef(errors, file, sourceIndexes, endpointId, "parent_knowledge_record_ids", id, "knowledge_records");
      if (endpoint) endpoints.push(endpoint);
    }

    if (!RELATION_TYPES.has(mapping.relation_type)) {
      addError(errors, file, id, "relation_type", "is not in the derived relation vocabulary");
    }
    checkReviewStatus(errors, file, id, mapping.review_status, "review_status");
    checkRequiredNonEmptyString(errors, file, id, mapping, "mapped_scope");
    checkRequiredNonEmptyString(errors, file, id, mapping, "analyst_rationale");
    checkRequiredNonEmptyString(errors, file, id, mapping, "derivation");

    if (mapping.review_status === "reviewed") {
      for (const endpoint of endpoints) {
        if (endpoint.review_status !== "reviewed") {
          addError(errors, file, id, "review_status", `reviewed mapping references unreviewed KnowledgeRecord ${endpoint.knowledge_record_id}`);
        }
      }
    }

    if (Object.prototype.hasOwnProperty.call(mapping, "contextual_cross_reference_note")) {
      checkStringArray(errors, file, id, mapping, "contextual_cross_reference_ids", { requireNonEmpty: true });
    }
    if (Object.prototype.hasOwnProperty.call(mapping, "contextual_cross_reference_ids")) {
      for (const xrefId of checkStringArray(errors, file, id, mapping, "contextual_cross_reference_ids")) {
        requireSourceRef(errors, file, sourceIndexes, xrefId, "contextual_cross_reference_ids", id, "cross_references");
      }
    }
  }

  return mappings;
}

function findDocument(sourceBundle, documentId) {
  return (sourceBundle.documents || []).find((document) => document.document_id === documentId) || null;
}

function hasDocumentedLimitation(record, id) {
  return (record.representation_limitations || []).some((text) => typeof text === "string" && text.includes(id));
}

function validateEffectiveRecords({ sourceBundle, effectiveArtifact, files, sourceIndexes, mappings, errors }) {
  const file = files.effectiveFile;
  validateArtifactMetadata({
    errors,
    file,
    artifact: effectiveArtifact.artifact,
    sourceIndexes,
    sourceFile: files.sourceFile,
    amendmentFile: files.amendmentFile,
    type: "effective"
  });

  if (!Array.isArray(effectiveArtifact.effective_records)) {
    addError(errors, file, null, "effective_records", "must be an array");
    return;
  }

  const seen = new Set();
  for (const record of effectiveArtifact.effective_records) {
    validateEffectiveRecord({ sourceBundle, effectiveArtifact, record, file, files, sourceIndexes, mappings, seen, errors });
  }
}

function validateEffectiveRecord({ sourceBundle, effectiveArtifact, record, file, files, sourceIndexes, mappings, seen, errors }) {
  const id = record && record.effective_record_id;
  if (!isNonEmptyString(id)) {
    addError(errors, file, null, "effective_record_id", "is required and must be a non-empty string");
    return;
  }
  if (seen.has(id)) {
    addError(errors, file, id, "effective_record_id", "duplicate effective_record_id");
  }
  seen.add(id);

  if (!isNonEmptyString(record.effective_status)) {
    addError(errors, file, id, "effective_status", "is required and must be a non-empty string");
  }
  checkReviewStatus(errors, file, id, record.review_status, "review_status");

  for (const field of EFFECTIVE_ID_ARRAY_FIELDS) {
    checkStringArray(errors, file, id, record, field, {
      requireNonEmpty: field === "knowledge_record_ids" || field === "source_unit_ids"
    });
  }

  checkRequiredNonEmptyString(errors, file, id, record, "effective_text_en");
  checkRequiredNonEmptyString(errors, file, id, record, "synthesis_rationale");
  checkStringOrNull(errors, file, id, record, "normalized_ko");
  if (!Array.isArray(record.representation_limitations)) {
    addError(errors, file, id, "representation_limitations", "must be an array of strings");
  } else {
    for (const limitation of record.representation_limitations) {
      if (typeof limitation !== "string") {
        addError(errors, file, id, "representation_limitations", "must be an array of strings");
      }
    }
  }

  validateEditionContext({ sourceBundle, effectiveArtifact, record, file, files, errors });

  const resolved = validateEffectiveReferences({ record, file, sourceIndexes, mappings, errors });
  validateMappingCoverage({ record, file, mappings, errors });
  validateContributorReviewStatus({ record, file, resolved, errors });
  validateSourceUnitDocumentConsistency({ record, file, resolved, errors });
  validateProvenanceGraph({ record, file, resolved, errors });
}

function validateEditionContext({ sourceBundle, effectiveArtifact, record, file, files, errors }) {
  const id = record.effective_record_id;
  if (!checkRequiredObject(errors, file, id, record.edition_context, "edition_context")) return;
  const edition = record.edition_context;
  const required = [
    "document_id",
    "document_version_label",
    "source_model_version",
    "source_availability",
    "source_pilot_file",
    "amendment_mapping_file",
    "derived_layer_status"
  ];
  for (const field of required) checkRequiredNonEmptyString(errors, file, id, edition, field, `edition_context.${field}`);

  const artifactDocumentId = effectiveArtifact && effectiveArtifact.artifact && effectiveArtifact.artifact.document_id;
  if (edition.document_id !== artifactDocumentId) {
    addError(errors, file, id, "edition_context.document_id", `must equal effective artifact document_id ${artifactDocumentId}; found ${edition.document_id}`);
  }

  const document = findDocument(sourceBundle, edition.document_id);
  if (!document) {
    addError(errors, file, id, "edition_context.document_id", `reference does not resolve to documents: ${edition.document_id}`);
  } else if (edition.source_model_version !== document.schema_model_version) {
    addError(errors, file, id, "edition_context.source_model_version", `must match source Document.schema_model_version ${document.schema_model_version}`);
  }
  compareRepoPath(errors, file, id, "edition_context.source_pilot_file", edition.source_pilot_file, files.sourceFile);
  compareRepoPath(errors, file, id, "edition_context.amendment_mapping_file", edition.amendment_mapping_file, files.amendmentFile);
}

function validateEffectiveReferences({ record, file, sourceIndexes, mappings, errors }) {
  const id = record.effective_record_id;
  const resolved = {
    knowledge_records: [],
    conditions: [],
    quantitative_criteria: [],
    cross_references: [],
    source_units: [],
    mappings: []
  };

  const sourceRefs = [
    ["knowledge_record_ids", "knowledge_records"],
    ["condition_ids", "conditions"],
    ["quantitative_criterion_ids", "quantitative_criteria"],
    ["cross_reference_ids", "cross_references"],
    ["source_unit_ids", "source_units"]
  ];
  for (const [field, collection] of sourceRefs) {
    for (const refId of record[field] || []) {
      const item = requireSourceRef(errors, file, sourceIndexes, refId, field, id, collection);
      if (item) resolved[collection].push(item);
    }
  }

  for (const mappingId of record.amendment_relation_ids || []) {
    if (!isNonEmptyString(mappingId)) continue;
    const mapping = mappings.get(mappingId);
    if (!mapping) {
      addError(errors, file, id, "amendment_relation_ids", `reference does not resolve to amendment_mappings: ${mappingId}`);
    } else {
      resolved.mappings.push(mapping);
      if (mapping.review_status !== "reviewed") {
        addError(errors, file, id, "amendment_relation_ids", `amendment mapping is not reviewed: ${mappingId}`);
      }
      if (record.review_status === "reviewed" && mapping.relation_type === "conflicts_with") {
        addError(errors, file, id, "amendment_relation_ids", `reviewed EffectiveRecord cannot reference conflicts_with mapping ${mappingId}`);
      }
    }
  }

  return resolved;
}

function validateSourceUnitDocumentConsistency({ record, file, resolved, errors }) {
  const id = record.effective_record_id;
  const recordDocumentId = record.edition_context && record.edition_context.document_id;
  for (const sourceUnit of resolved.source_units) {
    if (sourceUnit.document_id !== recordDocumentId) {
      addError(errors, file, id, "source_unit_ids", `SourceUnit ${sourceUnit.source_unit_id} document_id must equal edition_context.document_id ${recordDocumentId}; found ${sourceUnit.document_id}`);
    }
  }
}

function validateMappingCoverage({ record, file, mappings, errors }) {
  const id = record.effective_record_id;
  const knowledgeIds = new Set(record.knowledge_record_ids || []);
  for (const mappingId of record.amendment_relation_ids || []) {
    const mapping = mappings.get(mappingId);
    if (!mapping) continue;
    const parentIds = Array.isArray(mapping.parent_knowledge_record_ids) ? mapping.parent_knowledge_record_ids : [];
    const addendumIds = Array.isArray(mapping.addendum_knowledge_record_ids) ? mapping.addendum_knowledge_record_ids : [];
    const hasParent = parentIds.some((krId) => knowledgeIds.has(krId));
    const hasAddendum = addendumIds.some((krId) => knowledgeIds.has(krId));
    if (!hasParent) {
      addError(errors, file, id, "knowledge_record_ids", `mapping-backed record is missing Parent endpoint coverage for ${mappingId}`);
    }
    if (!hasAddendum) {
      addError(errors, file, id, "knowledge_record_ids", `mapping-backed record is missing Addendum endpoint coverage for ${mappingId}`);
    }
  }
}

function validateContributorReviewStatus({ record, file, resolved, errors }) {
  if (record.review_status !== "reviewed") return;
  const id = record.effective_record_id;
  for (const collection of ["knowledge_records", "conditions", "quantitative_criteria", "source_units"]) {
    for (const item of resolved[collection]) {
      const itemId = item.knowledge_record_id || item.condition_id || item.criterion_id || item.source_unit_id;
      if (item.review_status !== "reviewed") {
        addError(errors, file, id, collection, `reviewed EffectiveRecord references unreviewed contributor ${itemId}`);
      }
    }
  }
  for (const xref of resolved.cross_references) {
    if (xref.review_status !== "reviewed" && !hasDocumentedLimitation(record, xref.xref_id)) {
      addError(errors, file, id, "cross_reference_ids", `unreviewed CrossReference ${xref.xref_id} must be documented in representation_limitations`);
    }
  }
}

function validateProvenanceGraph({ record, file, resolved, errors }) {
  const id = record.effective_record_id;
  const knowledgeIds = new Set(record.knowledge_record_ids || []);
  const conditionIds = new Set(record.condition_ids || []);
  const sourceUnitIds = new Set(record.source_unit_ids || []);

  for (const condition of resolved.conditions) {
    const appliesToIncludedKr = (condition.applies_to_ids || []).some((targetId) => knowledgeIds.has(targetId));
    if (!appliesToIncludedKr) {
      addError(errors, file, id, "condition_ids", `Condition ${condition.condition_id} does not apply to any included KnowledgeRecord`);
    }
    requireIncludedSourceUnit(errors, file, id, "source_unit_ids", condition.source_unit_id, sourceUnitIds, `Condition ${condition.condition_id}`);
  }

  for (const criterion of resolved.quantitative_criteria) {
    if (!knowledgeIds.has(criterion.knowledge_record_id)) {
      addError(errors, file, id, "quantitative_criterion_ids", `QuantitativeCriterion ${criterion.criterion_id} references KnowledgeRecord ${criterion.knowledge_record_id} not included in knowledge_record_ids`);
    }
    for (const conditionId of criterion.condition_ids || []) {
      if (!conditionIds.has(conditionId)) {
        addError(errors, file, id, "condition_ids", `QuantitativeCriterion ${criterion.criterion_id} condition ${conditionId} is not included`);
      }
    }
    requireIncludedSourceUnit(errors, file, id, "source_unit_ids", criterion.source_unit_id, sourceUnitIds, `QuantitativeCriterion ${criterion.criterion_id}`);
  }

  for (const kr of resolved.knowledge_records) {
    for (const sourceUnitId of kr.source_unit_ids || []) {
      requireIncludedSourceUnit(errors, file, id, "source_unit_ids", sourceUnitId, sourceUnitIds, `KnowledgeRecord ${kr.knowledge_record_id}`);
    }
  }

  for (const xref of resolved.cross_references) {
    requireIncludedSourceUnit(errors, file, id, "source_unit_ids", xref.source_unit_id, sourceUnitIds, `CrossReference ${xref.xref_id}`);
  }
}

function requireIncludedSourceUnit(errors, file, ownerId, field, sourceUnitId, sourceUnitIds, label) {
  if (!sourceUnitIds.has(sourceUnitId)) {
    addError(errors, file, ownerId, field, `${label} direct SourceUnit ${sourceUnitId} is not included`);
  }
}

function validateLegacyDerivedArtifacts({ sourceBundle, amendmentArtifact, effectiveArtifact, files }) {
  const errors = [];
  const normalizedFiles = {
    sourceFile: files && files.sourceFile ? files.sourceFile : "source",
    amendmentFile: files && files.amendmentFile ? files.amendmentFile : "amendments",
    effectiveFile: files && files.effectiveFile ? files.effectiveFile : "effective"
  };

  const sourceIndexes = buildSourceIndexes(sourceBundle || {});
  const mappings = validateAmendments({
    amendmentArtifact: amendmentArtifact || {},
    files: normalizedFiles,
    sourceIndexes,
    errors
  });
  const amendmentDocumentId = amendmentArtifact && amendmentArtifact.artifact && amendmentArtifact.artifact.document_id;
  const effectiveDocumentId = effectiveArtifact && effectiveArtifact.artifact && effectiveArtifact.artifact.document_id;
  if (amendmentDocumentId !== effectiveDocumentId) {
    addError(errors, normalizedFiles.effectiveFile, null, "artifact.document_id", `must equal amendment artifact document_id ${amendmentDocumentId}; found ${effectiveDocumentId}`);
  }

  validateEffectiveRecords({
    sourceBundle: sourceBundle || {},
    effectiveArtifact: effectiveArtifact || {},
    files: normalizedFiles,
    sourceIndexes,
    mappings,
    errors
  });

  return {
    ok: errors.length === 0,
    errors,
    amendmentMappingCount: mappings.size,
    effectiveRecordCount: Array.isArray(effectiveArtifact && effectiveArtifact.effective_records)
      ? effectiveArtifact.effective_records.length
      : 0
  };
}

const CONTRACT_ID_FIELDS = {
  GuidanceFamily: "guidance_family_id",
  DocumentEdition: "document_edition_id",
  EditionSource: "edition_source_id",
  LifecycleRelationship: "lifecycle_relationship_id",
  AmendmentMapping: "mapping_id",
  EffectiveRecord: "effective_record_id",
  EffectiveStateSnapshot: "snapshot_id",
  ReviewAttestation: "review_attestation_id",
  RiskAssessment: "risk_assessment_id"
};

function validateContractArtifacts({ sourceBundle, artifacts }) {
  const errors = [];
  const normalizedArtifacts = (artifacts || []).map((entry, index) => ({
    artifact: entry && entry.artifact,
    file: entry && entry.file ? entry.file : `artifact_${index}.json`
  }));

  for (const { artifact, file } of normalizedArtifacts) {
    if (!isObject(artifact) || !Object.prototype.hasOwnProperty.call(artifact, "derived_model_version") || !Object.prototype.hasOwnProperty.call(artifact, "artifact_type")) {
      addError(errors, file, null, "artifact_type", "derived contract artifacts must declare derived_model_version and artifact_type");
      continue;
    }
    const result = validateDerivedContractArtifact({ artifact, file });
    errors.push(...result.errors);
  }

  if (errors.length > 0) {
    return {
      ok: false,
      errors,
      amendmentMappingCount: 0,
      effectiveRecordCount: 0
    };
  }

  const sourceIndexes = buildSourceIndexes(sourceBundle || {});
  const contractIndexes = buildContractIndexes({ artifacts: normalizedArtifacts, errors });
  validateContractRegistry({ contractIndexes, sourceIndexes, errors });
  validateContractAmendmentMappings({ contractIndexes, sourceIndexes, errors });
  validateContractEffectiveRecords({ contractIndexes, sourceIndexes, errors });

  return {
    ok: errors.length === 0,
    errors,
    amendmentMappingCount: contractIndexes.amendmentMappings.size,
    effectiveRecordCount: contractIndexes.effectiveRecords.size
  };
}

function buildContractIndexes({ artifacts, errors }) {
  const indexes = {
    guidanceFamilies: new Map(),
    documentEditions: new Map(),
    editionSources: new Map(),
    lifecycleRelationships: new Map(),
    amendmentMappings: new Map(),
    effectiveRecords: new Map(),
    artifactsByType: new Map(),
    editionSourceDocuments: new Map(),
    recordOwners: new Map()
  };

  const mapByType = {
    GuidanceFamily: indexes.guidanceFamilies,
    DocumentEdition: indexes.documentEditions,
    EditionSource: indexes.editionSources,
    LifecycleRelationship: indexes.lifecycleRelationships,
    AmendmentMapping: indexes.amendmentMappings,
    EffectiveRecord: indexes.effectiveRecords
  };

  for (const { artifact, file } of artifacts) {
    if (!indexes.artifactsByType.has(artifact.artifact_type)) indexes.artifactsByType.set(artifact.artifact_type, []);
    indexes.artifactsByType.get(artifact.artifact_type).push({ artifact, file });
    const idField = CONTRACT_ID_FIELDS[artifact.artifact_type];
    const targetMap = mapByType[artifact.artifact_type];
    if (!idField || !targetMap) continue;
    for (const record of artifact.records || []) {
      const id = record && record[idField];
      if (!isNonEmptyString(id)) continue;
      if (targetMap.has(id)) {
        addError(errors, file, id, idField, "duplicate contract record ID");
      } else {
        targetMap.set(id, record);
        indexes.recordOwners.set(id, { artifact, file, artifactType: artifact.artifact_type });
        if (artifact.artifact_type === "EditionSource") {
          if (!indexes.editionSourceDocuments.has(record.document_edition_id)) {
            indexes.editionSourceDocuments.set(record.document_edition_id, new Set());
          }
          indexes.editionSourceDocuments.get(record.document_edition_id).add(record.document_id);
        }
      }
    }
  }
  return indexes;
}

function validateContractRegistry({ contractIndexes, sourceIndexes, errors }) {
  for (const [editionId, edition] of contractIndexes.documentEditions) {
    if (contractIndexes.guidanceFamilies.size > 0 && !contractIndexes.guidanceFamilies.has(edition.guidance_family_id)) {
      const owner = contractIndexes.recordOwners.get(editionId);
      addError(errors, owner.file, editionId, "guidance_family_id", `reference does not resolve to GuidanceFamily: ${edition.guidance_family_id}`);
    }
  }
  for (const [editionSourceId, editionSource] of contractIndexes.editionSources) {
    const owner = contractIndexes.recordOwners.get(editionSourceId);
    if (contractIndexes.documentEditions.size > 0 && !contractIndexes.documentEditions.has(editionSource.document_edition_id)) {
      addError(errors, owner.file, editionSourceId, "document_edition_id", `reference does not resolve to DocumentEdition: ${editionSource.document_edition_id}`);
    }
    requireSourceRef(errors, owner.file, sourceIndexes, editionSource.document_id, "document_id", editionSourceId, "documents");
  }
  for (const [relationshipId, relationship] of contractIndexes.lifecycleRelationships) {
    const owner = contractIndexes.recordOwners.get(relationshipId);
    if (contractIndexes.guidanceFamilies.size > 0 && !contractIndexes.guidanceFamilies.has(relationship.guidance_family_id)) {
      addError(errors, owner.file, relationshipId, "guidance_family_id", `reference does not resolve to GuidanceFamily: ${relationship.guidance_family_id}`);
    }
    const fromEdition = contractIndexes.documentEditions.get(relationship.from_document_edition_id);
    const toEdition = contractIndexes.documentEditions.get(relationship.to_document_edition_id);
    if (relationship.from_document_edition_id === relationship.to_document_edition_id) {
      addError(errors, owner.file, relationshipId, "to_document_edition_id", "LifecycleRelationship self-relations are not supported in Module 4.1");
    }
    if (contractIndexes.documentEditions.size > 0 && !fromEdition) {
      addError(errors, owner.file, relationshipId, "from_document_edition_id", `reference does not resolve to DocumentEdition: ${relationship.from_document_edition_id}`);
    } else if (fromEdition && fromEdition.guidance_family_id !== relationship.guidance_family_id) {
      addError(errors, owner.file, relationshipId, "from_document_edition_id", "DocumentEdition guidance_family_id must match LifecycleRelationship guidance_family_id");
    }
    if (contractIndexes.documentEditions.size > 0 && !toEdition) {
      addError(errors, owner.file, relationshipId, "to_document_edition_id", `reference does not resolve to DocumentEdition: ${relationship.to_document_edition_id}`);
    } else if (toEdition && toEdition.guidance_family_id !== relationship.guidance_family_id) {
      addError(errors, owner.file, relationshipId, "to_document_edition_id", "DocumentEdition guidance_family_id must match LifecycleRelationship guidance_family_id");
    }
    if (fromEdition && toEdition && fromEdition.jurisdiction !== toEdition.jurisdiction) {
      addError(errors, owner.file, relationshipId, "jurisdiction", "LifecycleRelationship editions must have matching jurisdiction");
    }
    if (fromEdition && relationship.jurisdiction !== fromEdition.jurisdiction) {
      addError(errors, owner.file, relationshipId, "jurisdiction", "LifecycleRelationship jurisdiction must match source DocumentEdition jurisdiction");
    }
    validateContractSourceReferences({ refs: relationship.source_references || [], ownerId: relationshipId, file: owner.file, sourceIndexes, errors });
    if (relationship.review_status === "reviewed") {
      for (const ref of relationship.source_references || []) {
        if (!isNonEmptyString(ref.source_unit_id)) continue;
        const sourceUnit = sourceIndexes.source_units.get(ref.source_unit_id);
        if (sourceUnit && sourceUnit.review_status !== "reviewed") {
          addError(errors, owner.file, relationshipId, "review_status", `reviewed LifecycleRelationship references unreviewed SourceUnit ${ref.source_unit_id}`);
        }
      }
    }
  }
}

function validateContractAmendmentMappings({ contractIndexes, sourceIndexes, errors }) {
  for (const [mappingId, mapping] of contractIndexes.amendmentMappings) {
    const owner = contractIndexes.recordOwners.get(mappingId);
    if (contractIndexes.documentEditions.size > 0) {
      const sourceEdition = contractIndexes.documentEditions.get(mapping.source_document_edition_id);
      const amendingEdition = contractIndexes.documentEditions.get(mapping.amending_document_edition_id);
      if (!sourceEdition) {
        addError(errors, owner.file, mappingId, "source_document_edition_id", `reference does not resolve to DocumentEdition: ${mapping.source_document_edition_id}`);
      } else if (sourceEdition.guidance_family_id !== mapping.guidance_family_id) {
        addError(errors, owner.file, mappingId, "source_document_edition_id", "DocumentEdition guidance_family_id must match mapping guidance_family_id");
      }
      if (!amendingEdition) {
        addError(errors, owner.file, mappingId, "amending_document_edition_id", `reference does not resolve to DocumentEdition: ${mapping.amending_document_edition_id}`);
      } else if (amendingEdition.guidance_family_id !== mapping.guidance_family_id) {
        addError(errors, owner.file, mappingId, "amending_document_edition_id", "DocumentEdition guidance_family_id must match mapping guidance_family_id");
      }
    }
    for (const sourceRecordId of mapping.source_record_ids || []) {
      const endpoint = requireSourceRef(errors, owner.file, sourceIndexes, sourceRecordId, "source_record_ids", mappingId, "knowledge_records");
      if (mapping.review_status === "reviewed" && endpoint && endpoint.review_status !== "reviewed") {
        addError(errors, owner.file, mappingId, "review_status", `reviewed mapping references unreviewed KnowledgeRecord ${sourceRecordId}`);
      }
    }
    for (const amendingRecordId of mapping.amending_record_ids || []) {
      const endpoint = requireSourceRef(errors, owner.file, sourceIndexes, amendingRecordId, "amending_record_ids", mappingId, "knowledge_records");
      if (mapping.review_status === "reviewed" && endpoint && endpoint.review_status !== "reviewed") {
        addError(errors, owner.file, mappingId, "review_status", `reviewed mapping references unreviewed KnowledgeRecord ${amendingRecordId}`);
      }
    }
    for (const xrefId of mapping.contextual_cross_reference_ids || []) {
      requireSourceRef(errors, owner.file, sourceIndexes, xrefId, "contextual_cross_reference_ids", mappingId, "cross_references");
    }
    validateContractSourceReferences({ refs: mapping.source_references || [], ownerId: mappingId, file: owner.file, sourceIndexes, errors });
    validateAuthorizedSourceDocuments({
      refs: mapping.source_references || [],
      ownerId: mappingId,
      file: owner.file,
      field: "source_references.document_id",
      editionIds: [mapping.source_document_edition_id, mapping.amending_document_edition_id],
      contractIndexes,
      errors
    });
  }
}

function validateContractEffectiveRecords({ contractIndexes, sourceIndexes, errors }) {
  for (const [effectiveRecordId, record] of contractIndexes.effectiveRecords) {
    const owner = contractIndexes.recordOwners.get(effectiveRecordId);
    if (record.derivation_basis === "reviewed_cross_document_synthesis") {
      addError(errors, owner.file, effectiveRecordId, "derivation_basis", "reviewed_cross_document_synthesis is not executable in Module 4.1 without an approved authorization artifact");
    }

    const authorizedEditionIds = [record.document_edition_id];
    if (contractIndexes.documentEditions.size > 0) {
      const edition = contractIndexes.documentEditions.get(record.document_edition_id);
      if (!edition) {
        addError(errors, owner.file, effectiveRecordId, "document_edition_id", `reference does not resolve to DocumentEdition: ${record.document_edition_id}`);
      } else if (edition.guidance_family_id !== record.guidance_family_id) {
        addError(errors, owner.file, effectiveRecordId, "document_edition_id", "DocumentEdition guidance_family_id must match EffectiveRecord guidance_family_id");
      }
    }

    validateContractSourceReferences({ refs: record.source_references || [], ownerId: effectiveRecordId, file: owner.file, sourceIndexes, errors });
    const resolved = resolveContractEffectiveContributors({ record, file: owner.file, sourceIndexes, errors });
    for (const mappingId of record.amendment_mapping_ids || []) {
      const mapping = contractIndexes.amendmentMappings.get(mappingId);
      if (!mapping) continue;
      authorizedEditionIds.push(mapping.source_document_edition_id, mapping.amending_document_edition_id);
    }
    validateAuthorizedSourceDocuments({
      refs: record.source_references || [],
      ownerId: effectiveRecordId,
      file: owner.file,
      field: "source_references.document_id",
      editionIds: authorizedEditionIds,
      contractIndexes,
      errors
    });
    validateContractRepresentationLimitations({ record, file: owner.file, contractIndexes, sourceIndexes, resolved, errors });
    validateContractEffectiveMappingCoverage({ record, file: owner.file, contractIndexes, resolved, errors });
    validateContractEffectiveProvenanceClosure({ record, file: owner.file, resolved, errors });
  }
}

function validateAuthorizedSourceDocuments({ refs, ownerId, file, field, editionIds, contractIndexes, errors }) {
  const allowedDocuments = new Set();
  let hasRelevantEditionSource = false;
  for (const editionId of editionIds || []) {
    const documents = contractIndexes.editionSourceDocuments.get(editionId);
    if (!documents) continue;
    hasRelevantEditionSource = true;
    for (const documentId of documents) allowedDocuments.add(documentId);
  }
  if (!hasRelevantEditionSource) return;
  for (const ref of refs) {
    if (!allowedDocuments.has(ref.document_id)) {
      addError(errors, file, ownerId, field, `source document ${ref.document_id} is not authorized by EditionSource for the referenced DocumentEdition`);
    }
  }
}

function validateContractSourceReferences({ refs, ownerId, file, sourceIndexes, errors }) {
  for (const ref of refs) {
    requireSourceRef(errors, file, sourceIndexes, ref.document_id, "source_references.document_id", ownerId, "documents");
    if (ref.section_id !== null && ref.section_id !== undefined) {
      requireSourceRef(errors, file, sourceIndexes, ref.section_id, "source_references.section_id", ownerId, "sections");
    }
    if (ref.source_unit_id !== null && ref.source_unit_id !== undefined) {
      const sourceUnit = requireSourceRef(errors, file, sourceIndexes, ref.source_unit_id, "source_references.source_unit_id", ownerId, "source_units");
      if (sourceUnit && sourceUnit.document_id !== ref.document_id) {
        addError(errors, file, ownerId, "source_references.source_unit_id", `SourceUnit ${ref.source_unit_id} document_id must match source reference document_id ${ref.document_id}`);
      }
      if (sourceUnit && ref.section_id && sourceUnit.section_id !== ref.section_id) {
        addError(errors, file, ownerId, "source_references.source_unit_id", `SourceUnit ${ref.source_unit_id} section_id must match source reference section_id ${ref.section_id}`);
      }
    }
  }
}

function resolveContractEffectiveContributors({ record, file, sourceIndexes, errors }) {
  const resolved = {
    knowledge_records: [],
    conditions: [],
    quantitative_criteria: [],
    cross_references: [],
    source_units: []
  };
  for (const contributorId of record.contributing_record_ids || []) {
    const layer = sourceIndexes.idLayers.get(contributorId);
    if (!layer) {
      addError(errors, file, record.effective_record_id, "contributing_record_ids", `reference does not resolve to a source contributor: ${contributorId}`);
      continue;
    }
    const collection = layer.find((candidate) => Object.prototype.hasOwnProperty.call(resolved, candidate));
    if (!collection) {
      addError(errors, file, record.effective_record_id, "contributing_record_ids", `reference resolves to unsupported source layer ${layer.join(", ")}: ${contributorId}`);
      continue;
    }
    resolved[collection].push(sourceIndexes[collection].get(contributorId));
  }
  return resolved;
}

function validateContractEffectiveMappingCoverage({ record, file, contractIndexes, resolved, errors }) {
  const contributorIds = new Set(record.contributing_record_ids || []);
  for (const mappingId of record.amendment_mapping_ids || []) {
    const mapping = contractIndexes.amendmentMappings.get(mappingId);
    if (!mapping) {
      addError(errors, file, record.effective_record_id, "amendment_mapping_ids", `reference does not resolve to AmendmentMapping: ${mappingId}`);
      continue;
    }
    if (mapping.guidance_family_id !== record.guidance_family_id) {
      addError(errors, file, record.effective_record_id, "amendment_mapping_ids", `unauthorized cross-family synthesis through AmendmentMapping ${mappingId}`);
    }
    if (record.review_status === "reviewed" && mapping.review_status !== "reviewed") {
      addError(errors, file, record.effective_record_id, "amendment_mapping_ids", `reviewed EffectiveRecord references unreviewed AmendmentMapping ${mappingId}`);
    }
    const hasSource = (mapping.source_record_ids || []).some((id) => contributorIds.has(id));
    const hasAmending = (mapping.amending_record_ids || []).some((id) => contributorIds.has(id));
    if (!hasSource) {
      addError(errors, file, record.effective_record_id, "contributing_record_ids", `mapping-backed record is missing source endpoint coverage for ${mappingId}`);
    }
    if (!hasAmending) {
      addError(errors, file, record.effective_record_id, "contributing_record_ids", `mapping-backed record is missing amending endpoint coverage for ${mappingId}`);
    }
  }
  if (record.review_status === "reviewed") {
    for (const collection of ["knowledge_records", "conditions", "quantitative_criteria", "source_units"]) {
      for (const contributor of resolved[collection]) {
        const contributorId = contributor.knowledge_record_id || contributor.condition_id || contributor.criterion_id || contributor.source_unit_id;
        if (contributor.review_status !== "reviewed") {
          addError(errors, file, record.effective_record_id, collection, `reviewed EffectiveRecord references unreviewed contributor ${contributorId}`);
        }
      }
    }
    const limitedCrossReferenceIds = collectLimitedCrossReferenceIds(record);
    for (const xref of resolved.cross_references) {
      const unresolved = xref.resolution_status && xref.resolution_status !== "resolved";
      if ((xref.review_status !== "reviewed" || unresolved) && !limitedCrossReferenceIds.has(xref.xref_id)) {
        addError(errors, file, record.effective_record_id, "representation_limitations", `CrossReference ${xref.xref_id} must be documented in structured representation_limitations`);
      }
    }
  }
}

function collectLimitedCrossReferenceIds(record) {
  const ids = new Set();
  for (const limitation of record.representation_limitations || []) {
    for (const id of limitation.affected_cross_reference_ids || []) ids.add(id);
  }
  return ids;
}

function validateContractRepresentationLimitations({ record, file, contractIndexes, sourceIndexes, resolved, errors }) {
  const evidenceIds = new Set(record.contributing_record_ids || []);
  for (const mappingId of record.amendment_mapping_ids || []) evidenceIds.add(mappingId);
  for (const ref of record.source_references || []) {
    if (isNonEmptyString(ref.document_id)) evidenceIds.add(ref.document_id);
    if (isNonEmptyString(ref.section_id)) evidenceIds.add(ref.section_id);
    if (isNonEmptyString(ref.source_unit_id)) evidenceIds.add(ref.source_unit_id);
  }
  const sourceCollectionsById = new Map([
    ["documents", "document_id"],
    ["sections", "section_id"],
    ["source_units", "source_unit_id"],
    ["knowledge_records", "knowledge_record_id"],
    ["quantitative_criteria", "criterion_id"],
    ["conditions", "condition_id"],
    ["cross_references", "xref_id"]
  ]);
  const limitationList = record.representation_limitations || [];
  for (const limitation of limitationList) {
    for (const xrefId of limitation.affected_cross_reference_ids || []) {
      requireSourceRef(errors, file, sourceIndexes, xrefId, "representation_limitations.affected_cross_reference_ids", record.effective_record_id, "cross_references");
      if (!evidenceIds.has(xrefId)) {
        addError(errors, file, record.effective_record_id, "representation_limitations.affected_cross_reference_ids", `affected CrossReference ${xrefId} must be a contributor or referenced evidence`);
      }
    }
    for (const affectedId of limitation.affected_record_ids || []) {
      if (contractIndexes.amendmentMappings.has(affectedId)) {
        if (!evidenceIds.has(affectedId)) {
          addError(errors, file, record.effective_record_id, "representation_limitations.affected_record_ids", `affected record ${affectedId} must be a contributor or referenced evidence`);
        }
        continue;
      }
      const layers = sourceIndexes.idLayers.get(affectedId);
      if (!layers) {
        addError(errors, file, record.effective_record_id, "representation_limitations.affected_record_ids", `reference does not resolve to source or contract evidence: ${affectedId}`);
        continue;
      }
      const supportedLayer = layers.find((layer) => sourceCollectionsById.has(layer));
      if (!supportedLayer) {
        addError(errors, file, record.effective_record_id, "representation_limitations.affected_record_ids", `reference resolves to unsupported evidence layer ${layers.join(", ")}: ${affectedId}`);
      }
      if (!evidenceIds.has(affectedId)) {
        addError(errors, file, record.effective_record_id, "representation_limitations.affected_record_ids", `affected record ${affectedId} must be a contributor or referenced evidence`);
      }
    }
  }
}

function validateContractEffectiveProvenanceClosure({ record, file, resolved, errors }) {
  const sourceUnitIds = new Set((record.source_references || []).map((ref) => ref.source_unit_id).filter(isNonEmptyString));
  const knowledgeIds = new Set(resolved.knowledge_records.map((item) => item.knowledge_record_id));
  const conditionIds = new Set(resolved.conditions.map((item) => item.condition_id));

  for (const kr of resolved.knowledge_records) {
    for (const sourceUnitId of kr.source_unit_ids || []) {
      requireContractSourceUnitReference(errors, file, record.effective_record_id, sourceUnitId, sourceUnitIds, `KnowledgeRecord ${kr.knowledge_record_id}`);
    }
  }
  for (const condition of resolved.conditions) {
    if (!(condition.applies_to_ids || []).some((id) => knowledgeIds.has(id))) {
      addError(errors, file, record.effective_record_id, "contributing_record_ids", `Condition ${condition.condition_id} does not apply to any included KnowledgeRecord`);
    }
    requireContractSourceUnitReference(errors, file, record.effective_record_id, condition.source_unit_id, sourceUnitIds, `Condition ${condition.condition_id}`);
  }
  for (const criterion of resolved.quantitative_criteria) {
    if (!knowledgeIds.has(criterion.knowledge_record_id)) {
      addError(errors, file, record.effective_record_id, "contributing_record_ids", `QuantitativeCriterion ${criterion.criterion_id} references KnowledgeRecord ${criterion.knowledge_record_id} not included`);
    }
    for (const conditionId of criterion.condition_ids || []) {
      if (!conditionIds.has(conditionId)) {
        addError(errors, file, record.effective_record_id, "contributing_record_ids", `QuantitativeCriterion ${criterion.criterion_id} condition ${conditionId} is not included`);
      }
    }
    requireContractSourceUnitReference(errors, file, record.effective_record_id, criterion.source_unit_id, sourceUnitIds, `QuantitativeCriterion ${criterion.criterion_id}`);
  }
  for (const xref of resolved.cross_references) {
    requireContractSourceUnitReference(errors, file, record.effective_record_id, xref.source_unit_id, sourceUnitIds, `CrossReference ${xref.xref_id}`);
  }
}

function requireContractSourceUnitReference(errors, file, ownerId, sourceUnitId, sourceUnitIds, label) {
  if (!sourceUnitIds.has(sourceUnitId)) {
    addError(errors, file, ownerId, "source_references", `${label} direct SourceUnit ${sourceUnitId} is not included`);
  }
}

function shouldUseLegacyFileDispatch(files) {
  return isLegacySchemaExemptFile(files.amendmentFile) && isLegacySchemaExemptFile(files.effectiveFile);
}

function validateDerivedArtifacts({ sourceBundle, amendmentArtifact, effectiveArtifact, files }) {
  const normalizedFiles = {
    sourceFile: files && files.sourceFile ? files.sourceFile : "source",
    amendmentFile: files && files.amendmentFile ? files.amendmentFile : "amendments",
    effectiveFile: files && files.effectiveFile ? files.effectiveFile : "effective"
  };
  if (shouldUseLegacyFileDispatch(normalizedFiles)) {
    return validateLegacyDerivedArtifacts({
      sourceBundle,
      amendmentArtifact,
      effectiveArtifact,
      files: normalizedFiles
    });
  }
  return validateContractArtifacts({
    sourceBundle,
    artifacts: [
      { artifact: amendmentArtifact, file: normalizedFiles.amendmentFile },
      { artifact: effectiveArtifact, file: normalizedFiles.effectiveFile }
    ]
  });
}

function loadJson(file, errors) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (error) {
    addError(errors, file, null, "JSON", error.message);
    return null;
  }
}

function validateDerivedFiles({ sourceFile, amendmentFile, effectiveFile }) {
  const loadErrors = [];
  const sourceBundle = loadJson(sourceFile, loadErrors);
  const amendmentArtifact = loadJson(amendmentFile, loadErrors);
  const effectiveArtifact = loadJson(effectiveFile, loadErrors);
  if (loadErrors.length > 0) {
    return {
      ok: false,
      configError: true,
      errors: loadErrors,
      amendmentMappingCount: 0,
      effectiveRecordCount: 0
    };
  }
  return validateDerivedArtifacts({
    sourceBundle,
    amendmentArtifact,
    effectiveArtifact,
    files: { sourceFile, amendmentFile, effectiveFile }
  });
}

function parseArgs(args) {
  const parsed = {};
  for (let index = 0; index < args.length; index += 2) {
    const flag = args[index];
    const value = args[index + 1];
    if (!value || !["--source", "--amendments", "--effective"].includes(flag)) return null;
    if (flag === "--source") parsed.sourceFile = value;
    if (flag === "--amendments") parsed.amendmentFile = value;
    if (flag === "--effective") parsed.effectiveFile = value;
  }
  if (!parsed.sourceFile || !parsed.amendmentFile || !parsed.effectiveFile) return null;
  return parsed;
}

function main() {
  const parsed = parseArgs(process.argv.slice(2));
  if (!parsed) {
    console.error("Usage: node scripts/validate_derived.js --source <source-bundle.json> --amendments <amendment-mappings.json> --effective <effective-records.json>");
    process.exit(2);
  }

  const result = validateDerivedFiles(parsed);
  if (!result.ok) {
    const exitCode = result.configError ? 2 : 1;
    console.error(`Derived validation failed with ${result.errors.length} error(s):`);
    for (const error of result.errors) console.error(`- ${error}`);
    process.exit(exitCode);
  }

  console.log(`Validated ${result.amendmentMappingCount} amendment mapping(s) and ${result.effectiveRecordCount} EffectiveRecord(s).`);
}

if (require.main === module) {
  main();
}

module.exports = {
  normalizeRepoPath,
  validateContractArtifacts,
  validateDerivedContractArtifact,
  validateDerivedArtifacts,
  validateDerivedFiles,
  validateLegacyDerivedArtifacts
};
