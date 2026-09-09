# Production Evaluation & SLO

Baseline established: 2026-09-09 (Response Intelligence Workstream 7).
Source run: `logs/runtime/typed_eval_50plus_raw_2026-09-09.json` (72
questions), aggregated by `npm run audit:production-slo`
(`scripts/analyze_production_slo.js`) into
`logs/runtime/response_intelligence_workstream_7_slo_baseline.json`. Full
method and reasoning: `history/verification/response_intelligence_workstream_7_2026-09-09.md`.

Every target below is the measured baseline itself, not an aspirational
number — consistent with how this project has recorded every other
baseline in `docs/verification_status.md`. `scripts/analyze_production_slo.js`'s
`SLO_TARGETS` constant is the authoritative, code-enforced version of this
document; if they ever drift apart, the code constant is the bug to fix
(or this document is stale — check the git history of both together).

## Question-type taxonomy

No such taxonomy existed anywhere in the repo before this workstream. The
72-question typed corpus (`data/eval/typed_questions.json`, built by
`scripts/build_typed_eval_corpus.js`) assembles it entirely from real,
already-vetted material from prior Response Intelligence workstreams — no
question was newly invented for this document:

| Type | n | Source |
|---|---:|---|
| overview | 6 | `docs/answer_suitability_evaluation.md` depth code B0 |
| list | 11 | depth code B1 |
| process | 8 | depth code B2, the genuinely sequential subset (documented judgment call, not mechanical) |
| detail | 21 | depth codes D1+D2, plus the non-sequential/non-comparison B2 remainder |
| comparison | 4 | depth code X, plus 2 genuine two-concept B2 comparisons |
| ambiguous | 19 | Workstream 3's real ambiguous-tie probes that were confirmed to actually tie |
| refusal | 3 | `test/fixtures/eval_questions.json`'s refusal-expected gold questions whose refusal does not depend on whether generation happens to be configured |

## Tracked dimensions and current baseline, by type

`n/a` means the dimension does not apply to that type by construction (e.g.
a refusal has no claims to ground; `ambiguous`'s success signal is routing
abstention, not answerability — see the report for why).

| Type | Answerability | Claim grounding | Retrieval grounded | Routing abstention | Cross-scope safe | p50 / p95 / max (ms) | LLM calls | Cost (USD) |
|---|---:|---:|---:|---:|---:|---|---:|---:|
| overview | 100% | 100% | 100% | n/a | n/a | 9,070 / 37,452 / 37,452 | 13 | 0.169 |
| list | 100% | 100% | 100% | n/a | n/a | 15 / 19,894 / 19,894 | 4 | 0.064 |
| process | 100% | 100% | 100% | n/a | n/a | 10,691 / 27,679 / 27,679 | 19 | 0.197 |
| detail | 100% | 100% | 100% | n/a | n/a | 8,300 / 21,742 / 38,034 | 41 | 0.356 |
| comparison | 100% | 100% | 100% | n/a | n/a | 16,715 / 28,757 / 28,757 | 11 | 0.131 |
| ambiguous | n/a | 100%* | 100%* | **94.7% (18/19)** | **⚠ 94.7% (18/19)** | 11,324 / 26,157 / 26,157 | 51 | 0.393 |
| refusal | 100% | n/a | n/a | n/a | n/a | 6 / 87 / 87 | 0 | 0.000 |
| **overall** | **100%** (53/53 checked) | **100%** | **100%** | 94.7% | **⚠ 94.7%** | **8,831 / 27,679 / 38,034** | **139** (75 gen / 64 verif) | **1.311** ($0.0182/question avg) |

*\* computed only over the subset that fell through to an answered
fallback after abstaining — see the report.*

## Known open safety issue: cross-scope answer mixing (not yet fixed)

Routing abstention firing (the router internally noticing an ambiguous
tie) is not the same as the final answer being safe. Workstream 3 already
found the real failure this metric closes: the router abstains correctly,
then an ordinary fallback silently blends claims from two unrelated
documents into one answer with no disclosure that the question was
ambiguous. This is confirmed real, not theoretical: of the 19 `ambiguous`-
type questions in the baseline run, **1 real case**
(`ws3_ambiguous_tie.days`) produced a `grounded_generation` answer mixing
`fda_ada` and `ich_m10` content with no indication to the user that the
question spanned two guidelines.

`cross_scope_safe_rate` (`scripts/analyze_production_slo.js`) judges a
final answer safe only when ambiguity, once detected, resolves to one of:
a refusal, an explicitly-labeled `comparison` (documents kept separately
labeled by design), or a single-document answer. Anything else that spans
more than one document is unsafe. **Its SLO target is kept at the correct
1.0, not lowered to match the measured 18/19 baseline** — unlike
`routing_abstention_rate` (an internal-detection reliability signal this
project currently treats as tolerable variance), this is a user-facing
safety invariant, and the baseline containing one real violation is a
defect to fix, not a rate to accept. `npm run audit:production-slo --
--check` is **expected to fail** on this specific check until that defect
is fixed — this is intentional, not a bug in the gate.

This finding is also relevant to Workstream 5's decision to defer
building an LLM-disambiguation intervention for ambiguous-tie cases (that
decision was based on 0/50 real occurrences in Workstream 2's production
audit — see `history/verification/response_intelligence_workstream_5_2026-09-09.md`).
This is real evidence of user-facing harm from the *un-intervened* case,
at a low but non-zero rate (1/19 in a corpus specifically built to
exercise ambiguity), and should inform whether that deferral is
re-evaluated.

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
- **Ambiguous-type cross-scope safety** must reach 100% (see above — the
  target is correct, not baseline-matched, so this check currently fails
  and should keep failing until the real defect is fixed).
- **Overall p95 latency** must stay under 120% of the measured 27,679ms
  baseline (33,215ms).
- **Overall cost per question** must stay under 120% of the measured
  $0.0182 baseline ($0.0218).

## What does not count as a regression

- Route-level flips for an individual question between separate runs
  (e.g. a question landing on `grounded_generation` one day and
  `structured` fallback the next). Workstreams 2 and 5 already documented
  this as real, expected stochastic variance in generation/verification
  outcomes, not a defect — the type-level aggregate rates are the
  meaningful signal, not any single question's route.
- The `ambiguous` type's one non-reproducing probe
  (`ws3_manifest_ambiguity.section_1_introduction`, real trace in the
  Workstream 7 report) is already priced into the 18/19
  `routing_abstention_rate` baseline itself; it recurring is not a new
  finding. (This is separate from the cross-scope-safety issue above,
  which is a different real case.)

## Relationship to the existing 24Q/50Q baselines

This typed baseline does not replace `docs/verification_status.md`'s
existing 24-question gold eval (`npm run eval`, fast/cheap, run on every
regression check) or the 50-question production-path audits from
Workstreams 1-6. It is the broader, type-organized baseline Workstream 7
was scoped to produce, reusing rather than duplicating that existing
material (see the corpus table above). The Response Intelligence
milestone is not yet complete — Workstream 8 (Corpus Expansion /
Reusability Test) remains open; see `docs/milestones/response_intelligence.md`.
