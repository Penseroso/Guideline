> Moved from `docs/milestones/response_intelligence.md` on 2026-09-10 as
> part of the production-baseline close-out pass. Content below is
> preserved verbatim from the active milestone document — not rewritten.
> Current verification numbers live in `docs/verification_status.md`, the
> current production SLO baseline in `docs/production_slo.md`, and the
> milestone register entry in `docs/milestone_log.md`.

---

# Milestone: Response Intelligence

Status: complete (started 2026-09-08, closed 2026-09-10 — Workstream 8 cancelled, Workstreams 1-7 complete)

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

Status: complete (2026-09-09)

Outcome: goal met. The production answer envelope and query log now record
monotonic stage timing for routing, retrieval, generation, verification, and
presentation; every LLM call records its role, provider/model, service tier,
latency, token usage, and retry/fallback events. Aggregation and a frozen
pricing-snapshot cost report are reproducible with `npm run
audit:latency-cost`.

Baseline: a fresh 50-question production-path run completed 50/50 with zero
runtime errors. End-to-end p50/p95/max was 8,075/30,087/35,446 ms. Final
structured responses (n=23) were 1,891/30,087/35,446 ms; grounded generation
(n=26) was 9,980/23,388/34,379 ms; one source-excerpts fallback took 18,537
ms. The run made 94 calls (50 generation, 44 verification), used 165,901
tokens, and cost an estimated USD 1.0107562 using the frozen 2026-09-09
OpenAI Standard short-context price snapshot.

Root cause of the structured latency tail: the final route label was hiding
an attempted generated-answer path. In the full baseline, 12 of 23 final
structured answers had already made 30 LLM calls before falling back to the
deterministic answer; only 11 were deterministic-only. A targeted event-level
rerun measured deterministic-only structured at p50 15 ms / p95 66 ms, versus
LLM-attempt-then-structured-fallback at p50 11,043 ms / p95 24,741 ms.
Routing, retrieval, and presentation were not the bottleneck. Recorded causes
were verification rejection (sometimes after a full retry), unexpected
writing-system/language retry, model decline, or a grounded answer that passed
verification but failed the manifest facet-coverage gate. Two originally
structured tail cases passed as grounded generation on rerun, confirming that
model/verification outcome variance also changes the final-route distribution.

Evidence: `history/verification/response_intelligence_workstream_2_2026-09-09.md`.

Remaining risk/follow-up: cost is an estimate from observed token usage and a
dated price snapshot, not an invoice. The 50-question set has no repeated-run
confidence interval. Workstream 3 must use these events to define when LLM
synthesis is justified and when the already-complete deterministic answer
should be returned without paying generation/verification latency first.

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

Status: complete (2026-09-09)

Outcome: goal met, as a non-implementing audit only. Additive, non-behavior-
changing diagnostic telemetry was added to `structuredQuery` and
`selectReviewedRoutingManifest` (eight new event names, seven covered by
dedicated unit tests — the eighth, `routing_document_gate_empty`, is
unreachable through `structuredQuery`'s current public signature and kept
only as defensive instrumentation) so every routing abstention is now
observable, not silent. The existing 50-question suitability set alone
could not supply real query-resolution failures (its 34 partial cases are
format/completeness gaps, not resolution failures), so this workstream
built 26 real, corpus-derived probes (19 ambiguous-tie same-parameter
non-sibling QC collisions, 6 confidence-floor single-word probes, 1
cross-document manifest-topic overlap) plus reuse of Workstream 1's
220-probe mode/intent diagnostics (42 cases) and Workstream 2's fresh
50-question production-path audit.

