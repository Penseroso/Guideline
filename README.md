# Regulatory Guideline Archive

This repository builds a traceable structured-data archive for regulatory guidelines, and is now building a product on top of it: a hallucination-resistant conversational guideline assistant. See `working_docs/product_roadmap.md` for the target product profile, implementation approach, and roadmap, and `working_docs/audit_2026-08-18.md` for the independent audit of current repository state that grounds it.

Status note (2026-08-18): The original Phase 0-4 plan (data archive only, no application layer) is superseded by the product roadmap. Superseded planning documents are archived under `history/`; see `history/README.md`. The data layer described below (source model `0.2.0`, pilots, derived contract scaffold) is unaffected by the pivot and remains active.

The current structured pilot source is ICH M10. Phase 3 is complete for the S6(R1) foundation, source-layer pilot, derived-layer prototypes, derived validator, and provisional derived contract boundary; the former Phase 4 Module 4.1 derived-schema scaffold is implemented and remains active, though the Phase 4 module sequence that contained it is superseded.

## Current Status

- Original pilot PDF exists at `Guideline Files/ICH M10.pdf`.
- Initial PDF assessment exists at `working_docs/pdf_assessment_M10.md`.
- Phase 1 is complete for the limited ICH M10 pilot sections `3.2.5.2` and `6.1`.
- Reviewed pilot JSON files exist at `structured_data/pilots/m10_3_2_5_2.json` and `structured_data/pilots/m10_6_1.json`.
- The data model exists at `working_docs/schema.md` as model version `0.2.0`.
- Phase 2 implementation is complete for the current M10 pilots: model `0.2.0`, JSON Schema, reusable validator, and migrated pilot files validate with `npm run validate:pilots`.
- Selected M10 structural pressure testing is complete, and model `0.2.0` is retained.
- The files `structured_data/pilots/m10_phase2_table_pressure.json` and `structured_data/pilots/m10_phase2_reference_condition_pressure.json` are reviewed structural probes. They should later be retired or absorbed if the same leaf sections are replaced by fuller canonical bundles.
- Phase 3 is complete after repository review REV-011. Modules 3.0 through 3.6 completed the S6(R1) foundation, reviewed pilot scope, source-layer pilot, amendment-relation prototype, current effective-state prototype, derived-layer validator, and provisional derived contract plus Phase 4 handoff plan.
- S6(R1) evaluative-language record-type classifications are resolved under decision DEC-026 and repository review REV-006; all `KnowledgeRecord` objects in the S6 source pilot are `reviewed`.
- The S6(R1) source PDF exists at `Guideline Files/ICH S6.pdf`, with assessment at `working_docs/pdf_assessment_S6_R1.md`.
- Source model `0.2.0` remains unchanged.
- The Module 3.3 amendment-mapping prototype and Module 3.4 effective-state prototype are frozen historical derived-layer artifacts under `structured_data/derived/`, outside the source JSON Schema and validated by the separate legacy derived-layer validator.
- Derived schema scaffolding for contract `0.1.0` (formerly "Phase 4 Module 4.1") is implemented and pending independent repository review. The production derived validator is contract-manifest based; Phase 3 prototypes are regression references, not production migration inputs. The application layer (retrieval, chat interface, embeddings, generation) is not yet implemented; it is the subject of `working_docs/product_roadmap.md`, not a permanent exclusion.

## Repository Map

- `Guideline Files/`: immutable original guideline PDFs.
- `working_docs/`: active project scope, conceptual model, PDF assessments, the product roadmap/audit, and the milestone log.
- `history/`: frozen, superseded planning documents from the original Phase 0-4 archive-only plan. See `history/README.md`.
- `structured_data/`: machine-readable structured outputs and schemas; `structured_data/derived/` holds frozen historical Phase 3 derived prototypes plus the active derived contract `0.1.0` schemas.
- `scripts/`: reproducible extraction and validation scripts.
- `.agents/skills/`: reserved for future reusable workflows; not yet created (no files exist under this path today).

## Key Documents

- `working_docs/product_roadmap.md`: target product profile, implementation-approach decision (RAG and alternatives, agent-driven extraction/verification), and the active roadmap. Start here for current direction.
- `working_docs/audit_2026-08-18.md`: independent audit of repository state that grounds the roadmap.
- `working_docs/milestone_log.md`: active decision record, one entry per roadmap milestone. Replaces the old per-decision `DEC-`/`REV-` convention.
- `working_docs/project_scope.md`: project scope, product direction, and non-goals.
- `working_docs/schema.md`: current conceptual data model.
- `working_docs/pdf_assessment_M10.md`: technical assessment of the ICH M10 PDF and extraction risks.
- `working_docs/pdf_assessment_S6_R1.md`: technical assessment of the local ICH S6(R1) PDF and extraction risks.
- `AGENTS.md`: repository-wide operating rules for agents.
- `history/`: superseded Phase 3/4 plans, pilot-scope/review notes, derived-layer design notes, and the full pre-2026-08-18 `decisions.md`/`review_log.md` — historical rationale trail, see `history/README.md` for what's still authoritative vs. archived.

## Artifact Authority Boundary

- Normative runtime contract: derived JSON Schemas, regulator profile schemas, production validator, and future generation policy/configuration.
- Test-only: contract fixtures, M10/S6 regression samples, and invalid failure fixtures.
- Historical/non-normative: everything under `history/` (including the archived `decisions.md`/`review_log.md`), Phase 1-3 prototypes still referenced as regression baselines, and old review records. `working_docs/milestone_log.md` is the active record going forward.
