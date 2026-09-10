# Production Evaluation & SLO

Current baseline established: 2026-09-10, final rerun after all four
retrieval-scope-correctness gaps this document previously tracked were
fixed (see "Retrieval scope correctness" below). Source run:
`logs/runtime/typed_eval_50plus_raw_2026-09-10.json` (72 questions, fresh
run, `GUIDELINE_TYPED_EVAL_FRESH=true`), aggregated by
`npm run audit:production-slo` (`scripts/analyze_production_slo.js`) into
`logs/runtime/response_intelligence_slo_baseline_2026-09-10.json`. This
baseline supersedes two earlier same-day runs recorded in git history for
this file — the original Response Intelligence close-out baseline (full
method and reasoning: `history/verification/response_intelligence_workstream_7_2026-09-09.md`)
and an intermediate baseline after the cross-scope-mixing and
refusal-contract fixes but before the Q11/Q22/Q25/analysts
retrieval-scope fixes below.

Every target below is the measured baseline itself, not an aspirational
number — consistent with how this project has recorded every other
baseline in `docs/verification_status.md`. `scripts/analyze_production_slo.js`'s
`SLO_TARGETS` constant is the authoritative, code-enforced version of this
document; if they ever drift apart, the code constant is the bug to fix
(or this document is stale — check the git history of both together).

## Question-type taxonomy

The 72-question typed corpus (`data/eval/typed_questions.json`, built by
`scripts/build_typed_eval_corpus.js`) assembles it entirely from real,
already-vetted material — no question was newly invented for this
document:

| Type | n | Source |
|---|---:|---|
| overview | 6 | `docs/answer_suitability_evaluation.md` depth code B0 |
| list | 11 | depth code B1 |
| process | 8 | depth code B2, the genuinely sequential subset (documented judgment call, not mechanical) |
| detail | 21 | depth codes D1+D2, plus the non-sequential/non-comparison B2 remainder |
| comparison | 4 | depth code X, plus 2 genuine two-concept B2 comparisons |
| ambiguous | 19 | real ambiguous-tie/manifest-ambiguity probes that were confirmed to actually tie |
| refusal | 3 | `test/fixtures/eval_questions.json`'s refusal-expected gold questions whose refusal does not depend on whether generation happens to be configured |

## Tracked dimensions and current baseline, by type

`n/a` means the dimension does not apply to that type by construction (e.g.
a refusal has no claims to ground; `ambiguous`'s success signal is routing
abstention, not answerability — see the report for why). "Scope correct"
is `retrieval_scope_correct_rate` — see below the table.

| Type | Answerability | Claim grounding | Retrieval grounded | Routing abstention | Cross-scope safe | Scope correct | p50 / p95 / max (ms) | LLM calls | Cost (USD) |
|---|---:|---:|---:|---:|---:|---:|---|---:|---:|
| overview | 100% | 100% | 100% | n/a | n/a | 100% | 12,224 / 27,694 / 27,694 | 15 | 0.192 |
| list | 100% | 100% | 100% | n/a | n/a | 100% | 12 / 46,229 / 46,229 | 6 | 0.116 |
| process | 100% | 100% | 100% | n/a | n/a | 100% | 7,240 / 36,949 / 36,949 | 18 | 0.221 |
| detail | 100% | 100% | 100% | n/a | n/a | 95.2% (20/21) | 9,918 / 27,479 / 35,707 | 43 | 0.407 |
| comparison | 100% | 100% | 100% | n/a | n/a | 100% | 14,655 / 18,246 / 18,246 | 9 | 0.103 |
| ambiguous | n/a | 100%* | 100%* | 94.7% (18/19) | **100% (19/19)** | **100% (18/18)** | 9,064 / 27,223 / 27,223 | 47 | 0.343 |
| refusal | 100% | n/a | n/a | n/a | n/a | n/a | 11 / 100 / 100 | 0 | 0.000 |
| **overall** | **100%** (53/53 checked) | **100%** | **100%** | 94.7% | **100%** | **98.5% (67/68)** | **8,315 / 27,694 / 46,229** | **138** (75 gen / 63 verif) | **1.382** ($0.0192/question avg) |

