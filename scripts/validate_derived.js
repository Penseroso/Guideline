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

const SOURCE_COLLECTIONS = [
  ["documents", "document_id"],
  ["sections", "section_id"],
  ["source_units", "source_unit_id"],
  ["knowledge_records", "knowledge_record_id"],
  ["quantitative_criteria", "criterion_id"],
  ["conditions", "condition_id"],
  ["cross_references", "xref_id"]
];

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

function collectJsonSchemaFiles(directory) {
  const files = [];
  if (!fs.existsSync(directory)) return files;
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...collectJsonSchemaFiles(entryPath));
    else if (entry.isFile() && entry.name.endsWith(".schema.json")) files.push(entryPath);
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

function validateDerivedContractArtifact({ artifact, file }) {
  const errors = [];
  if (!isObject(artifact)) {
    addError(errors, file, null, "/", "must be an object");
    return { ok: false, errors };
  }
  const schemaId = DERIVED_ARTIFACT_SCHEMAS[artifact.artifact_type];
  if (!schemaId) {
    addError(errors, file, null, "artifact_type", `unsupported derived artifact type: ${artifact.artifact_type}`);
    return { ok: false, errors };
  }
  const validate = getDerivedSchemaAjv().getSchema(schemaId);
  if (!validate) {
    addError(errors, file, null, "schema", `schema not registered for artifact_type ${artifact.artifact_type}`);
    return { ok: false, errors };
  }
  if (!validate(artifact)) {
    for (const error of validate.errors || []) {
      addError(errors, file, null, error.instancePath || "/", error.message);
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

function requireSourceRef(errors, file, indexes, id, field, ownerId, collection) {
  if (!isNonEmptyString(id)) {
    addError(errors, file, ownerId, field, "must be a non-empty string");
    return null;
  }
  const item = indexes[collection].get(id);
  if (item) return item;
  const layers = indexes.idLayers.get(id);
  const message = layers && !layers.includes(collection)
    ? `reference resolves to ${layers.join(", ")}, expected ${collection}: ${id}`
    : `reference does not resolve to ${collection}: ${id}`;
  addError(errors, file, ownerId, field, message);
  return null;
}

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
    errors.push(...validateDerivedContractArtifact({ artifact, file }).errors);
  }
  if (errors.length > 0) return validationResult(errors, 0, 0);

  const sourceIndexes = buildSourceIndexes(sourceBundle || {});
  const contractIndexes = buildContractIndexes({ artifacts: normalizedArtifacts, errors });
  validateContractRegistry({ contractIndexes, sourceIndexes, errors });
  validateContractHistory({ contractIndexes, errors });
  validateContractAmendmentMappings({ contractIndexes, sourceIndexes, errors });
  validateContractEffectiveRecords({ contractIndexes, sourceIndexes, errors });
  return validationResult(errors, contractIndexes.amendmentMappings.size, contractIndexes.effectiveRecords.size);
}

function validationResult(errors, amendmentMappingCount, effectiveRecordCount) {
  return { ok: errors.length === 0, errors, amendmentMappingCount, effectiveRecordCount };
}

function buildContractIndexes({ artifacts, errors }) {
  const indexes = {
    allRecords: new Map(),
    guidanceFamilies: new Map(),
    documentEditions: new Map(),
    editionSources: new Map(),
    lifecycleRelationships: new Map(),
    amendmentMappings: new Map(),
    effectiveRecords: new Map(),
    effectiveStateSnapshots: new Map(),
    reviewAttestations: new Map(),
    riskAssessments: new Map(),
    editionSourceDocuments: new Map(),
    recordOwners: new Map()
  };
  const maps = {
    GuidanceFamily: indexes.guidanceFamilies,
    DocumentEdition: indexes.documentEditions,
    EditionSource: indexes.editionSources,
    LifecycleRelationship: indexes.lifecycleRelationships,
    AmendmentMapping: indexes.amendmentMappings,
    EffectiveRecord: indexes.effectiveRecords,
    EffectiveStateSnapshot: indexes.effectiveStateSnapshots,
    ReviewAttestation: indexes.reviewAttestations,
    RiskAssessment: indexes.riskAssessments
  };
  for (const { artifact, file } of artifacts) {
    const idField = CONTRACT_ID_FIELDS[artifact.artifact_type];
    const targetMap = maps[artifact.artifact_type];
    if (!idField || !targetMap) continue;
    for (const record of artifact.records || []) {
      const id = record && record[idField];
      if (!isNonEmptyString(id)) continue;
      if (indexes.allRecords.has(id)) {
        const prior = indexes.recordOwners.get(id);
        addError(errors, file, id, idField, `duplicate contract record ID already used by ${prior.artifactType} in ${prior.file}`);
        continue;
      }
      indexes.allRecords.set(id, record);
      targetMap.set(id, record);
      indexes.recordOwners.set(id, { artifact, file, artifactType: artifact.artifact_type, idField });
      if (artifact.artifact_type === "EditionSource") {
        if (!indexes.editionSourceDocuments.has(record.document_edition_id)) indexes.editionSourceDocuments.set(record.document_edition_id, new Set());
        indexes.editionSourceDocuments.get(record.document_edition_id).add(record.document_id);
      }
    }
  }
  return indexes;
}

function validateContractRegistry({ contractIndexes, sourceIndexes, errors }) {
  for (const [editionId, edition] of contractIndexes.documentEditions) {
    const owner = contractIndexes.recordOwners.get(editionId);
    const family = contractIndexes.guidanceFamilies.get(edition.guidance_family_id);
    if (contractIndexes.guidanceFamilies.size > 0 && !family) {
      addError(errors, owner.file, editionId, "guidance_family_id", `reference does not resolve to GuidanceFamily: ${edition.guidance_family_id}`);
    } else if (family && !(family.jurisdictions || []).includes(edition.jurisdiction)) {
      addError(errors, owner.file, editionId, "jurisdiction", `DocumentEdition jurisdiction ${edition.jurisdiction} must be listed in GuidanceFamily jurisdictions`);
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
    const fromEdition = contractIndexes.documentEditions.get(relationship.from_document_edition_id);
    const toEdition = contractIndexes.documentEditions.get(relationship.to_document_edition_id);
    if (contractIndexes.guidanceFamilies.size > 0 && !contractIndexes.guidanceFamilies.has(relationship.guidance_family_id)) {
      addError(errors, owner.file, relationshipId, "guidance_family_id", `reference does not resolve to GuidanceFamily: ${relationship.guidance_family_id}`);
    }
    if (relationship.from_document_edition_id === relationship.to_document_edition_id) {
      addError(errors, owner.file, relationshipId, "to_document_edition_id", "LifecycleRelationship self-relations are not supported in Module 4.1");
    }
    validateRelationshipEdition({ relationship, relationshipId, field: "from_document_edition_id", edition: fromEdition, contractIndexes, errors, file: owner.file });
    validateRelationshipEdition({ relationship, relationshipId, field: "to_document_edition_id", edition: toEdition, contractIndexes, errors, file: owner.file });
    if (fromEdition && relationship.jurisdiction !== fromEdition.jurisdiction) addError(errors, owner.file, relationshipId, "jurisdiction", "LifecycleRelationship jurisdiction must match source DocumentEdition jurisdiction");
    if (toEdition && relationship.jurisdiction !== toEdition.jurisdiction) addError(errors, owner.file, relationshipId, "jurisdiction", "LifecycleRelationship jurisdiction must match target DocumentEdition jurisdiction");
    validateContractSourceReferences({ refs: relationship.source_references || [], ownerId: relationshipId, file: owner.file, sourceIndexes, errors });
    validateAuthorizedSourceDocuments({ refs: relationship.source_references || [], ownerId: relationshipId, file: owner.file, field: "source_references.document_id", editionIds: [relationship.from_document_edition_id, relationship.to_document_edition_id], contractIndexes, errors });
    if (relationship.review_status === "reviewed") validateReviewedSourceUnitRefs({ refs: relationship.source_references || [], ownerId: relationshipId, file: owner.file, sourceIndexes, errors, label: "LifecycleRelationship" });
  }
}

function validateRelationshipEdition({ relationship, relationshipId, field, edition, contractIndexes, errors, file }) {
  if (contractIndexes.documentEditions.size > 0 && !edition) {
    addError(errors, file, relationshipId, field, `reference does not resolve to DocumentEdition: ${relationship[field]}`);
  } else if (edition && edition.guidance_family_id !== relationship.guidance_family_id) {
    addError(errors, file, relationshipId, field, "DocumentEdition guidance_family_id must match LifecycleRelationship guidance_family_id");
  }
}

function validateReviewedSourceUnitRefs({ refs, ownerId, file, sourceIndexes, errors, label }) {
  for (const ref of refs) {
    if (!isNonEmptyString(ref.source_unit_id)) continue;
    const sourceUnit = sourceIndexes.source_units.get(ref.source_unit_id);
    if (sourceUnit && sourceUnit.review_status !== "reviewed") {
      addError(errors, file, ownerId, "review_status", `reviewed ${label} references unreviewed SourceUnit ${ref.source_unit_id}`);
    }
  }
}

function validateContractHistory({ contractIndexes, errors }) {
  const edges = new Map();
  for (const [id, record] of contractIndexes.allRecords) {
    const owner = contractIndexes.recordOwners.get(id);
    const predecessors = record.history && Array.isArray(record.history.predecessor_record_ids) ? record.history.predecessor_record_ids : [];
    for (const predecessorId of predecessors) {
      if (predecessorId === id) addError(errors, owner.file, id, "history.predecessor_record_ids", "must not reference the current record ID");
      if (contractIndexes.allRecords.has(predecessorId)) {
        if (!edges.has(id)) edges.set(id, []);
        edges.get(id).push(predecessorId);
      }
    }
  }
  const visiting = new Set();
  const visited = new Set();
  function visit(id, pathIds) {
    if (visiting.has(id)) {
      const owner = contractIndexes.recordOwners.get(id);
      addError(errors, owner.file, id, "history.predecessor_record_ids", `predecessor cycle detected: ${[...pathIds, id].join(" -> ")}`);
      return;
    }
    if (visited.has(id)) return;
    visiting.add(id);
    for (const next of edges.get(id) || []) visit(next, [...pathIds, id]);
    visiting.delete(id);
    visited.add(id);
  }
  for (const id of edges.keys()) visit(id, []);
}

function validateContractAmendmentMappings({ contractIndexes, sourceIndexes, errors }) {
  for (const [mappingId, mapping] of contractIndexes.amendmentMappings) {
    const owner = contractIndexes.recordOwners.get(mappingId);
    const sourceEdition = contractIndexes.documentEditions.get(mapping.source_document_edition_id);
    const amendingEdition = contractIndexes.documentEditions.get(mapping.amending_document_edition_id);
    validateMappingEdition({ mapping, mappingId, field: "source_document_edition_id", edition: sourceEdition, contractIndexes, errors, file: owner.file });
    validateMappingEdition({ mapping, mappingId, field: "amending_document_edition_id", edition: amendingEdition, contractIndexes, errors, file: owner.file });
    const sourceUnitIds = sourceUnitRefSet(mapping.source_references || []);
    for (const sourceRecordId of mapping.source_record_ids || []) {
      const endpoint = requireSourceRef(errors, owner.file, sourceIndexes, sourceRecordId, "source_record_ids", mappingId, "knowledge_records");
      if (mapping.review_status === "reviewed" && endpoint && endpoint.review_status !== "reviewed") addError(errors, owner.file, mappingId, "review_status", `reviewed mapping references unreviewed KnowledgeRecord ${sourceRecordId}`);
      validateKnowledgeRecordEvidence({ record: endpoint, ownerId: mappingId, file: owner.file, field: "source_record_ids", sourceIndexes, sourceUnitIds, editionId: mapping.source_document_edition_id, contractIndexes, errors });
    }
    for (const amendingRecordId of mapping.amending_record_ids || []) {
      const endpoint = requireSourceRef(errors, owner.file, sourceIndexes, amendingRecordId, "amending_record_ids", mappingId, "knowledge_records");
      if (mapping.review_status === "reviewed" && endpoint && endpoint.review_status !== "reviewed") addError(errors, owner.file, mappingId, "review_status", `reviewed mapping references unreviewed KnowledgeRecord ${amendingRecordId}`);
      validateKnowledgeRecordEvidence({ record: endpoint, ownerId: mappingId, file: owner.file, field: "amending_record_ids", sourceIndexes, sourceUnitIds, editionId: mapping.amending_document_edition_id, contractIndexes, errors });
    }
    for (const xrefId of mapping.contextual_cross_reference_ids || []) {
      const xref = requireSourceRef(errors, owner.file, sourceIndexes, xrefId, "contextual_cross_reference_ids", mappingId, "cross_references");
      if (xref) requireContractSourceUnitReference(errors, owner.file, mappingId, xref.source_unit_id, sourceUnitIds, `CrossReference ${xref.xref_id}`);
    }
    validateContractSourceReferences({ refs: mapping.source_references || [], ownerId: mappingId, file: owner.file, sourceIndexes, errors });
    validateAuthorizedSourceDocuments({ refs: mapping.source_references || [], ownerId: mappingId, file: owner.file, field: "source_references.document_id", editionIds: [mapping.source_document_edition_id, mapping.amending_document_edition_id], contractIndexes, errors });
  }
}

function validateMappingEdition({ mapping, mappingId, field, edition, contractIndexes, errors, file }) {
  if (contractIndexes.documentEditions.size > 0 && !edition) {
    addError(errors, file, mappingId, field, `reference does not resolve to DocumentEdition: ${mapping[field]}`);
  } else if (edition && edition.guidance_family_id !== mapping.guidance_family_id) {
    addError(errors, file, mappingId, field, "DocumentEdition guidance_family_id must match mapping guidance_family_id");
  }
}

function validateKnowledgeRecordEvidence({ record, ownerId, file, field, sourceIndexes, sourceUnitIds, editionId, contractIndexes, errors }) {
  if (!record) return;
  for (const sourceUnitId of record.source_unit_ids || []) {
    requireContractSourceUnitReference(errors, file, ownerId, sourceUnitId, sourceUnitIds, `KnowledgeRecord ${record.knowledge_record_id}`);
    validateSourceUnitEditionAuthorization({ sourceUnitId, editionId, ownerId, file, field, sourceIndexes, contractIndexes, errors });
  }
}

function validateSourceUnitEditionAuthorization({ sourceUnitId, editionId, ownerId, file, field, sourceIndexes, contractIndexes, errors }) {
  const allowedDocuments = contractIndexes.editionSourceDocuments.get(editionId);
  if (!allowedDocuments) return;
  const sourceUnit = sourceIndexes.source_units.get(sourceUnitId);
  if (sourceUnit && !allowedDocuments.has(sourceUnit.document_id)) {
    addError(errors, file, ownerId, field, `SourceUnit ${sourceUnitId} document ${sourceUnit.document_id} is not authorized by EditionSource for DocumentEdition ${editionId}`);
  }
}

function validateContractEffectiveRecords({ contractIndexes, sourceIndexes, errors }) {
  for (const [effectiveRecordId, record] of contractIndexes.effectiveRecords) {
    const owner = contractIndexes.recordOwners.get(effectiveRecordId);
    if (record.derivation_basis === "reviewed_cross_document_synthesis") addError(errors, owner.file, effectiveRecordId, "derivation_basis", "reviewed_cross_document_synthesis is not executable in Module 4.1 without an approved authorization artifact");
    const edition = contractIndexes.documentEditions.get(record.document_edition_id);
    const authorizedEditionIds = [record.document_edition_id];
    if (contractIndexes.documentEditions.size > 0 && !edition) {
      addError(errors, owner.file, effectiveRecordId, "document_edition_id", `reference does not resolve to DocumentEdition: ${record.document_edition_id}`);
    } else if (edition) {
      if (edition.guidance_family_id !== record.guidance_family_id) addError(errors, owner.file, effectiveRecordId, "document_edition_id", "DocumentEdition guidance_family_id must match EffectiveRecord guidance_family_id");
      if (edition.jurisdiction !== record.jurisdiction) addError(errors, owner.file, effectiveRecordId, "jurisdiction", "EffectiveRecord jurisdiction must match DocumentEdition jurisdiction");
    }
    validateContractSourceReferences({ refs: record.source_references || [], ownerId: effectiveRecordId, file: owner.file, sourceIndexes, errors });
    const resolved = resolveContractEffectiveContributors({ record, file: owner.file, sourceIndexes, errors });
    for (const mappingId of record.amendment_mapping_ids || []) {
      const mapping = contractIndexes.amendmentMappings.get(mappingId);
      if (mapping) authorizedEditionIds.push(mapping.source_document_edition_id, mapping.amending_document_edition_id);
    }
    validateAuthorizedSourceDocuments({ refs: record.source_references || [], ownerId: effectiveRecordId, file: owner.file, field: "source_references.document_id", editionIds: authorizedEditionIds, contractIndexes, errors });
    validateContractRepresentationLimitations({ record, file: owner.file, contractIndexes, sourceIndexes, errors });
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
    if (!allowedDocuments.has(ref.document_id)) addError(errors, file, ownerId, field, `source document ${ref.document_id} is not authorized by EditionSource for the referenced DocumentEdition`);
  }
}

function validateContractSourceReferences({ refs, ownerId, file, sourceIndexes, errors }) {
  for (const ref of refs) {
    requireSourceRef(errors, file, sourceIndexes, ref.document_id, "source_references.document_id", ownerId, "documents");
    const section = isNonEmptyString(ref.section_id) ? requireSourceRef(errors, file, sourceIndexes, ref.section_id, "source_references.section_id", ownerId, "sections") : null;
    if (section && section.document_id !== ref.document_id) addError(errors, file, ownerId, "source_references.section_id", `Section ${ref.section_id} document_id must match source reference document_id ${ref.document_id}`);
    const sourceUnit = isNonEmptyString(ref.source_unit_id) ? requireSourceRef(errors, file, sourceIndexes, ref.source_unit_id, "source_references.source_unit_id", ownerId, "source_units") : null;
    if (sourceUnit && sourceUnit.document_id !== ref.document_id) addError(errors, file, ownerId, "source_references.source_unit_id", `SourceUnit ${ref.source_unit_id} document_id must match source reference document_id ${ref.document_id}`);
    if (sourceUnit && ref.section_id && sourceUnit.section_id !== ref.section_id) addError(errors, file, ownerId, "source_references.source_unit_id", `SourceUnit ${ref.source_unit_id} section_id must match source reference section_id ${ref.section_id}`);
  }
}

function sourceUnitRefSet(refs) {
  return new Set((refs || []).map((ref) => ref.source_unit_id).filter(isNonEmptyString));
}

function resolveContractEffectiveContributors({ record, file, sourceIndexes, errors }) {
  const resolved = { knowledge_records: [], conditions: [], quantitative_criteria: [], cross_references: [], source_units: [] };
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
    if (mapping.guidance_family_id !== record.guidance_family_id) addError(errors, file, record.effective_record_id, "amendment_mapping_ids", `unauthorized cross-family synthesis through AmendmentMapping ${mappingId}`);
    if (record.review_status === "reviewed" && mapping.review_status !== "reviewed") addError(errors, file, record.effective_record_id, "amendment_mapping_ids", `reviewed EffectiveRecord references unreviewed AmendmentMapping ${mappingId}`);
    if (!(mapping.source_record_ids || []).some((id) => contributorIds.has(id))) addError(errors, file, record.effective_record_id, "contributing_record_ids", `mapping-backed record is missing source endpoint coverage for ${mappingId}`);
    if (!(mapping.amending_record_ids || []).some((id) => contributorIds.has(id))) addError(errors, file, record.effective_record_id, "contributing_record_ids", `mapping-backed record is missing amending endpoint coverage for ${mappingId}`);
  }
  if (record.review_status === "reviewed") {
    for (const collection of ["knowledge_records", "conditions", "quantitative_criteria", "source_units"]) {
      for (const contributor of resolved[collection]) {
        const contributorId = contributor.knowledge_record_id || contributor.condition_id || contributor.criterion_id || contributor.source_unit_id;
        if (contributor.review_status !== "reviewed") addError(errors, file, record.effective_record_id, collection, `reviewed EffectiveRecord references unreviewed contributor ${contributorId}`);
      }
    }
    const limitedCrossReferenceIds = new Set((record.representation_limitations || []).flatMap((limitation) => limitation.affected_cross_reference_ids || []));
    for (const xref of resolved.cross_references) {
      const unresolved = xref.resolution_status && xref.resolution_status !== "resolved";
      if ((xref.review_status !== "reviewed" || unresolved) && !limitedCrossReferenceIds.has(xref.xref_id)) addError(errors, file, record.effective_record_id, "representation_limitations", `CrossReference ${xref.xref_id} must be documented in structured representation_limitations`);
    }
  }
}

function validateContractRepresentationLimitations({ record, file, contractIndexes, sourceIndexes, errors }) {
  const evidenceIds = new Set(record.contributing_record_ids || []);
  for (const mappingId of record.amendment_mapping_ids || []) evidenceIds.add(mappingId);
  for (const ref of record.source_references || []) {
    if (isNonEmptyString(ref.document_id)) evidenceIds.add(ref.document_id);
    if (isNonEmptyString(ref.section_id)) evidenceIds.add(ref.section_id);
    if (isNonEmptyString(ref.source_unit_id)) evidenceIds.add(ref.source_unit_id);
  }
  for (const limitation of record.representation_limitations || []) {
    for (const xrefId of limitation.affected_cross_reference_ids || []) {
      requireSourceRef(errors, file, sourceIndexes, xrefId, "representation_limitations.affected_cross_reference_ids", record.effective_record_id, "cross_references");
      if (!evidenceIds.has(xrefId)) addError(errors, file, record.effective_record_id, "representation_limitations.affected_cross_reference_ids", `affected CrossReference ${xrefId} must be a contributor or referenced evidence`);
    }
    for (const affectedId of limitation.affected_record_ids || []) {
      if (!contractIndexes.allRecords.has(affectedId) && !sourceIndexes.idLayers.has(affectedId)) {
        addError(errors, file, record.effective_record_id, "representation_limitations.affected_record_ids", `reference does not resolve to source or contract evidence: ${affectedId}`);
        continue;
      }
      if (!evidenceIds.has(affectedId)) addError(errors, file, record.effective_record_id, "representation_limitations.affected_record_ids", `affected record ${affectedId} must be a contributor or referenced evidence`);
    }
  }
}

function validateContractEffectiveProvenanceClosure({ record, file, resolved, errors }) {
  const sourceUnitIds = sourceUnitRefSet(record.source_references || []);
  const knowledgeIds = new Set(resolved.knowledge_records.map((item) => item.knowledge_record_id));
  const conditionIds = new Set(resolved.conditions.map((item) => item.condition_id));
  for (const kr of resolved.knowledge_records) {
    for (const sourceUnitId of kr.source_unit_ids || []) requireContractSourceUnitReference(errors, file, record.effective_record_id, sourceUnitId, sourceUnitIds, `KnowledgeRecord ${kr.knowledge_record_id}`);
  }
  for (const condition of resolved.conditions) {
    if (!(condition.applies_to_ids || []).some((id) => knowledgeIds.has(id))) addError(errors, file, record.effective_record_id, "contributing_record_ids", `Condition ${condition.condition_id} does not apply to any included KnowledgeRecord`);
    requireContractSourceUnitReference(errors, file, record.effective_record_id, condition.source_unit_id, sourceUnitIds, `Condition ${condition.condition_id}`);
  }
  for (const criterion of resolved.quantitative_criteria) {
    if (!knowledgeIds.has(criterion.knowledge_record_id)) addError(errors, file, record.effective_record_id, "contributing_record_ids", `QuantitativeCriterion ${criterion.criterion_id} references KnowledgeRecord ${criterion.knowledge_record_id} not included`);
    for (const conditionId of criterion.condition_ids || []) {
      if (!conditionIds.has(conditionId)) addError(errors, file, record.effective_record_id, "contributing_record_ids", `QuantitativeCriterion ${criterion.criterion_id} condition ${conditionId} is not included`);
    }
    requireContractSourceUnitReference(errors, file, record.effective_record_id, criterion.source_unit_id, sourceUnitIds, `QuantitativeCriterion ${criterion.criterion_id}`);
  }
  for (const xref of resolved.cross_references) requireContractSourceUnitReference(errors, file, record.effective_record_id, xref.source_unit_id, sourceUnitIds, `CrossReference ${xref.xref_id}`);
  for (const sourceUnit of resolved.source_units) requireContractSourceUnitReference(errors, file, record.effective_record_id, sourceUnit.source_unit_id, sourceUnitIds, `SourceUnit ${sourceUnit.source_unit_id}`);
}

function requireContractSourceUnitReference(errors, file, ownerId, sourceUnitId, sourceUnitIds, label) {
  if (!sourceUnitIds.has(sourceUnitId)) addError(errors, file, ownerId, "source_references", `${label} direct SourceUnit ${sourceUnitId} is not included`);
}

function loadJson(file, errors) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (error) {
    addError(errors, file, null, "JSON", error.message);
    return null;
  }
}

