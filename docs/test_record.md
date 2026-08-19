# Engine Test Record

A QbD-style build-measure-document log of `engine/` pipeline behavior (extraction + verification accuracy, retrieval behavior). Separate from `docs/milestone_log.md`, which stays high-level (milestone status, decisions with lasting consequences) — this file carries the actual per-run numbers so the log doesn't have to.

Every entry is tied to an exact engine version and git commit, so a result is always attributable to a specific, reproducible code state — not "the engine" in the abstract. `package.json`'s `version` field is the engine version; bump it whenever `engine/` behavior changes meaningfully, before recording a new entry.

## How to read an entry

- **Engine version / commit**: exact code state tested.
- **Date**: when the run was executed.
- **Model(s)**: which LLM(s) were used for extraction/verification — `engine/openai_adapter.js`'s default (`gpt-5.6-terra`) unless a `verifyModel` override is noted.
- **Tooling**: Node/npm versions, active provider.
- **Run**: what was executed and its exact scope.
- **Results**: raw counts plus reviewed/extracted rate per record type — that rate (not reviewed/true) is the verification-gate pass rate; a `true` count is the human-reviewed baseline, not an absolute ceiling (over-extraction can push reviewed above true).
- **Changes since previous entry**: required from the second entry onward — what changed in the engine between this run and the last one, so a result delta is attributable to a specific change, not vibes.
- **Known variance**: run-to-run non-determinism on identical input is real and already documented (`docs/milestone_log.md` M1) — treat a single run as one data point, not a stable measurement. Repeat before trusting a delta as signal rather than noise.

---

## Entry 001 — Baseline

- **Date**: 2026-08-19
- **Engine version**: `0.1.0` (commit `f140616`)
- **Model(s)**: `gpt-5.6-terra` (extraction and verification both — no `verifyModel` override)
- **Tooling**: Node v24.2.0, npm 11.19.0, OpenAI provider (`ANTHROPIC_API_KEY` unset)
- **Run**: `extractAndVerifySection`, single pass (no self-consistency), over all 7 non-empty sections across the 3 fully-reviewed pilot bundles (`data/pilots/{m10_3_2_5_2,m10_6_1,s6_r1_species_selection}.json`)

### Results

| section | trueKR | extractedKR | reviewedKR | trueQC | extractedQC | reviewedQC | trueCond | extractedCond | reviewedCond |
|---|---|---|---|---|---|---|---|---|---|
| ich_m10.sec.3_2_5_2 | 14 | 14 | 11 | 12 | 12 | 12 | 7 | 9 | 9 |
| ich_m10.sec.6_1 | 23 | 22 | 21 | 0 | 1 | 1 | 6 | 4 | 4 |
| ich_s6_r1.sec.part1.3_3 | 21 | 26 | 24 | 1 | 4 | 2 | 10 | 7 | 7 |
| ich_s6_r1.sec.part1.notes | 3 | 3 | 3 | 0 | 0 | 0 | 0 | 1 | 1 |
| ich_s6_r1.sec.part2.2_1 | 16 | 16 | 15 | 0 | 0 | 0 | 8 | 7 | 7 |
| ich_s6_r1.sec.part2.2_2 | 6 | 7 | 7 | 1 | 1 | 1 | 4 | 7 | 7 |
| ich_s6_r1.sec.part2.notes | 19 | 22 | 19 | 1 | 1 | 0 | 8 | 11 | 11 |
| **TOTAL** | **102** | **110** | **100** | **15** | **19** | **16** | **43** | **46** | **46** |

**Reviewed/extracted (verification pass rate)**: KR 90.9%, QC 84.2%, Cond 100.0%.

### Changes since previous entry

N/A — baseline.

### Notes

This baseline reflects the engine state after today's (2026-08-19) fixes: self-consistency KR dedup (word-overlap clustering instead of exact-prefix fingerprint), `record_type=example` claim construction, `QuantitativeCriterion` condition-hint surfacing, and the `SIBLING_SIGNALS` exact-set-equality tightening — see `docs/milestone_log.md` M1 for the full narrative. Two open findings from that work are *not* reflected as fixes here (tracked as known limitations, not engine bugs): (1) "normally X, except Y" statements don't fit any `comparator` value; (2) "e.g."-illustrative values keep getting extracted as definite criteria, and `value_status` has no state for "illustrative example." Both need a schema decision before they can move.

---

## Entry 002 — `is_default_with_exception` / `is_illustrative_example`

- **Date**: 2026-08-19
- **Engine version**: `0.2.0` (commit `849080e`)
- **Schema model version**: `0.4.0` (bumped from `0.3.0`)
- **Model(s)**: `gpt-5.6-terra` (extraction and verification both — no `verifyModel` override)
- **Tooling**: Node v24.2.0, npm 11.19.0, OpenAI provider (`ANTHROPIC_API_KEY` unset)
- **Run**: same 7-section `extractAndVerifySection` dry run as Entry 001, plus 3 targeted repeated runs on `ich_s6_r1.sec.part1.3_3` specifically (the section that motivated this change) and a spot-check on `ich_m10.sec.3_2_5_2` for regressions

