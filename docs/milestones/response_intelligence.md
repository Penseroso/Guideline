# Milestone: Response Intelligence

Status: active (started 2026-09-08)

Purpose: on top of the current production baseline, improve answer quality,
retrieval, latency, and LLM-involvement structure based on real measured
problems and instrumentation results — not a cumulative feature list.

Each workstream below is a sequential step, not an independent backlog item.
A later workstream's necessity and scope is decided from the prior
workstream's actual findings; do not adopt a capability the results don't
justify.

On completion of each workstream: record whether its stated goal was met
and how it was verified, note remaining risk/follow-up, and — once the
whole milestone is done — move this document to `history/milestones/` and
update the relevant active docs (`docs/schema.md`, `docs/verification_status.md`,
`docs/coverage/*.md`, etc.) to reflect only the resulting current state.

## 1. Answer Routing Hardening

Goal: eliminate structural false refusals — questions that are actually
answerable but fall to refusal because of router structure, not because the
evidence is missing.

- Systematic audit of broad/list/topic-overview refusal cases.
- Examine `structuredQuery`'s dependence on candidate count, section size,
  and tie-break behavior.
- For broad questions, use reviewed manifest/facet/section data to help
  decide actual answer scope.
- Keep the existing deterministic path for detail/single-criterion
  questions wherever possible.

Status: complete (2026-09-09)

Outcome: goal met. Reviewed semantic manifests now participate as a
pre-answer fallback when the established deterministic composite/list paths
cannot form an answer. A manifest is eligible only when it is reviewed,
fresh against the current source bundle, and has real evidence behind at
least one applicable facet. Selection uses explicit document/section/topic
cues, compatible answer intent, and evidence distance; record count and
section size are not ranking signals. Ambiguous ties abstain.

Verification: the current inventory contains 55 eligible manifests. Four
probe variants per manifest produced 220/220 structured, reviewed, cited
answers in the intended document scope. This 100% gate is defined only over
eligible probes generated from reviewed + fresh + evidence-bearing
manifests; stale, unreviewed, ambiguous, unrelated, and scope-excluded cases
are separate negative regressions. Partial structured answers require at
least one grounded facet in the selected reviewed manifest and explicit
coverage disclosure for every uncovered applicable facet. The previously
logged ADC/ADA animal-species question now resolves to ICH S6(R1) evidence
instead of treating `ADA` as an FDA-document constraint. A fresh 50-question
production-path audit completed 50/50 with no final runtime error or refusal,
and all 16 established suitable cases passed the pre-Workstream-1 production
baseline regression policy.

Operational hardening: the 50-question runner persists an atomic snapshot
after every completed question. A resumed run skips saved successful IDs;
an interrupted or failed in-flight question alone is retried. Tests inject an
interruption and verify both persistence and resume behavior.

Remaining risk/follow-up: 42/220 probes selected the intended grounded
manifest but used an existing deterministic mode/intent different from the
manifest declaration. This is diagnostic, not a failure of the structured
routing gate, and should first be classified under Workstream 3's query
resolution audit.
The current manifest inventory has no stale or unreviewed member, so those
states are covered by negative regression fixtures rather than the positive
220-probe denominator.

## 2. Latency & Cost Baseline

Goal: establish latency/cost bottlenecks from real measurements, not
assumption — the baseline every later LLM-involvement decision in this
milestone is judged against.

- Stage-by-stage latency: routing, retrieval, generation, verification,
  presentation.
- p50/p95 for structured vs. grounded_generation separately.
- API call count and cost by question type.

Status: not started

Preliminary observation from the Workstream 1 production-path run (not the
Workstream 2 baseline): end-to-end latency across 50 questions was p50
8,945 ms, p95 26,600 ms, max 40,415 ms. Structured responses (n=22) were p50
90 ms, p95 23,793 ms, max 28,973 ms; grounded generation (n=28) was p50
10,986 ms, p95 26,600 ms, max 40,415 ms. These are request-level elapsed
times only. Stage-level timing, API-call counts, token use, and cost remain
to be instrumented in this workstream.

## 3. Query Resolution & LLM Intervention Audit

Goal: classify the failures that remain after routing hardening and baseline
measurement before choosing an implementation technique.

- Build a failure taxonomy from real questions: evidence absent, retrieval
  miss, query-understanding/resolution miss, ambiguous scope, deterministic
  confidence gap, or response-generation/verification failure.
- Distinguish cases where the correct semantic scope was resolved but
  evidence retrieval missed from cases where document/topic/intent/context
  resolution itself was wrong.
- Identify the exact candidate intervention points for an LLM and define
  observable escalation conditions, including the deterministic evidence
  available at each point.
- Measure how many cases each proposed intervention would cover and what
  latency/API-call budget it would consume using Workstream 2's baseline.
- Do not implement an LLM planner or retrieval upgrade in this workstream;
  its output is the evidence-backed scope for Workstreams 4 and 5.

Status: not started

## 4. Retrieval Quality Upgrade

Goal: reduce cases where the semantic scope is right but needed evidence is
missed by retrieval, limited to the cases classified as retrieval failures in
Workstream 3.

- Use Workstream 3's taxonomy and fixtures as the benchmark denominator.
- Evaluate real synonym/paraphrase/wording-variation cases lexical/
  structured retrieval misses.
- Only adopt hybrid retrieval / BM25 / embeddings / reranking if benchmark
  results actually justify it — building RAG machinery is not itself a
  goal here.

Status: not started

## 5. Conditional LLM Query Planning

Goal: cover deterministic routing's natural-language blind spots while
minimizing added API/latency cost. Implement only for Workstream 3 cases that
deterministic resolution and the justified Workstream 4 retrieval changes
cannot solve reliably.

- Implement the intervention points and observable escalation conditions
  selected by Workstream 3; do not broaden them by default.
- Compare against always-on LLM planning on latency/cost/quality trade-offs.
- Retain deterministic handling whenever it meets the same acceptance
  contract.

Status: not started

## 6. Response Quality / Verification Contract

Goal: reduce generation-level failures where evidence is adequate but the
answer is incomplete or distorts meaning.

- Broad-answer completeness, qualifier/exception preservation, claim
  omission, stochastic-generation regression, structured vs. generated
  answer consistency.

Status: not started

## 7. Production Evaluation & SLO

Goal: define product-level acceptance criteria and a production SLO.

- Rebuild the eval set by question type beyond the existing 50Q: detail,
  list, overview, process, comparison, ambiguous, refusal.
- Track answerability, retrieval completeness, citation correctness,
  latency, and API usage — not just accuracy.

Status: not started

## 8. Corpus Expansion / Reusability Test

Goal: empirically determine whether the current engine is a
Guideline-specific application or a reusable regulatory-QA platform.

- Add a real, separate regulatory corpus.
- Test whether it works via schema + ontology + semantic data alone, with
  no engine changes.
- If engine changes turn out to be necessary, identify exactly what's
  Guideline-specific coupling.

Status: not started
