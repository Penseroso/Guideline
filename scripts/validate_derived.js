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

function isContractMarkedArtifact(artifact) {
  return isObject(artifact) && (
    Object.prototype.hasOwnProperty.call(artifact, "derived_model_version") ||
    Object.prototype.hasOwnProperty.call(artifact, "artifact_type")
  );
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

function validateDerivedContractArtifactIfRequired({ artifact, file }) {
  if (isLegacySchemaExemptFile(file) || !isContractMarkedArtifact(artifact)) {
    return { ok: true, errors: [], schemaValidated: false };
  }
  const result = validateDerivedContractArtifact({ artifact, file });
  return { ...result, schemaValidated: true };
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

function validateDerivedArtifacts({ sourceBundle, amendmentArtifact, effectiveArtifact, files }) {
  const errors = [];
  const normalizedFiles = {
    sourceFile: files && files.sourceFile ? files.sourceFile : "source",
    amendmentFile: files && files.amendmentFile ? files.amendmentFile : "amendments",
    effectiveFile: files && files.effectiveFile ? files.effectiveFile : "effective"
  };

  const amendmentSchemaResult = validateDerivedContractArtifactIfRequired({
    artifact: amendmentArtifact,
    file: normalizedFiles.amendmentFile
  });
  const effectiveSchemaResult = validateDerivedContractArtifactIfRequired({
    artifact: effectiveArtifact,
    file: normalizedFiles.effectiveFile
  });
  errors.push(...amendmentSchemaResult.errors, ...effectiveSchemaResult.errors);
  if (errors.length > 0) {
    return {
      ok: false,
      errors,
      amendmentMappingCount: 0,
      effectiveRecordCount: 0
    };
  }

  if (amendmentSchemaResult.schemaValidated || effectiveSchemaResult.schemaValidated) {
    return {
      ok: true,
      errors,
      amendmentMappingCount: Array.isArray(amendmentArtifact && amendmentArtifact.records) ? amendmentArtifact.records.length : 0,
      effectiveRecordCount: Array.isArray(effectiveArtifact && effectiveArtifact.records) ? effectiveArtifact.records.length : 0
    };
  }

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
  validateDerivedContractArtifact,
  validateDerivedArtifacts,
  validateDerivedFiles
};
