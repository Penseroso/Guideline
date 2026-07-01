const fs = require("fs");
const path = require("path");
const Ajv = require("ajv");

const ROOT = path.resolve(__dirname, "..");
const SCHEMA_PATH = path.join(ROOT, "structured_data", "schemas", "guideline_bundle.schema.json");

const COLLECTIONS = [
  ["documents", "document_id"],
  ["sections", "section_id"],
  ["source_units", "source_unit_id"],
  ["knowledge_records", "knowledge_record_id"],
  ["quantitative_criteria", "criterion_id"],
  ["conditions", "condition_id"],
  ["cross_references", "xref_id"]
];

const NON_REPEATABLE = new Set([
  "source_units",
  "knowledge_records",
  "quantitative_criteria",
  "conditions",
  "cross_references"
]);

function stableStringify(value) {
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(",")}]`;
  }
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function location(file, id, field) {
  const parts = [file];
  if (id) parts.push(id);
  if (field) parts.push(field);
  return parts.join(" ");
}

function addError(errors, file, id, field, message) {
  errors.push(`${location(file, id, field)}: ${message}`);
}

function objectId(object, idField) {
  return object && object[idField] ? object[idField] : null;
}

function getAllIds(bundle) {
  const ids = new Set();
  for (const [collection, idField] of COLLECTIONS) {
    for (const item of bundle[collection] || []) {
      ids.add(item[idField]);
    }
  }
  return ids;
}

function buildIndex(bundle, collection, idField) {
  const index = new Map();
  for (const item of bundle[collection] || []) {
    index.set(item[idField], item);
  }
  return index;
}

function checkInternalUniqueness(file, bundle, errors) {
  const allIds = new Map();
  for (const [collection, idField] of COLLECTIONS) {
    const seen = new Set();
    for (const item of bundle[collection] || []) {
      const id = objectId(item, idField);
      if (seen.has(id)) {
        addError(errors, file, id, collection, `duplicate ${idField} inside collection`);
      }
      seen.add(id);
      if (allIds.has(id)) {
        addError(errors, file, id, idField, `duplicate primary ID also used by ${allIds.get(id)}`);
      } else {
        allIds.set(id, collection);
      }
    }
  }
}

function requireLocal(errors, file, indexes, id, field, ownerId, allowedCollections) {
  if (id === null || id === undefined) return null;
  for (const collection of allowedCollections) {
    if (indexes[collection].has(id)) return indexes[collection].get(id);
  }
  addError(errors, file, ownerId, field, `reference does not resolve inside this bundle: ${id}`);
  return null;
}

function checkReferencesAndRules(file, bundle, archiveIds, errors) {
  const indexes = {
    documents: buildIndex(bundle, "documents", "document_id"),
    sections: buildIndex(bundle, "sections", "section_id"),
    source_units: buildIndex(bundle, "source_units", "source_unit_id"),
    knowledge_records: buildIndex(bundle, "knowledge_records", "knowledge_record_id"),
    quantitative_criteria: buildIndex(bundle, "quantitative_criteria", "criterion_id"),
    conditions: buildIndex(bundle, "conditions", "condition_id"),
    cross_references: buildIndex(bundle, "cross_references", "xref_id")
  };

  for (const section of bundle.sections || []) {
    requireLocal(errors, file, indexes, section.document_id, "document_id", section.section_id, ["documents"]);
    const parent = requireLocal(errors, file, indexes, section.parent_section_id, "parent_section_id", section.section_id, ["sections"]);
    if (parent && parent.document_id !== section.document_id) {
      addError(errors, file, section.section_id, "parent_section_id", "parent Section must have the same document_id");
    }
    const heading = requireLocal(errors, file, indexes, section.heading_source_unit_id, "heading_source_unit_id", section.section_id, ["source_units"]);
    if (heading && heading.unit_type !== "heading") {
      addError(errors, file, section.section_id, "heading_source_unit_id", `${section.heading_source_unit_id} is not a heading SourceUnit`);
    }
    if (heading && heading.document_id !== section.document_id) {
      addError(errors, file, section.section_id, "heading_source_unit_id", `${section.heading_source_unit_id} has a different document_id`);
    }
    if (heading && heading.section_id !== section.section_id) {
      addError(errors, file, section.section_id, "heading_source_unit_id", `${section.heading_source_unit_id} belongs to a different section_id`);
    }
  }

  for (const unit of bundle.source_units || []) {
    const document = requireLocal(errors, file, indexes, unit.document_id, "document_id", unit.source_unit_id, ["documents"]);
    const section = requireLocal(errors, file, indexes, unit.section_id, "section_id", unit.source_unit_id, ["sections"]);
    if (section && section.document_id !== unit.document_id) {
      addError(errors, file, unit.source_unit_id, "section_id", "referenced Section must have the same document_id");
    }
    for (const relatedId of unit.related_source_unit_ids || []) {
      requireLocal(errors, file, indexes, relatedId, "related_source_unit_ids", unit.source_unit_id, ["source_units"]);
    }
    if (unit.trace) {
      if (unit.trace.document_id !== unit.document_id) {
        addError(errors, file, unit.source_unit_id, "trace.document_id", "must match SourceUnit.document_id");
      }
      if (unit.trace.section_id !== unit.section_id) {
        addError(errors, file, unit.source_unit_id, "trace.section_id", "must match SourceUnit.section_id");
      }
      if (document && unit.trace.source_file_path !== document.source_file_path) {
        addError(errors, file, unit.source_unit_id, "trace.source_file_path", "must match Document.source_file_path");
      }
    }
  }

  for (const record of bundle.knowledge_records || []) {
    for (const sourceUnitId of record.source_unit_ids || []) {
      requireLocal(errors, file, indexes, sourceUnitId, "source_unit_ids", record.knowledge_record_id, ["source_units"]);
    }
    if (record.modality === "other" && !record.original_modal_text) {
      addError(errors, file, record.knowledge_record_id, "original_modal_text", "is required when modality is other");
    }
    if (record.modality === "none" && record.original_modal_text !== null) {
      addError(errors, file, record.knowledge_record_id, "original_modal_text", "must be null when modality is none");
    }
  }

  for (const criterion of bundle.quantitative_criteria || []) {
    requireLocal(errors, file, indexes, criterion.source_unit_id, "source_unit_id", criterion.criterion_id, ["source_units"]);
    requireLocal(errors, file, indexes, criterion.knowledge_record_id, "knowledge_record_id", criterion.criterion_id, ["knowledge_records"]);
    for (const conditionId of criterion.condition_ids || []) {
      requireLocal(errors, file, indexes, conditionId, "condition_ids", criterion.criterion_id, ["conditions"]);
    }
    const hasValue = criterion.value !== null && criterion.value !== undefined;
    const hasFraction = criterion.value_fraction !== null && criterion.value_fraction !== undefined;
    if (criterion.value_status === "known" && hasValue === hasFraction) {
      addError(errors, file, criterion.criterion_id, "value_status", "known requires exactly one of value or value_fraction");
    }
    if (criterion.value_status !== "known" && (hasValue || hasFraction)) {
      addError(errors, file, criterion.criterion_id, "value_status", "non-known status requires value and value_fraction to be null");
    }
    if (hasFraction && criterion.value_fraction.denominator <= 0) {
      addError(errors, file, criterion.criterion_id, "value_fraction.denominator", "must be greater than zero");
    }
  }

  const conditionTargets = ["source_units", "knowledge_records", "quantitative_criteria"];
  for (const condition of bundle.conditions || []) {
    requireLocal(errors, file, indexes, condition.source_unit_id, "source_unit_id", condition.condition_id, ["source_units"]);
    for (const targetId of condition.applies_to_ids || []) {
      requireLocal(errors, file, indexes, targetId, "applies_to_ids", condition.condition_id, conditionTargets);
    }
    if (condition.condition_type === "exception" && (!condition.applies_to_ids || condition.applies_to_ids.length === 0)) {
      addError(errors, file, condition.condition_id, "applies_to_ids", "exception conditions require at least one target");
    }
  }

  for (const xref of bundle.cross_references || []) {
    requireLocal(errors, file, indexes, xref.source_unit_id, "source_unit_id", xref.xref_id, ["source_units"]);
    if (xref.resolution_status === "resolved") {
      if (!xref.target_id) {
        addError(errors, file, xref.xref_id, "target_id", "resolved CrossReference requires target_id");
      } else if (!archiveIds.has(xref.target_id)) {
        addError(errors, file, xref.xref_id, "target_id", `resolved target does not exist in validated archive: ${xref.target_id}`);
      }
    } else if (xref.target_id !== null) {
      addError(errors, file, xref.xref_id, "target_id", "unresolved or needs_review CrossReference must use null target_id");
    }
  }

  checkSourceUnitOrdering(file, bundle, errors);
}

function checkSourceUnitOrdering(file, bundle, errors) {
  const bySection = new Map();
  for (const unit of bundle.source_units || []) {
    if (!bySection.has(unit.section_id)) bySection.set(unit.section_id, []);
    bySection.get(unit.section_id).push(unit);
  }
  for (const [sectionId, units] of bySection) {
    let previous = null;
    const used = new Map();
    for (const unit of units) {
      if (unit.unit_order_status !== "known") continue;
      if (typeof unit.unit_order !== "number") {
        addError(errors, file, unit.source_unit_id, "unit_order", "known unit_order_status requires numeric unit_order");
        continue;
      }
      if (previous !== null && unit.unit_order <= previous) {
        addError(errors, file, unit.source_unit_id, "unit_order", `must increase within section ${sectionId}`);
      }
      if (used.has(unit.unit_order)) {
        addError(errors, file, unit.source_unit_id, "unit_order", `duplicates ${used.get(unit.unit_order)} in section ${sectionId}`);
      }
      used.set(unit.unit_order, unit.source_unit_id);
      previous = unit.unit_order;
    }
  }
}

function checkCrossFileRules(fileBundles, errors) {
  const repeatedDocuments = new Map();
  const repeatedSections = new Map();
  const nonRepeatableIds = new Map();

  for (const { file, bundle } of fileBundles) {
    for (const document of bundle.documents || []) {
      const key = document.document_id;
      const value = stableStringify(document);
      if (repeatedDocuments.has(key) && repeatedDocuments.get(key).value !== value) {
        addError(errors, file, key, "documents", `repeated Document differs from ${repeatedDocuments.get(key).file}`);
      } else {
        repeatedDocuments.set(key, { file, value });
      }
    }

    for (const section of bundle.sections || []) {
      const key = section.section_id;
      const value = stableStringify(section);
      const contextOnly = isContextOnlySection(bundle, key);
      if (repeatedSections.has(key)) {
        const previous = repeatedSections.get(key);
        if (previous.value !== value) {
          addError(errors, file, key, "sections", `repeated Section differs from ${previous.file}`);
        }
        if (!previous.contextOnly || !contextOnly) {
          addError(errors, file, key, "sections", "repeated Section must be context-only in every bundle where it appears");
        }
      } else {
        repeatedSections.set(key, { file, value, contextOnly });
      }
    }

    for (const [collection, idField] of COLLECTIONS) {
      if (!NON_REPEATABLE.has(collection)) continue;
      for (const item of bundle[collection] || []) {
        const id = item[idField];
        if (nonRepeatableIds.has(id)) {
          addError(errors, file, id, collection, `ID also appears in ${nonRepeatableIds.get(id)}`);
        } else {
          nonRepeatableIds.set(id, file);
        }
      }
    }
  }
}

function isContextOnlySection(bundle, sectionId) {
  const hasChildSection = (bundle.sections || []).some((section) => section.parent_section_id === sectionId);
  const hasDirectSourceUnit = (bundle.source_units || []).some((unit) => unit.section_id === sectionId);
  return hasChildSection && !hasDirectSourceUnit;
}

function loadJson(file, errors) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (error) {
    addError(errors, file, null, "JSON", error.message);
    return null;
  }
}

function main() {
  const files = process.argv.slice(2);
  if (files.length === 0) {
    console.error("Usage: npm run validate -- <json-file> [json-file ...]");
    process.exit(2);
  }

  const errors = [];
  const schema = JSON.parse(fs.readFileSync(SCHEMA_PATH, "utf8"));
  const ajv = new Ajv({ allErrors: true, strict: false });
  const validate = ajv.compile(schema);

  const fileBundles = [];
  for (const inputFile of files) {
    const file = path.normalize(inputFile);
    const bundle = loadJson(file, errors);
    if (!bundle) continue;

    const valid = validate(bundle);
    if (!valid) {
      for (const error of validate.errors || []) {
        const objectId = inferObjectId(bundle, error.instancePath);
        addError(errors, file, objectId, error.instancePath || "/", `${error.message}`);
      }
    }
    fileBundles.push({ file, bundle });
  }

  const archiveIds = new Set();
  for (const { bundle } of fileBundles) {
    for (const id of getAllIds(bundle)) archiveIds.add(id);
  }

  for (const { file, bundle } of fileBundles) {
    checkInternalUniqueness(file, bundle, errors);
    checkReferencesAndRules(file, bundle, archiveIds, errors);
  }
  checkCrossFileRules(fileBundles, errors);

  if (errors.length > 0) {
    console.error(`Validation failed with ${errors.length} error(s):`);
    for (const error of errors) console.error(`- ${error}`);
    process.exit(1);
  }

  console.log(`Validated ${fileBundles.length} bundle(s).`);
}

function inferObjectId(bundle, instancePath) {
  const parts = instancePath.split("/").filter(Boolean);
  const collection = parts[0];
  const index = Number(parts[1]);
  if (!collection || Number.isNaN(index)) return null;
  const entry = COLLECTIONS.find(([name]) => name === collection);
  if (!entry) return null;
  const item = bundle[collection] && bundle[collection][index];
  return item ? item[entry[1]] : null;
}

main();