*\* computed only over the subset that fell through to an answered
fallback after abstaining — see the report.*

All four previously-tracked retrieval-scope-correctness gaps
(`fifty_q_Q11`, `fifty_q_Q22`, `fifty_q_Q25`, `ws3_ambiguous_tie.analysts`)
are fixed and pass on this run. `detail` at 95.2% reflects one newly
surfaced case, `fifty_q_Q23` — see below, not a regression from those
fixes (that question doesn't share any mechanism with the four that were
fixed).

## Cross-scope answer mixing (fixed)

Routing abstention firing (the router internally noticing an ambiguous
tie) is not the same as the final answer being safe. A real trace showed
the failure this metric closes: the router abstains correctly, then an
ordinary fallback silently blends claims from two unrelated documents into
one answer with no disclosure that the question was ambiguous. Confirmed
real: of the 19 `ambiguous`-type questions in the original 2026-09-09
baseline run, 1 real case (`ws3_ambiguous_tie.days`) produced a
`grounded_generation` answer mixing `fda_ada` and `ich_m10` content with
no indication to the user that the question spanned two guidelines.

**Fixed** in `engine/answer_envelope.js`/`engine/query_router.js`
(`answerFallback`): when a same-request routing tie fires
(`routing_ambiguous_tie`/`routing_list_ambiguous_tie`/
`manifest_ambiguous_tie`), a tie resolved to exactly one document is
propagated into `answerFallback` as a document restriction (including
through its own internal repair-retry recursion); a tie spanning more
than one document refuses immediately, disclosing every tied document,
before ever attempting a fallback search — a genuine multi-document
ambiguity must never be silently narrowed to one candidate. Both API
envelope and web UI (`web/render.js`, `web/i18n.js`) surface the
disclosure. `cross_scope_safe_rate` is **100% (19/19)** on this baseline,
confirmed via `test/engine_answer_envelope.test.js`'s direct real-shape
reproductions plus this 72Q rerun.

This finding was also relevant to Workstream 5's decision to defer
building an LLM-disambiguation intervention for ambiguous-tie cases (based
on 0/50 real occurrences in a 50-question production audit — see
`history/verification/response_intelligence_workstream_5_2026-09-09.md`).
The fix above resolves the real user-facing harm deterministically, with
no new LLM call, so that deferral does not need to be revisited on this
basis.

## Retrieval scope correctness

