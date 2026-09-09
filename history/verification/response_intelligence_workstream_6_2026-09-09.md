# Response Intelligence — Workstream 6 Verification

Date: 2026-09-09

Workstream: Response Quality / Verification Contract

Result: complete. One concrete, deterministic rendering bug fixed with
real scale evidence; one real content-fidelity measurement taken and
found insufficient to justify a verifier/generation-prompt change.

## Method

### Step 1: the render bug

Tracing `web/render.js`'s render functions per route found
`renderGeneratedUnit` (used for every `grounded_generation` answer) was
the only per-unit renderer that never called `renderApplicableConditions`/
`renderModalityLabel`/`renderValueStatusNote` — `renderAnswerUnit`
(structured route), `renderSourceExcerptUnit`, `renderOverviewSummaryUnit`,
`renderOverviewCriterionUnit`, and the shared `renderClaimCard` (evidence
panels) all show at least applicable conditions; `renderGeneratedUnit`
showed none of the three. This is a rendering gap, not a generation or LLM
problem: `claimForUnit(unit, claims).record` already carries the full
record for a generated unit, exactly as for a structured one — the
renderer simply never read `applicable_conditions`/`modality`/
`value_status` from it.

Real scale: **978 of 2,693 records (36%) in the current archive carry
`applicable_conditions`.** Before this fix, any `grounded_generation`
answer grounded to one of those records showed the user no indication of
an attached precondition, exception, or scope qualifier, while the exact
same record cited via any other route would show it. `renderClaimCard`
(the shared evidence-card renderer used by both the structured route's
side evidence panel and the generated-evidence panel below a synthesized
answer) had the identical gap for `applicable_conditions` specifically —
fixed at the same time, extending the existing precedent already visible
in that function (it already showed modality/value-status redundantly in
both the primary answer unit and the side evidence card; conditions now
follow the same pattern).

### Step 2: measuring generated-prose qualifier fidelity (real, zero additional cost)

Rather than paying for new API calls, `scripts/analyze_generation_qualifier_fidelity.js`
(`npm run audit:generation-fidelity`) reuses the already-collected fresh
50-question production-path run from Workstream 5
(`logs/runtime/answer_suitability_50_workstream_5.json`): for every
`grounded_generation` claim whose record carries `applicable_conditions`,
it checks whether the generated unit's own prose text reflects each
condition, via keyword overlap against the condition's reviewed
`normalized_ko` text (all response-language output in this project's
audited runs is Korean).

**Two real methodology bugs were found and fixed before drawing any
conclusion from this script's own output** (consistent with this
milestone's established practice of not trusting a first pass at a new
audit script):

1. The first version compared the archive's English `condition_text`
   against Korean generated prose — near-zero overlap regardless of real
   fidelity. Fixed to compare against each condition's reviewed
   `normalized_ko`.
2. The first fixed version filtered out tokens shorter than 4 characters
   (a reasonable English heuristic) — this zeroed out short but meaningful
   Korean condition phrases entirely (e.g. "가능한 경우" tokenizes to
   2-3 character words) and produced false "omitted" results even where
   the generated text plainly paraphrased the condition. Fixed to rely on
   `tokenize()`'s own existing stopword/particle handling with no
   additional length filter.

### Real result

76 real condition instances (all with a matching generated unit and a
reviewed `normalized_ko`) were checked. 23 scored a keyword overlap
`>= 0.5` (a rough "likely preserved" signal). The remaining 53 were
manually sampled, not taken at face value:

