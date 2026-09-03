const fs = require("node:fs");
const path = require("node:path");

const R = require("../web/render");
const I18N = require("../web/i18n");

const ROOT = path.resolve(__dirname, "..");
const INPUT_PATH = process.env.GUIDELINE_AUDIT_INPUT
  ? path.resolve(process.env.GUIDELINE_AUDIT_INPUT)
  : path.join(ROOT, "logs", "runtime", "answer_suitability_50_raw_2026-09-02.json");
const OUTPUT_PATH = process.env.GUIDELINE_AUDIT_UI_OUTPUT
  ? path.resolve(process.env.GUIDELINE_AUDIT_UI_OUTPUT)
  : path.join(ROOT, "logs", "runtime", "answer_suitability_50_ui_2026-09-02.html");
const CASE_DIR = process.env.GUIDELINE_AUDIT_CASE_DIR
  ? path.resolve(process.env.GUIDELINE_AUDIT_CASE_DIR)
  : path.join(ROOT, "logs", "runtime", "answer_suitability_ui_cases");

function escapeHtml(value) {
  return String(value || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function main() {
  const results = JSON.parse(fs.readFileSync(INPUT_PATH, "utf8"));
  if (results.length !== 50) throw new Error(`Expected 50 responses, found ${results.length}`);
  const appCss = fs.readFileSync(path.join(ROOT, "web", "app.css"), "utf8");
  const cases = results.map((result) => {
    const envelope = result.envelope;
    const rendered = envelope ? R.renderEnvelope(envelope, I18N.ko, result.question) : `<div class="claim-error">${escapeHtml(result.error)}</div>`;
    const meta = envelope
      ? `${escapeHtml(envelope.route)} / ${escapeHtml(envelope.mode)} · claims ${envelope.claims.length} · ${result.elapsed_ms}ms`
      : `error · ${result.elapsed_ms}ms`;
    return `<section class="audit-case" id="${result.id}"><header class="audit-case-header"><strong>${result.id}</strong><span>${escapeHtml(result.depth)}</span><code>${meta}</code></header><div class="result-panel">${rendered}</div></section>`;
  }).join("\n");
  fs.mkdirSync(CASE_DIR, { recursive: true });
  for (const result of results) {
    const envelope = result.envelope;
    const rendered = envelope ? R.renderEnvelope(envelope, I18N.ko, result.question) : `<div class="claim-error">${escapeHtml(result.error)}</div>`;
    const caseHtml = `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${result.id} UI snapshot</title><style>${appCss}
      body { padding: 42px 24px; } .result-panel { max-width: 1160px; margin: 0 auto; }</style></head><body><div class="result-panel">${rendered}</div></body></html>`;
    fs.writeFileSync(path.join(CASE_DIR, `${result.id}.html`), caseHtml, "utf8");
  }
  const html = `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Answer suitability 50 UI snapshot</title><style>${appCss}
  body { padding: 28px; }
  .snapshot-header { max-width: 1160px; margin: 0 auto 48px; }
  .snapshot-header h1 { margin: 0; font-size: 2rem; letter-spacing: -.04em; }
  .snapshot-header p { color: var(--text-dim); }
  .audit-case { max-width: 1160px; margin: 0 auto 84px; padding-top: 24px; border-top: 2px solid var(--border-strong); }
  .audit-case-header { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; margin-bottom: 26px; color: var(--text-faint); }
  .audit-case-header strong { color: var(--text); font: 700 .9rem var(--mono); }
  .audit-case-header code { margin-left: auto; color: var(--accent); font-size: .74rem; }
  </style></head><body><header class="snapshot-header"><h1>답변 적합성 50문항 UI 스냅샷</h1><p>실제 POST /api/ask 응답을 운영 렌더러와 한국어 UI 문자열로 표시한 결과입니다.</p></header>${cases}</body></html>`;
  fs.writeFileSync(OUTPUT_PATH, html, "utf8");
  console.log(`Rendered ${results.length} UI cases to ${OUTPUT_PATH} and ${CASE_DIR}`);
}

main();