### Changes since Entry 001

Added two new required `QuantitativeCriterion` boolean fields (`is_default_with_exception`, `is_illustrative_example`) closing the two open findings noted in Entry 001 — see `docs/schema.md`'s "Model 0.4.0" section and the commit above for the full design/rationale. `claimTextFor` now branches its phrasing on these flags instead of always asserting "specified, not illustrative."

### Results — 7-section aggregate

| section | trueKR | extractedKR | reviewedKR | trueQC | extractedQC | reviewedQC | trueCond | extractedCond | reviewedCond |
|---|---|---|---|---|---|---|---|---|---|
| ich_m10.sec.3_2_5_2 | 14 | 17 | 17 | 12 | 11 | 11 | 7 | 6 | 6 |
| ich_m10.sec.6_1 | 23 | 23 | 19 | 0 | 1 | 0 | 6 | 3 | 3 |
| ich_s6_r1.sec.part1.3_3 | 21 | 25 | 24 | 1 | 5 | 1 | 10 | 9 | 9 |
| ich_s6_r1.sec.part1.notes | 3 | 3 | 3 | 0 | 0 | 0 | 0 | 1 | 1 |
| ich_s6_r1.sec.part2.2_1 | 16 | 17 | 17 | 0 | 1 | 1 | 8 | 11 | 11 |
| ich_s6_r1.sec.part2.2_2 | 6 | 7 | 7 | 1 | 1 | 1 | 4 | 4 | 4 |
| ich_s6_r1.sec.part2.notes | 19 | 21 | 18 | 1 | 1 | 1 | 8 | 8 | 8 |
| **TOTAL** | **102** | **113** | **105** | **15** | **20** | **15** | **43** | **42** | **42** |

**Reviewed/extracted**: KR 92.9% (Entry 001: 90.9%), QC 75.0% (Entry 001: 84.2% — down, see note below), Cond 100.0% (unchanged). Single run each; per the standing variance caveat, not directly comparable run-to-run without repeats.

### Results — targeted S6(R1) §3.3 verification (3 repeated runs)

The specific patterns this change targets: run 1 extracted exactly the two intended records and both passed —

```
[reviewed] relevant species included in safety evaluation programs  at_least 2   default:true  illustrative:false  cond:[cond.3_3.002]
[reviewed] repeated dose toxicity study duration                    not_exceed 14 default:false illustrative:true   cond:[cond.3_3.005]
```

Runs 2-3 confirm both patterns keep working, but surfaced a **new, third pattern** not in scope for this change: the exception's own value ("one relevant species may suffice") is sometimes drafted as a *separate* `QuantitativeCriterion` (`comparator=at_least, value=1`) rather than folded into the default record's `condition_ids`, and that separate record fails verification — `at_least 1` is trivially true and doesn't capture "exactly/only 1, as a permitted exception," which is a different comparator semantics gap than the two just fixed. This is why the aggregate QC rate (75.0%) is lower than Entry 001 (84.2%) despite the targeted fix working — not a regression of the fix itself, but a new gap it made visible. Not fixed here; flagged for a future decision (`docs/milestone_log.md`).

### Regression spot-check

`ich_m10.sec.3_2_5_2` (general/exception-via-domain-partition pattern, unaffected by this change): 13/13 QC reviewed — matches pre-change behavior, no regression.

---

## Entry 003 — sibling-grouping veto for `is_default_with_exception`

- **Date**: 2026-08-19
- **Engine version**: `0.2.1` (commit `0749e87`)
- **Schema model version**: `0.4.0` (unchanged — code-only fix)
- **Model(s)**: `gpt-5.6-terra`
- **Run**: 3 repeated `extractAndVerifySection` runs on `ich_s6_r1.sec.part1.3_3`, same section Entry 002's "third pattern" finding came from

### Changes since Entry 002

Root cause of Entry 002's new finding: the default record and its own separately-extracted exception record both correctly link the same exception `Condition` (per the extraction guidance added for `is_default_with_exception`), giving them an identical `condition_ids` set — which satisfies `SIBLING_SIGNALS[0]`'s exact-match requirement and got them heuristically grouped as "jointly applicable," reasserting the false "2 AND 1 both hold" conjunction. `siblingCriteria()` now vetoes heuristic grouping whenever either side has `is_default_with_exception=true`.

### Results — targeted S6(R1) §3.3 (3 runs)

| run | extracted QC | reviewed QC | "jointly applicable" false-conjunction present? |
|---|---|---|---|
| 1 | 2 | 1 | No (the 1 rejection is an unrelated, pre-existing wrong-condition-link issue) |
| 2 | 5 | 5 | No |
| 3 | 2 | 2 | No |

