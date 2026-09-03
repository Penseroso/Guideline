/**
 * scripts/run_semantic_shadow_audit.js
 * Stage B (docs/derived_semantic_layer.md §10): "기존 50문항 감사 세트에서
 * 기존 plan과 새 plan의 facet coverage, 순서, 비교 축을 나란히 기록한다."
 *
 * Replays the already-captured, final 50-question answer-suitability audit
 * envelopes (logs/runtime/answer_suitability_50_raw_2026-09-03_final.json —
 * see history/verification/answer_suitability_audit_2026-09-02.md) through
 * engine/semantic_shadow.js's comparePlans(). No server, no LLM calls: the
 * envelopes were already produced and manually judged once; this only adds
 * the derived-semantic-layer plan alongside them for comparison, exactly as
 * shadow mode intends (§10 Stage B: build the plan, do not apply it to a
 * user response).
 */
const fs = require("fs");
const path = require("path");

const { comparePlans } = require("../engine/semantic_shadow");

const INPUT_PATH = process.env.GUIDELINE_SHADOW_AUDIT_INPUT
  ? path.resolve(process.env.GUIDELINE_SHADOW_AUDIT_INPUT)
  : path.resolve(__dirname, "..", "logs", "runtime", "answer_suitability_50_raw_2026-09-03_final.json");
const OUTPUT_PATH = process.env.GUIDELINE_SHADOW_AUDIT_OUTPUT
  ? path.resolve(process.env.GUIDELINE_SHADOW_AUDIT_OUTPUT)
  : path.resolve(__dirname, "..", "logs", "runtime", `semantic_shadow_50_${new Date().toISOString().slice(0, 10)}.json`);

function main() {
  const raw = JSON.parse(fs.readFileSync(INPUT_PATH, "utf8"));
  const results = [];

  for (const item of raw) {
    if (item.error || !item.envelope) {
      results.push({ id: item.id, depth: item.depth, question: item.question, skipped: "no_envelope" });
      continue;
    }
    const comparison = comparePlans(item.question, item.envelope);
    results.push({ id: item.id, depth: item.depth, ...comparison });
  }

  fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
  fs.writeFileSync(OUTPUT_PATH, `${JSON.stringify(results, null, 2)}\n`, "utf8");

  const applicable = results.filter((r) => r.semantic_plan && r.semantic_plan.applicable);
  const notApplicableReasons = new Map();
  for (const r of results) {
    if (!r.semantic_plan || r.semantic_plan.applicable) continue;
    const reason = r.semantic_plan.reason || "unknown";
    notApplicableReasons.set(reason, (notApplicableReasons.get(reason) || 0) + 1);
  }
  const manifestStatusCounts = new Map();
  for (const r of applicable) {
    for (const manifest of r.semantic_plan.manifests || []) {
      manifestStatusCounts.set(manifest.status, (manifestStatusCounts.get(manifest.status) || 0) + 1);
    }
  }

  console.log(`Replayed ${results.length} questions -> ${OUTPUT_PATH}`);
  console.log(`applicable (an overlay matched a resolved document): ${applicable.length}/${results.length}`);
  for (const [reason, count] of notApplicableReasons) console.log(`  not applicable (${reason}): ${count}`);
  for (const [status, count] of manifestStatusCounts) console.log(`  manifest status ${status}: ${count}`);
  console.log("Applicable question IDs:", applicable.map((r) => r.id).join(", "));
}

main();
