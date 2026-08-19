# Regulatory Guideline Archive

A hallucination-resistant conversational assistant for regulatory guidelines, built on a traceable structured-data archive. Every answer is grounded in cited source text; the assistant refuses rather than invents when nothing in the archive supports a question. See `docs/product_roadmap.md` for the target product profile, implementation approach, and active roadmap — start there for current direction.

## Current Status

- **Data model**: `docs/schema.md`, model version `0.3.0`, enforced by `data/schemas/guideline_bundle.schema.json`.
- **Reviewed source data**: 3 fully-reviewed pilot bundles under `data/pilots/` — ICH M10 §3.2.5.2, ICH M10 §6.1, ICH S6(R1) species selection — content-fidelity and recall audited against the source PDFs, not just schema-valid.
- **Engine** (`engine/`): loads and indexes the pilot bundles; answers by structured lookup first (Option A, no LLM call) and falls back to retrieval-augmented generation with a mandatory citation-entailment check before showing any answer (Option B); a schema-constrained extraction agent and a separate, narrower verification agent automate drafting and checking new records. Try it with `npm run chat` (Option A works with zero API key/cost).
- **Validation**: `npm test` (unit tests, mocked LLM calls, no network), `npm run validate:pilots` (schema + cross-reference validation over all pilot bundles), `npm run eval` (gold question/citation regression set, Option A only, zero API cost).

## Repository Map

- `source_pdfs/`: immutable original guideline PDFs.
- `docs/`: active project scope, conceptual data model, PDF assessments, the product roadmap, and the milestone log.
- `data/`: the reviewed pilot bundles and the source JSON Schema.
- `engine/`: the chatbot/extraction/verification application layer.
- `validation/`: reproducible validation scripts.
- `test/`: unit tests (mocked LLM clients — no live API calls in CI) and schema validation tests.
- `logs/`: `m2_queries.jsonl`, the M2 real-usage log (`npm run chat`) — every question, its answer, path (A/B), and review_status; the coverage-expansion backlog for M3 (`docs/product_roadmap.md` §3 M2).

## Key Documents

- `docs/product_roadmap.md`: target product profile, implementation-approach decision (RAG and alternatives, agent-driven extraction/verification), and the active roadmap.
- `docs/milestone_log.md`: active decision record, one entry per roadmap milestone — the source of truth for what changed, why, and what it affects.
- `docs/test_record.md`: QbD-style engine test log — per-run extraction/verification measurements against a versioned engine baseline (`package.json` `version`), one entry per run with what changed since the last one.
- `docs/schema.md`: the current data model.
- `docs/project_scope.md`: mission, users, design principles, and non-goals.
- `docs/audit_2026-08-18.md`: independent repository audit that grounded the pivot to this roadmap.
- `docs/pdf_assessment_M10.md`, `docs/pdf_assessment_S6_R1.md`: technical assessments of the source PDFs and extraction risks.
- `AGENTS.md`: repository-wide operating rules for agents.