Verification: measured taxonomy counts — `ambiguous_scope` 19,
`deterministic_confidence_gap` 6, `response_generation_verification_failure`
10, `evidence_absent` 0, and the milestone's own `query-understanding/
resolution miss` category **0** (no probe or corpus case had document/
topic/intent/context resolution itself resolve incorrectly). Workstream 1's
42 mode/intent-label diagnostics were kept as a separate,
non-milestone-taxonomy count (`mode_intent_contract_mismatch`) precisely
because document and manifest resolution were already correct in every one
of those cases — only an internal label disagreed with the manifest.
None of the `ambiguous_scope`/`deterministic_confidence_gap` cases occurred
in Workstream 2's 50-question production-path audit (0/50); all came from
targeted, corpus-derived probes — a finding about that one benchmark, not a
claim about all production traffic. Of the 6 confidence-floor probes, 5
reproduced a genuine retrieval miss (the structured router correctly
identified the right document even sub-floor, but the separate
`store.search()` fallback path independently missed the same record) and
only 1 was recoverable by existing fallback — this splits the milestone's
retrieval-miss/resolution-miss distinction with real (probe-derived) data,
not assumption, though it has not yet been measured how often this pattern
occurs in real production questions. A concrete real trace showed a bare
cross-document topic question degrading to a `source_excerpts` answer
mixing two unrelated documents with no disambiguation signal to the user.
Reproducible via `npm run audit:query-resolution`
(`history/verification/response_intelligence_workstream_3_2026-09-09.md`).
`npm test` 428/428 (7 new routing-diagnostics tests), `validate:guidelines`
6/6, `validate:ko` 2,693/2,693, `audit:ko` 1,495/1,495 with 0 issues,
`validate:semantic` 6/6, `audit:routing:hardening` 220/220 (unchanged), and
`npm run eval` 24/24 all stayed green.

Remaining risk/follow-up: a documented (not fixed) bug —
`answer_envelope.js`'s plain-fallback path reads `refusal_reason` while
`answerFallback` sets the richer reasons on `fallback_reason`, silently
collapsing them to `"no_match"`; fixing it changes the public envelope
contract and is left for a dedicated follow-up. **Addendum (Workstream 4
kickoff): the "5 retrieval-miss cases" above are not usable as a benchmark
denominator** — they are an artificial single-real-word query colliding
with unrelated records at the keyword store's field-tier scoring, not a
demonstrated synonym/paraphrase gap (see the corresponding addendum in the
Workstream 3 report). Workstream 4 built a real, multi-word synonym/
paraphrase benchmark instead. Workstream 5 should scope any new LLM call
strictly to the two measured
ambiguous-tie escalation conditions and implement Workstream 2's
cost-negative recommendation (skip speculative generation when the
deterministic answer is already adequate) first, ahead of any new
LLM-call-adding disambiguation path. Probe corpora are small because the
real archive currently contains only that many genuine collisions/overlaps;
`npm run audit:query-resolution` is fully corpus-derived and will pick up
new real cases as the archive/manifest inventory grows.

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

Status: complete (2026-09-09)

Outcome: goal met with two small, dependency-free fixes; no hybrid
retrieval/BM25/embeddings/reranking was adopted. Workstream 3's "5
retrieval-miss" cases were first found unusable as a benchmark denominator
(they were an artificial single-real-word query colliding with unrelated
records at the keyword store's field-tier scoring, not a synonym/paraphrase
gap — addenda added to the Workstream 3 report and §3 above). A real
benchmark was built instead (`npm run audit:retrieval-quality`,
`scripts/analyze_retrieval_quality.js`): 30 auto-generated known-synonym
regression probes and 3 hand-curated real uncovered-synonym probes, all
realistic multi-word questions.

Verification: uncovered-synonym gap went 1/3 → 3/3 after adding
`"repeats"`/`"repeat"`/`"cycling"` to `engine/text_utils.js`'s
`REGULATORY_SYNONYMS` (two confirmed real missing-vocabulary gaps —
neither shared any token at all with its ground-truth record). Known-
synonym regression stayed 28/30 both before and after adding a small
document-frequency-aware scoring bonus to `engine/vector_store.js`'s
`createKeywordStore()` (fixes the same field-tier-collision mechanism the
Workstream 3 artifact exposed, at its root); the remaining 2 misses
(`단백질`/protein, `결합`/binding) are a genuinely under-specified 2-generic-
word query (each word individually matches ~9-12% of the 2,693-record
archive), not a fixable ranking or vocabulary defect. `npm test` 430/430
(2 new tests), `validate:guidelines` 6/6, `validate:ko` 2,693/2,693,
`audit:ko` 1,495/1,495 with 0 issues, `validate:semantic` 6/6,
`audit:routing:hardening` 220/220 with 42 mode/intent diagnostics
unchanged (confirms this change is isolated to the fallback retrieval
path, not `structuredQuery`'s own scorer), and `npm run eval` 24/24 all
stayed green. Full detail:
`history/verification/response_intelligence_workstream_4_2026-09-09.md`.

Remaining risk/follow-up: the IDF bonus weight (0.3) was chosen to fix the
observed collision shape without regressing any pinned test, not
exhaustively tuned against a larger corpus. The remaining 2-generic-word
under-specification gap may need upstream fallback-query construction
(more of the original question's content words), not further retrieval-
layer changes, if it proves to matter with real user questions. Embeddings
remain unintegrated and infrastructurally blocked (no working native-binary
build for `better-sqlite3`/`sqlite-vec` on this machine) — a real
prerequisite, independent of retrieval-quality justification, for any
future workstream that revisits them.

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

Status: complete (2026-09-09)

Outcome: goal met with one narrow, measurement-verified fix; a second
candidate was explicitly deferred. Workstream 3's ambiguous-tie/manifest-
ambiguous-tie LLM disambiguation candidate was **not implemented** — it
measured 0/50 in Workstream 2's 50-question production-path audit (not
observed in that benchmark; not a claim about all production traffic this
system has served), so there is no real trade-off from that benchmark to
compare against, per the milestone's own "implement only ... cannot solve
reliably" gate. Implemented instead: `engine/answer_envelope.js`'s
`shouldGenerate()` now skips a speculative generation attempt for
`multi_criterion`/`list`/`within_document_comparison` matches at exactly
`SMALL_CANDIDATE_SET_CEILING` (3) expected units, because the deterministic
composite already trivially satisfies `generatedCoverageIsAdequate`'s own
completeness bar for that exact shape — skipping can never fail that
specific coverage check. That is a guarantee about the coverage check
only, not proof that a generated narrative would never have added real
value; the `process`-mode exclusion below is exactly a case where it does.

Verification: the scope was narrowed twice from its first design, each
time by real measurement against fresh full 50-question production-path
runs, not assumption. Count 1 was excluded after finding all 4 real cases
had already succeeded at generation (pure value loss if skipped). `process`
mode was excluded after implementing the broader version broke a pinned
test showing genuine 3-unit narrative synthesis value — real, direct
evidence that the same evidence shape can carry real synthesis value, so
this fix's safety is about the coverage check, not a general "no value
lost" property of the shape itself. Count 2 was excluded after finding
real outcomes genuinely mixed (1 failure, 2 successes across 3 real
cases) — not a clean win. Only count 3 showed a clean, repeated real
failure (Q05, Q47) with no counterexample across three separate fresh
runs; the final scope targets exactly that shape, and this remains a risk
to re-evaluate (not a proven property) if Workstream 6 finds otherwise.
`npm test` 436/436 (430 prior + 6 new), `validate:guidelines` 6/6,
`validate:ko` 2,693/2,693, `audit:ko` 1,495/1,495 with 0 issues,
`validate:semantic` 6/6, `audit:routing:hardening` 220/220 with 42
mode/intent diagnostics unchanged, and `npm run eval` 24/24 all stayed
green. Full detail:
`history/verification/response_intelligence_workstream_5_2026-09-09.md`.

Remaining risk/follow-up: count-2 and `process`-mode completeness failures
remain unaddressed on current evidence (a real, documented trade rather
than a free win) — `isSmallCompleteClaimSet`
(`engine/answer_envelope.js`) documents exactly why and can be revisited
with more data. The count-3 skip itself is a guarantee about the coverage
check, not a proven "no synthesis value ever lost" property — the
`process`-mode counter-evidence above shows the same evidence shape can
carry real value, so Workstream 6 (response/generation quality) should
explicitly re-evaluate whether the count-3 skip is losing real value for
`multi_criterion`/`list`/`within_document_comparison`, not treat it as
settled. The ambiguous-tie disambiguation candidate remains deferred
pending real occurrence evidence at production scale.

## 6. Response Quality / Verification Contract

Goal: reduce generation-level failures where evidence is adequate but the
answer is incomplete or distorts meaning.

- Broad-answer completeness, qualifier/exception preservation, claim
  omission, stochastic-generation regression, structured vs. generated
  answer consistency.

Status: complete (2026-09-09)

Outcome: goal partially met by a concrete, deterministic fix, and
partially found not to clear the bar for a pipeline change on real
evidence. `web/render.js`'s `renderGeneratedUnit` (the only per-unit
renderer used by the `grounded_generation` route) was the sole renderer
that never showed a claim's `applicable_conditions`/`modality`/
`value_status`, while every other route's renderer did — a real,
structured-vs-generated inconsistency affecting 36% of the archive (978/
2,693 records carry `applicable_conditions`). Fixed, along with the same
gap in the shared `renderClaimCard` evidence-card renderer.

A second, real measurement (`npm run audit:generation-fidelity`, reusing
Workstream 5's already-collected 50-question run at zero extra API cost)
checked 76 real cases of a generated answer's own prose against an
attached condition's text. Two real methodology bugs in the measurement
script itself were caught and fixed first (an English-vs-Korean text
mismatch, then a length filter that zeroed out short Korean condition
phrases) before drawing any conclusion. Manual review of the result found
most apparent omissions are not distortions — a single generated sentence
naturally can't restate every one of several distinct conditions attached
to one source record — but found 2 real, material cases where an omitted
exception/precondition would mislead a user about the answer's
applicability, matching the exact critical failure
`docs/answer_suitability_evaluation.md` already names.

Verification: `npm test` 439/439 (436 prior + 3 new). No routing/
generation/verification code was touched, so the Workstream 1-5
validate/audit/eval battery was not re-run (nothing in its scope changed).
Full detail:
`history/verification/response_intelligence_workstream_6_2026-09-09.md`.

Remaining risk/follow-up: a verifier-prompt change to reject
condition-omitting units was considered and explicitly **not**
implemented — the measured omission rate is high across both benign and
consequential condition types (not concentrated in a subset a narrow rule
could target), so any such rule risks broadly rejecting generation
attempts for the 36% of the archive with attached conditions, for a
benefit measured so far in only 2/76 real cases. The Step 1 render fix is
judged the correct primary mitigation: it guarantees every condition is
shown regardless of what the generated prose says. The 2 real material
cases are documented for a future, narrower fix attempt.
"Stochastic-generation regression" is documented as a measurement
practice (reuse `GUIDELINE_AUDIT_RERUN_IDS` for spot-checking one
question's stability), not something fixable — LLM output variance is
inherent and already observed directly in this milestone (Workstream 2's
Q07/Q34; Workstream 5's three separate runs).

## 7. Production Evaluation & SLO

Goal: define product-level acceptance criteria and a production SLO.

- Rebuild the eval set by question type beyond the existing 50Q: detail,
  list, overview, process, comparison, ambiguous, refusal.
- Track answerability, retrieval completeness, citation correctness,
  latency, and API usage — not just accuracy.

Status: complete (2026-09-09)

Outcome: goal met. No question-type taxonomy or production SLO existed
anywhere in the repo before this workstream. A 72-question typed eval
corpus (`data/eval/typed_questions.json`,
`scripts/build_typed_eval_corpus.js`) was assembled entirely from real,
already-vetted material from prior workstreams — 50Q depth codes mapped
to 5 of the 7 types (B0→overview, B1→list, D1+D2→detail, X→comparison,
plus a documented human split of B2 into `process`/`comparison`/`detail`
subsets), and the two types the 50Q set structurally cannot supply
(`ambiguous`, `refusal`) reused Workstream 3's 19 confirmed real
ambiguous-tie probes and 3 of the gold eval set's refusal-expected
questions. `scripts/run_typed_eval_audit.js` ran all 72 through the real
production path (72/72, 0 final errors after retrying 2 transient
failures); `scripts/analyze_production_slo.js`
(`npm run audit:production-slo`) aggregates answerability, claim
grounding, retrieval-groundedness, and (reusing Workstream 2's latency/
cost code directly) latency/API usage, per type.

Verification: 100% answerability, claim grounding, and retrieval-
groundedness across every type where they apply; the `ambiguous` type's
real routing-abstention rate is 18/19 (94.7%, one real probe did not
reproduce its tie on this run — traced, not a bug). Overall p50/p95/max
8,831/27,679/38,034 ms, 139 LLM calls, ~$1.31 total. Two real bugs in this
workstream's own new measurement script were caught and fixed before
reporting (a wrong `ambiguous`-type success expectation, and a
floating-point rounding bug that made the SLO baseline fail its own
check) — see the report. `docs/production_slo.md` records every target as
this measured baseline itself, code-enforced via
`scripts/analyze_production_slo.js`'s `SLO_TARGETS` and a `--check` exit-
code gate (verified to actually catch a real regression, not just report).
`npm test` 450/450 (post-close correction below; 444/444 at initial
commit). No engine/routing/generation code was touched, so the Workstream
1-6 validate/audit/eval battery was not re-run. Full detail:
`history/verification/response_intelligence_workstream_7_2026-09-09.md`.

**Post-close correction (same day):** the initial `ambiguous`-type SLO
success check only verified that routing *noticed* the ambiguity
internally, not that the final answer was safe — Workstream 3 had already
documented the real failure this missed (router abstains correctly, then
an ordinary fallback silently blends claims from two unrelated documents
into one answer with no disclosure). Re-checking confirmed this is real:
1 of the 19 `ambiguous`-type questions (`ws3_ambiguous_tie.days`)
produced exactly this failure and passed the original SLO anyway. Fixed:
a new `cross_scope_safe_rate` metric judges the final answer, with its
SLO target deliberately kept at the correct 1.0 (not lowered to match the
measured 18/19) — `npm run audit:production-slo -- --check` now
correctly, intentionally fails on this one real, unfixed defect until a
future workstream fixes it. This is also new evidence relevant to
Workstream 5's "0/50 real occurrences" deferral of ambiguous-tie
disambiguation — see `docs/production_slo.md`.

Remaining risk/follow-up: the cross-scope answer-mixing defect found above
is real and unfixed — a future workstream should design an actual fix
(disambiguation, refusal, or explicit scope disclosure), not just leave
the SLO check red. "Retrieval completeness" is operationalized as "every
returned claim resolves a citation," not "retrieved the exact expected
document/section" — the typed corpus doesn't yet carry a uniform parsed
expected-scope field for every question to support the stricter check.
The `ambiguous` type's 18/19 `routing_abstention_rate` baseline reflects
the current 55-manifest reviewed inventory's single real cross-document
manifest-ambiguity case; re-run `npm run build:eval:typed` +
`npm run eval:typed:run` as more manifests are authored rather than
treating it as fixed.

## Milestone close-out (2026-09-10)

Workstream 8 (Corpus Expansion / Reusability Test) was **cancelled** by
explicit user decision, not deferred and not completed — no separate
regulatory corpus was added, and the reusability-vs-Guideline-specific
question it was meant to answer remains genuinely open. With Workstreams
1-7 complete and Workstream 8 cancelled, this milestone is closed.

Both real risks this document's Workstream 3/7 sections left open were
fixed in this close-out pass, before moving this document to `history/`:

- **Cross-scope answer mixing** (§7's "known open safety issue"): fixed in
  `engine/answer_envelope.js` — after `answerFallback` returns, if this
  request's telemetry recorded a genuine routing/manifest ambiguity tie
  and the fallback's own claims span more than one document, the answer
  is replaced with an explicit `ambiguous_document_scope` refusal naming
  the candidate documents, surfaced in both the API envelope and the web
  refusal card. Verified via a direct reproduction of the real
  `ws3_ambiguous_tie.days` failure shape
  (`test/engine_answer_envelope.test.js`) and a fresh full 72-question SLO
  rerun: `cross_scope_safe_rate` is now 100% (19/19), and
  `npm run audit:production-slo -- --check` passes. Full detail:
  `docs/production_slo.md`.
- **`refusal_reason`/`fallback_reason` contract** (§3's documented, then-
  unfixed bug): `engine/answer_envelope.js`'s plain-fallback branch now
  reads `result.refusal_reason || result.fallback_reason`, so the richer
  reasons `answerFallback` actually sets (`model_declined`,
  `language_mismatch`, `verification_failed: <detail>`,
  `generation_not_configured`) no longer silently collapse to
  `"no_match"`. The stale envelope doc-comment listing unreachable
  `refusal.kind` values was also corrected.

A new, real finding surfaced in the same close-out pass, **left unfixed**
as a real follow-up rather than something this pass was scoped to
address: a `retrieval_scope_correct_rate` metric (`data/eval/typed_questions.json`'s
new `expected_document_ids` field, populated from real, already-known
provenance) measured 93.9% (62/66) and found 4 real cases where the
answer cited a document outside the question's real expected scope,
including one case (`ws3_ambiguous_tie.analysts`) where a router-flagged
ambiguous tie fell through to a confident answer from a single document
that isn't even a plausible candidate — a distinct defect class the
cross-scope-mixing guard above structurally cannot catch. Full detail and
the 4 specific cases: `docs/production_slo.md`.

`answer()` (`engine/query_router.js`) and `answerEnvelope()`
(`engine/answer_envelope.js`) were confirmed to be genuine parallel
implementations, not one wrapping the other — `answerEnvelope()` is the
sole production path (`/api/ask`); `answer()` serves only the CLI and the
legacy gold eval, and does not carry `answerEnvelope()`'s gates including
the fix above. Left as two entry points rather than merged (see
`engine/answer_envelope.js`'s header comment for the reasoning) — merging
would have meant migrating the CLI/legacy-eval call sites for no
production-safety benefit, out of proportion to this pass's scope.

This document is now frozen at
`history/milestones/response_intelligence_2026-09-10.md`. Current
verification numbers live in `docs/verification_status.md`, the current
SLO baseline in `docs/production_slo.md`, and the milestone register entry
in `docs/milestone_log.md`.
