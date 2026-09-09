const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const INPUT_PATH = process.env.GUIDELINE_LATENCY_AUDIT_INPUT
  ? path.resolve(process.env.GUIDELINE_LATENCY_AUDIT_INPUT)
  : path.join(ROOT, "logs", "runtime", "answer_suitability_50_workstream_2.json");
const OUTPUT_PATH = process.env.GUIDELINE_LATENCY_REPORT_OUTPUT
  ? path.resolve(process.env.GUIDELINE_LATENCY_REPORT_OUTPUT)
  : path.join(ROOT, "logs", "runtime", "response_intelligence_workstream_2_baseline.json");

// Frozen short-context Standard pricing snapshot used for this historical
// baseline. Source: https://developers.openai.com/api/docs/pricing
// Prices are USD per 1M tokens and must not be silently updated in place.
const PRICING_SNAPSHOT = {
  pricing_date: "2026-09-09",
  source_url: "https://developers.openai.com/api/docs/pricing",
  service_tier: "standard",
  context: "short",
  currency: "USD",
  per_million_tokens: {
    "gpt-5.6-terra": { input: 2.00, cached_input: 0.20, cache_write_input: 2.50, output: 12.00 },
    "gpt-5.6-sol": { input: 4.00, cached_input: 0.40, cache_write_input: 5.00, output: 20.00 }
  }
};

function percentile(values, fraction) {
  const sorted = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (!sorted.length) return null;
  return sorted[Math.max(0, Math.ceil(fraction * sorted.length) - 1)];
}

function distribution(values) {
  const valid = values.filter(Number.isFinite);
  return {
    n: valid.length,
    p50_ms: percentile(valid, 0.5),
    p95_ms: percentile(valid, 0.95),
    max_ms: valid.length ? Math.max(...valid) : null
  };
}

function modelRate(model, pricing = PRICING_SNAPSHOT) {
  if (pricing.per_million_tokens[model]) return pricing.per_million_tokens[model];
  return Object.entries(pricing.per_million_tokens)
    .find(([name]) => String(model || "").startsWith(`${name}-`))?.[1] || null;
}

function estimateCallCost(call, pricing = PRICING_SNAPSHOT) {
  const rate = modelRate(call.model, pricing);
  if (!rate || !call.usage_available) return null;
  const usage = call.usage || {};
  const cached = Number(usage.cached_input_tokens) || 0;
  const cacheWrite = Number(usage.cache_write_input_tokens) || 0;
  const totalInput = Number(usage.input_tokens) || 0;
  const uncached = Math.max(0, totalInput - cached - cacheWrite);
  const output = Number(usage.output_tokens) || 0;
  return (uncached * rate.input + cached * rate.cached_input + cacheWrite * rate.cache_write_input + output * rate.output) / 1_000_000;
}

function summarizeItems(items, pricing = PRICING_SNAPSHOT) {
  const stages = ["routing", "retrieval", "generation", "verification", "presentation"];
  const calls = items.flatMap((item) => item.envelope.telemetry.llm.details || []);
  const callCosts = calls.map((call) => estimateCallCost(call, pricing));
  const usage = { input_tokens: 0, cached_input_tokens: 0, cache_write_input_tokens: 0, output_tokens: 0, reasoning_output_tokens: 0, total_tokens: 0 };
  for (const call of calls) {
    for (const key of Object.keys(usage)) usage[key] += Number(call.usage && call.usage[key]) || 0;
  }
  return {
    questions: items.length,
    request_elapsed: distribution(items.map((item) => item.elapsed_ms)),
    engine_total: distribution(items.map((item) => item.envelope.telemetry.total_ms)),
    stages: Object.fromEntries(stages.map((stage) => [stage, distribution(items.map((item) => item.envelope.telemetry.stages_ms[stage]))])),
    llm: {
      calls: calls.length,
      calls_per_question: items.length ? calls.length / items.length : null,
      calls_by_role: {
        generation: calls.filter((call) => call.role === "generation").length,
        verification: calls.filter((call) => call.role === "verification").length
      },
      usage,
      usage_complete: calls.every((call) => call.usage_available),
      estimated_cost_usd: callCosts.every((value) => value !== null)
        ? Math.round(callCosts.reduce((sum, value) => sum + value, 0) * 1e8) / 1e8
        : null
    }
  };
}

