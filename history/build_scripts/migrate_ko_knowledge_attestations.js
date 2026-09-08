const fs = require("fs");
const path = require("path");

const { loadBundles, buildIndex, sourceTextFor } = require("../engine/data_store");
const { OVERLAY_DIR, sourceHash } = require("../validation/validate_ko_presentation");

function main() {
  const bundles = loadBundles();
  const index = buildIndex(bundles);
  for (const { bundle } of bundles) {
    const documentId = bundle.documents[0].document_id;
    const file = path.join(OVERLAY_DIR, `${documentId}.json`);
    const overlay = JSON.parse(fs.readFileSync(file, "utf8"));
    const entries = new Map((overlay.entries || []).map((entry) => [entry.record_id, entry]));
    for (const record of bundle.knowledge_records || []) {
      if (entries.has(record.knowledge_record_id)) continue;
      entries.set(record.knowledge_record_id, {
        record_id: record.knowledge_record_id,
        record_type: "knowledge_record",
        source_text_sha256: sourceHash(sourceTextFor(index, record.source_unit_ids)),
        normalized_ko_sha256: record.normalized_ko ? sourceHash(record.normalized_ko) : null,
        normalization_status: "needs_review"
      });
    }
    overlay.overlay_version = "0.2.0";
    overlay.entries = [...entries.values()].sort((a, b) => a.record_id.localeCompare(b.record_id));
    fs.writeFileSync(file, `${JSON.stringify(overlay, null, 2)}\n`, "utf8");
  }
}

if (require.main === module) main();

module.exports = { main };
