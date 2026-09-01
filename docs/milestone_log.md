# Milestone Log

This file is the active milestone index. Detailed completed-milestone narratives through 2026-08-28 are frozen in `history/milestones/milestone_log_through_2026-08-28.md`.

## M0 — Foundation audit and roadmap

Completed 2026-08-18. Established the source hierarchy, evidence-first schema direction, product boundary, and multi-regulator roadmap.

## M1 — Chatbot MVP and extraction/verification pipeline

Completed 2026-08-19. Delivered structured evidence answers, grounded generation, schema-constrained extraction, independent verification, citation/refusal evaluation, and the versioned engine baseline.

## M2 — Real-use gap discovery

Completed 2026-08-19. Historical real-user questions are frozen under `history/usage/`; new runtime logs are deployment-local under `logs/runtime/` and are not Git-tracked.

## M3 — Coverage expansion

Completed 2026-08-27 for the six current guideline bundles: ICH M10, ICH S6(R1), ICH M3(R2), EMA FIH, FDA ADA 2019, and FDA Clinical Immunogenicity 2014. Current matrices are under `docs/coverage/`.

## M4 — Comparison and amendment-aware answering

Completed 2026-08-27. Cross-guideline comparison and amendment views render only claim-level grounded content; unresolved amendment notes are omitted.

## M5 — Local-first production MVP

Core MVP completed 2026-08-28; semantic routing revised 2026-09-01. The HTTP/API contract now names the actual outcomes (`structured`, `grounded_generation`, `source_excerpts`, `refusal`) instead of A/B paths. Local source retrieval is always available without a key. A single OpenAI key uses distinct default generator/verifier models; failed generation or verification falls back to verbatim source excerpts.

Open work:

- Live integration verification for both same-provider cross-model and two-provider configurations.
- Post-M1 extraction-accuracy re-measurement after representative ground truth exists.
- Deployment target, TLS termination, and retention policy remain intentionally undecided while the product stays local-first.

## M6 — Applicability Engine spike

Explored and discontinued as a separate module on 2026-08-26. The frozen implementation and rationale are under `history/applicability_engine/`; useful query-scope and condition-display findings were incorporated into the main engine.

## Repository housekeeping — 2026-08-31

Separated active operational documentation from frozen audits, source assessments, detailed verification narratives, completed milestone narratives, and historical usage artifacts. Runtime question/feedback logs are now Git-ignored and tests use dedicated fixtures instead of historical user data.
