# Phase 3 Plan

## 3.0 S6 foundation and architecture

- Objective: Onboard the S6(R1) source PDF and establish the documentation baseline for source, amendment-mapping, and current effective-state layers.
- Outputs: Complete. S6 PDF assessment, Phase 3 module plan, amendment and effective-state strategy, status document updates, and related decisions.
- Completion gate: Complete. Documentation agrees that Phase 3 has started, Module 3.0 foundation is complete, S6 cross-guideline validation is not complete, and model `0.2.0` remains unchanged.
- Non-goals: S6 structured JSON, schema changes, validator changes, full extraction, translation, database, search, embeddings, RAG, web application, and regulatory decision automation.

## 3.1 pilot scope selection

- Objective: Select a small reviewed S6 Parent-Addendum pilot scope before creating structured JSON.
- Outputs: Complete. Pilot-scope note identifies exact Part, section, page, and rationale for the selected S6 sample.
- Completion gate: Complete after repository review. Human-reviewable scope is selected and does not exceed Part I `3.3 Animal Species/Model Selection`, Part II `2 Species Selection`, `2.1 General Principles`, `2.2 One or Two Species`, and directly referenced notes needed to preserve meaning.
- Non-goals: Full-guideline extraction, effective-state synthesis, schema changes, and regulatory or study-design conclusions.

## 3.2 source-layer S6 pilot using model `0.2.0`

- Objective: Complete. Create a small source-preserving S6 pilot bundle using existing model `0.2.0`.
- Outputs: Complete. Part-aware S6 source-layer JSON pilot and review notes for model fit.
- Completion gate: Complete after repository review REV-004. Existing JSON Schema and validator pass for the pilot, source text verified against the original PDF, and model-fit notes documented in `working_docs/pilot_review_S6_R1.md`. Remaining `needs_review` items are confirmed as legitimate classification or model-limitation questions, not defects, and do not block this gate.
- Non-goals: Amendment-relation objects, EffectiveRecord objects, model-version changes before evidence, and full S6 extraction.

## 3.3 amendment-relation prototype

- Objective: Complete. Prototype reviewed mappings between Addendum and Parent `KnowledgeRecord` objects.
- Outputs: Complete. Provisional amendment-relation design note (`working_docs/amendment_prototype_S6_R1.md`) and a small reviewed mapping sample (`structured_data/derived/s6_r1_amendment_mappings.json`) referencing existing S6 source `KnowledgeRecord` IDs.
- Completion gate: Complete after repository review REV-005. Each mapping traces to existing source records, uses only the strategy relation-type vocabulary, and is clearly marked analyst-derived, not source text. All four mappings are now `reviewed` after REV-008 resolved `amend.003` to `clarifies` and REV-007 resolved `amend.004` to `narrows`.
- Non-goals: Rewriting Parent records, creating effective-state records, automated amendment detection, or adding objects to the JSON Schema.

## 3.4 current effective-state prototype

- Prerequisite: Complete. S6(R1) evaluative-language record-type classifications are resolved (DEC-026, REV-006); all S6 pilot `KnowledgeRecord` objects are `reviewed`. The `amend.004` tissue-cross-reactivity determination is resolved to `narrows` and `reviewed` (DEC-027, REV-007). The `amend.003` no-relevant-species determination is resolved to `clarifies` and `reviewed` (DEC-028, REV-008). Addendum-only `EffectiveRecord` handling is defined (DEC-029): operative Addendum guidance with no meaningful Parent counterpart may be synthesized with full Addendum provenance and an empty amendment-relation ID array.
- Objective: Complete. Prototype current effective-state records derived from applicable Parent and Addendum records, with all four accepted as `review_status=reviewed` after independent review REV-009.
- Outputs: Complete. Provisional `EffectiveRecord` design note (`working_docs/effective_state_prototype_S6_R1.md`) and a reviewed synthesis sample (`structured_data/derived/s6_r1_effective_records.json`) outside source model `0.2.0`, JSON Schema, and the current validator.
- Completion gate: Complete after REV-009. All four EffectiveRecords are `effective_status=current` and `review_status=reviewed`; traceability to contributing source records and, where applicable, reviewed amendment-relation IDs is preserved; the Addendum-only ADC Note 2 record uses an empty amendment-relation ID array; representation limitations are documented as model issues rather than substantive blockers.
- Non-goals: Verbatim source replacement, regulatory suitability conclusions, decision automation, or UI implementation.

## 3.5 validator and regression-test expansion

- Objective: Complete. Expand validation only after source-layer, amendment, or effective-state prototype evidence shows what checks are needed.
- Outputs: Complete. Derived-layer validator and regression tests for the reviewed S6 amendment-mapping and EffectiveRecord artifacts, documented in `working_docs/derived_layer_validator_module_3_5.md`.
- Completion gate: Complete after REV-010. The derived validator and regression suite passed independent review; demonstrated failure modes and artifact/document identity consistency are covered; existing M10/source validation remains unchanged; model/schema decisions remain deferred to Module 3.6.
- Non-goals: Speculative schema expansion, dependency additions without need, or unrelated refactoring.

## 3.6 model/workflow decision

- Objective: Implemented pending repository review. Decide whether model `0.2.0` remains sufficient or requires a versioned extension for S6-derived layers.
- Outputs: Provisional derived-layer contract decision and Phase 4 handoff plan, documented in `working_docs/derived_contract_module_3_6.md`, `working_docs/phase4_handoff_plan.md`, and DEC-030.
- Completion gate: Pending independent repository review. REV-011 must verify the Module 3.6 decision, validation results, and Phase 4 boundary before Module 3.6 and Phase 3 are marked complete.
- Non-goals: Premature model changes, unreviewed derived records, or full production workflow implementation.
