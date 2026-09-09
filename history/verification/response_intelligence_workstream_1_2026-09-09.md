# Response Intelligence — Workstream 1 Verification

Date: 2026-09-09

Workstream: Answer Routing Hardening

Result: complete; structural false-refusal goal met

## Baseline and observed failure

The pre-Workstream-1 production baseline was the live state produced after
the derived-semantic-layer implementation documented in
`history/verification/semantic_stage_g_2026-09-08.md`. Its raw run artifact
was `logs/runtime/answer_suitability_50_raw_2026-09-08_stage_g.json`.
That provenance is historical only; active tests use the stable
`pre_workstream_1_production_baseline` fixture name.

The router could retrieve useful records yet still refuse broad answerable
questions because section size, candidate count, or an incidental detail
match prevented a coherent scope from being selected. The logged question
“ADC에서 ADA 확인하기 위해서 어떤 동물종을 사용해야 하는지?” also treated
bare `ADA` as an FDA guideline identity constraint and refused instead of
using the reviewed ICH S6(R1) evidence.

## Implemented contract

- Existing deterministic detail, single-criterion, composite, and list paths
  remain authoritative when they form an answer.
- A reviewed semantic manifest is a broad-routing fallback only if its
  overlay is fresh and at least one applicable facet resolves to real
  reviewed evidence.
- Ranking uses explicit document/section/topic cues, compatible answer
  intent, and distance to retrieved evidence. Record count and section size
  are excluded. A tie across distinct targets abstains.
- Partial structured output requires at least one grounded facet in the
  selected manifest and explicit coverage disclosure for every uncovered
  applicable facet. An incidental record alone cannot support a broad
  answer.
- Bare `ADA` is a document constraint only with FDA/year/guideline/guidance
  context, so the ADC animal-species question reaches ICH S6(R1).

## Verification

The positive hard-gate denominator is generated from the current eligible
inventory only: reviewed + fresh + evidence-bearing manifests. There were 55
eligible manifests and 0 ineligible manifests in the current snapshot. Four
stable prompt variants per manifest produced 220 probes; 220/220 returned a
structured answer, selected the intended manifest, stayed within the intended
document, and contained reviewed cited claims.

Stale, unreviewed, ambiguous, unrelated, and scope-excluded inputs are not
silently removed from testing. They are separate negative regression cases
because they must abstain or follow the existing refusal/fallback contract,
not satisfy a positive structured-answer gate.

There were 42 mode/intent diagnostics among the 220 probes: the intended
grounded manifest was selected, but an established deterministic path used a
mode or answer-intent label different from the manifest declaration. These do
not violate the Workstream 1 hard gate and remain a response-contract question
for Workstream 5.

The fresh production-path 50-question audit completed 50/50 with 0 final
errors and 0 refusals after targeted retry of two transient provider failures
(Q34 and Q42). All 16 established suitable cases passed the route-keyed
pre-Workstream-1 production baseline policy. The 6 deterministic cases kept
identical claim sets. The 10 grounded-generation cases kept route, mode,
answered state, and reviewed grounding; Q25 and Q45 produced diagnostic-only
claim-set variation.

## Interruption and resume behavior

The audit runner persists the accumulated result immediately after each
question. The write now uses a temporary sibling file followed by rename, so
the saved JSON is replaced atomically. On restart, successful saved IDs are
skipped and only missing/error entries are run again. A regression test
injects an exception on the second question, verifies the first is already
persisted, then verifies a resumed run executes only the missing ID.

## Preliminary latency observation

This is an incidental end-to-end observation from the Workstream 1 run, not
the stage-level latency/cost baseline required by Workstream 2.

| Route | n | p50 | p95 | max |
| --- | ---: | ---: | ---: | ---: |
| All | 50 | 8,945 ms | 26,600 ms | 40,415 ms |
| `structured` | 22 | 90 ms | 23,793 ms | 28,973 ms |
| `grounded_generation` | 28 | 10,986 ms | 26,600 ms | 40,415 ms |

The runner currently records total request elapsed time. Routing, retrieval,
generation, verification, and presentation timings, plus API-call counts,
token use, and cost, are not yet separately instrumented.

## Commands

- `npm run audit:routing:hardening` — 220/220 positive probes passed;
  55 eligible and 0 ineligible manifests in the current snapshot.
- `GUIDELINE_AUDIT_FRESH=true GUIDELINE_AUDIT_OUTPUT=logs/runtime/answer_suitability_50_current_production_baseline.json node scripts/run_answer_suitability_audit.js`
  followed by targeted resume with `GUIDELINE_AUDIT_IDS=Q34,Q42` — 50/50
  unique results, 0 final errors, 0 refusals, one semantic-state fingerprint.
- `npm test` — 417/417 passed, including routing, partial-coverage,
  negative-regression, per-question persistence/resume, and atomic-write tests.
- `npm run validate:guidelines` — 6/6 guideline bundles passed.
- `npm run validate:semantic` — 6 semantic overlays and 6 presentation
  files passed.
- `npm run eval` — 24/24 passed; citation precision, claim grounding, and
  refusal correctness were each 100% over their applicable gold cases.
