# Response Intelligence — Workstream 3 Verification

Date: 2026-09-09

Workstream: Query Resolution & LLM Intervention Audit

Result: complete; non-implementing audit — no LLM planner or retrieval
upgrade was built, per the milestone's explicit scope.

## Method

Before this workstream, `engine/query_router.js`'s and
`engine/semantic_routing.js`'s deterministic abstention points (confidence-
floor miss, ambiguous tie, manifest score/intent mismatch, manifest-
ambiguous tie, broad-question-no-composite) returned `null` silently —
Workstream 2's `telemetry.events` only covered the generation/verification
side (`answerFallback`). Without an observable reason, a taxonomy could only
be built by manually re-reading code per failing question.

**Additive routing diagnostics** (no behavior change; same instrumentation
pattern as Workstream 2) were added to `engine/query_router.js` and
`engine/semantic_routing.js`, threading an optional `telemetry` object into
`structuredQuery`, `tryListCompositeQuery`, `tryCoverageCompositeQuery` /
`buildCoverageMatch`, and `selectReviewedRoutingManifest`. Seven new event
names were added: `routing_document_gate_empty`,
`routing_below_confidence_floor`, `routing_broad_no_composite`,
`routing_ambiguous_tie`, `routing_list_ambiguous_tie`,
`routing_coverage_composite_below_threshold`, `manifest_no_eligible_candidate`,
`manifest_ambiguous_tie`. Seven unit tests
(`test/engine_routing_diagnostics.test.js`) confirm each fires on the
branch it names, without changing any match/return value. `npm test`
(428/428), `validate:guidelines`, `validate:ko`, `audit:ko`,
`validate:semantic`, `audit:routing:hardening` (220/220), and `npm run eval`
(24/24) all stayed green after this change.