function groupSummaries(items, keyFn, pricing) {
  const groups = new Map();
  for (const item of items) {
    const key = keyFn(item) || "unknown";
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(item);
  }
  return Object.fromEntries([...groups.entries()].sort(([a], [b]) => a.localeCompare(b))
    .map(([key, values]) => [key, summarizeItems(values, pricing)]));
}

function structuredTailDiagnosis(items) {
  const structured = items.filter((item) => item.envelope.route === "structured");
  const p95 = percentile(structured.map((item) => item.envelope.telemetry.total_ms), 0.95);
  return structured
    .filter((item) => item.envelope.telemetry.total_ms >= p95 || item.envelope.telemetry.llm.calls > 0)
    .sort((a, b) => b.envelope.telemetry.total_ms - a.envelope.telemetry.total_ms)
    .map((item) => {
      const telemetry = item.envelope.telemetry;
      const stages = telemetry.stages_ms;
      const events = telemetry.events || [];
      const dominantStage = Object.entries(stages).sort((a, b) => b[1] - a[1])[0][0];
      return {
        id: item.id,
        depth: item.depth,
        semantic_mode: item.envelope.semantic_mode,
        total_ms: telemetry.total_ms,
        request_elapsed_ms: item.elapsed_ms,
        stages_ms: stages,
        llm_calls: telemetry.llm.calls,
        llm_calls_by_role: telemetry.llm.calls_by_role,
        events,
        diagnosis: telemetry.llm.calls > 0 && stages.generation + stages.verification > stages.routing
          ? "generation_or_verification_attempt_before_structured_fallback"
          : `${dominantStage}_dominated`
      };
    });
}

function analyze(results, pricing = PRICING_SNAPSHOT) {
  if (!Array.isArray(results) || results.length !== 50 || new Set(results.map((item) => item.id)).size !== 50) {
    throw new Error("Latency baseline requires exactly 50 unique audit questions.");
  }
  const missingTelemetry = results.filter((item) => !item.envelope || !item.envelope.telemetry).map((item) => item.id);
  if (missingTelemetry.length) throw new Error(`Missing telemetry: ${missingTelemetry.join(", ")}`);
  return {
    generated_at: new Date().toISOString(),
    telemetry_version: results[0].envelope.telemetry.version,
    pricing_snapshot: pricing,
    questions: results.length,
    errors: results.filter((item) => item.error).length,
    overall: summarizeItems(results, pricing),
    by_route: groupSummaries(results, (item) => item.envelope.route, pricing),
    structured_by_execution_path: groupSummaries(
      results.filter((item) => item.envelope.route === "structured"),
      (item) => item.envelope.telemetry.llm.calls > 0 ? "llm_attempt_then_structured_fallback" : "deterministic_only",
      pricing
    ),
    by_semantic_mode: groupSummaries(results, (item) => item.envelope.semantic_mode, pricing),
    by_depth: groupSummaries(results, (item) => item.depth, pricing),
    structured_tail_diagnosis: structuredTailDiagnosis(results)
  };
}

function main() {
  const report = analyze(JSON.parse(fs.readFileSync(INPUT_PATH, "utf8")));
  fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
  fs.writeFileSync(OUTPUT_PATH, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  console.log(`Questions: ${report.questions}; errors: ${report.errors}`);
  console.log(`Total estimated cost: $${report.overall.llm.estimated_cost_usd}`);
  console.log(`Structured tail cases: ${report.structured_tail_diagnosis.length}`);
  console.log(`Output: ${path.relative(ROOT, OUTPUT_PATH)}`);
}

if (require.main === module) main();

module.exports = { PRICING_SNAPSHOT, analyze, distribution, estimateCallCost, percentile, structuredTailDiagnosis, summarizeItems };