`retrieval_scope_correct_rate` (`scripts/analyze_production_slo.js`'s
`retrievalScopeCorrect`) checks something `retrieval_grounded_rate` does
not: not just "did every claim's citation resolve" but "was the answer
actually scoped to one of the real, already-known expected documents."
`data/eval/typed_questions.json` carries an `expected_document_ids` field
on 69/72 questions, populated from real, already-known provenance only
(never fabricated) — the 50-question set's own per-question guideline
grouping (`docs/answer_suitability_evaluation.md`'s section headers A-G)
and the ambiguous-tie probes' own labeled `ground_truth_document_ids`.
The 3 `refusal`-type questions have no expected document by design.

Measured at **98.5% (67/68)** on this baseline, up from 93.9% (62/66) on
the prior run. All four previously-tracked real gaps are fixed,
deterministically, no LLM added:

- `fifty_q_Q11` ("ADA 평가는 보통 어떤 흐름으로 시작해?"): fixed at
  document-*identity* resolution. `engine/query_router.js`'s
  `resolveRequestedDocumentIds` now also treats a bare "ADA" mention as
  naming the ADA document family when the question's own topic/assay/
  molecule ontology (`extractQueryScope`) finds no competing scope —
  reusing the exact signal that already protects the real
  ADC/species-selection counter-example, not a new mechanism.
- `fifty_q_Q22` ("면역원성 샘플은 baseline부터..."): a *different* root
  cause than Q11 — not document identity (the correct two-document family
  was already resolved) but document *ranking*. `tryCoverageCompositeQuery`
  tie-broke a `bestScore` tie using `aggregate`, a flat sum of the top-8
  records' scores, which let a document with many records about one
  narrow section outrank a document with fewer but more topically
  distributed records. Fixed by redefining `aggregate` as section-deduped
  (best score per distinct section, not a flat sum) — reflects how many
  distinct points a document makes, not how many records restate one.
- `fifty_q_Q25` ("ADA가 생기면 임상적으로..."): judged legitimate, not a
  defect — `tryCoverageCompositeQuery`'s existing, intentional
  cross-document `topic_overview` participation rule, both documents
  independently grounded. The eval corpus's `expected_document_ids` for
  this one question was corrected to `["fda_ada", "fda_ada_2014"]`
  (`scripts/build_typed_eval_corpus.js`'s `CROSS_DOCUMENT_EXPECTED_IDS`).
- `ws3_ambiguous_tie.analysts`: fixed by the router→fallback tie
  propagation described above (a same-document tie case).

A global `scoreRecord` IDF-weighting change was evaluated as an
alternative for Q11/Q22 but caused real regressions elsewhere in the
corpus even at the smallest tested weight and was **not adopted** —
both fixes above are narrower, targeted, and verified regression-free
against the full 220-probe/24-question/unit-test corpus before landing.

**One new gap surfaced this run, not present in the prior baseline**:
`fifty_q_Q23` ("피하주사와 정맥주사는 면역원성 위험이 어떻게 달라?",
expected `fda_ada_2014`) answered from a mix of `fda_ada_2014` and
`ema_fih` — not blocked by the cross-scope-mixing guard because no
ambiguity tie fired for this ordinary `detail`-type question, and not
touched by either the Q11 or Q22 fix (no "ADA" mention, and not the same
document pair). Left uninvestigated this pass — a future workstream
should trace why `ema_fih` content entered this specific fallback answer
before deciding whether it's a defect or legitimate related content
(same open question Q25 originally raised, now resolved as legitimate —
this one has not yet been adjudicated). `min_retrieval_scope_correct_rate`
in `SLO_TARGETS` is set to this measured 67/68 baseline (checked only at
the overall level, not per-type, for the same reasoning as before).

## What counts as a regression

Enforced by `npm run audit:production-slo -- --check` (or
`GUIDELINE_PRODUCTION_SLO_CHECK=true`), exit code non-zero on any breach:

- **Answerability, claim grounding, retrieval-grounded rate** must stay at
  100% for every type where they apply. These measured 100% at baseline
  with no exceptions; any drop is a real defect, not noise.
- **Ambiguous-type routing abstention rate** must stay at or above the
  measured 18/19 baseline (kept as the exact fraction in code, not a
  rounded decimal — a rounded target would be stricter than what was
  actually demonstrated and would falsely fail the baseline run itself).
- **Ambiguous-type cross-scope safety** must reach 100% — now met at
  baseline (see above).
- **Overall retrieval-scope-correct rate** must stay at or above the
  measured 67/68 baseline (see above — 1 known, real, unfixed gap,
  `fifty_q_Q23`).
- **Overall p95 latency** must stay under 120% of the measured 27,694ms
  baseline (33,233ms).
- **Overall cost per question** must stay under 120% of the measured
  $0.0192 baseline ($0.0230).

## What does not count as a regression

- Route-level flips for an individual question between separate runs
  (e.g. a question landing on `grounded_generation` one day and
  `structured` fallback the next). This is real, expected stochastic
  variance in generation/verification outcomes, not a defect — the
  type-level aggregate rates are the meaningful signal, not any single
  question's route.
- The `ambiguous` type's one non-reproducing probe
  (`ws3_manifest_ambiguity.section_1_introduction`) is already priced into
  the 18/19 `routing_abstention_rate` baseline itself; it recurring is not
  a new finding. (This is separate from the cross-scope-safety issue
  above, which is now fixed.)

## Relationship to the existing 24Q/50Q baselines

This typed baseline does not replace `docs/verification_status.md`'s
existing 24-question gold eval (`npm run eval`, fast/cheap, run on every
regression check) or the earlier 50-question production-path audits. It
is the broader, type-organized baseline first built to close the Response
Intelligence milestone, reusing rather than duplicating that existing
material (see the corpus table above). The Response Intelligence
milestone is complete (Workstream 8 was cancelled, not deferred — see
`history/milestones/response_intelligence_2026-09-10.md`); `fifty_q_Q23`
above is its most concrete real
follow-up for any future workstream.