The existing 50-question suitability set could not, by itself, supply enough
real query-resolution failures: current adjudication is 16 suitable / 34
partially suitable / 0 unsuitable, and per
`history/verification/answer_suitability_audit_2026-09-07_complete.md` §7,
the 34 partial cases are overwhelmingly format/completeness gaps ("남은
격차는 형식(표/명시적 구획)과 완전성"), not wrong-scope, ambiguous, or
retrieval-miss failures. No per-question defect category (retrieval/
coverage/composition/scope/presentation, the rubric in
`docs/answer_suitability_evaluation.md`) was ever recorded in a structured,
machine-readable form for these 50 questions — only prose verdicts. Rather
than retroactively assign a category to 50 questions from prose (a
judgment-heavy reclassification exercise this workstream cannot do
reliably), this audit instead confirmed and used that report's own stated
conclusion directly, and built new, **real, corpus-derived** probes to
actually exercise the resolution-failure branches:

- **19 ambiguous-tie probes**: every `quantitative_criterion` parameter name
  that appears on non-sibling records (different `knowledge_record_id` and
  different `source_unit_ids[0]` — i.e. not the intentional default+exception
  composite `areSiblings` already handles) in the real archive. A bare
  `"<parameter> acceptance criteria"` question scores every same-parameter
  record identically (the router's own `criteria`/`acceptance`/exact-
  `parameter` special-cased scoring), reproducing `structuredQuery`'s real
  Case-4 tie abstention without inventing synthetic records.
- **6 confidence-floor probes**: one per archived document, using one real
  distinctive content word (≥6 characters, excluding the router's special-
  cased bonus/penalty vocabulary) from that document's longest narrative
  record, combined with filler tokens absent from the archive.
- **1 manifest-ambiguity probe**: the one real coverage-manifest topic
  (`section_1_introduction`) that recurs, with a section target, across ≥2
  documents (`ich_m10`, `ich_m3_r2`, `ich_s6_r1`) in the current 55-manifest
  reviewed inventory. Document-target "whole guideline" manifests exist for
  all 6 documents under the same topic name but require an explicit multi-
  document request to become eligible at all, a materially different
  question shape; that case is reported qualitatively below rather than
  counted as an automated probe.

All probes and results are reproducible via `npm run audit:query-resolution`
(`scripts/analyze_query_resolution_taxonomy.js`), which also reuses two
already-existing, already-measured real corpora rather than re-running them:
Workstream 1's 220-probe routing-hardening audit
(`logs/runtime/answer_routing_hardening_audit.json`) and Workstream 2's fresh
50-question production-path run
(`logs/runtime/answer_suitability_50_workstream_2.json`).

## Failure taxonomy and counts

| Milestone category | Real measured count | Source |
|---|---:|---|
| `ambiguous_scope` | 19 | 18/19 ambiguous-tie probes tied; the 1 manifest-ambiguity probe tied |
| `deterministic_confidence_gap` | 6 | 6/6 confidence-floor probes fell below the router's score/token floor |
| `query_understanding_resolution_miss` | 42 | Workstream 1's 220-probe mode/intent diagnostics (manifest and document resolved correctly; the router's own mode/answer_intent label disagreed with the manifest's declaration) |
| `response_generation_verification_failure` | 10 | Workstream 2's fresh 50-question production corpus (verification retry/failure, language retry, generated-facet-coverage rejection, model decline — already itemized in the Workstream 2 report) |
| `evidence_absent` | 0 | Not observed in either probe corpus or the 50-question production corpus |
| `retrieval_miss` | (see below — distinct axis, not double-counted here) | Confidence-floor probes only |

**A real production question essentially never reaches the routing-
abstention branches.** All 19 ambiguous-scope and 6 confidence-gap cases
came from targeted probes built specifically to exercise those branches;
zero occurred in Workstream 2's real 50-question production run. This is
itself a finding: these deterministic abstention points are real and now
observable, but latent under the current corpus's actual question
distribution — not a source of everyday user-facing failures today.

One ambiguous-tie probe (`precision (%cv)`, `ich_m10.qc.3_2_7.003` vs.
`ich_m10.qc.4_2_4_2.010`) did not tie: the `(%cv)` parenthetical gave the two
records incidentally different scores, breaking the exact tie. Reported for
completeness, not a design defect.

## Retrieval-miss vs. resolution-miss (milestone bullet 2)

For confidence-floor probes only (the ones with a single, known ground-truth
record), the script additionally calls the real `store.search()` used by the
generation-fallback path, independent of `structuredQuery`'s own scoring, to
check whether the ground-truth record is retrievable at all:

| Document | Router identified the right document below-floor? | `store.search` found the ground-truth record? | Classification |
|---|---|---|---|
| ema_fih | yes | no | retrieval_miss |
| fda_ada_2014 | yes | no | retrieval_miss |
| fda_ada | yes | no | retrieval_miss |
| ich_m10 | yes | **yes** | resolution_recoverable_by_fallback |
| ich_m3_r2 | yes | no | retrieval_miss |
| ich_s6_r1 | yes | no | retrieval_miss |

**5 of 6 confidence-floor cases are genuine retrieval misses**: the
structured router's own scorer actually identified the correct document even
at sub-floor confidence (`best_sub_floor_document_id` in the new telemetry
event), but the separate vector/keyword `store.search()` used for
grounded-generation fallback independently failed to surface the same
record. The two subsystems do not share this signal today. Only 1 of 6 was
recoverable purely by the existing fallback path.

This directly answers the milestone's ask: these 5 cases are **not**
query-understanding/resolution failures — the resolution was already
correct — and belong in Workstream 4's retrieval-quality benchmark
denominator, not in Workstream 5's LLM-planning scope.

## Manifest ambiguity: a concrete real trace

The bare Korean question `"가이드라인의 section 1 introduction 항목은 뭐가
있어?"` (no document named) triggers `manifest_ambiguous_tie` across
`ich_m10`/`ich_m3_r2`/`ich_s6_r1`'s identically-shaped introduction
manifests. Traced through the full `answerEnvelope` (no generator/verifier
configured, `fallbackMode: "source_excerpts"`): the tie abstains, plain
scored-candidate routing also falls below the confidence floor
(`ema_fih` scored highest but still sub-floor), and the question ultimately
resolves to a `source_excerpts` answer mixing content from **two unrelated
documents** (`ema_fih` and `ich_m10`) with no indication to the user that
their question was actually ambiguous across three guidelines. This is a
concrete illustration of what "silently degrade instead of disambiguating"
looks like in production, not a hypothetical.

## Candidate LLM intervention points (evidence-backed scope for Workstreams 4–5)

| Candidate | Escalation condition | Deterministic evidence already available | Measured coverage | Direction |
|---|---|---|---|---|
| **Skip speculative generation when the deterministic answer is already adequate** | `generated_answer_rejected` / `structured_routing_rejected` | The already-complete deterministic structured/manifest answer | 12/23 final-structured Workstream 2 baseline cases | **cost-negative** — highest priority |
| LLM disambiguation on `routing_ambiguous_tie` / `routing_list_ambiguous_tie` | Tie abstention fires | The tied candidate record set itself — no new retrieval | 18/19 real corpus-derived probes; 0/50 real production questions | cost-positive, conditional |
| LLM disambiguation on `manifest_ambiguous_tie` | Manifest tie abstention fires | The tied manifest list | 1/1 real cross-document topic group (of 55 reviewed manifests) | cost-positive, conditional, low volume today |
| Retrieval quality upgrade for confidence-floor retrieval misses | `routing_below_confidence_floor` where `store.search` also misses | N/A — this is retrieval quality, not LLM planning | 5/6 confidence-floor probes | **out of scope for Workstream 5**; becomes Workstream 4's benchmark |
| Deterministic mode/intent relabeling | Workstream 1's 42 mode/intent diagnostics | The selected manifest's own declared `answer_intent` | 42/220 eligible probes | diagnostic only — not an LLM candidate; a deterministic label fix is cheaper if it ever causes an observable defect |

Using Workstream 2's measured per-call cost (frozen 2026-09-09 OpenAI
Standard short-context snapshot; `gpt-5.6-terra` generation rates), a single
bounded disambiguation call over an already-fixed small candidate set is
estimated at roughly the same per-call cost as one ordinary generation call
in that baseline (~p50 3,423 ms / p95 11,801 ms, ~$0.008–0.01 at the run's
average token usage) — small in isolation, but this workstream found only
19 real-corpus-derived and 0 real-production occurrences to spend it on. The
cost-negative candidate (skip speculative generation) remains the
overwhelmingly higher-value target and should be Workstream 5's first
implementation, ahead of any new LLM-call-adding disambiguation path.

