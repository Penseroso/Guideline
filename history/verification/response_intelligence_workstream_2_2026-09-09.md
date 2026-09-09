# Response Intelligence Workstream 2 — Latency & Cost Baseline

Date: 2026-09-09  
Status: complete

## Method

The existing 50-question answer-suitability set was executed through the
production HTTP answer path with `GUIDELINE_AUDIT_FRESH=true`. The generator
was `openai/gpt-5.6-terra` and the independent verifier was
`openai/gpt-5.6-sol`. The runner wrote an atomic snapshot after each question,
so an interrupted run can resume without discarding completed measurements.

Answer contract `2.6.0` measures monotonic wall time at routing, retrieval,
generation, verification, and presentation boundaries. It records each LLM
call's role, model, service tier, elapsed time, token usage, and retry/fallback
events. The reproducible aggregator is `npm run audit:latency-cost`.

Cost uses observed API token usage and a frozen 2026-09-09 OpenAI Standard,
short-context price snapshot (USD per million tokens): Terra input/cached
input/cache-write/output = 2.00/0.20/2.50/12.00; Sol =
4.00/0.40/5.00/20.00. This is an estimate, not invoice reconciliation. Source:
https://developers.openai.com/api/docs/pricing

## Full 50-question baseline

| Population | n | p50 | p95 | max |
|---|---:|---:|---:|---:|
| All | 50 | 8,075 ms | 30,087 ms | 35,446 ms |
| Final structured | 23 | 1,891 ms | 30,087 ms | 35,446 ms |
| Grounded generation | 26 | 9,980 ms | 23,388 ms | 34,379 ms |
| Source excerpts | 1 | 18,537 ms | 18,537 ms | 18,537 ms |

Stage p50/p95 across all questions was routing 63/115 ms, retrieval 0.009/4
ms, generation 3,423/11,801 ms, verification 4,632/19,603 ms, and
presentation 0.876/4 ms. The run made 94 LLM calls: 50 generation and 44
verification calls, or 1.88 calls/question. Usage was 132,126 input tokens,
33,775 output tokens, and 165,901 total tokens. The frozen-snapshot estimated
cost was USD 1.0107562.

## Structured-tail root cause

The final `route=structured` label does not imply a deterministic-only
execution. When a structured match is eligible for prose generation, the
engine first attempts generation and verification. If that candidate is
declined, rejected, or fails broad facet coverage, the engine safely returns
the already-available deterministic structured answer. Before Workstream 2,
only the final route was visible, so this work was attributed to “structured
latency.”

In the full baseline, 12 of 23 final structured answers made 30 LLM calls
(18 generation, 12 verification) before fallback; 11 were deterministic-only.
Those 12 calls account for essentially all generation/verification time on
the final structured route. A targeted rerun of the 12 cases with control-flow
events enabled produced this separation:

| Structured execution path | n | p50 | p95 | max | calls |
|---|---:|---:|---:|---:|---:|
| Deterministic only | 11 | 15 ms | 66 ms | 66 ms | 0 |
| LLM attempt, then structured fallback | 10 | 11,043 ms | 24,741 ms | 24,741 ms | 25 |

Two of the original 12 (Q07 and Q34) passed generation on rerun, so they moved
from final structured to final grounded generation. This is direct evidence
that stochastic generation/verification outcomes affect both tail latency and
the route population reported by any single run.

The event-level rerun identified four concrete fallback mechanisms:

- Verification retry/failure: Q01 and Q06 used two complete
  generation+verification attempts; Q10 and Q50 also ended on verification
  failure after a language retry. These were the largest verification-driven
  costs.
- Language/writing-system retry: Q10, Q35, and Q50 regenerated after an
  unexpected writing system; Q35 failed the same check twice without reaching
  verification.
- Generated facet coverage rejection: Q05, Q40, Q47, and Q49 produced answers
  that passed claim verification but did not cover enough of the selected
  manifest, so the deterministic structured answer was returned.
- Model decline: Q11 declined after one generation call and fell back.

For the fallback subgroup, routing p95 was 74 ms and retrieval p95 0.066 ms;
presentation p95 was 53 ms. Generation p95 was 19,547 ms and verification p95
11,147 ms. Therefore the abnormal structured p95 is specifically the cost of
speculative generation, verification, and retries before structured fallback,
not slow routing, retrieval, or formatting.

This also explains the earlier Workstream 1 observation of structured p50 near
90 ms but p95 near 24 seconds. With roughly half the final structured cases on
each execution path, the median can land on the deterministic cluster while
the upper tail lands entirely on the hidden LLM-attempt cluster. In the fresh
full Workstream 2 run, one additional final structured fallback moved the
median boundary to the shortest LLM case (1,891 ms), while the bimodal cause
remained the same.

## Artifacts and follow-up

Runtime artifacts (deployment-local, gitignored):

- `logs/runtime/answer_suitability_50_workstream_2.json`
- `logs/runtime/response_intelligence_workstream_2_baseline.json`
- `logs/runtime/response_intelligence_workstream_2_tail_rerun.json`

The baseline also contained one final `source_excerpts` response (Q32) after
four LLM calls and 18,537 ms. Its 12,983 ms verification share shows the same
failed-synthesis cost pattern, but the original full run preceded event-reason
logging, so its exact verifier rejection remains a Workstream 3 diagnostic.

Verification completed after implementation: `npm test` 421/421;
`validate:guidelines` 6/6 bundles; `validate:ko` 2,693/2,693 entries;
`audit:ko` 1,495/1,495 reviewed with 0 issues; `validate:semantic` 6 semantic
and 6 presentation files; `audit:routing:hardening` 220/220 eligible probes;
and `npm run eval` 24/24 with 100% citation precision, claim grounding, and
refusal correctness.

Workstream 3 should classify these events before changing behavior. The main
candidate is to avoid speculative prose generation when a complete reviewed
structured answer already satisfies the question, and to reserve generation
for an observable coverage or presentation need. No routing, retrieval, or LLM
planning behavior was changed in Workstream 2.
