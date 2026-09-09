# Milestone Log

This is the active, high-level milestone register. It records one entry per
roadmap milestone: status, decisions with lasting consequences, and links to
detailed evidence. It does not accumulate implementation-stage narratives or
per-fix chronology.

Detailed completed history is frozen in:

- `history/milestones/milestone_log_through_2026-08-28.md`
- `history/milestones/milestone_log_through_2026-09-08.md`
- `history/verification/`

Current measured results belong in `docs/verification_status.md`. The active
post-M5 workstream belongs in `docs/milestones/response_intelligence.md`.

## M0 — Foundation audit and roadmap

Status: completed 2026-08-18.

Established the source hierarchy, evidence-first structured archive,
grounding-first product boundary, agent-driven extraction/review model, and
multi-regulator roadmap. The lasting architecture decision is structured
evidence first, bounded grounded generation second, and explicit refusal when
the archive cannot support an answer.

History: `history/audits/repository_audit_2026-08-18.md` and
`history/milestones/milestone_log_through_2026-08-28.md`.

## M1 — Chatbot MVP and extraction/verification pipeline

Status: completed 2026-08-19.

Delivered structured answering, grounded generation, schema-constrained
extraction, independent entailment verification, citation/refusal evaluation,
and versioned engine validation. `review_status=reviewed` means the record
passed the verification pipeline; it does not imply human review.

History: `history/milestones/milestone_log_through_2026-08-28.md` and
`history/verification/engine_test_record_through_2026-08-28.md`.

## M2 — Real-use gap discovery

Status: completed 2026-08-19.

Real target-user questions established the recurring coverage and routing
gaps that drove later work. Historical usage evidence is frozen; new question
and feedback logs are deployment-local runtime data and are not committed
automatically.

History: `history/usage/`.

## M3 — Coverage expansion

Status: completed 2026-08-27 for the six current guideline bundles.

The reviewed archive covers ICH M10, ICH S6(R1), ICH M3(R2), EMA FIH, FDA ADA
2019, and FDA Clinical Immunogenicity 2014. Further expansion remains
usage-driven. Current section coverage is maintained in `docs/coverage/`.

History: `history/milestones/milestone_log_through_2026-09-08.md`.

## M4 — Comparison and amendment-aware answering

Status: completed 2026-08-27.

Cross-guideline comparison and amendment views expose only claim-level
grounded content and omit unresolved amendment claims. The separate derived
effective-state experiment was discontinued and is not a runtime dependency.

History: `history/derived_contract/`.

## M5 — Local-first production MVP

Status: completed 2026-09-08.

Delivered the local HTTP/API and web UI, authentication, feedback and runtime
monitoring, semantic response routes, reviewed semantic coverage manifests,
route-specific presentation, and fail-closed freshness/review gates. The
current semantic inventory and answer contract are operational facts in
`docs/schema.md`, `docs/derived_semantic_layer.md`, and
`docs/verification_status.md`; their construction chronology is historical.

History: `history/milestones/derived_semantic_layer_stages_a_g_2026-09-08.md`,
`history/milestones/milestone_log_through_2026-09-08.md`, and
`history/verification/`.

## M6 — Applicability Engine spike

Status: explored and discontinued as a separate module on 2026-08-26.

The separate applicability-verdict architecture was not justified for its
narrow coverage and maintenance cost. Useful query-scope vocabulary and
condition-display behavior were incorporated into the main answer engine; the
rest remains frozen and is not an active dependency.

History: `history/applicability_engine/`.

## Active milestone — Response Intelligence

Status: active since 2026-09-08; Workstreams 1-3 completed 2026-09-09.

This sequential milestone measures and improves routing, latency/cost, query
resolution, retrieval, conditional planning, response verification,
production SLOs, and cross-corpus reusability. Its scope and per-workstream
outcomes are maintained in `docs/milestones/response_intelligence.md`.
The stage-level latency/cost baseline found that the structured p95 tail is
not deterministic routing cost: it is generation/verification work performed
before a final structured fallback. Detailed evidence is in
`history/verification/response_intelligence_workstream_2_2026-09-09.md`.
Workstream 3 added additive routing-abstention telemetry and 26 real,
corpus-derived probes to classify the remaining failures: 5 of 6
confidence-floor cases are genuine retrieval misses (not resolution
failures), routing/manifest ambiguous-tie abstention is real but did not
occur in real production traffic, and the highest-value next step remains
Workstream 2's cost-negative recommendation. Detailed evidence is in
`history/verification/response_intelligence_workstream_3_2026-09-09.md`.
Workstream 4, Retrieval Quality Upgrade, is next, scoped to the retrieval-
miss cases Workstream 3 classified.
