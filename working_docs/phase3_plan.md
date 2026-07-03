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

- Objective: Implemented pending repository review. Create a small source-preserving S6 pilot bundle using existing model `0.2.0`.
- Outputs: Part-aware S6 source-layer JSON pilot and review notes for model fit.
- Completion gate: Pending repository review. Existing JSON Schema and validator pass for the pilot, with model-fit notes documented in `working_docs/pilot_review_S6_R1.md`.
- Non-goals: Amendment-relation objects, EffectiveRecord objects, model-version changes before evidence, and full S6 extraction.

## 3.3 amendment-relation prototype

- Objective: Unstarted. Prototype reviewed mappings between Addendum and Parent `KnowledgeRecord` objects.
- Outputs: Provisional amendment-relation design notes and a small reviewed mapping sample.
- Completion gate: Each mapping traces to source records and is clearly marked as analyst-derived, not source text.
- Non-goals: Rewriting Parent records, creating effective-state records, automated amendment detection, or adding objects to the JSON Schema.

## 3.4 current effective-state prototype

- Objective: Unstarted. Prototype reviewed current effective-state records derived from applicable Parent and Addendum records.
- Outputs: Provisional `EffectiveRecord` design notes and a small reviewed synthesis sample.
- Completion gate: Each effective statement traces to all contributing source records and amendment-relation IDs, with unresolved conflicts blocking reviewed status.
- Non-goals: Verbatim source replacement, regulatory suitability conclusions, decision automation, or UI implementation.

## 3.5 validator and regression-test expansion

- Objective: Unstarted. Expand validation only after source-layer, amendment, or effective-state prototype evidence shows what checks are needed.
- Outputs: Validator and regression-test change plan, followed by implementation only if approved.
- Completion gate: New checks validate the demonstrated failure modes without weakening existing M10 validation.
- Non-goals: Speculative schema expansion, dependency additions without need, or unrelated refactoring.

## 3.6 model/workflow decision

- Objective: Unstarted. Decide whether model `0.2.0` remains sufficient or requires a versioned extension for S6-derived layers.
- Outputs: Decision record and any approved follow-up plan for model or workflow changes.
- Completion gate: Decision is supported by reviewed pilot evidence from S6 source, amendment, and effective-state prototypes.
- Non-goals: Premature model changes, unreviewed derived records, or full production workflow implementation.
