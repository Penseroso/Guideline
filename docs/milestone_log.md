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

Status: active since 2026-09-08; Workstreams 1-7 completed 2026-09-09;
Workstream 8 (Corpus Expansion / Reusability Test) not started.

This sequential milestone measures and improves routing, latency/cost, query
resolution, retrieval, conditional planning, response verification,
production SLOs, and cross-corpus reusability. Its scope and per-workstream
outcomes are maintained in `docs/milestones/response_intelligence.md`.
The stage-level latency/cost baseline found that the structured p95 tail is
not deterministic routing cost: it is generation/verification work performed
before a final structured fallback. Detailed evidence is in
`history/verification/response_intelligence_workstream_2_2026-09-09.md`.
Workstream 3 added additive routing-abstention telemetry and 26 real,
corpus-derived probes to classify the remaining failures: routing/manifest
ambiguous-tie abstention is real but did not occur in Workstream 2's
50-question production-path audit, and the highest-value next step remains
Workstream 2's cost-negative recommendation. Its initial "5 of 6
confidence-floor probes are retrieval misses" finding was corrected by
Workstream 4 (below) before being used as a benchmark. Detailed evidence is
in `history/verification/response_intelligence_workstream_3_2026-09-09.md`.
Workstream 4 found that correction — those 5 cases were an artificial
single-real-word query colliding with unrelated records at the keyword
store's field-tier scoring, not a synonym/paraphrase gap — then built a
real, realistic-multi-word benchmark and implemented two small,
dependency-free fixes it justified: two missing synonym entries and a
document-frequency-aware scoring bonus in `engine/vector_store.js`. No
hybrid retrieval, BM25, or embeddings were adopted. Detailed evidence is in
`history/verification/response_intelligence_workstream_4_2026-09-09.md`.
Workstream 5 deferred Workstream 3's ambiguous-tie LLM-disambiguation
candidate (0/50 in Workstream 2's 50-question production-path audit — not
observed in that benchmark, so no real trade-off from it to justify
implementing) and implemented one narrow, measurement-verified fix
instead: skip speculative generation for `multi_criterion`/`list`/
`within_document_comparison` matches at exactly 3 expected units, where
the deterministic composite already trivially satisfies the completeness
bar that would otherwise reject a generated answer after paying for it —
a guarantee about that coverage check, not proof that a generated
narrative would never have added real value (Workstream 6 should
re-evaluate this). The scope was narrowed
twice by real measurement (counts 1 and 2, and `process` mode, were each
tried and found to be a real net loss, not a free win, before landing on
exactly count 3). Detailed evidence is in
`history/verification/response_intelligence_workstream_5_2026-09-09.md`.
(Note: Workstream 6, below, did not re-evaluate the count-3 skip risk
Workstream 5 flagged — that specific question remains open.)
Workstream 6 fixed a concrete rendering bug — `web/render.js`'s
`renderGeneratedUnit` was the only per-route renderer that never showed a
claim's `applicable_conditions`/`modality`/`value_status`, affecting the
36% of the archive (978/2,693 records) carrying attached conditions — and
separately measured (reusing Workstream 5's already-collected run, no new
API cost) whether generated prose itself preserves those conditions in
its own wording. 2 of 76 real checked cases showed a genuine, material
omission; the rest were mostly benign (one generated sentence can't
restate every one of several distinct conditions on one record). A
verifier-prompt change was considered and explicitly not implemented — the
omission rate is too broad and undifferentiated to target narrowly without
risking wide regression, and the render fix already guarantees every
condition is shown regardless of prose fidelity. Detailed evidence is in
`history/verification/response_intelligence_workstream_6_2026-09-09.md`.
Workstream 7 built the milestone's first question-type taxonomy and
production SLO, neither of which existed before: a 72-question typed
corpus (`data/eval/typed_questions.json`) assembled entirely from real
material already produced by prior workstreams (50Q depth-code mapping
plus Workstream 3's confirmed ambiguous-tie probes and the gold set's
stable refusal cases), run through the real production path (72/72, 0
final errors), scoring 100% answerability/claim-grounding/retrieval-
groundedness across every applicable type and 18/19 (94.7%) routing-
abstention for the `ambiguous` type. `docs/production_slo.md` records
every target as this measured baseline itself, enforced by
`npm run audit:production-slo -- --check`. A same-day post-close review
found the original `ambiguous`-type success check only verified routing
noticed the ambiguity, not that the final answer was safe — 1/19 real
cases silently mixed content from two unrelated documents with no
disclosure, a defect Workstream 5's original "0/50 real occurrences"
disambiguation deferral should now be re-evaluated against. A
`cross_scope_safe_rate` check was added with its target correctly kept at
1.0 (not lowered to match the flawed baseline), so the SLO check
intentionally fails until that defect is actually fixed. Detailed
evidence is in
`history/verification/response_intelligence_workstream_7_2026-09-09.md`.
Workstream 8, Corpus Expansion / Reusability Test, is next and remains
not started — the milestone is not yet complete.