The targeted false-conjunction pattern (present in 2 of 3 Entry-002 runs) did not reappear in any of these 3 runs. `npm run validate:pilots` and `npm run eval` (9/9) unaffected — code-only change, no data migration.

---

## Entry 004 — M1 acceptance bar + M1's last run

- **Date**: 2026-08-19
- **Engine version**: `0.2.1` (commit `9d6b0b9`, unchanged since Entry 003 — measurement only, no code/data change)
- **Schema model version**: `0.4.0`
- **Model(s)**: `gpt-5.6-terra`
- **Run**: full 7-section `extractAndVerifySection` dry run, same methodology as Entries 001/002

### Acceptance bar decided

KR ≥ 90%, QC ≥ 85%, Cond ≥ 95% (reviewed-of-extracted). Explicitly a **forward-tracking target for M2+**, not an M1 completion gate — decided by the user after clarifying that a target need not already be met by current measurements; KR and QC in particular are acknowledged as needing further improvement over time. This entry records the baseline to track against.

### Results — 7-section aggregate (M1's last run)

| section | trueKR | extractedKR | reviewedKR | trueQC | extractedQC | reviewedQC | trueCond | extractedCond | reviewedCond |
|---|---|---|---|---|---|---|---|---|---|
| ich_m10.sec.3_2_5_2 | 14 | 17 | 16 | 12 | 13 | 11 | 7 | 7 | 6 |
| ich_m10.sec.6_1 | 23 | 23 | 22 | 0 | 1 | 1 | 6 | 2 | 2 |
| ich_s6_r1.sec.part1.3_3 | 21 | 37 | 34 | 1 | 6 | 2 | 10 | 7 | 7 |
| ich_s6_r1.sec.part1.notes | 3 | 4 | 4 | 0 | 0 | 0 | 0 | 1 | 1 |
| ich_s6_r1.sec.part2.2_1 | 16 | 18 | 18 | 0 | 0 | 0 | 8 | 9 | 9 |
| ich_s6_r1.sec.part2.2_2 | 6 | 7 | 5 | 1 | 1 | 1 | 4 | 5 | 5 |
| ich_s6_r1.sec.part2.notes | 19 | 23 | 15 | 1 | 0 | 0 | 8 | 11 | 11 |
| **TOTAL** | **102** | **129** | **114** | **15** | **21** | **15** | **43** | **42** | **41** |

**Reviewed/extracted vs. target**: KR 88.4% (target 90%, -1.6pt), QC 71.4% (target 85%, -13.6pt), Cond 97.6% (target 95%, +2.6pt, already clear). Single run, still subject to the documented run-to-run variance — not a precise measurement, but the honest current baseline against the newly-set target.

### M1 status

Closed 2026-08-19 (see `docs/milestone_log.md` and `docs/product_roadmap.md` §3). Cond already clears its target; KR is close; QC has real, tracked headroom (the acceptance bar's own text acknowledges this) — carried forward as an M2+ improvement target, not blocking M1 closure.

---

## Entry 005 — sibling-veto extended to `is_illustrative_example`, then `comparator=equals`

- **Date**: 2026-08-19 (post-M1)
- **Engine version**: `0.3.0` (commit `45cc6ae`)
- **Schema model version**: `0.5.0` (bumped from `0.4.0`)
- **Model(s)**: `gpt-5.6-terra`
- **Run**: 3 targeted repeated runs on `ich_s6_r1.sec.part1.3_3` after each of the two fixes below (6 runs total)

### Changes since Entry 004

M1's last run (Entry 004) re-broke `ich_s6_r1.sec.part1.3_3` down to 0-2 reviewed QC out of 4-6. Two real, distinct root causes found and fixed in sequence:

1. **Sibling-veto gap** (commit `38dc33a`): the `is_default_with_exception` veto added in Entry 003 didn't also cover `is_illustrative_example`, so an illustrative QC sharing its `condition_ids` with an unrelated criterion still got grouped as "jointly applicable." Fixed by extending the veto. Live re-check (3 runs): the "jointly applicable" wording is gone from every rejection reason; what's left converges entirely on pattern 2.
2. **`comparator` can't express an exact count** (commit `45cc6ae`): "two relevant species," "a single species" rendered as `at_least N`, correctly rejected for asserting an open-ended floor. Added `comparator=equals` (schema `0.5.0`).

### Results — targeted S6(R1) §3.3, after `equals` (3 runs)

| run | extracted QC | reviewed QC |
|---|---|---|
| 1 | 4 | 4 |
| 2 | 5 | 4 |
| 3 | 6 | 5 |

Up from 0-2 reviewed out of 4-6 before this pair of fixes. Remaining rejections (1 in run 2, 1 in run 3) are a distinct, narrower pattern: modal-possibility language ("may suffice," "may be necessary") asserted as an unconditional exact requirement via `equals`, missing a modality qualifier — not fixed here, noted as a further residual for a future pass. `npm run validate:pilots` and `npm run eval` (9/9) unaffected.

