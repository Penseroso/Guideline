const test = require("node:test");
const assert = require("node:assert/strict");

const {
  attachLlmMeta,
  completeWithTelemetry,
  createAnswerTelemetry,
  finalizeTelemetry,
  measureSync
} = require("../engine/answer_telemetry");
const { answerEnvelope } = require("../engine/answer_envelope");
const { loadStore } = require("../engine/data_store");
const { analyze, estimateCallCost } = require("../scripts/analyze_latency_cost_baseline");

test("answer telemetry records stage time, LLM role, model, and exact token usage", async () => {
  let clock = 0;
  const telemetry = createAnswerTelemetry({ now: () => clock });
  measureSync(telemetry, "routing", () => { clock += 5; });
  const client = {
    provider: "openai",
    model: "gpt-5.6-terra",
    complete: async () => {
      clock += 7;
      return attachLlmMeta({ answered: true }, {
        provider: "openai",
        model: "gpt-5.6-terra",
        response_model: "gpt-5.6-terra-2026-09-01",
        service_tier: "default",
        usage: {
          prompt_tokens: 1000,
          completion_tokens: 50,
          total_tokens: 1050,
          prompt_tokens_details: { cached_tokens: 200, cache_write_tokens: 100 },
          completion_tokens_details: { reasoning_tokens: 25 }
        }
      });
    }
  };
  await completeWithTelemetry(client, "generation", {}, telemetry);
  measureSync(telemetry, "presentation", () => { clock += 3; });

  const result = finalizeTelemetry(telemetry);
  assert.equal(result.total_ms, 15);
  assert.deepEqual(result.stages_ms, { routing: 5, retrieval: 0, generation: 7, verification: 0, presentation: 3 });
  assert.equal(result.llm.calls, 1);
  assert.equal(result.llm.details[0].model, "gpt-5.6-terra");
  assert.equal(result.llm.usage.cached_input_tokens, 200);
  assert.equal(result.llm.usage.reasoning_output_tokens, 25);
  assert.equal(result.llm.usage_complete, true);
});

test("a final structured response exposes generation attempted before fallback", async () => {
  const { records, index } = loadStore();
  const client = {
    provider: "mock",
    model: "mock-model",
    complete: async ({ schema }) => schema.properties.verdicts
      ? { verdicts: [{ unit_index: 0, entailed: true, source_index: 0, reason: "supported" }] }
      : { answered: true, units: [{ text: "한 항목만 생성했습니다.", source_index: 0 }] }
  };
  const store = { mode: "keyword", search: async () => [] };
  const envelope = await answerEnvelope("ICH M10은 전체적으로 무엇을 다루는 가이드라인이야?", records, {
    generatorClient: client,
    verifierClient: client,
    store,
    index
  });
  assert.equal(envelope.route, "structured");
  assert.equal(envelope.telemetry.llm.calls, 2);
  assert.equal(envelope.telemetry.llm.calls_by_role.generation, 1);
  assert.equal(envelope.telemetry.llm.calls_by_role.verification, 1);
  assert.deepEqual(envelope.telemetry.events.map(({ event }) => event), [
    "grounded_generation_succeeded",
    "generated_answer_rejected"
  ]);
  assert.equal(envelope.telemetry.events[1].reason, "generated_coverage_inadequate");
  assert.ok(envelope.telemetry.stages_ms.generation >= 0);
  assert.ok(envelope.telemetry.stages_ms.verification >= 0);
});

test("latency/cost analyzer uses the frozen model-price snapshot and diagnoses structured fallback tails", () => {
  const pricedCall = {
    role: "generation",
    model: "gpt-5.6-terra",
    usage_available: true,
    usage: {
      input_tokens: 1000,
      cached_input_tokens: 200,
      cache_write_input_tokens: 100,
      output_tokens: 50,
      reasoning_output_tokens: 25,
      total_tokens: 1050
    }
  };
  assert.equal(estimateCallCost(pricedCall), 0.00229);

  const results = Array.from({ length: 50 }, (_, index) => {
    const slowFallback = index === 24;
    const route = index < 25 ? "structured" : "grounded_generation";
    const details = route === "grounded_generation" || slowFallback ? [pricedCall] : [];
    return {
      id: `Q${String(index + 1).padStart(2, "0")}`,
      depth: index % 2 ? "B1" : "B2",
      elapsed_ms: slowFallback ? 20000 : route === "structured" ? 10 : 1000,
      error: null,
      envelope: {
        route,
        semantic_mode: slowFallback ? "document_overview" : "detail",
        telemetry: {
          version: "1.0.0",
          total_ms: slowFallback ? 19900 : route === "structured" ? 9 : 990,
          stages_ms: {
            routing: 5,
            retrieval: 1,
            generation: slowFallback ? 15000 : route === "grounded_generation" ? 800 : 0,
            verification: slowFallback ? 4800 : route === "grounded_generation" ? 180 : 0,
            presentation: 1
          },
          unaccounted_ms: 0,
          llm: {
            calls: details.length,
            calls_by_role: { generation: details.length, verification: 0 },
            usage: {},
            usage_complete: true,
            details
          }
        }
      }
    };
  });

  const report = analyze(results);
  assert.equal(report.questions, 50);
  assert.equal(report.by_route.structured.questions, 25);
  assert.equal(report.structured_by_execution_path.deterministic_only.questions, 24);
  assert.equal(report.structured_by_execution_path.llm_attempt_then_structured_fallback.questions, 1);
  assert.ok(report.overall.llm.estimated_cost_usd > 0);
  assert.equal(report.structured_tail_diagnosis[0].id, "Q25");
  assert.equal(report.structured_tail_diagnosis[0].diagnosis, "generation_or_verification_attempt_before_structured_fallback");
});
