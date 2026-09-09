# Response Intelligence — Workstream 7 Verification

Date: 2026-09-09

Workstream: Production Evaluation & SLO (final workstream of the Response
Intelligence milestone)

Result: complete. A typed eval corpus, a per-type metrics aggregator, and
a standing, code-enforced production SLO were built and populated with a
real measured baseline.

## Method

No question-type taxonomy (detail/list/overview/process/comparison/
ambiguous/refusal) or production SLO of any kind existed anywhere in the
repo before this workstream — confirmed by search. The existing 24-
question gold set (`test/fixtures/eval_questions.json`) and 50-question
suitability set (`docs/answer_suitability_evaluation.md`) each use their
own, different classification (free-text ids/notes, and a `B0/B1/B2/D1/
D2/X` depth code respectively), neither matching the milestone's named
7-way taxonomy.

**Building the typed corpus** (`scripts/build_typed_eval_corpus.js` →
`data/eval/typed_questions.json`, 72 questions) was reuse-first, not
new invention:

- `overview`/`list`/`detail`/`comparison` map cleanly from the 50Q set's
  depth codes (B0→overview, B1→list, D1+D2→detail, X→comparison) —
  re-tallied directly from `docs/answer_suitability_evaluation.md`'s §4
  tables (correcting a miscount from an earlier research pass: B0=6,
  B1=11, B2=17, D1=6, D2=8, X=2, summing to the full 50).
