# Production Evaluation & SLO

Current baseline established: 2026-09-10 (Response Intelligence milestone
close-out pass). Source run: `logs/runtime/typed_eval_50plus_raw_2026-09-10.json`
(72 questions), aggregated by `npm run audit:production-slo`
(`scripts/analyze_production_slo.js`) into
`logs/runtime/response_intelligence_slo_baseline_2026-09-10.json`. This
run supersedes the 2026-09-09 baseline (full method and reasoning for that
original baseline: `history/verification/response_intelligence_workstream_7_2026-09-09.md`)
after two real fixes landed (see "Cross-scope answer mixing" below and
`engine/answer_envelope.js`'s envelope refusal-contract fix).

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
| overview | 100% | 100% | 100% | n/a | n/a | 83.3% (5/6) | 7,155 / 25,134 / 25,134 | 13 | 0.151 |
| list | 100% | 100% | 100% | n/a | n/a | 100% | 12 / 15,339 / 15,339 | 4 | 0.069 |
| process | 100% | 100% | 100% | n/a | n/a | 87.5% (7/8) | 10,471 / 23,992 / 23,992 | 19 | 0.230 |
| detail | 100% | 100% | 100% | n/a | n/a | 95.2% (20/21) | 9,216 / 15,590 / 17,051 | 40 | 0.331 |
| comparison | 100% | 100% | 100% | n/a | n/a | 100% | 9,324 / 12,866 / 12,866 | 9 | 0.095 |
| ambiguous | n/a | 100%* | 100%* | 94.7% (18/19) | **100% (19/19)** | 93.75% (15/16) | 7,163 / 20,007 / 20,007 | 46 | 0.363 |
| refusal | 100% | n/a | n/a | n/a | n/a | n/a | 13 / 131 / 131 | 0 | 0.000 |
| **overall** | **100%** (53/53 checked) | **100%** | **100%** | 94.7% | **100%** | **93.9% (62/66)** | **7,276 / 20,007 / 25,134** | **131** (71 gen / 60 verif) | **1.238** ($0.0172/question avg) |

*\* computed only over the subset that fell through to an answered
fallback after abstaining — see the report.*

## Cross-scope answer mixing (fixed 2026-09-10)

Routing abstention firing (the router internally noticing an ambiguous
tie) is not the same as the final answer being safe. A real trace showed
the failure this metric closes: the router abstains correctly, then an
ordinary fallback silently blends claims from two unrelated documents into
one answer with no disclosure that the question was ambiguous. This was
confirmed real, not theoretical: of the 19 `ambiguous`-type questions in
the original 2026-09-09 baseline run, **1 real case**
(`ws3_ambiguous_tie.days`) produced a `grounded_generation` answer mixing
`fda_ada` and `ich_m10` content with no indication to the user that the
question spanned two guidelines.

**Fixed** in `engine/answer_envelope.js`: after `answerFallback` returns,
if this request's telemetry recorded a genuine routing/manifest ambiguity
tie (`routing_ambiguous_tie`/`routing_list_ambiguous_tie`/
`manifest_ambiguous_tie`) and the fallback's own claims span more than one
document, the blended answer is replaced with an explicit refusal
(`refusal.kind: "ambiguous_document_scope"`) naming the candidate
documents/guidelines, both in the API envelope and in the web UI's
refusal card (`web/render.js`, `web/i18n.js`) — the ambiguity is disclosed
to the user, not silently absorbed. Re-measured on this baseline:
`cross_scope_safe_rate` is now **100% (19/19)**, `ws3_ambiguous_tie.days`
included, confirmed via `test/engine_answer_envelope.test.js`'s direct
reproduction of the original real failure shape (same real corpus
records) plus the fresh 72Q rerun. `npm run audit:production-slo --
--check` no longer fails on this — the check that used to intentionally
fail now genuinely passes.

This finding was also relevant to Workstream 5's decision to defer
building an LLM-disambiguation intervention for ambiguous-tie cases (based
on 0/50 real occurrences in a 50-question production audit — see
`history/verification/response_intelligence_workstream_5_2026-09-09.md`).
The fix above resolves the real user-facing harm deterministically, with
no new LLM call, so that deferral does not need to be revisited on this
basis.

## Retrieval scope correctness (new this baseline)

`retrieval_scope_correct_rate` (`scripts/analyze_production_slo.js`'s
`retrievalScopeCorrect`) checks something `retrieval_grounded_rate` does
not: not just "did every claim's citation resolve" but "was the answer
actually scoped to one of the real, already-known expected documents."
`data/eval/typed_questions.json` now carries an `expected_document_ids`
field on 69/72 questions, populated from real, already-known provenance
only (never fabricated) — the 50-question set's own per-question
guideline grouping (`docs/answer_suitability_evaluation.md`'s section
headers A-G) and the ambiguous-tie probes' own labeled
`ground_truth_document_ids`. The 3 `refusal`-type questions have no
expected document by design.

Measured at **93.9% (62/66)**, checked only over answered questions with a
known expected scope. **4 real gaps found, none a regression from the
cross-scope-mixing fix** (identical behavior in the pre-fix 2026-09-09
baseline run too — confirmed by re-checking that run's own saved
results):

- `fifty_q_Q11` ("ADA 평가는 보통 어떤 흐름으로 시작해?", expected
  `fda_ada`) answered entirely from `ich_s6_r1` — a topically-adjacent but
  wrong-guideline document.
- `fifty_q_Q22` (expected `fda_ada_2014`) answered from `fda_ada`.
- `fifty_q_Q25` (expected `fda_ada_2014`) answered from a mix of `fda_ada`
  and `fda_ada_2014` — not blocked by the cross-scope-mixing guard because
  no ambiguity tie fired for this ordinary `detail`-type question; whether
  that mix is a genuine defect or legitimate related-topic grounding has
  not been adjudicated.
- `ws3_ambiguous_tie.analysts` (expected `fda_ada`) is a router-flagged
  ambiguous tie where the fallback confidently settled on a single
  document (`ich_m10`) that isn't even a plausible candidate for the
  question — a distinct defect class the cross-scope-mixing guard
  structurally cannot catch, since that guard only blocks a *multi*-
  document blend, not a confident wrong-*single*-document answer after an
  unresolved tie.

**Left unfixed this pass** — these are real retrieval-quality findings,
not something the cross-scope-mixing/refusal-contract fixes were scoped
to address, and fixing them needs actual investigation (are they a
retrieval-ranking defect, a genuinely under-specified question, or
legitimate cross-references?), not a mechanical change. `min_retrieval_scope_correct_rate`
in `SLO_TARGETS` is set to this measured 62/66 baseline (checked only at
the overall level, not per-type — the real rate genuinely differs across
types, e.g. ambiguous 15/16 vs. list 11/11, so one threshold applied
per-type would falsely flag a small type's naturally lower rate); a future
workstream should investigate and fix these 4 cases, then tighten the
target.

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
  measured 62/66 baseline (see above — 4 known, real, unfixed gaps).
- **Overall p95 latency** must stay under 120% of the measured 20,007ms
  baseline (24,008ms).
- **Overall cost per question** must stay under 120% of the measured
  $0.0172 baseline ($0.0206).

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
`history/milestones/response_intelligence_2026-09-10.md`); the 4
retrieval-scope-correctness gaps above are its most concrete real
follow-up for any future workstream.
