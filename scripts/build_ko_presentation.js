const fs = require("fs");
const path = require("path");

const { createClient } = require("../engine/llm_client");
const { loadBundles, buildIndex } = require("../engine/data_store");
const { OVERLAY_DIR, sourceHash } = require("../validation/validate_ko_presentation");

const ROOT = path.resolve(__dirname, "..");

function parseArgs(argv) {
  const args = { document: null, section: null, provider: null, force: false, limit: null };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--document") args.document = argv[++i];
    else if (argv[i] === "--section") args.section = argv[++i];
    else if (argv[i] === "--provider") args.provider = argv[++i];
    else if (argv[i] === "--limit") args.limit = Number(argv[++i]);
    else if (argv[i] === "--force") args.force = true;
  }
  return args;
}

function targetRecords() {
  const bundles = loadBundles();
  const index = buildIndex(bundles);
  const targets = [];
  for (const record of index.quantitativeCriteria.values()) {
    const sourceUnit = index.sourceUnits.get(record.source_unit_id);
    targets.push({
      record_id: record.criterion_id,
      record_type: "quantitative_criterion",
      document_id: sourceUnit.document_id,
      section_id: sourceUnit.section_id,
      source_text: record.source_text,
      structured: {
        parameter: record.parameter,
        comparator: record.comparator,
        value: record.value,
        value_fraction: record.value_fraction,
        unit: record.unit,
        denominator_or_reference: record.denominator_or_reference,
        is_default_with_exception: record.is_default_with_exception,
        is_illustrative_example: record.is_illustrative_example,
        value_status: record.value_status
      }
    });
  }
  for (const record of index.conditions.values()) {
    const sourceUnit = index.sourceUnits.get(record.source_unit_id);
    targets.push({
      record_id: record.condition_id,
      record_type: "condition",
      document_id: sourceUnit.document_id,
      section_id: sourceUnit.section_id,
      source_text: record.condition_text,
      structured: { condition_type: record.condition_type }
    });
  }
  return targets.sort((a, b) => a.record_id.localeCompare(b.record_id));
}

function generationSchema(ids) {
  return {
    type: "object",
    additionalProperties: false,
    required: ["entries"],
    properties: {
      entries: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["record_id", "normalized_ko"],
          properties: {
            record_id: { type: "string", enum: ids },
            normalized_ko: { type: "string" }
          }
        }
      }
    }
  };
}

function verificationSchema(ids) {
  return {
    type: "object",
    additionalProperties: false,
    required: ["verdicts"],
    properties: {
      verdicts: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["record_id", "equivalent", "reason"],
          properties: {
            record_id: { type: "string", enum: ids },
            equivalent: { type: "boolean" },
            reason: { type: "string" }
          }
        }
      }
    }
  };
}

function requiredNumericTokens(target) {
  const tokens = new Set((target.source_text.match(/(?:±|≤|≥|<|>)?\d+(?:\.\d+)?(?:\/\d+)?/g) || []).map(String));
  const value = target.structured.value;
  if (value !== null && value !== undefined) tokens.add(String(value));
  if (target.structured.value_fraction) tokens.add(`${target.structured.value_fraction.numerator}/${target.structured.value_fraction.denominator}`);
  return [...tokens];
}

function numericTokensPreserved(target, normalizedKo) {
  return requiredNumericTokens(target).every((token) => normalizedKo.includes(token));
}

function readExisting() {
  const byDocument = new Map();
  if (!fs.existsSync(OVERLAY_DIR)) return byDocument;
  for (const name of fs.readdirSync(OVERLAY_DIR).filter((name) => name.endsWith(".json"))) {
    const overlay = JSON.parse(fs.readFileSync(path.join(OVERLAY_DIR, name), "utf8"));
    byDocument.set(overlay.document_id, new Map((overlay.entries || []).map((entry) => [entry.record_id, entry])));
  }
  return byDocument;
}

function writeOverlays(targets, entriesByDocument) {
  fs.mkdirSync(OVERLAY_DIR, { recursive: true });
  const documents = [...new Set(targets.map((target) => target.document_id))].sort();
  for (const documentId of documents) {
    const entries = [...(entriesByDocument.get(documentId) || new Map()).values()].sort((a, b) => a.record_id.localeCompare(b.record_id));
    const overlay = { overlay_version: "0.1.0", language: "ko", document_id: documentId, entries };
    fs.writeFileSync(path.join(OVERLAY_DIR, `${documentId}.json`), `${JSON.stringify(overlay, null, 2)}\n`, "utf8");
  }
}

