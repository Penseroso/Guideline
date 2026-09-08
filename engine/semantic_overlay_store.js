/**
 * engine/semantic_overlay_store.js
 * Read-only loader for the derived semantic layer (validated by
 * validation/validate_semantic_overlay.js): the facet/manifest/
 * summary_spec/salience_profile inventory plus the Korean presentation
 * overlay. Never writes to the core archive. engine/semantic_routing.js
 * consumes this store for both of its own two roles — the served
 * `envelope.semantic_coverage` disclosure and the diagnostic-only
 * shadow-comparison log.
 *
 * Freshness reuses the same canonical-hash check the validator runs in CI
 * (`npm run validate:semantic`) rather than duplicating it, so a document
 * overlay whose source_bundle_sha256 no longer matches the live guideline
 * bundle is silently dropped here exactly as docs/derived_semantic_layer.md
 * §6 requires ("오버레이가 없거나 stale이면 현재 코어 검색으로 안전하게
 * fallback한다") — the caller never has to know the difference between
 * "no overlay exists" and "the overlay went stale".
 */
const fs = require("fs");
const path = require("path");

const { discoverJsonFiles } = require("../validation/validate_guidelines");
const { canonicalize, sha256, loadCoreArchive, recordSourceText, summarySpecSha256 } = require("../validation/validate_semantic_overlay");

const ROOT = path.resolve(__dirname, "..");
const GUIDELINES_DIR = path.join(ROOT, "data", "guidelines");
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
 * engine/semantic_routing.js can measure a facet's real coverage against
 * "every record the core archive actually has in this facet's own scope
 * (and its sub-sections)" instead of only the facet's hand-curated
 * `member_record_ids` sample. Curated samples stay useful as a precise
 * "this exact declared fact" signal, but using them as the sole coverage
 * denominator under-counts real coverage whenever an answer legitimately
 * cited different-but-equally-valid evidence from the same section
 * (history/verification/semantic_shadow_stage_b_2026-09-03.md §4 Q14).
 *
 * `childrenBySectionId` intentionally only walks direct
 * `parent_section_id` edges — engine/semantic_routing.js's own facet
 * coverage census wants the strict subtree under a facet's declared
 * scope, not sibling sections (a sibling is a different sub-topic, not
 * part of this facet's own content). Sibling relevance is a distinct
 * question the shadow module answers separately when deciding whether a
 * manifest is worth showing at all.
 */
function buildSectionIndex(archive) {
  const recordIdsBySectionId = new Map();
  const sectionIdByRecordId = new Map();
  for (const [recordId, entry] of archive.recordsById) {
    const sourceUnitId = sourceUnitIdForRecordEntry(entry);
    const sourceUnit = sourceUnitId ? archive.sourceUnitsById.get(sourceUnitId) : null;
    if (!sourceUnit || !sourceUnit.section_id) continue;
    if (!recordIdsBySectionId.has(sourceUnit.section_id)) recordIdsBySectionId.set(sourceUnit.section_id, new Set());
    recordIdsBySectionId.get(sourceUnit.section_id).add(recordId);
    sectionIdByRecordId.set(recordId, sourceUnit.section_id);
  }

  const childrenBySectionId = new Map();
  for (const section of archive.sectionsById.values()) {
    if (!section.parent_section_id) continue;
    if (!childrenBySectionId.has(section.parent_section_id)) childrenBySectionId.set(section.parent_section_id, new Set());
    childrenBySectionId.get(section.parent_section_id).add(section.section_id);
  }

  return { recordIdsBySectionId, sectionIdByRecordId, childrenBySectionId };
}

/**
 * The presentation overlay's own validator (validate_semantic_overlay.js's
 * validatePresentationFile) checks evidence freshness only at authoring
 * time; nothing re-checked it at load time the way the structural overlay's
 * own source_bundle_sha256 already is above. A presentation entry whose
 * evidence has since drifted (a core record's source_text_sha256 no longer
 * matches) is dropped whole here, not truncated to its still-fresh units —
 * a "scope" summary missing its own boundary/exception sentence could read
 * as broader than the source actually supports, which is worse than
 * showing no curated sentence at all and falling back to raw evidence.
 */
function evidenceRefIsFresh(archive, ref) {
  const entry = archive.recordsById.get(ref.record_id);
  if (!entry) return false;
  const sourceText = recordSourceText({ kind: entry.kind, record: entry.record, evidenceSourceUnitId: ref.source_unit_id }, archive.sourceUnitsById);
  if (sourceText === null || sourceText === undefined) return false;
  return sha256(sourceText) === ref.source_text_sha256;
}

function presentationEntryIsFresh(archive, entry, overlay) {
  const summary = overlay && (overlay.summary_specs || []).find((item) => item.summary_id === entry.semantic_id);
  if (!summary || entry.summary_spec_sha256 !== summarySpecSha256(summary)) return false;
  return (entry.units || []).every((unit) => (unit.evidence_refs || []).every((ref) => evidenceRefIsFresh(archive, ref)));
}

function loadSemanticOverlayStore({
  guidelinesDir = GUIDELINES_DIR,
  overlayDir = OVERLAY_DIR,
  presentationDir = PRESENTATION_DIR,
  conceptsPath = CONCEPTS_PATH
} = {}) {
  const archive = loadCoreArchive(guidelinesDir);
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
      const overlay = overlaysByDocumentId.get(presentation.document_id);
      const freshEntries = (presentation.entries || []).filter((entry) => presentationEntryIsFresh(archive, entry, overlay));
      presentationByDocumentId.set(presentation.document_id, { ...presentation, entries: freshEntries });
    }
  }

  const sectionIndex = buildSectionIndex(archive);

  return { archive, concepts, overlaysByDocumentId, presentationByDocumentId, staleDocumentIds, sectionIndex };
}

module.exports = {
  loadSemanticOverlayStore,
  GUIDELINES_DIR,
  OVERLAY_DIR,
  PRESENTATION_DIR,
  CONCEPTS_PATH
};
