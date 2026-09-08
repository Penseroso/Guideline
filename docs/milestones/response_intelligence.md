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

Status: not started

## 2. Latency & Cost Baseline

Goal: establish latency/cost bottlenecks from real measurements, not
assumption — the baseline every later LLM-involvement decision in this
milestone is judged against.

- Stage-by-stage latency: routing, retrieval, generation, verification,
  presentation.
- p50/p95 for structured vs. grounded_generation separately.
- API call count and cost by question type.

Status: not started

## 3. Retrieval Quality Upgrade

Goal: reduce cases where the semantic scope is right but needed evidence is
missed by retrieval.

- After Workstream 1's routing fixes, check what recall gaps remain.
- Evaluate real synonym/paraphrase/wording-variation cases lexical/
  structured retrieval misses.
- Only adopt hybrid retrieval / BM25 / embeddings / reranking if benchmark
  results actually justify it — building RAG machinery is not itself a
  goal here.

Status: not started

## 4. Conditional LLM Query Planning

Goal: cover deterministic routing's natural-language blind spots while
minimizing added API/latency cost.

- Identify question shapes deterministic resolution doesn't handle well:
  ambiguous, broad-compound, low-confidence resolution, insufficient first
  retrieval.
- Evaluate conditional escalation to an LLM planner only for those shapes.
- Compare against always-on LLM planning on latency/cost/quality trade-offs.

Status: not started

## 5. Response Quality / Verification Contract

Goal: reduce generation-level failures where evidence is adequate but the
answer is incomplete or distorts meaning.

- Broad-answer completeness, qualifier/exception preservation, claim
  omission, stochastic-generation regression, structured vs. generated
  answer consistency.

Status: not started

## 6. Production Evaluation & SLO

Goal: define product-level acceptance criteria and a production SLO.

- Rebuild the eval set by question type beyond the existing 50Q: detail,
  list, overview, process, comparison, ambiguous, refusal.
- Track answerability, retrieval completeness, citation correctness,
  latency, and API usage — not just accuracy.

Status: not started

## 7. Corpus Expansion / Reusability Test

Goal: empirically determine whether the current engine is a
Guideline-specific application or a reusable regulatory-QA platform.

- Add a real, separate regulatory corpus.
- Test whether it works via schema + ontology + semantic data alone, with
  no engine changes.
- If engine changes turn out to be necessary, identify exactly what's
  Guideline-specific coupling.

Status: not started
