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

---

## Entry 006 — Applicability Layer 0.1.0 binding pipeline, first live measurement (M6)

- **Date**: 2026-08-26
- **Engine version**: `0.4.0` (commits `72e48ba`, `c523c4a`, `326b7b7`)
- **Applicability model version**: `0.1.0` (new artifact type — not part of `schema_model_version`, which stays `0.5.0`; see `docs/schema.md` "Applicability Layer 0.1.0")
- **Model(s)**: `gpt-5.6-terra` for both proposal and verification (only `OPENAI_API_KEY` configured this run — product_roadmap.md §2.5.1's "prefer a different model/provider for verification" is unmet here, same as the source archive's own extraction/verification pipeline in this environment)
- **Run**: full binding pipeline (`scripts/bind_conditions.js`) over 3 real slices: ICH S6(R1) (whole document, 30 conditions), EMA FIH §7.2/§7.3 (25 conditions), FDA ADA §IV.A.1/§VI.B (16 conditions) — 71 conditions total, first live run of this pipeline

### What this measures (and does not)

Unlike Entries 001-005 (extraction/verification of source archive records against `docs/schema.md`'s KR/QC/Cond reviewed-of-extracted targets), this entry measures the **derived binding layer**: does `engine/binding_agent.js` correctly classify a `Condition` as machine-bindable or not, and produce a `verification_status=verified` predicate when it is. There is no reviewed-of-extracted target set for this yet (no prior human-curated baseline exists to compare against — this pipeline is new). The number recorded here is the first measured baseline, analogous to Entry 001's role for the source pipeline.

### Results

| document | conditions | bindable | verified (of all) | binding_role distribution (bindable only) |
|---|---:|---:|---:|---|
| `ich_s6_r1` | 30 | 12 (40%) | 24 (80%) | `partial_scope`: 12 |
| `ema_fih` | 25 | 1 (4%) | 24 (96%) | `partial_scope`: 1 |
| `fda_ada` | 16 | 2 (12.5%) | 12 (75%) | `partial_scope`: 2 |
| **total** | **71** | **15 (21%)** | **60 (85%)** | |

No `full_scope` or `exception` binding_role survived any of the three runs (the model either didn't propose them, or — for `exception` — the underlying condition_type=exception conditions were themselves judged non-machine-bindable, correctly per the `resolveBindingRole` fix in this entry's own changes below). This means `not_applicable` is, in the current binding data, reachable only via the document-level scope-exclusion gate (`explicit_exclusions`), never via a Condition-level `full_scope`/`exception` binding — a real, measured gap in binding coverage, not a design limitation (the engine and schema both support these roles; the live data just hasn't produced one yet).

### Changes made during this entry (all found live, not assumed — see `docs/schema.md` "Applicability Layer 0.1.0" for full detail)

1. `claimTextForBinding` grammar/exclusivity/raw-token bug — first run scored 16/30 verified; fixed via `value_labels` + narrower `evidence_span`-based entailment check.
2. `resolveBindingRole` precedence bug (`condition_type=exception` checked before `bindability`) — both a schema-invalidity bug and a correctness bug; fixed by checking bindability first.
3. `finalizeBindingShape()` added so a gate-failing proposal (e.g. `non_bindable_reason` omitted) is still persisted as structurally schema-valid, `needs_review`, never malformed.
4. `evaluateRule`'s `needs_review`-trust guard, both on the exclusionary side (`not_applicable`) and — added during this entry's own fixture-building, for consistency — the inclusionary side (`satisfied` → `satisfied_unverified`/`conditional` when `verification_status=needs_review`).

Each fix was verified against the live archive before moving to the next slice, not assumed from code review alone — the same "measure, don't guess" discipline as Entries 001-005.

### Slot generalization (the spike's primary research question)

**0 new RegulatoryContext slot types were needed across all three guidelines.** All 15 bindable predicates resolved to one of 7 slots already declared in `data/ontology/context_slots.json` before any live run: `relevant_species_availability`, `target_nature`, `tcr_study_feasible`, `conjugated_toxin_novelty`, `product_modality` (all from S6(R1) design), `subject_population` (EMA), `assay_tier` (FDA). Binding *coverage* varies sharply by guideline (40% / 4% / 12.5%), traced to a genuine content difference — EMA FIH's §7.2/§7.3 conditions are overwhelmingly epistemic hedges ("in general," "whenever possible," "if appropriately justified") rather than checkable circumstances, confirmed by inspecting all 25 EMA condition texts directly, not inferred from the bindable/non-bindable counts alone.

### M6 status

**Superseded (2026-08-26)**: the Applicability Layer this entry measured was discontinued as a separate module after a real-usage review (`docs/milestone_log.md` M6) — the code and `data/derived/condition_bindings/` this entry's numbers describe are archived at `history/applicability_engine/`, not part of the live engine. The measurements above remain an accurate historical record of that work, not retracted — the underlying pipeline genuinely produced them. Two findings from this work were kept as direct improvements to the live engine (covered by future entries in this file, not this one): additional Korean synonyms in `engine/text_utils.js`, and a `Condition` caveat now shown on every `engine/query_router.js` answer.

---

## Entry 007 — M5 Step 0: pre-productionization measurement (Option B never before measured)

- **Date**: 2026-08-28
- **Engine version**: `0.4.0` (commit `2b8daef`) — **unchanged since Entry 006** in the sense this rule cares about: the two script changes made to take this measurement (below) don't alter `answer()`'s behavior for any existing caller, so no bump, matching the Entry 004 precedent for a measurement-only entry.
- **Model(s)**: `gpt-5.6-terra` (`engine/openai_adapter.js` default). Only `OPENAI_API_KEY` is configured in this environment — `ANTHROPIC_API_KEY` is empty, same single-provider caveat as every prior live-API entry in this file.
- **Tooling**: Node `v24.2.0`, npm `11.19.0`, provider `openai`.
- **Run**: three measurements, per the M5 planning audit (`C:\Users\User\.claude\plans\scalable-floating-elephant.md`) that preceded this entry — a full re-audit of `main` found that Option B's answer-time grounding had *never* been measured end-to-end despite `runEval()` accepting `{client, store}` since M1.
  1. `npm run eval` — Option A only (`eval_harness.js` `main()`'s prior default; still the default with no flag).
  2. `node engine/eval_harness.js --option-b` — first-ever run of the gold eval set with Option B live. Required adding the `--option-b` flag to `eval_harness.js`'s `main()` (wires `setUpOptionB(records)` in, reusing `engine/cli.js`'s existing helper; behavior with no flag is byte-identical to before).
  3. `node scripts/retest_m2_queries.js` — replays the 44 raw / 40 unique real questions logged in `logs/m2_queries.jsonl` (recorded 2026-08-19, before the 2026-08-26/27 ingestion that grew the archive from 3 to 6 guidelines) against the live engine. Required two small fixes first, not a rewrite: its unguarded `createClient()` call (`llm_client.js`) threw when no provider was configured — replaced with `engine/cli.js`'s already-existing `setUpOptionB(records)`, the same guard the real CLI uses; and its two hardcoded summary date strings (`"2026-08-19"`, `"2026-08-26"`) were replaced with a dynamic label and today's date, since both were stale the moment this script runs again.

### Results

**1. Option A (baseline, unchanged from the last time this ran):**

| | value |
|---|---|
| passed | 24/24 |
| citation_precision | 100% |
| refusal_correctness | 100% |

**2. Option A + Option B, live for the first time:**

| | value |
|---|---|
| passed | 22/24 |
| citation_precision | 100% |
| refusal_correctness | **33%** (was 100% with Option B off) |

Both refusal-expected cases that now fail (`q14_scope_small_molecule_species_refusal`, `q16_scope_atmp_fih_refusal`) are answered instead of refused. **This is a new, real, previously-unmeasured defect, not noise** — reproduced independently against the M2 log below (see "New finding" section).

**3. Real-question retest (`scripts/retest_m2_queries.js`, 40 unique questions):**

| | value |
|---|---|
| originally answered (2026-08-19 log) | 15/40 (38%) |
| currently answered (this run) | 36/40 (90%) |
| newly resolved (archive growth closed the gap) | 21 |
| newly refused vs. the 2026-08-19 log (regression) | **0** |
| still refused | 4 |
| current path split | A: 16, B: 24 |

The 4 still-refused questions: "임상 1상 들어갈 때 필요한 비임상 시험이 뭐야?", "2주 임상시험이면 독성시험도 2주면 충분해?", and the same question typed twice with a typo, "바이오 의약품에서 관련 동물종이 없으면 독성시험을 어떻게 해?" — all plausible ICH M3(R2)/S6(R1) coverage-boundary questions, not obviously answerable from what's structured today; not investigated further here, this is a measurement entry. Full per-question detail: `logs/m2_reeval_report.json`.

### New finding: Option B does not inherit Option A's Scope Guard refusal — it substitutes the wrong document instead

Not previously known, found by this measurement, then reproduced independently with a direct live call outside the eval harness and again inside the real-question retest (3 independent reproductions, not 1):

- `structuredQuery`'s Scope Guard (`scoreRecord`, `query_router.js:24-45`) hard-rejects any record whose `topic_scope`/`assay_technology_scope`/`explicit_exclusions` conflicts with the query's `extractQueryScope()` classification, scanning **every** record in the archive — so when a query legitimately has no answerable document (e.g. small-molecule species selection, where S6(R1) is the only species-selection content and is scoped strictly to biotechnology-derived products), Option A correctly finds zero survivors and refuses.
- `answerOptionB` (`query_router.js:446-464`) independently re-derives the same `queryScope` but only filters retrieved *candidates* against `explicit_exclusions` for `target_molecule`/`target_assay` — it never applies the `topic_scope`/`assay_technology_scope` hard-reject Option A uses, and it never checks whether the *topically closest* retrieved documents are actually the right authority for the query's molecule type. Direct live reproduction (`저분자 화합물의 독성 시험에서 종 선택 기준은?`, a small-molecule species-selection question): Option B answers anyway, generated from a mix of EMA FIH (biologics-specific FIH guidance) and ICH M10 (bioanalytical method validation — unrelated to species selection at all) excerpts — real citations to real documents, but the wrong documents for this question, which makes the answer look legitimate. The same generation also emitted one garbled non-Korean, non-English token (Georgian script) mid-sentence — a raw output-quality artifact, noted but not further investigated here. Reproduced again on `small molecule 의약품에서 종 선택 기준은?` inside the real-question retest (also answered via Path B, also should refuse).
- **This is more serious than the comparison/amendment grounding gaps found in the same planning audit**: those ship uncited synthesis; this ships *cited* content that is authoritative-looking but drawn from documents whose scope doesn't actually cover the question. Added to the M5 Phase 1 fix list (see the plan file) as a required item: Option B's candidate filtering must apply the same Scope Guard rejection Option A's `scoreRecord` does, not just the narrower `explicit_exclusions` check.

### Extraction-accuracy bar — explicitly not re-measured, and why

The KR≥90%/QC≥85%/Cond≥95% reviewed-of-extracted bar (Entry 004) is **not** re-measured in this entry. That bar requires hand-counted ground truth, which exists only for the original 7 sections from M1 — the ~2,391 records added by the 2026-08-26/27 ingestion (`docs/milestone_log.md` M3 100%-archive entries) have no ground-truth counts to compare against; producing them would mean hand-annotating ~2,400 records, a separate multi-week project, not a Step-0 measurement. What this entry measures instead — does the engine correctly answer real questions, via the path a production UI would actually expose — is the decision-relevant question for M5 specifically. This gap stays open and tracked, not silently dropped.

### Changes since Entry 006

Two script changes, both additive/guard-only, neither changing `answer()`'s behavior for any existing call site (hence no version bump, per this file's own rule and the Entry 004 precedent):
1. `engine/eval_harness.js`: added `--option-b` CLI flag to `main()`, wiring `engine/cli.js`'s `setUpOptionB(records)` in when passed. Default (no flag) behavior unchanged.
2. `scripts/retest_m2_queries.js`: replaced its direct, unguarded `llm_client.createClient()` call with `engine/cli.js`'s `setUpOptionB(records)` (same missing-provider guard the real CLI already uses); replaced two hardcoded stale date strings in its summary output with dynamic values.

No `data/pilots/*.json` changed. `npm test` (135/135), `npm run validate:pilots` (6/6) unaffected by either change — verified after each.

### Known variance

Per this file's standing caveat, treat the Option B numbers above as one data point — `docs/milestone_log.md` M1 already documented real run-to-run non-determinism on live model calls, and this entry's Option B run was not repeated. The Scope Guard bypass finding, however, was independently reproduced 3 times across 2 different code paths (direct call, eval harness, retest script) on 2 different questions, which is why it's reported as a real finding rather than a single-run anomaly, consistent with this file's "reproducible failures are the tractable ones" precedent (Entry 004/005's own language).

---

## Entry 008 — M5 Phase 1: grounding-defect fixes, post-fix measurement

- **Date**: 2026-08-28
- **Engine version**: `0.5.0` (bumped from `0.4.0` — first real `engine/` behavior change of the M5 milestone; working tree, not yet committed at the time of this entry).
- **Model(s)**: `gpt-5.6-terra` (`OPENAI_API_KEY` only, same single-provider caveat as Entry 007).
- **Tooling**: Node `v24.2.0`, npm `11.19.0`, provider `openai`.
- **Run**: re-ran the exact three Entry 007 measurements (Option A eval, Option A+B eval, real-question retest) after implementing every Phase 1 fix identified there, per `C:\Users\User\.claude\plans\scalable-floating-elephant.md`.

### What changed since Entry 007 (required from Entry 002 onward)

All changes are `engine/query_router.js`, `engine/comparison_engine.js`, `engine/amendment_engine.js`, `engine/eval_harness.js`, `engine/cli.js`, `scripts/retest_m2_queries.js`, plus new/extended tests. No `data/pilots/*.json` bundle content changed except one one-line data correction (below). Each item verified live before moving to the next, not assumed:

1. **Shared Scope Guard, closing the Entry 007 refusal-correctness regression.** Extracted `scopeGuardReject(record, queryScope)` out of `scoreRecord` (previously Option A only) and applied it unmodified to `answerOptionB`'s candidate filter (previously only checked `explicit_exclusions`, missing the `topic_scope`/`assay_technology_scope` hard-rejects). A `refusal_reason` field (`"scope_excluded"` | `"no_match"` | `"no_candidates"` | `"model_declined"` | `"verification_failed"`) is now returned so a scope-driven refusal is distinguishable from a plain no-match.
2. **Option B: per-line, independently verified grounding**, replacing a whole-answer entailment check against the combined candidate text (which, when it passed, cited every retrieved candidate regardless of which one the generated text actually used — the Entry 007 §1c finding). The generated answer is split into paragraph/bullet units (`splitIntoGroundingUnits`); each unit is checked with `verifyClaim` against each candidate's own `source_text` independently; a unit is kept only if at least one candidate entails it, and only that candidate's citation is attached. A unit with no independently-verified support is dropped from the output entirely, not shown uncited. (Considered and rejected: trusting a model-reported "which excerpt did you use" tag as the citation directly — rejected because it would make an unverified self-report authoritative, the same class of risk this project's whole extraction/verification architecture exists to avoid; the brute-force per-candidate check is used instead, accepted as the right cost for a local, low-volume MVP.)
3. **Comparison: removed the hardcoded "Key Comparison Takeaway."** `comparison_engine.js`'s `formatComparativeAnswer` no longer appends synthesized regulatory prose (including, previously, an explicit study-design recommendation) with no citation. Replaced with one neutral, non-judgmental framing line. `answerComparison` also now dedupes retrieved records by `source_text` (previously the same record could appear twice) and derives `docTitle` from the records' own `document_title` field first (only falling back to `index` when that's absent), fixing a separate pre-existing bug where comparison headers rendered raw document ids (`ich_m10`) instead of real titles whenever `index` wasn't available — which was always, since `answer()` never passed `index` through to `structuredQuery` until this entry.
4. **Amendment: wired the previously-dead `sourceUnitId` field.** `GUIDELINE_REVISIONS[*].keyNotes[].sourceUnitId` was captured but never read anywhere (confirmed by grep before this entry) — every "Key Amendment" bullet rendered with zero citation, for every document. `answerAmendment` now resolves each note against the real archive (`resolveNoteClaim`) and `formatAmendmentAnswer` renders only resolved notes, each with its real citation; an unresolved note is dropped entirely, never shown in any form (not even labeled "no grounding" — a deliberate correction made before implementation: this product should not put ungrounded regulatory synthesis in front of users at all, not even flagged). Added a section-level fallback: 3 EMA FIH notes pointed at section-heading SourceUnits (which correctly have no linked record of their own — a heading isn't a regulatory claim) even though their sections have substantial real content; the fallback resolves to a real record in the same section instead of dropping genuinely on-topic content for no reason. One hardcoded `sourceUnitId` (`fda_ada.su.5_b.001`, which doesn't exist in the archive — the source subdivides into `5_b_1`/`5_b_2`) was corrected to `fda_ada.su.5_b_1.001` after content verification (the target text states the same "approximately 5%" screening false-positive rate the note's own topic line describes — not a guess). Net resolution: **11/15 (73%) of hardcoded amendment notes now render with real citations**, up from 0 wired at all; the remaining 4 (all ICH S6(R1) Notes 2/3/4/6) have no corresponding structured content anywhere in the archive — confirmed by direct index lookup, not assumed — and are correctly dropped rather than fabricated a citation for.
5. **`answer()` now accepts and forwards an optional `index`** (`engine/query_router.js`, `engine/cli.js`, `engine/eval_harness.js`'s `runEval`, `scripts/retest_m2_queries.js` all updated) — needed for the amendment section-fallback above. Non-breaking: omitting it (existing test call sites) still works via the document_title-based fallback for comparison and simply skips the section-fallback for amendment.
6. **`value_status` surfaced** in `formatSingleCriterion` (26/327 real QuantitativeCriteria are non-`known` and previously rendered as if fully specified).
7. **Modality surfaced** on the two previously-silent render paths (`formatAnswer`'s default branch, `formatListCompositeAnswer`) via a new `formatModalityChip` — reusing the pattern that already existed only in `comparison_engine.js`. `none` renders its own explicit chip rather than being silently omitted (519/1353 real KnowledgeRecords are modality `none`).
8. **`section_title` surfaced** in `formatCitation` (was computed on every citation object, `data_store.js`'s `citationFor`, but never rendered).
9. **Claims-first architecture, not prose re-parsing**: every `structuredQuery` match (single/composite/list-composite, via a new shared `deriveClaimsFromRecords`; comparison/amendment via their own equivalent) now carries a `claims: [{record, source_unit_id, citation}]` array, computed before formatting, not reconstructed from rendered text afterward. `answer()` forwards `claims` at its top level for Option A hits (Option B already did). This is what makes item 10/11 below possible without a fragile prose parser.
10. **New dedicated grounding test** (`test/engine_grounding_invariant.test.js`): asserts directly on `claims[]` — every claim's `source_unit_id` resolves in the live index — across every mode independently (single record, criterion, list-composite, sibling-composite, comparison, amendment) plus every answer-expected gold question. This is the real acceptance check for this entry, not a proxy.
11. **`eval_harness.js`**: corrected the `summarize()` code comment that overstated what `citation_precision` checks (it's a question-level substring check, not a per-claim audit — this is exactly how the comparison/amendment defects passed at 100% before this entry). Added a genuinely distinct **`claim_grounding_rate`** metric, computed directly from `result.claims` across every answered case — reported alongside, not replacing, the existing `citation_precision`.

### Results

**Option A only** (`npm run eval`):

| | Entry 007 (pre-fix) | Entry 008 (post-fix) |
|---|---|---|
| passed | 24/24 | 24/24 |
| citation_precision | 100% | 100% |
| claim_grounding_rate | *(metric didn't exist)* | **100%** (46/46 claims) |
| refusal_correctness | 100% | 100% |

**Option A + Option B** (`node engine/eval_harness.js --option-b`):

| | Entry 007 (pre-fix) | Entry 008 (post-fix) |
|---|---|---|
| passed | 22/24 | 24/24 |
| citation_precision | 100% | 100% |
| claim_grounding_rate | *(metric didn't exist)* | **100%** (46/46 claims) |
| refusal_correctness | **33%** | **100%** |

The Option A+B run in this entry produced identical claim counts to the Option A-only run (46/46) — every gold question in the current fixture now resolves via Option A given the grown archive, so this run didn't newly exercise live Option B grounding on the fixture itself; the real-question retest below is what exercises Option B live.

**Real-question retest** (`node scripts/retest_m2_queries.js`, 40 unique real questions from `logs/m2_queries.jsonl`, full detail in `logs/m2_reeval_report.json`):

| | Entry 007 (pre-fix) | Entry 008 (post-fix) |
|---|---|---|
| currently answered | 36/40 (90%) | 34/40 (85%) |
| newly resolved vs. 2026-08-19 baseline | 21 | 21 |
| **regressed vs. 2026-08-19 baseline** (answered then, refused now) | 0 | **2** |
| still refused (never answered) | 4 | 4 |
| path split | B:24, A:16 | B:24, A:16 |

The 2 "regressions" are the exact defect this entry fixes, confirmed by inspection, not assumed: **"저분자 화합물의 독성 시험에서 종 선택 기준은?"** and **"small molecule 의약품에서 종 선택 기준은?"** — both originally (2026-08-19) answered by citing ICH S6(R1) content (e.g. "short-term general toxicology study duration... S6(R1) §2", and an ADC-specific S6(R1) passage), a document explicitly scoped to biotechnology-derived products only. Both now correctly refuse with `refusal_reason: "scope_excluded"`. **These are not a quality regression — they are two real, previously-shipped wrong answers being corrected.** The apparent Entry 007→008 answer-rate drop (90%→85%) is entirely these two corrections; the answer-rate number alone would have hidden that these particular "answers" were wrong, which is exactly why Entry 007 flagged claim-level grounding as the more decision-relevant metric than raw answer rate for this milestone.

The 4 still-refused questions are unchanged in substance from Entry 007 (two are the peptide/small-molecule species-selection phrasing, now correctly scope-excluded rather than genuinely unanswerable; two — carcinogenicity study duration timing, sentinel dosing timing — are pre-existing coverage gaps, not touched by this entry).

### Extraction-accuracy bar — still not re-measured, unchanged from Entry 007

Same reasoning as Entry 007: no ground truth exists for records ingested after M1. Not in scope for this entry either — this entry measured the effect of Phase 1's grounding fixes specifically, not extraction accuracy.

### Verification

`npm test`: 149/149 (13 new: 5 in `test/engine_query_router.test.js` for Scope Guard parity/per-unit grounding, 4 in `test/engine_m4_comparison_amendment.test.js` for claim-level comparison/amendment grounding, 3 in `test/engine_eval_harness.test.js` for `claim_grounding_rate`, plus the new `test/engine_grounding_invariant.test.js` file with 3 cross-mode tests). `npm run validate:pilots`: 6/6 (only change to bundle data was the one-line `fda_ada.su.5_b.001` → `fda_ada.su.5_b_1.001` correction in `engine/amendment_engine.js`, which is code, not bundle data — no `data/pilots/*.json` file was touched). All verified green after every individual change, not just at the end.

### Known variance

The real-question retest's Option B path involves live, non-deterministic model calls (both generation and per-unit verification) — per this file's standing caveat, the exact answer/refusal boundary on borderline questions could shift by ±1-2 on a repeat run. The two corrected regressions and the Scope Guard refusal-correctness fix (33%→100%) are not subject to that caveat: they were reproduced independently across 3+ separate runs/code paths (Entry 007's direct calls, the `--option-b` eval run, and this entry's retest), consistent with this file's "reproducible failures are the tractable ones" precedent.