async function normalizeBatch(client, batch) {
  const ids = batch.map((target) => target.record_id);
  const payload = batch.map(({ record_id, record_type, source_text, structured }) => ({ record_id, record_type, source_text, structured }));
  const generated = await client.complete({
    system: "Translate each regulatory record into concise, natural Korean for expert readers. Preserve meaning exactly. Do not add advice, interpretation, or applicability judgments. Preserve every Arabic number, fraction, symbol, unit, abbreviation, comparator direction, exception/default/illustrative status, and modal strength. A quantitative criterion should read as one complete criterion sentence. A condition should translate only the condition phrase.",
    messages: [{ role: "user", content: JSON.stringify(payload) }],
    schema: generationSchema(ids),
    maxTokens: Math.max(2048, batch.length * 180)
  });
  const generatedById = new Map((generated.entries || []).map((entry) => [entry.record_id, entry.normalized_ko.trim()]));

  const candidates = batch.map((target) => ({ ...target, normalized_ko: generatedById.get(target.record_id) || null }));
  const verifiable = candidates.filter((candidate) => candidate.normalized_ko && numericTokensPreserved(candidate, candidate.normalized_ko));
  const verifiedById = new Map();
  if (verifiable.length) {
    const verification = await client.complete({
      system: "Verify whether each Korean normalization is semantically equivalent to its regulatory source record. Reject any changed numeric value, comparator direction, modality, scope, exception/default/illustrative meaning, added recommendation, or omitted material qualifier. This is verification only, not rewriting.",
      messages: [{ role: "user", content: JSON.stringify(verifiable.map(({ record_id, record_type, source_text, structured, normalized_ko }) => ({ record_id, record_type, source_text, structured, normalized_ko }))) }],
      schema: verificationSchema(verifiable.map((item) => item.record_id)),
      maxTokens: Math.max(2048, verifiable.length * 120)
    });
    for (const verdict of verification.verdicts || []) verifiedById.set(verdict.record_id, verdict.equivalent === true);
  }

  return candidates.map((candidate) => ({
    record_id: candidate.record_id,
    record_type: candidate.record_type,
    source_text_sha256: sourceHash(candidate.source_text),
    normalized_ko: candidate.normalized_ko,
    normalization_status: candidate.normalized_ko && numericTokensPreserved(candidate, candidate.normalized_ko) && verifiedById.get(candidate.record_id)
      ? "reviewed"
      : "needs_review"
  }));
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const allTargets = targetRecords();
  let targets = allTargets.filter((target) => (!args.document || target.document_id === args.document) && (!args.section || target.section_id === args.section));
  const existing = readExisting();
  targets = targets.filter((target) => {
    const entry = existing.get(target.document_id)?.get(target.record_id);
    return args.force || !entry || entry.source_text_sha256 !== sourceHash(target.source_text) || entry.normalization_status !== "reviewed";
  });
  if (args.limit) targets = targets.slice(0, args.limit);
  if (!targets.length) {
    console.log("No Korean presentation entries need processing.");
    return;
  }

  const client = createClient(args.provider || undefined);
  const groups = new Map();
  for (const target of targets) {
    const key = `${target.document_id}|${target.section_id}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(target);
  }

  let completed = 0;
  for (const [key, group] of groups) {
    const documentEntries = existing.get(group[0].document_id) || new Map();
    existing.set(group[0].document_id, documentEntries);
    try {
      for (let offset = 0; offset < group.length; offset += 20) {
        const batch = group.slice(offset, offset + 20);
        for (const entry of await normalizeBatch(client, batch)) documentEntries.set(entry.record_id, entry);
        completed += batch.length;
      }
      console.log(`${key}: ${group.length} entries processed (${completed}/${targets.length}).`);
    } catch (error) {
      for (const target of group) {
        documentEntries.set(target.record_id, {
          record_id: target.record_id,
          record_type: target.record_type,
          source_text_sha256: sourceHash(target.source_text),
          normalized_ko: null,
          normalization_status: "needs_review"
        });
      }
      console.error(`${key}: marked needs_review after provider error: ${error.message}`);
    }
    writeOverlays(allTargets, existing);
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error.stack || error.message);
    process.exit(1);
  });
}

module.exports = { numericTokensPreserved, parseArgs, targetRecords };
