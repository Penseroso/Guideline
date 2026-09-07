const fs = require("fs");
const path = require("path");

const { loadBundles, buildIndex, sourceTextFor } = require("../engine/data_store");
const { OVERLAY_DIR, sourceHash } = require("../validation/validate_ko_presentation");
const { canonicalize, sha256 } = require("../validation/validate_semantic_overlay");

const ROOT = path.resolve(__dirname, "..");

function main(argv = process.argv.slice(2)) {
  const documentIndex = argv.indexOf("--document");
  const recordsIndex = argv.indexOf("--records");
  if (documentIndex < 0 || recordsIndex < 0) throw new Error("--document and --records are required");
  const documentId = argv[documentIndex + 1];
  const requestedIds = new Set(argv[recordsIndex + 1].split(",").filter(Boolean));
  const bundles = loadBundles();
  const selected = bundles.find(({ bundle }) => bundle.documents.some((document) => document.document_id === documentId));
  if (!selected) throw new Error(`document not found: ${documentId}`);
  const index = buildIndex(bundles);
  const records = new Map((selected.bundle.knowledge_records || []).map((record) => [record.knowledge_record_id, record]));
  const overlayFile = path.join(OVERLAY_DIR, `${documentId}.json`);
  const overlay = JSON.parse(fs.readFileSync(overlayFile, "utf8"));
  const entries = new Map((overlay.entries || []).map((entry) => [entry.record_id, entry]));
  for (const id of requestedIds) {
    const record = records.get(id);
    if (!record) throw new Error(`KnowledgeRecord not found in ${documentId}: ${id}`);
    if (!record.normalized_ko) throw new Error(`normalized_ko is empty: ${id}`);
    entries.set(id, {
      record_id: id,
      record_type: "knowledge_record",
      source_text_sha256: sourceHash(sourceTextFor(index, record.source_unit_ids)),
      normalized_ko_sha256: sourceHash(record.normalized_ko),
      normalization_status: "reviewed"
    });
  }
  overlay.entries = [...entries.values()].sort((a, b) => a.record_id.localeCompare(b.record_id));
  fs.writeFileSync(overlayFile, `${JSON.stringify(overlay, null, 2)}\n`, "utf8");
  const semanticFile = path.join(ROOT, "data", "derived", "semantic", `${documentId}.json`);
  if (fs.existsSync(semanticFile)) {
    const semantic = JSON.parse(fs.readFileSync(semanticFile, "utf8"));
    semantic.source_bundle_sha256 = sha256(canonicalize(selected.bundle));
    fs.writeFileSync(semanticFile, `${JSON.stringify(semantic, null, 2)}\n`, "utf8");
  }
  console.log(`Attested ${requestedIds.size} reviewed KnowledgeRecord normalization(s) for ${documentId}.`);
}

if (require.main === module) {
  try { main(); } catch (error) { console.error(error.stack || error.message); process.exit(1); }
}

module.exports = { main };