- **Most are not distortions.** A record commonly carries several
  `applicable_conditions` entries describing different scope/threshold
  details within one source paragraph (e.g. one ISR record's conditions
  cover "for pivotal early patient trials," a "≤1000 samples" rule, a
  "4-6-20 rule for chromatographic methods," and a "4-6-30 rule for
  LBAs" — four distinct sub-facts), while the generated unit is one
  sentence narrating the record's general purpose. The generated
  sentence does not claim anything false; it answers a broader framing
  of the question than any single attached condition, and structurally
  cannot restate every one of several enumerated conditions in one
  sentence.
- **2 of 76 are genuine, material omissions**, where dropping the
  condition changes what a user would conclude: a dose-increment answer
  that omitted "except when covered by predefined decision criteria in
  the protocol," and a homologous-protein-use answer that omitted "unless
  embryo-fetal lethality or teratogenicity has been identified in one
  species." Both are real instances of the exact critical failure
  `docs/answer_suitability_evaluation.md` already names ("원문이
  예시·권고·기본값인 내용을 절대 요건으로 바꿈").
- Breaking the 53 down by `condition_type`: even the more consequential
  types show a similarly high omission rate as the whole set (`exception`
  4/6 omitted, `precondition` 15/22, `scope` 11/16, `applicability`
  23/32) — `condition_type` alone does not cleanly separate the 2 real
  material cases from the benign multi-condition-per-record cases.

## Decision (Step 3): no verifier/generation-prompt change

Extending the verifier to reject a unit whose cited source contains an
`applicable_conditions` entry the unit doesn't reflect was the candidate
fix named in this workstream's plan. **Not implemented**, for three
reasons grounded in the measurement above:

1. The omission rate is high across benign and consequential condition
   types alike (not concentrated in a subset a narrow rule could target),
   so any such rule would reject the majority of generation attempts on
   records with attached conditions — a broad, high-risk change to a
   pipeline Workstreams 2/3/5 have repeatedly found sensitive to exactly
   this kind of change, for a benefit concentrated in 2/76 real cases
   found so far.
2. The Step 1 render fix already provides the real safety net for this
   exact failure mode: every condition attached to a grounding record is
   now always shown, in a dedicated block, regardless of what the
   generated prose says or omits. A user who reviews the evidence (not
   only the one-line summary) sees the qualifier either way.
3. This mirrors Workstream 4's "no embeddings without benchmark
   justification" and Workstream 5's "no ambiguous-tie disambiguation
   without real occurrences": a real, non-zero finding that does not
   clear the bar for a broad pipeline change, reported as a true result
   rather than forced into an implementation.

The 2 real material cases are named above for a future workstream that
wants to design a narrower, better-evidenced fix (e.g. a rule specific to
whether the condition, if true, would invalidate the generated claim's own
applicability — a harder, more semantic judgment than keyword overlap or
`condition_type` can make cheaply).

## Step 4: stochastic-generation regression

Not a defect to fix — LLM output variance is inherent, already observed
directly in this milestone (Workstream 2's Q07/Q34 flipped route across
reruns; Workstream 5's three separate fresh 50-question runs landed
different questions in different buckets each time). No new stability
harness was built. Recommended practice: when a future workstream needs
confidence in one specific answer's stability, rerun that question 2-3
times via `scripts/run_answer_suitability_audit.js`'s
`GUIDELINE_AUDIT_RERUN_IDS` mechanism (already used operationally in
Workstream 5) rather than building dedicated infrastructure absent
evidence that ad hoc reruns are insufficient.

## Tests

`test/web_render.test.js` (3 new tests):

- A `grounded_generation` envelope whose claim record carries
  `applicable_conditions`/non-default `modality` renders
  `modality-label`/`conditions-block` markup with the condition text.
- The same route shows no `value-status-note` when `value_status` is
  absent/known (negative case, mirroring the existing structured-route
  pin).
- `renderClaimCard` directly renders `applicable_conditions` in its own
  `conditions-block`.

## Verification

- `npm test` — 439/439 (436 prior + 3 new).
- `npm run audit:generation-fidelity` — reproducible, reads the existing
  Workstream 5 run, writes
  `logs/runtime/response_intelligence_workstream_6_qualifier_fidelity.json`.
- No change to `engine/query_router.js`/`engine/answer_envelope.js` or any
  routing/generation/verification code — this workstream's only production
  code change is in `web/render.js` (rendering, not generation), so the
  Workstream 1-5 verification battery
  (`validate:guidelines`/`validate:ko`/`audit:ko`/`validate:semantic`/
  `audit:routing:hardening`/`npm run eval`) was not re-run; nothing in
  their scope was touched.

## Remaining risk/follow-up

- The 2 real material-omission cases found are documented above, not
  fixed. A future workstream with a real budget for verifier-prompt
  iteration (and its required before/after regression run) could design a
  narrower rule targeting only conditions whose omission changes the
  generated claim's own applicability, rather than any omitted condition.
- The keyword-overlap heuristic in `scripts/analyze_generation_qualifier_fidelity.js`
  is explicitly not a semantic judgment (documented in its own comments)
  — its output is for human review, and this report's real conclusions
  came from manually sampling its output, not from its `likely_preserved`/
  `likely_omitted` counts alone. Do not treat "53/76 omitted" as a
  headline defect rate without that context.
- `is_default_with_exception` is not exercised anywhere in the current
  archive (0/2,693 records) — the deterministic prose formatter
  (`formatSingleCriterion`) and `renderCriterionValue` both handle it, but
  it has no real coverage in this measurement. Revisit if the archive ever
  gains a record using that flag.
