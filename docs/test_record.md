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
