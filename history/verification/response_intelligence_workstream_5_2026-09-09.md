# Response Intelligence — Workstream 5 Verification

Date: 2026-09-09

Workstream: Conditional LLM Query Planning

Result: complete. One narrow, measurement-verified fix implemented; a
second candidate explicitly deferred with reasoning.

## Method

Workstream 3 named two candidate interventions. This workstream implemented
one and deferred the other.

**Deferred: LLM disambiguation on `routing_ambiguous_tie`/
`manifest_ambiguous_tie`.** Workstream 3 measured this escalation condition
at 0/50 in Workstream 2's 50-question production-path audit — only
reproducible via targeted probes, not observed in that benchmark. Building
a new conditional-LLM code path for a condition with zero occurrences in
the one real-question benchmark measured so far fails the milestone's own
"implement only for cases deterministic resolution ... cannot solve
reliably" and "compare against always-on ... trade-offs" gates: there is no
real trade-off to compare from that benchmark. This is a statement about
that specific 50-question audit, not a claim about all production traffic
this system has ever served. The existing fallback already produces an
answer for these abstentions (imperfect, per Workstream 3's manifest-
ambiguity trace, but not broken). Not implemented.

**Implemented: skip speculative generation when the deterministic answer is
already adequate.** `engine/answer_envelope.js`'s `shouldGenerate()`
attempts generation under `generationPreference: "auto"` for six modes
(`document_overview`, `process`, `within_document_comparison`,
`multi_criterion`, `list`, `comparison`) with no regard to whether the
deterministic composite already answers the question adequately.
`generatedCoverageIsAdequate()` decides, *after* paying for the call,
whether to keep the generated candidate — and for every mode except
`document_overview`/`comparison`, its generic bar requires 100% coverage of
`match.claims`' distinct source units whenever there are `<=
SMALL_CANDIDATE_SET_CEILING` (3) of them. That expected set is fully known
before generation runs, and the deterministic composite trivially *is* that
set — so for this exact shape, skipping the call can never fail that
specific coverage check. That is a guarantee about the coverage/acceptance
check only, not a claim that a generated narrative would never have added
real value for the user; see the `process`-mode exclusion below, which is
exactly a case where the same evidence shape does carry real synthesis
value.

## Iterating the scope against real measurement (not just implementing on paper)

The obvious first design was to apply this to all four non-overview/
non-comparison modes at `<= 3` units. Before finalizing, this was checked
against **two fresh full 50-question production-path runs**
(`scripts/run_answer_suitability_audit.js`,
`logs/runtime/answer_suitability_50_workstream_5.json`), each time reading
back which real questions actually triggered the new
`generation_skipped_adequate` telemetry event, and cross-referencing each
one against `logs/runtime/answer_suitability_50_workstream_2.json` (the
pre-Workstream-5 baseline) to see whether the skip cost a previously-
*successful* generation or avoided a previously-*wasted* one:

| Expected unit count | Real cases observed (both runs) | Outcome before this fix |
|---:|---|---|
| 1 | Q08, Q24, Q38, Q46 | **All 4 already succeeded** at generation, no rejection |
| 2 | Q06 (fail), Q39 (success), Q41 (success) | **Mixed** — 1 real failure, 2 real successes |
| 3 | Q05, Q47 | **Both failed** (`generated_coverage_inadequate`), consistently, in both runs |

Excluding `process` was decided first, from a different signal: an
existing pinned test (`"auto preference synthesizes broad semantic
modes..."`, `test/engine_answer_envelope.test.js`) demonstrated a real
3-unit `process` question with genuine narrated-sequencing synthesis
value — implementing the fix at first broke this test, which is exactly
correct evidence that `process`'s completeness failures (e.g. Workstream
2's Q40) are a real mixed cost/benefit for that mode, not a free win.

Given count 1 showed zero real risk to justify skipping (pure value loss)
and count 2 was genuinely mixed (a real trade, not a clean win), the final
scope is **`multi_criterion`/`list`/`within_document_comparison` at
exactly 3 expected units** — the one shape with a clean, repeated, real
failure and no observed counterexample. This is narrower than Workstream
3's original framing suggested, but it is the part that is actually
justified by measurement, which is what the milestone asks for.

## Real measured effect (final scope)

