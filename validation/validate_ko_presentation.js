const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const Ajv = require("ajv");

const { discoverJsonFiles } = require("./validate_pilots");

const ROOT = path.resolve(__dirname, "..");
const PILOTS_DIR = path.join(ROOT, "data", "pilots");
const OVERLAY_DIR = path.join(ROOT, "data", "presentation", "ko");
const SCHEMA_PATH = path.join(ROOT, "data", "schemas", "ko_presentation_overlay.schema.json");

function sourceHash(text) {
  return crypto.createHash("sha256").update(String(text || ""), "utf8").digest("hex");
}

function collectTargets(pilotsDir = PILOTS_DIR) {
  const targets = new Map();
  for (const file of discoverJsonFiles(pilotsDir)) {
    const bundle = JSON.parse(fs.readFileSync(file, "utf8"));
    for (const record of bundle.quantitative_criteria || []) {
      targets.set(record.criterion_id, {
        document_id: record.criterion_id.split(".")[0],
        record_type: "quantitative_criterion",
        source_text: record.source_text
      });
    }
    for (const record of bundle.conditions || []) {
      targets.set(record.condition_id, {
        document_id: record.condition_id.split(".")[0],
        record_type: "condition",
        source_text: record.condition_text
      });
    }
  }
  return targets;
}

function formatAjvErrors(file, errors) {
  return (errors || []).map((error) => `${file} ${error.instancePath || "/"}: ${error.message}`);
}

function validateKoPresentation({ pilotsDir = PILOTS_DIR, overlayDir = OVERLAY_DIR } = {}) {
  const errors = [];
  const schema = JSON.parse(fs.readFileSync(SCHEMA_PATH, "utf8"));
  const validate = new Ajv({ allErrors: true, strict: false }).compile(schema);
  const targets = collectTargets(pilotsDir);
  const seen = new Set();
  const files = fs.existsSync(overlayDir) ? discoverJsonFiles(overlayDir) : [];

  for (const file of files) {
    const overlay = JSON.parse(fs.readFileSync(file, "utf8"));
    if (!validate(overlay)) errors.push(...formatAjvErrors(file, validate.errors));

    for (const entry of overlay.entries || []) {
      if (seen.has(entry.record_id)) {
        errors.push(`${file} ${entry.record_id}: duplicate overlay entry`);
        continue;
      }
      seen.add(entry.record_id);
      const target = targets.get(entry.record_id);
      if (!target) {
        errors.push(`${file} ${entry.record_id}: record does not exist in pilot data`);
        continue;
      }
      if (overlay.document_id !== target.document_id) {
        errors.push(`${file} ${entry.record_id}: document_id must be ${target.document_id}`);
      }
      if (entry.record_type !== target.record_type) {
        errors.push(`${file} ${entry.record_id}: record_type must be ${target.record_type}`);
      }
      if (entry.source_text_sha256 !== sourceHash(target.source_text)) {
        errors.push(`${file} ${entry.record_id}: source_text_sha256 is stale or incorrect`);
      }
    }
  }

  for (const id of targets.keys()) {
    if (!seen.has(id)) errors.push(`${id}: missing Korean presentation overlay entry`);
  }

  return {
    ok: errors.length === 0,
    errors,
    fileCount: files.length,
    entryCount: seen.size,
    targetCount: targets.size
  };
}

function main() {
  const result = validateKoPresentation();
  if (!result.ok) {
    console.error(`Korean presentation validation failed with ${result.errors.length} error(s):`);
    for (const error of result.errors) console.error(`- ${error}`);
    process.exit(1);
  }
  console.log(`Validated ${result.entryCount}/${result.targetCount} Korean presentation entries across ${result.fileCount} file(s).`);
}

if (require.main === module) main();

module.exports = {
  OVERLAY_DIR,
  collectTargets,
  sourceHash,
  validateKoPresentation
};
