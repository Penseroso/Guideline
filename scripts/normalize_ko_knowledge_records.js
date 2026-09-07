const fs = require("fs");
const path = require("path");

const { createClient } = require("../engine/llm_client");
const { loadBundles, buildIndex, sourceTextFor } = require("../engine/data_store");
const { OVERLAY_DIR, sourceHash } = require("../validation/validate_ko_presentation");
const { canonicalize, sha256 } = require("../validation/validate_semantic_overlay");

const ROOT = path.resolve(__dirname, "..");

function parseArgs(argv) {
  const args = { document: null, section: null, limit: null, force: false, batchSize: 10 };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--document") args.document = argv[++i];
    else if (argv[i] === "--section") args.section = argv[++i];
    else if (argv[i] === "--limit") args.limit = Number(argv[++i]);
    else if (argv[i] === "--batch-size") args.batchSize = Number(argv[++i]);
    else if (argv[i] === "--force") args.force = true;
  }
  if (!args.document) throw new Error("--document is required");
  if (!Number.isInteger(args.batchSize) || args.batchSize < 1 || args.batchSize > 20) throw new Error("--batch-size must be 1..20");
  return args;
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
            normalized_ko: { type: "string", minLength: 1 }
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
          required: ["record_id", "equivalent", "standalone", "preserves_modality", "reason"],
          properties: {
            record_id: { type: "string", enum: ids },
            equivalent: { type: "boolean" },
            standalone: { type: "boolean" },
            preserves_modality: { type: "boolean" },
            reason: { type: "string" }
          }
        }
      }
    }
  };
}

function atomicText(target) {
  return [target.subject, target.action, target.object, target.original_modal_text].filter(Boolean).join(" ");
}

function numericTokensPreserved(target, normalizedKo) {
  const required = atomicText(target).match(/(?:[<>]=?|\u00b1)?\s*\d+(?:\.\d+)?(?:\/\d+)?/g) || [];
  const compactKo = String(normalizedKo || "").replace(/\s+/g, "");
  return required.every((token) => compactKo.includes(token.replace(/\s+/g, "")));
}

function targetPayload(target) {
  return {
    record_id: target.record_id,
    record_type: target.record_type,
    modality: target.modality,
    original_modal_text: target.original_modal_text,
    subject: target.subject,
    action: target.action,
    object: target.object,
    source_context: target.source_text
  };
}

async function processBatch(generator, verifier, batch) {
  const ids = batch.map((target) => target.record_id);
  const generated = await generator.complete({
    system: [
      "Translate each structured regulatory KnowledgeRecord into one concise, natural, standalone Korean proposition.",
      "The subject, action, object, modality, and original_modal_text identify the one atomic proposition to translate; source_context is evidence only and may contain other propositions that must not be imported.",
      "Explicitly preserve the proposition's semantic subject or topic whenever one is supplied. Never return only a predicate such as 'applies', 'is needed', or 'should be done'.",
      "Do not import a condition or qualifier found only in source_context when it is absent from the structured atomic fields; conditions are modeled separately.",
      "Preserve modal strength, negation, scope, conditions present in the atomic fields, numbers, fractions, units, abbreviations, and comparator direction exactly.",
      "Use standard Korean regulatory terminology throughout. Translate availability, abuse liability, emphasis, and concurrency naturally and consistently. Do not emit Devanagari or another unrelated writing system.",
      "Do not add advice, interpretation, explanations, applicability judgments, or requirements not present in the atomic proposition."
    ].join(" "),
    messages: [{ role: "user", content: JSON.stringify(batch.map(targetPayload)) }],
    schema: generationSchema(ids),
    maxTokens: Math.max(3000, batch.length * 240)
  });
  const generatedById = new Map((generated.entries || []).map((entry) => [entry.record_id, entry.normalized_ko.trim()]));
  const candidates = batch.map((target) => ({ ...target, normalized_ko: generatedById.get(target.record_id) || null }));
  const verifiable = candidates.filter((candidate) => candidate.normalized_ko && numericTokensPreserved(candidate, candidate.normalized_ko));
  const verdicts = verifiable.length ? await verifier.complete({
    system: [
      "Independently verify each Korean normalization against the structured atomic proposition and its source context.",
      "The structured subject, action, object, modality, and original_modal_text are authoritative for the atomic proposition. Source_context is supporting evidence and can contain other propositions or separately modeled conditions; do not require text absent from the structured atomic fields.",
      "Equivalent means no content present in those atomic fields is omitted, changed, or added.",
      "Standalone means the Korean sentence explicitly retains the structured subject's semantic topic or participant and is not a bare predicate. Natural Korean object or topic constructions are acceptable for abstract English subjects; a nominative grammatical subject is not required. Preserve source anaphora without inventing its antecedent.",
      "Preserves_modality means must/should/may/recommendation/description strength has not changed.",
      "Reject conservatively. This is verification only; do not rewrite."
    ].join(" "),
    messages: [{ role: "user", content: JSON.stringify(verifiable.map((target) => ({
      ...targetPayload(target),
      normalized_ko: target.normalized_ko
    }))) }],
    schema: verificationSchema(verifiable.map((target) => target.record_id)),
    maxTokens: Math.max(6000, verifiable.length * 300)
  }) : { verdicts: [] };
  const verdictById = new Map((verdicts.verdicts || []).map((verdict) => [verdict.record_id, verdict]));
  return candidates.map((candidate) => {
    const verdict = verdictById.get(candidate.record_id);
    const reviewed = Boolean(candidate.normalized_ko && numericTokensPreserved(candidate, candidate.normalized_ko) &&
      verdict && verdict.equivalent && verdict.standalone && verdict.preserves_modality);
    return { ...candidate, reviewed, reason: verdict ? verdict.reason : "generation missing or deterministic numeric check failed" };
  });
}

