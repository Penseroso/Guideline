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

  return { archive, concepts, overlaysByDocumentId, presentationByDocumentId, staleDocumentIds };
}

module.exports = {
  loadSemanticOverlayStore,
  PILOTS_DIR,
  OVERLAY_DIR,
  PRESENTATION_DIR,
  CONCEPTS_PATH
};
