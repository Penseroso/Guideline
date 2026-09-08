const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const { loadSemanticOverlayStore, PRESENTATION_DIR } = require("../engine/semantic_overlay_store");

function tempDir(label) {
  const dir = path.join(os.tmpdir(), `semantic_overlay_store_test_${label}_${Date.now()}_${Math.random().toString(36).slice(2)}`);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function loadPresentation(fileName) {
  return JSON.parse(fs.readFileSync(path.join(PRESENTATION_DIR, fileName), "utf8"));
}

function writePresentation(dir, fileName, presentation) {
  fs.writeFileSync(path.join(dir, fileName), JSON.stringify(presentation), "utf8");
}

// --- Stage E2 (docs/derived_semantic_layer.md §10 단계 E2): presentation staleness filter ---

test("a presentation entry with fresh evidence loads unchanged", () => {
  const presentation = loadPresentation("ema_fih.json");
  const dir = tempDir("fresh");
  writePresentation(dir, "ema_fih.json", presentation);
  const store = loadSemanticOverlayStore({ presentationDir: dir });
  const loaded = store.presentationByDocumentId.get("ema_fih");
  assert.equal(loaded.entries.length, presentation.entries.length);
});

test("a presentation entry whose evidence went stale is dropped whole, not truncated to its still-fresh units", () => {
  const presentation = loadPresentation("ema_fih.json");
  presentation.entries[0].units[0].evidence_refs[0].source_text_sha256 = "0".repeat(64);
  const dir = tempDir("stale");
  writePresentation(dir, "ema_fih.json", presentation);
  const store = loadSemanticOverlayStore({ presentationDir: dir });
  const loaded = store.presentationByDocumentId.get("ema_fih");
  assert.equal(loaded.entries.length, 0, "a stale unit must drop the whole entry, not just that unit");
});

test("a presentation entry whose evidence record_id no longer resolves is dropped", () => {
  const presentation = loadPresentation("ema_fih.json");
  presentation.entries[0].units[0].evidence_refs[0].record_id = "ema_fih.kr.does_not_exist";
  const dir = tempDir("unresolved");
  writePresentation(dir, "ema_fih.json", presentation);
  const store = loadSemanticOverlayStore({ presentationDir: dir });
  const loaded = store.presentationByDocumentId.get("ema_fih");
  assert.equal(loaded.entries.length, 0);
});