async function processBatchResilient(generator, verifier, batch) {
  try {
    return await processBatch(generator, verifier, batch);
  } catch (error) {
    if (batch.length <= 1) throw error;
    const midpoint = Math.ceil(batch.length / 2);
    console.warn(`Batch of ${batch.length} failed (${error.message}); retrying as ${midpoint} + ${batch.length - midpoint}.`);
    const first = await processBatchResilient(generator, verifier, batch.slice(0, midpoint));
    const second = await processBatchResilient(generator, verifier, batch.slice(midpoint));
    return [...first, ...second];
  }
}

function updateSemanticBundleHash(documentId, bundle) {
  const file = path.join(ROOT, "data", "derived", "semantic", `${documentId}.json`);
  if (!fs.existsSync(file)) return;
  const semantic = JSON.parse(fs.readFileSync(file, "utf8"));
  semantic.source_bundle_sha256 = sha256(canonicalize(bundle));
  fs.writeFileSync(file, `${JSON.stringify(semantic, null, 2)}\n`, "utf8");
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const bundles = loadBundles();
  const selectedBundle = bundles.find(({ bundle }) => bundle.documents.some((document) => document.document_id === args.document));
  if (!selectedBundle) throw new Error(`document not found: ${args.document}`);
  const index = buildIndex(bundles);
  const bundle = selectedBundle.bundle;
  const overlayFile = path.join(OVERLAY_DIR, `${args.document}.json`);
  const overlay = JSON.parse(fs.readFileSync(overlayFile, "utf8"));
  const entries = new Map((overlay.entries || []).map((entry) => [entry.record_id, entry]));
  const sectionBySource = new Map((bundle.source_units || []).map((unit) => [unit.source_unit_id, unit.section_id]));
  let targets = (bundle.knowledge_records || []).map((record) => ({
    record,
    record_id: record.knowledge_record_id,
    record_type: record.record_type,
    modality: record.modality,
    original_modal_text: record.original_modal_text,
    subject: record.subject,
    action: record.action,
    object: record.object,
    section_id: sectionBySource.get(record.source_unit_ids[0]),
    source_text: sourceTextFor(index, record.source_unit_ids)
  })).filter((target) => !args.section || target.section_id === args.section)
    .filter((target) => args.force || entries.get(target.record_id)?.normalization_status !== "reviewed");
  if (args.limit) targets = targets.slice(0, args.limit);
  if (targets.length === 0) {
    console.log("No KnowledgeRecord normalizations need processing.");
    return;
  }

  const generator = createClient("openai", { model: process.env.GUIDELINE_KO_GENERATOR_MODEL || "gpt-5.6-terra" });
  const verifier = createClient("openai", { model: process.env.GUIDELINE_KO_VERIFIER_MODEL || "gpt-5.6-sol" });
  if (generator.model === verifier.model) throw new Error("generator and verifier models must be distinct");
  const failures = [];
  let reviewedCount = 0;
  for (let offset = 0; offset < targets.length; offset += args.batchSize) {
    const batch = targets.slice(offset, offset + args.batchSize);
    const results = await processBatchResilient(generator, verifier, batch);
    for (const result of results) {
      if (result.reviewed) {
        result.record.normalized_ko = result.normalized_ko;
        reviewedCount += 1;
      } else {
        failures.push({ record_id: result.record_id, candidate: result.normalized_ko, reason: result.reason });
      }
      entries.set(result.record_id, {
        record_id: result.record_id,
        record_type: "knowledge_record",
        source_text_sha256: sourceHash(result.source_text),
        normalized_ko_sha256: result.record.normalized_ko ? sourceHash(result.record.normalized_ko) : null,
        normalization_status: result.reviewed ? "reviewed" : "needs_review"
      });
    }
    overlay.entries = [...entries.values()].sort((a, b) => a.record_id.localeCompare(b.record_id));
    fs.writeFileSync(selectedBundle.file, `${JSON.stringify(bundle, null, 2)}\n`, "utf8");
    fs.writeFileSync(overlayFile, `${JSON.stringify(overlay, null, 2)}\n`, "utf8");
    updateSemanticBundleHash(args.document, bundle);
    console.log(`${args.document}: ${Math.min(offset + batch.length, targets.length)}/${targets.length} processed; ${reviewedCount} reviewed.`);
  }

  if (failures.length) {
    const logDir = path.join(ROOT, "logs", "runtime");
    fs.mkdirSync(logDir, { recursive: true });
    const reportFile = path.join(logDir, `ko_normalization_failures_${args.document}.json`);
    fs.writeFileSync(reportFile, `${JSON.stringify({ document_id: args.document, failures }, null, 2)}\n`, "utf8");
    console.log(`${failures.length} item(s) remain needs_review; details: ${path.relative(ROOT, reportFile)}`);
  }
}

if (require.main === module) main().catch((error) => {
  console.error(error.stack || error.message);
  process.exit(1);
});

module.exports = { atomicText, numericTokensPreserved, parseArgs, processBatch, processBatchResilient };
