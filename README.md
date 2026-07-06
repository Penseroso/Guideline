# Regulatory Guideline Archive

This repository builds a traceable structured-data archive for regulatory guidelines. The current structured pilot source is ICH M10. Phase 3 is complete for the S6(R1) foundation, source-layer pilot, derived-layer prototypes, derived validator, and provisional derived contract boundary; Phase 4 is planned and not started.

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
- The Module 3.3 amendment-mapping prototype and Module 3.4 effective-state prototype are provisional derived-layer artifacts under `structured_data/derived/`, outside the source JSON Schema and validated by the separate Module 3.5 derived-layer validator.
- Derived schemas, migrations, the Phase 4 single-PDF engine, FDA/EMA production profiles, full extraction, database, search, embeddings, RAG, web application, and regulatory decision automation are not started.

## Repository Map

- `Guideline Files/`: immutable original guideline PDFs.
- `working_docs/`: project scope, conceptual model, PDF assessments, decisions, and review logs.
- `structured_data/`: machine-readable structured outputs and schemas; `structured_data/derived/` holds provisional derived-layer artifacts (amendment mappings and effective-state records) that are outside the source JSON Schema and validator.
- `scripts/`: reproducible extraction and validation scripts.
- `.agents/skills/`: future reusable workflows after validation.

## Key Documents

- `working_docs/project_scope.md`: project scope, product direction, phases, and non-goals.
- `working_docs/schema.md`: current conceptual data model.
- `working_docs/decisions.md`: accepted material decisions and rationale.
- `working_docs/pdf_assessment_M10.md`: technical assessment of the ICH M10 PDF and extraction risks.
- `working_docs/pdf_assessment_S6_R1.md`: technical assessment of the local ICH S6(R1) PDF and extraction risks.
- `working_docs/phase3_plan.md`: Phase 3 module plan.
- `working_docs/pilot_scope_S6_R1.md`: selected S6(R1) Parent-Addendum pilot scope for Module 3.2, approved after repository review.
- `working_docs/pilot_review_S6_R1.md`: implemented and reviewed S6(R1) source-layer pilot review notes; repository review recorded as REV-004.
- `working_docs/amendment_effective_strategy.md`: provisional derived-layer strategy for Parent-Addendum mappings and effective-state records.
- `working_docs/amendment_prototype_S6_R1.md`: implemented and reviewed Module 3.3 amendment-relation prototype note; repository review recorded as REV-005; sample at `structured_data/derived/s6_r1_amendment_mappings.json`.
- `working_docs/effective_state_prototype_S6_R1.md`: implemented and reviewed Module 3.4 effective-state prototype note; repository review recorded as REV-009; sample at `structured_data/derived/s6_r1_effective_records.json`.
- `working_docs/derived_layer_validator_module_3_5.md`: implemented and reviewed Module 3.5 derived-layer validator note; repository review recorded as REV-010.
- `working_docs/derived_contract_module_3_6.md`: implemented and reviewed Module 3.6 provisional derived contract decision note; repository review recorded as REV-011.
- `working_docs/phase4_handoff_plan.md`: planned Phase 4 single-PDF engine handoff; Phase 4 is not started.
- `working_docs/phase4_plan.md`: concretized Phase 4 module specification (modules 4.1-4.10) derived from the handoff plan; Phase 4 remains not started.
- `working_docs/pilot_review_M10.md`: completed pilot review and Phase 2 migration notes for M10 sections `3.2.5.2` and `6.1`.
- `working_docs/review_log.md`: human review log template and completed review records.
- `AGENTS.md`: repository-wide operating rules for agents.
