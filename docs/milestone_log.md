# Milestone Log

This file is the active milestone index. Detailed completed-milestone narratives through 2026-08-28 are frozen in `history/milestones/milestone_log_through_2026-08-28.md`.

## M0 — Foundation audit and roadmap

Completed 2026-08-18. Established the source hierarchy, evidence-first schema direction, product boundary, and multi-regulator roadmap.

## M1 — Chatbot MVP and extraction/verification pipeline

Completed 2026-08-19. Delivered structured evidence answers, grounded generation, schema-constrained extraction, independent verification, citation/refusal evaluation, and the versioned engine baseline.

## M2 — Real-use gap discovery

Completed 2026-08-19. Historical real-user questions are frozen under `history/usage/`; new runtime logs are deployment-local under `logs/runtime/` and are not Git-tracked.

## M3 — Coverage expansion

Completed 2026-08-27 for the six current guideline bundles: ICH M10, ICH S6(R1), ICH M3(R2), EMA FIH, FDA ADA 2019, and FDA Clinical Immunogenicity 2014. Current matrices are under `docs/coverage/`. On 2026-09-07 all 1,353 KnowledgeRecord Korean normalizations were regenerated or reverified as standalone atomic propositions; subject-drop and other failed translations now remain unavailable unless a source- and translation-hash-bound review attestation is current.

## M4 — Comparison and amendment-aware answering

Completed 2026-08-27. Cross-guideline comparison and amendment views render only claim-level grounded content; unresolved amendment notes are omitted.

## M5 — Local-first production MVP

Core MVP completed 2026-08-28; semantic routing and route-specific presentation revised through 2026-09-08. The HTTP/API contract names the actual outcomes (`structured`, `grounded_generation`, `source_excerpts`, `refusal`) instead of A/B paths. Broad questions now use document/section/topic coverage, process and within-document comparison modes; generated answers are bounded by structured claims and checked for scope coverage. The UI exposes route/mode, supports an API override, presents generated synthesis above section-headed evidence, and renders section overviews, processes, comparisons, excerpts, and refusals distinctly. A 50-question Korean broad-to-detail audit reduced unsuitable answers from 27 to 5 without question-specific answer storage. A 2026-09-07 follow-up closed the remaining Q06 candidate-selection gap and replaced implicit trust of KnowledgeRecord Korean strings with fail-closed, hash-bound review attestations covering all answerable record types. On 2026-09-08 Stage D0 migrated the semantic overlay/public answer contracts to `0.2.0`/`2.2.0`, then expanded the reviewed semantic inventory to a final de-duplicated 55 manifests (6 document overviews + 42 parent sections + 5 leaf topics + 2 specialized manifests); deterministic 55/55 selection verification and a fresh 50/50 live audit retained 16 suitable/34 partial/0 unsuitable with no regression in the established 16 suitable cases. Stage D left `summary_specs`, Korean presentation sentences, and `salience_profiles` unconnected at runtime; Stage E activates each separately, starting with Stage E0 (2026-09-08), which added the `review_status` field `salienceProfile` was missing (overlay contract `0.2.0` → `0.3.0`) so it can be gated `reviewed`/`needs_review` like every other overlay object. Stage E1 (2026-09-08) then wired `summary_specs` structure into served coverage disclosure (public answer contract `2.2.0` → `2.3.0`): the offline attachment audit confirmed all 5 existing pilot summary_specs reach their intended manifest. Stage E2 (2026-09-08) rendered the matching Korean presentation sentence for section/topic overview answers (contract `2.3.0` → `2.4.0`) and added evidence-freshness filtering for the presentation overlay at load time (previously checked only by the validator). Stage E3 (2026-09-08) fixed a dead-code bug in salience's document-level matching and wired `salience_profiles` into exposure tiers (primary/supporting shown, detail collapsed; contract `2.4.0` → `2.5.0`), completing Stage E's wiring for all three objects Stage D left unconnected. A live 50-question audit against the current codebase (`.env` API keys confirmed working) promoted all of Stage E0–E3's objects to `reviewed` (5 summary_specs, 3 presentation entries, 7 salience_profiles) with the established 16 suitable cases unregressed — one case (Q25) showed a differing `grounded_generation` claim on rerun, confirmed via reproduction and content review to be model-generation variance unrelated to any Stage E code change (`history/decision_log/review_log.md` REV-015). Stage F (2026-09-08) then mechanically extended `summary_specs`/`salience_profiles` (structure only, no engine change, no new Korean text) to the 47 manifests Stage D added but Stage E's pilot scope didn't cover — 45 new summary_specs (multi_criterion/comparison manifests excluded, no matching summary shape) and 19 new salience_profiles (manifests with 5+ facets, tier/rationale derived from each facet's existing reviewed semantic_role), all promoted to `reviewed` via the same live audit Stage E0-E3 used. Korean presentation text for these 45 remains unauthored (`text: null`, same fallback as Stage E2) — deferred to separate manual work since many parent sections have no directly-filed content of their own to quote and new synthesis carries accuracy risk.

Open work:

- Live integration verification for both same-provider cross-model and two-provider configurations.
- Post-M1 extraction-accuracy re-measurement after representative ground truth exists.
- Deployment target, TLS termination, and retention policy remain intentionally undecided while the product stays local-first.

## M6 — Applicability Engine spike

Explored and discontinued as a separate module on 2026-08-26. The frozen implementation and rationale are under `history/applicability_engine/`; useful query-scope and condition-display findings were incorporated into the main engine.

## Repository housekeeping — 2026-08-31

Separated active operational documentation from frozen audits, source assessments, detailed verification narratives, completed milestone narratives, and historical usage artifacts. Runtime question/feedback logs are now Git-ignored and tests use dedicated fixtures instead of historical user data.