## Documented bug (not fixed in this workstream)

`engine/answer_envelope.js`'s plain-fallback refusal path reads
`result.refusal_reason`, but `engine/query_router.js`'s `answerFallback`
only ever sets richer reject reasons (`model_declined`, `language_mismatch`,
`` verification_failed: ... ``) on a **different** field, `result.fallback_reason`
(set via the `sourceExcerptResult` closure). `envelope.refusal.kind` therefore
silently collapses these to the generic `"no_match"` default whenever
`answerFallback` returns `answered: false` through that path. The
`answer_envelope.js` doc-comment listing `"model_declined"`,
`"verification_failed"`, and `"no_provider"` as reachable `refusal.kind`
values is not accurate to the code — none of those three strings ever reach
`refusal.kind`; `"no_provider"` does not exist anywhere in `engine/`. This
audit's own classification used `telemetry.events` (not `envelope.refusal.kind`)
specifically because of this gap, so its findings above are unaffected. Not
fixed here: correcting it changes the public answer envelope's observable
`refusal.kind` values, which is a version-bump-worthy contract change, out
of scope for a non-implementing audit workstream.

## Remaining risk/follow-up

- The probe corpora are necessarily small (19 + 6 + 1 = 26 targeted probes)
  because the real archive only contains that many genuine non-sibling
  same-parameter collisions and cross-document manifest-topic overlaps
  today. As the archive/manifest inventory grows, re-run
  `npm run audit:query-resolution` — it is fully corpus-derived and will
  pick up new real cases automatically, not a fixed fixture.
- `evidence_absent` (document-gate-empty / zero-candidate) was not observed
  by any probe in this workstream; `routing_document_gate_empty` in
  particular is likely unreachable by construction today because
  `resolveRequestedDocumentIds`'s identity map is built from the same
  `records` array `applyDocumentGate` filters — the event is kept as
  defensive instrumentation for a caller that ever passes a pre-scoped
  record subset.
- Workstream 4 should treat the 5 real retrieval-miss cases (and the
  underlying mechanism — the structured scorer and `store.search` not
  sharing a signal) as part of its benchmark denominator.
- Workstream 5 should scope any new LLM call strictly to the two ambiguous-
  tie escalation conditions above, and implement Workstream 2's
  cost-negative recommendation first.

## Commands

- `npm run audit:query-resolution` — writes
  `logs/runtime/response_intelligence_workstream_3_taxonomy.json`; prints
  probe counts and taxonomy category counts.
- `npm test` — 428/428 passed, including the 7 new routing-diagnostics tests.
- `npm run validate:guidelines` — 6/6 guideline bundles passed.
- `npm run validate:ko` — 2,693/2,693 Korean presentation entries passed.
- `npm run audit:ko` — 1,495/1,495 reviewed, 0 issues.
- `npm run validate:semantic` — 6 semantic overlays and 6 presentation files
  passed.
- `npm run audit:routing:hardening` — 220/220 passed; 55 eligible, 0
  ineligible manifests (unchanged from Workstream 1).
- `npm run eval` — 24/24 passed; citation precision, claim grounding, and
  refusal correctness each 100%.