function validateDerivedManifestFile({ manifestFile }) {
  const loadErrors = [];
  const manifestPath = path.resolve(manifestFile);
  const manifest = loadJson(manifestPath, loadErrors);
  if (loadErrors.length > 0) return { ok: false, configError: true, errors: loadErrors, amendmentMappingCount: 0, effectiveRecordCount: 0 };
  return validateDerivedManifest({ manifest, manifestFile: manifestPath });
}

function validateDerivedManifest({ manifest, manifestFile }) {
  const errors = [];
  const manifestDir = path.dirname(manifestFile || ROOT);
  if (!isObject(manifest)) {
    addError(errors, manifestFile || "manifest", null, "/", "must be an object");
    return { ok: false, configError: true, errors, amendmentMappingCount: 0, effectiveRecordCount: 0 };
  }
  const sourcePath = manifest.source_bundle || manifest.source_bundle_file;
  const artifactPaths = manifest.artifacts || manifest.artifact_files;
  if (!isNonEmptyString(sourcePath)) addError(errors, manifestFile || "manifest", null, "source_bundle", "must name a source bundle file");
  if (!Array.isArray(artifactPaths) || artifactPaths.length === 0) addError(errors, manifestFile || "manifest", null, "artifacts", "must contain at least one artifact file");
  if (errors.length > 0) return { ok: false, configError: true, errors, amendmentMappingCount: 0, effectiveRecordCount: 0 };
  const sourceBundle = loadJson(path.resolve(manifestDir, sourcePath), errors);
  const artifacts = artifactPaths.map((artifactPath) => {
    const artifactFile = path.resolve(manifestDir, artifactPath);
    return { artifact: loadJson(artifactFile, errors), file: artifactFile };
  });
  if (errors.length > 0) return { ok: false, configError: true, errors, amendmentMappingCount: 0, effectiveRecordCount: 0 };
  return validateContractArtifacts({ sourceBundle, artifacts });
}

function parseArgs(args) {
  if (args.length !== 2 || args[0] !== "--manifest") return null;
  return { manifestFile: args[1] };
}

function main() {
  const parsed = parseArgs(process.argv.slice(2));
  if (!parsed) {
    console.error("Usage: node scripts/validate_derived.js --manifest <manifest.json>");
    process.exit(2);
  }
  const result = validateDerivedManifestFile(parsed);
  if (!result.ok) {
    const exitCode = result.configError ? 2 : 1;
    console.error(`Derived contract validation failed with ${result.errors.length} error(s):`);
    for (const error of result.errors) console.error(`- ${error}`);
    process.exit(exitCode);
  }
  console.log(`Validated contract graph with ${result.amendmentMappingCount} AmendmentMapping record(s) and ${result.effectiveRecordCount} EffectiveRecord record(s).`);
}

if (require.main === module) main();

module.exports = {
  normalizeRepoPath,
  validateContractArtifacts,
  validateDerivedContractArtifact,
  validateDerivedManifest,
  validateDerivedManifestFile
};