- `process` and the rest of `comparison` required a real judgment call:
  B2 ("procedure/relationship/judgment factors") is not one of the
  milestone's types. Each of its 17 questions was read individually;
  8 with explicit sequence/stage/flow wording (e.g. Q12 "단계별로 어떻게
  이어져", Q31's "투여 → 관찰 → 데이터 검토 → 다음 cohort" order) became
  `process`; 2 genuine two-concept contrasts (Q17, Q32) joined
  `comparison`; the remaining 7 (single-topic, multi-factor synthesis
  with no second thing being contrasted) became `detail`. This split is
  documented in the builder script's own comments, not silently decided.
- **`ambiguous` and `refusal` do not exist in the 50Q set at all** — it
  was deliberately curated to be answerable. These came entirely from
  reusing real, already-validated material from earlier workstreams:
  Workstream 3's 19 ambiguous-tie probes that it already confirmed
  actually tie (`logs/runtime/response_intelligence_workstream_3_taxonomy.json`;
  the one probe that didn't tie, `precision (%cv)`, is correctly excluded)
  plus its 1 manifest-ambiguity probe, and 3 of
  `test/fixtures/eval_questions.json`'s 4 refusal-expected questions
  (the 4th, q6, was excluded — its own note already states generation
  may legitimately answer it when configured, so asserting a hard-refusal
  expectation for it under this workstream's full-generation-enabled run
  would have been a false expectation, not a real one).

This produced 72 real, individually-traceable questions (every entry
carries a `source` field) — genuinely beyond the 50Q set, not a relabeling
of it.

**Running and measuring**: `scripts/run_typed_eval_audit.js` (new,
mirroring `scripts/run_answer_suitability_audit.js`'s tested mechanics —
real HTTP `/api/ask` calls, atomic snapshot persistence, resume support —
reused via direct `require`, not reimplemented) ran all 72 questions
through the real production path. 2 transient provider failures (matching
this milestone's established pattern, e.g. Workstream 1's Q34/Q42) were
retried via `GUIDELINE_TYPED_EVAL_RERUN_IDS`, reaching a clean 72/72.
`scripts/analyze_production_slo.js` (new) aggregates per type, reusing
`scripts/analyze_latency_cost_baseline.js`'s `summarizeItems`/
`PRICING_SNAPSHOT` directly for latency/cost (not reimplemented) and
adding three new checks: answerability match, claim grounding rate, and
"retrieval grounded" (every claim's `source_unit_id` resolves — see the
script's own comment on why this is not a stricter "correct document/
section scope" check: the typed corpus does not carry a uniform, parsed
expected-scope field for every question yet, a documented limitation, not
an overclaim).

## Two real bugs in this workstream's own new measurement, caught before reporting

Consistent with this milestone's practice across Workstreams 3, 4, and 6
of not trusting a first pass at a new audit script:

1. **The `ambiguous` type's expected outcome was wrong.** The corpus
   builder initially set `expect_answered: false` for all 20 ambiguous
   probes, assuming abstention means refusal. The real run showed most
   fall through to an ordinary, successful fallback answer (`grounded_
   generation`/`source_excerpts`) after the routing layer abstains —
   exactly what Workstream 3 already found, which this workstream's own
   first pass didn't apply consistently. Fixed by changing the corpus to
   `expect_answered: null` (not checked) for this type and adding a
   dedicated `routing_abstention_rate` metric that checks the real
   success signal (`routing_ambiguous_tie`/`routing_list_ambiguous_tie`/
   `manifest_ambiguous_tie` telemetry event) instead.
2. **A floating-point rounding bug in the SLO target itself.** The
   ambiguous type's real baseline is 18/19 (0.947368...); an early version
   of `SLO_TARGETS.min_routing_abstention_rate` stored this as the rounded
   decimal literal `0.9474`, which is *higher* than the true value —
   `--check` run against the very baseline that established it failed
   with a false breach. Fixed by storing the exact fraction `18 / 19` in
   code, pinned by a new test
   (`test/analyze_production_slo.test.js`, "does not flag the exact
   measured routing_abstention_rate baseline as a breach").

## Real baseline (see `docs/production_slo.md` for the full table)

72/72 questions, 0 final errors. Across every type except `ambiguous`:
**100% answerability match, 100% claim grounding, 100% retrieval-grounded.**
`ambiguous`'s routing-abstention rate: **18/19 (94.7%)** — one real probe
(`ws3_manifest_ambiguity.section_1_introduction`) did not reproduce its
tie on this run (traced: it resolved cleanly to a single-document
`structured/list` match with no tie event, unlike Workstream 3's original
trace of the same question — real run-to-run sensitivity in this
particular manifest-ambiguity shape, not a bug, and consistent with
Workstream 3's own finding that this shape had only 1 real occurrence in
the whole 55-manifest inventory to begin with).

Overall latency: p50 8,831 ms / p95 27,679 ms / max 38,034 ms. 139 LLM
calls (75 generation / 64 verification), 221,181 tokens, estimated
$1.310562 total ($0.0182/question average) under the frozen pricing
snapshot Workstream 2 established.

## SLO definition

`docs/production_slo.md` states every target as this workstream's own
measured baseline (not an aspirational number), with `scripts/
analyze_production_slo.js`'s `SLO_TARGETS` constant as the authoritative,
code-enforced version — `npm run audit:production-slo -- --check` exits
non-zero on a real breach, following `scripts/audit_answer_routing_
hardening.js`'s existing exit-code gate pattern. Verified the gate
actually works (not just reports) by running `--check` against the same
data that established the baseline and confirming a clean pass, then
confirming it correctly flags a real synthetic regression in the new test
file.

## Tests

`test/analyze_production_slo.test.js` (5 new tests): `claimGroundingRate`/
`retrievalGrounded`/`answerabilityMatch`'s null-vs-computed behavior, and
two tests pinning the exact-fraction SLO target fix (one confirming the
real baseline doesn't breach itself, one confirming a real drop is still
caught).

## Verification

- `npm test` — 444/444 (439 prior + 5 new).
- `npm run audit:production-slo` — reproducible, writes
  `logs/runtime/response_intelligence_workstream_7_slo_baseline.json`.
- `npm run audit:production-slo -- --check` — passes against the baseline
  that established it (a real, not tautological, check once the rounding
  bug above was fixed).
- Every question in `data/eval/typed_questions.json` carries a `source`
  field traceable to a real prior artifact; spot-checked a sample against
  the files they claim to come from.
- No engine/routing/generation code was touched this workstream — it is
  measurement and definition only — so the Workstream 1-6 validate/audit/
  eval battery was not re-run; nothing in its scope changed.

## Remaining risk/follow-up

- "Retrieval completeness" is operationalized narrowly (every returned
  claim resolves a citation), not as "retrieved the exact expected
  document/section" — the typed corpus doesn't yet carry a uniform parsed
  expected-scope field for every question. A future workstream could
  extend `scripts/build_typed_eval_corpus.js` to parse the 50Q source
  table's guideline/section reference column into real per-question
  expected `document_id`s, enabling the stricter check
  `scripts/audit_answer_routing_hardening.js` already uses for its own
  reviewed-manifest probes.
- The `ambiguous` type's 18/19 baseline reflects only 1 real cross-document
  manifest-ambiguity case existing in the current 55-manifest reviewed
  inventory (per Workstream 3) — as more manifests are authored, re-run
  `npm run build:eval:typed` (fully corpus-derived, will pick up new real
  cases) and `npm run eval:typed:run` to refresh this baseline rather than
  treating it as permanently fixed.
- This is the Response Intelligence milestone's final workstream. Per the
  milestone doc's own closing instruction, `docs/milestones/response_
  intelligence.md` moves to `history/milestones/` and
  `docs/verification_status.md`/`docs/milestone_log.md` are updated to
  reflect only the resulting current state, done alongside this report.
