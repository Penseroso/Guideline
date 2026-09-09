const { performance } = require("node:perf_hooks");

const TELEMETRY_VERSION = "1.0.0";
const LLM_META = Symbol.for("guideline.llm_call_meta");
const STAGES = ["routing", "retrieval", "generation", "verification", "presentation"];

function roundMs(value) {
  return Math.round(Math.max(0, Number(value) || 0) * 1000) / 1000;
}

function createAnswerTelemetry({ now = () => performance.now() } = {}) {
  return {
    now,
    started_at: now(),
    stages: Object.fromEntries(STAGES.map((stage) => [stage, 0])),
    llm_calls: [],
    events: []
  };
}

function recordTelemetryEvent(telemetry, event, details = {}) {
  if (!telemetry) return;
  telemetry.events.push({
    event,
    at_ms: roundMs(telemetry.now() - telemetry.started_at),
    ...details
  });
}

function measureSync(telemetry, stage, fn) {
  const start = telemetry.now();
  try {
    return fn();
  } finally {
    telemetry.stages[stage] += telemetry.now() - start;
  }
}

async function measureAsync(telemetry, stage, fn) {
  const start = telemetry.now();
  try {
    return await fn();
  } finally {
    telemetry.stages[stage] += telemetry.now() - start;
  }
}

function attachLlmMeta(result, meta) {
  if (!result || typeof result !== "object") return result;
  Object.defineProperty(result, LLM_META, { value: meta, enumerable: false, configurable: false });
  return result;
}

function llmMeta(result) {
  return result && typeof result === "object" ? result[LLM_META] || null : null;
}

function normalizeUsage(usage = {}) {
  const inputTokens = Number(usage.input_tokens ?? usage.prompt_tokens ?? 0) || 0;
  const outputTokens = Number(usage.output_tokens ?? usage.completion_tokens ?? 0) || 0;
  const inputDetails = usage.input_tokens_details || usage.prompt_tokens_details || {};
  return {
    input_tokens: inputTokens,
    cached_input_tokens: Number(inputDetails.cached_tokens ?? usage.cache_read_input_tokens ?? 0) || 0,
    cache_write_input_tokens: Number(inputDetails.cache_write_tokens ?? usage.cache_creation_input_tokens ?? 0) || 0,
    output_tokens: outputTokens,
    reasoning_output_tokens: Number((usage.output_tokens_details || usage.completion_tokens_details || {}).reasoning_tokens ?? 0) || 0,
    total_tokens: Number(usage.total_tokens ?? inputTokens + outputTokens) || 0
  };
}

async function completeWithTelemetry(client, role, args, telemetry) {
  const start = telemetry.now();
  let result;
  let error = null;
  try {
    result = await client.complete(args);
    return result;
  } catch (caught) {
    error = caught;
    throw caught;
  } finally {
    const metadata = llmMeta(result) || {};
    const latency = telemetry.now() - start;
    telemetry.stages[role] += latency;
    telemetry.llm_calls.push({
      role,
      provider: metadata.provider || client.provider || null,
      model: metadata.model || client.model || null,
      response_model: metadata.response_model || null,
      service_tier: metadata.service_tier || null,
      latency_ms: roundMs(latency),
      usage: normalizeUsage(metadata.usage),
      usage_available: Boolean(metadata.usage),
      error: error ? error.name || "Error" : null
    });
  }
}

function sumUsage(calls) {
  const usage = {
    input_tokens: 0,
    cached_input_tokens: 0,
    cache_write_input_tokens: 0,
    output_tokens: 0,
    reasoning_output_tokens: 0,
    total_tokens: 0
  };
  for (const call of calls) {
    for (const key of Object.keys(usage)) usage[key] += Number(call.usage && call.usage[key]) || 0;
  }
  return usage;
}

function finalizeTelemetry(telemetry) {
  const totalMs = telemetry.now() - telemetry.started_at;
  const stagesMs = Object.fromEntries(STAGES.map((stage) => [stage, roundMs(telemetry.stages[stage])]));
  const measuredMs = Object.values(stagesMs).reduce((sum, value) => sum + value, 0);
  const callsByRole = { generation: 0, verification: 0 };
  for (const call of telemetry.llm_calls) callsByRole[call.role] = (callsByRole[call.role] || 0) + 1;
  return {
    version: TELEMETRY_VERSION,
    total_ms: roundMs(totalMs),
    stages_ms: stagesMs,
    unaccounted_ms: roundMs(Math.max(0, totalMs - measuredMs)),
    events: telemetry.events,
    llm: {
      calls: telemetry.llm_calls.length,
      calls_by_role: callsByRole,
      usage: sumUsage(telemetry.llm_calls),
      usage_complete: telemetry.llm_calls.every((call) => call.usage_available),
      details: telemetry.llm_calls
    }
  };
}

module.exports = {
  TELEMETRY_VERSION,
  attachLlmMeta,
  completeWithTelemetry,
  createAnswerTelemetry,
  finalizeTelemetry,
  llmMeta,
  measureAsync,
  measureSync,
  normalizeUsage,
  recordTelemetryEvent
};
