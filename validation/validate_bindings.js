const fs = require("fs");
const path = require("path");
const Ajv = require("ajv");

const { loadBundles, buildIndex } = require("../engine/data_store");

const ROOT = path.resolve(__dirname, "..");
const SCHEMA_PATH = path.join(ROOT, "data", "schemas", "condition_binding.schema.json");
const BINDINGS_DIR = path.join(ROOT, "data", "derived", "condition_bindings");
const CONTEXT_SLOTS_PATH = path.join(ROOT, "data", "ontology", "context_slots.json");

function discoverJsonFiles(directory) {
  if (!fs.existsSync(directory)) return [];
  return fs
    .readdirSync(directory, { withFileTypes: true })
    .filter((entry) => entry.isFile() && path.extname(entry.name).toLowerCase() === ".json")
    .map((entry) => path.join(directory, entry.name))
    .sort((a, b) => a.localeCompare(b));
}

function loadJson(file, errors) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (error) {
    errors.push(`${file}: ${error.message}`);
    return null;
  }
}

function buildSlotIndex() {
  const contextSlots = JSON.parse(fs.readFileSync(CONTEXT_SLOTS_PATH, "utf8"));
  const bySlotId = new Map();
  for (const slot of [...contextSlots.program_slots, ...contextSlots.program_finding_slots]) {
    bySlotId.set(slot.slot_id, slot);
  }
  return bySlotId;
}

/**
 * Schema-level structural checks (Ajv against condition_binding.schema.json)
 * for every file under data/derived/condition_bindings/.
 */
function checkSchema(files, errors) {
  const schema = JSON.parse(fs.readFileSync(SCHEMA_PATH, "utf8"));
  const ajv = new Ajv({ allErrors: true, strict: false });
  const validate = ajv.compile(schema);

  const loaded = [];
  for (const file of files) {
    const doc = loadJson(file, errors);
    if (!doc) continue;
    const valid = validate(doc);
    if (!valid) {
      for (const error of validate.errors || []) {
        errors.push(`${file} ${error.instancePath || "/"}: ${error.message}`);
      }
      continue;
    }
    loaded.push({ file, doc });
  }
  return loaded;
}

/**
 * Cross-file binding_id uniqueness — same convention as
 * validate_structured_data.js's checkInternalUniqueness, applied to the
 * whole condition_bindings directory rather than one bundle.
 */
function checkUniqueness(loaded, errors) {
  const seen = new Map();
  for (const { file, doc } of loaded) {
    for (const binding of doc.bindings) {
      if (seen.has(binding.binding_id)) {
        errors.push(`${file} ${binding.binding_id}: duplicate binding_id also defined in ${seen.get(binding.binding_id)}`);
      } else {
        seen.set(binding.binding_id, file);
      }
    }
  }
}

/**
 * Referential integrity against the live archive and the RegulatoryContext
 * slot vocabulary. These are the checks that make a binding trustworthy
 * evidence for the Applicability Engine, not just schema-shaped JSON:
 *   - condition_id must resolve to a real Condition in data/pilots/
 *   - evidence_span must be a verbatim substring of that Condition's
 *     condition_text (the grounding gate — same philosophy as the source
 *     archive's citation-verification, applied to derived bindings)
 *   - every predicate leaf's slot must be a declared RegulatoryContext slot,
 *     and its value(s) must be within that slot's declared enum
 */
function checkReferences(loaded, index, slotById, errors) {
  for (const { file, doc } of loaded) {
    for (const binding of doc.bindings) {
      const condition = index.conditions.get(binding.condition_id);
      if (!condition) {
        errors.push(`${file} ${binding.binding_id}: condition_id "${binding.condition_id}" does not exist in the archive`);
        continue;
      }

      if (!condition.condition_text.includes(binding.evidence_span)) {
        errors.push(
          `${file} ${binding.binding_id}: evidence_span is not a verbatim substring of condition_text ("${binding.condition_id}")`
        );
      }

      if (binding.bindability === "bindable") {
        checkPredicateGroup(binding.predicate, slotById, `${file} ${binding.binding_id}`, errors);
      }
    }
  }
}

function checkPredicateGroup(predicateGroup, slotById, location, errors) {
  const leaves = predicateGroup.all_of || predicateGroup.any_of || [];
  for (const leaf of leaves) {
    const slot = slotById.get(leaf.slot);
    if (!slot) {
      errors.push(`${location}: predicate references unknown slot "${leaf.slot}"`);
      continue;
    }
    const values = Array.isArray(leaf.value) ? leaf.value : [leaf.value];
    for (const v of values) {
      if (!slot.values.includes(v)) {
        errors.push(`${location}: predicate value "${v}" is not in slot "${leaf.slot}"'s declared values (${slot.values.join(", ")})`);
      }
    }
  }
}

/**
 * `index`/`slotById` are injectable (default: load the real archive and
 * data/ontology/context_slots.json from disk) so unit tests can validate
 * referential-integrity behavior against small synthetic fixtures instead of
 * depending on the live archive's exact contents staying byte-identical.
 */
function validateBindingFiles(files = discoverJsonFiles(BINDINGS_DIR), { index, slotById } = {}) {
  const errors = [];
  const loaded = checkSchema(files, errors);
  checkUniqueness(loaded, errors);

  const resolvedIndex = index || buildIndex(loadBundles());
  const resolvedSlotById = slotById || buildSlotIndex();
  checkReferences(loaded, resolvedIndex, resolvedSlotById, errors);

  return {
    ok: errors.length === 0,
    errors,
    fileCount: loaded.length,
    bindingCount: loaded.reduce((sum, { doc }) => sum + doc.bindings.length, 0)
  };
}

function main() {
  const files = discoverJsonFiles(BINDINGS_DIR);
  if (files.length === 0) {
    console.log(`No condition binding files found under ${path.relative(ROOT, BINDINGS_DIR)}.`);
    return;
  }

  const result = validateBindingFiles(files);
  if (!result.ok) {
    console.error(`Validation failed with ${result.errors.length} error(s):`);
    for (const error of result.errors) console.error(`- ${error}`);
    process.exit(1);
  }

  console.log(`Validated ${result.fileCount} binding file(s), ${result.bindingCount} binding(s).`);
}

if (require.main === module) {
  main();
}

module.exports = {
  discoverJsonFiles,
  validateBindingFiles,
  buildSlotIndex
};