A third fresh full 50-question run with the final scope confirmed exactly
2 real questions (Q05, Q47) triggered `generation_skipped_adequate`. For
both, the observed outcome is a clean win with no downside: in the
baseline, generation had already been attempted and rejected for these
exact questions, so the user received the identical structured answer
either way — this fix only removed the wasted call, it did not change
what the user saw. This is an observed result for these two measured
cases, not a guarantee that every future question hitting this same shape
will have nothing to lose from skipping generation:

| | Q05 | Q47 |
|---|---|---|
| Before (Workstream 2 baseline) | `structured`, 2 LLM calls, `grounded_generation_succeeded` → `generated_answer_rejected` | same shape |
| After (this workstream) | `structured`, 0 LLM calls | `structured`, 0 LLM calls |
| Final answer | identical either way | identical either way |

Aggregate run-level numbers (`npm run audit:latency-cost` pointed at the
new run) are provided for context, but are **not** solely attributable to
this fix — separate runs on different days carry real stochastic
generation/verification variance (as Workstream 2's own report already
documented) independent of any code change:

| | Workstream 2 baseline | This workstream (final scope) |
|---|---:|---:|
| Total LLM calls | 94 (50 gen / 44 verif) | 88 (47 gen / 41 verif) |
| Estimated cost | $1.0107562 | $0.8483443 |
| `deterministic_only` structured cases | 11 | 13 |
| `llm_attempt_then_structured_fallback` cases | 12 | 8 |

The only change directly and unambiguously attributable to this
workstream's code is the 2 cases carrying the new telemetry event; the
rest of the run-to-run difference reflects ordinary stochastic variance
plus the cumulative effect of Workstreams 2-4's separate changes, and
should not be read as this fix's own effect size.

## Tests

`test/engine_answer_envelope.test.js` (6 new tests, `shouldGenerate`
exported for direct testing, following `engine/query_router.js`'s existing
convention of exporting internals for test purposes):

- Skips for `multi_criterion`/`list`/`within_document_comparison` at
  exactly 3 units, under `auto`.
- Records `generation_skipped_adequate` telemetry with the right
  `mode`/`expected_unit_count`.
- Still attempts generation at 1 or 2 units (the measured non-decisive
  counts).
- Still attempts generation when `generationPreference: "prefer_generated"`
  (explicit user override preserved).
- Still attempts generation once the claim set exceeds the ceiling (> 3).
- Does **not** skip `document_overview`/`comparison` at 3 units (their
  bars are breadth-based, explicitly out of scope).

The pre-existing pinned `process`-mode test ("auto preference synthesizes
broad semantic modes...") is not new, but its continued, unmodified pass
is itself load-bearing verification: it is the real counter-evidence that
justified excluding `process` from this fix's scope (see Method above).

## Verification

- `npm test` — 436/436 (430 prior, per Workstream 4's verified count, + 6 new).
- Three fresh full 50-question production-path runs, final one 50/50 with
  0 errors.
- `npm run validate:guidelines` — 6/6.
- `npm run validate:ko` — 2,693/2,693.
- `npm run audit:ko` — 1,495/1,495 reviewed, 0 issues.
- `npm run validate:semantic` — 6/6 overlays and presentations.
- `npm run audit:routing:hardening` — 220/220, 42 mode/intent diagnostics
  unchanged (this change is entirely inside `answer_envelope.js`'s
  generation gate, upstream of nothing routing-related).
- `npm run eval` — 24/24; citation precision, claim grounding, and refusal
  correctness each 100%.

## Remaining risk/follow-up

- Count 2 (`multi_criterion`/`list`/`within_document_comparison`) remains
  unaddressed despite Q06 being a real, repeated waste, because Q39/Q41's
  real successes make it a genuine trade, not a free win, on the evidence
  gathered so far (3 real data points). If a future workstream gathers
  more real count-2 cases, `isSmallCompleteClaimSet`
  (`engine/answer_envelope.js`) documents exactly why the bound is where it
  is and can be revisited with more evidence — it is not a hard scope
  limit needing its own workstream to move.
- `process` mode's completeness failures (e.g. the shape behind Workstream
  2's Q40) remain unaddressed, deliberately: the existing pinned test's
  real, opposite-direction evidence means a blanket skip there is a net
  loss, not a win, on current evidence.
- The ambiguous-tie disambiguation candidate remains deferred. If a future
  audit (e.g. a repeat of Workstream 3's corpus-derived probes at a larger
  archive scale) finds real occurrences in production traffic, it becomes
  eligible for implementation under the same "measure first" discipline
  used here.
