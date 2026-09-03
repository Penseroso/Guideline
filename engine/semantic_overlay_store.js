/**
 * engine/semantic_overlay_store.js
 * Stage B (docs/derived_semantic_layer.md §10, "shadow mode") loader for
 * the derived semantic layer built in validation/validate_semantic_overlay.js.
 * Read-only: nothing here writes to the core archive or changes what an
 * answer looks like. engine/semantic_shadow.js consumes this to build a
 * side-by-side plan that is logged, never served.
 *
 * Freshness reuses the same canonical-hash check the validator runs in CI
 * (`npm run validate:semantic`) rather than duplicating it, so a document
 * overlay whose source_bundle_sha256 no longer matches the live pilot
 * bundle is silently dropped here exactly as docs/derived_semantic_layer.md
 * §6 requires ("오버레이가 없거나 stale이면 현재 코어 검색으로 안전하게
 * fallback한다") — the caller never has to know the difference between
 * "no overlay exists" and "the overlay went stale".
 */
const fs = require("fs");
const path = require("path");

const { discoverJsonFiles } = require("../validation/validate_pilots");
const { canonicalize, sha256, loadCoreArchive } = require("../validation/validate_semantic_overlay");

const ROOT = path.resolve(__dirname, "..");
const PILOTS_DIR = path.join(ROOT, "data", "pilots");
const OVERLAY_DIR = path.join(ROOT, "data", "derived", "semantic");
const PRESENTATION_DIR = path.join(ROOT, "data", "derived", "presentation", "ko");
const CONCEPTS_PATH = path.join(ROOT, "data", "ontology", "semantic_concepts.json");

function loadJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function sourceUnitIdForRecordEntry(entry) {
  if (entry.kind === "knowledge_record") return (entry.record.source_unit_ids || [])[0] || null;
  return entry.record.source_unit_id || null;
}

/**
 * A per-section census of the core archive, built once at load time so
 * engine/semantic_shadow.js can measure a facet's real coverage against
 * "every record the core archive actually has in this facet's own scope
 * (and its sub-sections)" instead of only the facet's hand-curated
 * `member_record_ids` sample. Curated samples stay useful as a precise
 * "this exact declared fact" signal, but using them as the sole coverage
 * denominator under-counts real coverage whenever an answer legitimately
 * cited different-but-equally-valid evidence from the same section
 * (found in Stage B's first shadow run, history/verification/
 * semantic_shadow_stage_b_2026-09-03.md §4 Q14).
 *
 * `childrenBySectionId` intentionally only walks direct
 * `parent_section_id` edges — engine/semantic_shadow.js's own facet
 * coverage census wants the strict subtree under a facet's declared
 * scope, not sibling sections (a sibling is a different sub-topic, not
 * part of this facet's own content). Sibling relevance is a distinct
 * question the shadow module answers separately when deciding whether a
 * manifest is worth showing at all.
 */
function buildSectionIndex(archive) {
  const recordIdsBySectionId = new Map();
  for (const [recordId, entry] of archive.recordsById) {
    const sourceUnitId = sourceUnitIdForRecordEntry(entry);
    const sourceUnit = sourceUnitId ? archive.sourceUnitsById.get(sourceUnitId) : null;
    if (!sourceUnit || !sourceUnit.section_id) continue;
    if (!recordIdsBySectionId.has(sourceUnit.section_id)) recordIdsBySectionId.set(sourceUnit.section_id, new Set());
    recordIdsBySectionId.get(sourceUnit.section_id).add(recordId);
  }

  const childrenBySectionId = new Map();
  for (const section of archive.sectionsById.values()) {
    if (!section.parent_section_id) continue;
    if (!childrenBySectionId.has(section.parent_section_id)) childrenBySectionId.set(section.parent_section_id, new Set());
    childrenBySectionId.get(section.parent_section_id).add(section.section_id);
  }

  return { recordIdsBySectionId, childrenBySectionId };
}

function loadSemanticOverlayStore({
  pilotsDir = PILOTS_DIR,
  overlayDir = OVERLAY_DIR,
  presentationDir = PRESENTATION_DIR,
  conceptsPath = CONCEPTS_PATH
} = {}) {
  const archive = loadCoreArchive(pilotsDir);
  const concepts = fs.existsSync(conceptsPath)
    ? loadJson(conceptsPath)
    : { concepts: [], comparison_axes: [] };

  const overlaysByDocumentId = new Map();
  const staleDocumentIds = new Set();
  const overlayFiles = fs.existsSync(overlayDir) ? discoverJsonFiles(overlayDir) : [];
  for (const file of overlayFiles) {
    const overlay = loadJson(file);
    const coreEntry = overlay && overlay.document_id ? archive.byDocumentId.get(overlay.document_id) : null;
    if (!coreEntry) continue;
    const expectedHash = sha256(canonicalize(coreEntry.bundle));
    if (overlay.source_bundle_sha256 !== expectedHash) {
      staleDocumentIds.add(overlay.document_id);
      continue;
    }
    overlaysByDocumentId.set(overlay.document_id, overlay);
  }

  const presentationByDocumentId = new Map();
  const presentationFiles = fs.existsSync(presentationDir) ? discoverJsonFiles(presentationDir) : [];
  for (const file of presentationFiles) {
    const presentation = loadJson(file);
    if (presentation && presentation.document_id) {
      presentationByDocumentId.set(presentation.document_id, presentation);
    }
  }

  const sectionIndex = buildSectionIndex(archive);

  return { archive, concepts, overlaysByDocumentId, presentationByDocumentId, staleDocumentIds, sectionIndex };
}

module.exports = {
  loadSemanticOverlayStore,
  PILOTS_DIR,
  OVERLAY_DIR,
  PRESENTATION_DIR,
  CONCEPTS_PATH
};
