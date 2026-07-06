# Phase 4 Plan

Status: planned, not started. This document concretizes `working_docs/phase4_handoff_plan.md` into an executable module specification under the accepted derived-layer contract (DEC-030, REV-011). It is a planning artifact only; writing it does not begin Phase 4 implementation, change any schema, or alter any reviewed artifact.

## Objective

Build a reusable engine that processes one complete ICH guideline PDF from beginning to end in a single extraction run: ingest, structure detection, complete source-layer extraction under source model `0.2.0`, derived-artifact generation under derived contract `0.1.0`, layered validation, review attestations, versioned risk assessment, and query-ready effective-state snapshots.

The target PDF for the first complete run is `Guideline Files/ICH S6.pdf`. Rationale: it is already assessed (`working_docs/pdf_assessment_S6_R1.md`), its Parent-Addendum structure exercises the derived layer, the reviewed Module 3.2 pilot provides a verification baseline for a subset of its content, and it is the smaller of the two available PDFs. Substituting a different PDF requires a recorded decision.

## Entry conditions

All entry conditions are satisfied as of REV-011:

- DEC-030 accepted: provisional derived contract `derived_model_version=0.1.0`, regulator-neutral core plus ICH profile, source model `0.2.0` preserved.
- Module 3.6 reviewed (REV-011); Phase 3 complete.
- Source validation (`npm run validate:pilots`), derived validation (`npm run validate:derived`), and the regression suite (`npm test`) pass on the current repository state.

## Engine boundary

Unchanged from `working_docs/phase4_handoff_plan.md` and the Module 3.6 contract:

- One extraction run processes exactly one PDF.
- Historical EffectiveRecords and snapshots are never overwritten.
- Unchanged older PDFs are not re-extracted unless explicitly required.
- No automatic unreviewed cross-document synthesis.
- No regulatory decision engine.

## Common rules binding every module

These apply the repository-wide rules in `AGENTS.md` and the Module 3.6 contract to Phase 4 execution. Every module below inherits them; module sections list only additions.

- Source integrity: never modify, rename, move, or overwrite files in `Guideline Files/`. New source PDFs are added only by the user.
- Traceability: every generated structured record traces to a document, section, and PDF page; physical page index and printed page number remain distinguished.
- No invented requirements: descriptive text is not converted into requirements; original modal wording is preserved; unsupported values use `null`, `unknown`, or `needs_review`.
- Contract separation: source model `0.2.0` and `structured_data/schemas/guideline_bundle.schema.json` are not modified for derived needs. AmendmentMapping and EffectiveRecord never enter the source bundle schema.
- Sample-first workflow: each extraction or generation module structures a small representative sample and passes validation before processing its full assigned scope.
- Validation gate: a module is not complete until every existing applicable validation command has been run and reported. Existing M10/source-pilot validation behavior must remain byte-for-byte unchanged unless a module explicitly and reviewably extends it.
- Decision and review recording: material design choices are recorded as `DEC-0NN` in `working_docs/decisions.md`; each module's completion gate includes an independent repository review recorded as `REV-0NN` in `working_docs/review_log.md`, following the Phase 3 precedent.
- Status coherence: `README.md`, `working_docs/project_scope.md`, and this plan are updated when a module completes, and must never claim more progress than the review log supports.
- Regression tests: engine code added under `scripts/` gains `node --test` coverage under `test/` for demonstrated failure modes, mirroring the Module 3.5 approach.
- Completion reports state files changed, validation commands and results, items requiring human review, and scope intentionally not completed.

## Proposed repository layout additions

Paths below are the working proposal for Phase 4 outputs. Each path becomes fixed when the module that first writes it records its decision entry; deviations require a recorded decision, not silent relocation.

- `structured_data/schemas/derived/`: derived core, artifact, and ICH profile JSON Schemas (4.1).
- `structured_data/derived/registry/`: GuidanceFamily, DocumentEdition, EditionSource, LifecycleRelationship artifacts (4.2).
- `structured_data/derived/risk/`: versioned RiskAssessment history (4.5).
- `structured_data/derived/reviews/`: ReviewAttestation artifacts, including legacy REV migrations (4.7).
- `structured_data/derived/snapshots/`: EffectiveStateSnapshot artifacts (4.8).
- `structured_data/bundles/`: complete source-layer bundles from full-document extraction, kept separate from the reviewed pilot bundles under `structured_data/pilots/` (4.4).
- `scripts/`: engine scripts; one script per pipeline stage, reproducible, no hidden state.

## Modules

### 4.1 Derived contract schema scaffold

- Objective: Implement JSON Schemas for the derived contract: a regulator-neutral core (shared definitions for IDs, artifact metadata, derivation basis, review attestation, aggregate review status, risk assessment references, lifecycle relationship, effective-state context, and provenance references), per-artifact schemas, and the initial ICH profile. All derived artifacts declare `derived_model_version=0.1.0`.
- Inputs and dependencies: DEC-030; the Module 3.6 contract; the reviewed prototype artifacts under `structured_data/derived/` as fit-evidence (they are not migrated in this module).
- Outputs: Schemas under `structured_data/schemas/derived/`; `scripts/validate_derived.js` extended to run schema validation ahead of its existing cross-object checks; new regression tests; a module note `working_docs/phase4_module_4_1.md`; decision entries for schema structure choices.
- Validation: `npm run validate:derived` passes with schema validation active; existing cross-object checks and all 3.5-era tests still pass unchanged; `npm run validate:pilots` unchanged.
- Completion gate: Independent repository review confirms the schemas express the Module 3.6 contract without expanding it, the core/profile split holds (profiles extend or constrain, never duplicate the core), the closed relation vocabulary is enforced, and source schema `0.2.0` is untouched.
- Non-goals: FDA/EMA profile schemas beyond named placeholders; prototype migration; source schema changes; derived contract `1.0.0`.

### 4.2 Family registry and lifecycle artifacts

- Objective: Implement GuidanceFamily, DocumentEdition, EditionSource, and LifecycleRelationship artifacts, plus the RiskAssessment and ReviewAttestation artifact structures they reference, and create the initial ICH S6 registry entries.
- Inputs and dependencies: 4.1 schemas; existing source `document_id=ich_s6_r1` as the canonical physical-PDF record.
- Outputs: Registry artifacts under `structured_data/derived/registry/` for an ICH S6 GuidanceFamily, a DocumentEdition for the S6(R1) integrated package, and an EditionSource referencing `ich_s6_r1`; validator rules for family/edition identity, lifecycle status, current-RiskAssessment reference, and risk history; regression tests; module note.
- Validation: Extended `npm run validate:derived` covers registry artifacts; duplication of source Document path, checksum, or version fields into the registry is a validation error, not a convention.
- Completion gate: Independent repository review confirms registry identity is independent of folder names under `Guideline Files/`, no source-Document fields are duplicated, and lifecycle relationships carry source evidence, original wording, normalized type, jurisdiction, and review status.
- Non-goals: Lifecycle relationships to documents not in the repository; M10 family registration (deferred until a run requires it); effective-state recalculation.

### 4.3 Single-PDF ingest and structure detection

- Objective: Implement the ingest stage: verify the target PDF checksum against its source Document record, and produce a reviewed structure manifest identifying section hierarchy, physical and printed pages, tables, notes, and cross-reference candidates for `Guideline Files/ICH S6.pdf`.
- Inputs and dependencies: source model `0.2.0`; `working_docs/pdf_assessment_S6_R1.md`; 4.1/4.2 only for artifact metadata conventions.
- Outputs: An ingest/structure script under `scripts/`; a structure manifest artifact (proposed: `structured_data/bundles/s6_r1/structure_manifest.json`) with per-item confidence and `needs_review` flags for uncertain boundaries; regression tests against fixture excerpts; module note recording detection accuracy against a manually verified sample.
- Validation: Manifest is syntactically valid and internally consistent (unique section IDs, page ranges within document bounds, Part I/Part II hierarchy preserved); a manually verified sample of sections confirms detected boundaries; results reported.
- Completion gate: Independent repository review confirms the manifest matches the PDF's actual structure for the verified sample, uncertain detections are flagged `needs_review` rather than silently resolved, and the run touched exactly one PDF.
- Non-goals: Text normalization; KnowledgeRecord creation; OCR beyond what the assessed PDF requires; M10 ingest.

### 4.4 Complete source-layer extraction

- Objective: Generate the complete source-layer bundle for the S6(R1) PDF under model `0.2.0`: SourceUnits, Sections, KnowledgeRecords, Conditions, QuantitativeCriteria, and CrossReferences for the whole document.
- Inputs and dependencies: 4.3 structure manifest; existing source JSON Schema and `scripts/validate_structured_data.js`.
- Outputs: Full bundle under `structured_data/bundles/s6_r1/` (proposed; distinct from the untouched Module 3.2 pilot at `structured_data/pilots/s6_r1_species_selection.json`); extraction script under `scripts/`; a reconciliation note comparing overlapping scope against the reviewed pilot; module note; regression tests.
- Validation: The full bundle passes source JSON Schema and cross-object validation; IDs unique; references resolve; traceability fields present; every record uncertain in type, modality, or applicability is `needs_review`; overlap with the reviewed pilot is reconciled with no unexplained semantic divergence.
- Completion gate: Independent repository review of a risk-weighted record sample confirms source fidelity (no invented requirements, modality preserved, tables and notes preserved as entities) and confirms the pilot bundle and all reviewed artifacts are unchanged. Extraction proceeds section-group by section-group with validation between groups, not in one uncontrolled pass.
- Non-goals: Korean normalization for the full document unless separately assigned; derived-artifact generation; pilot bundle replacement or retirement (a later recorded decision).

### 4.5 Source validation and risk assessment

- Objective: Run full source validation as a pipeline stage and create the initial versioned RiskAssessment events for the S6 document and its Phase 4 artifacts.
- Inputs and dependencies: 4.4 bundle; Module 3.6 risk policy (risk scale, risk factors, artifact-type minimums, review-tier table).
- Outputs: RiskAssessment artifacts under `structured_data/derived/risk/` with rationale, risk factors, assessor attestation reference, and required review tier computed as the higher of document risk and artifact-type minimum; validator rules for risk-history integrity; module note; regression tests.
- Validation: Extended `npm run validate:derived` verifies risk artifacts, required-tier derivation, and that registry current-risk references resolve to the latest assessment in history.
- Completion gate: Independent repository review confirms risk levels are justified by recorded factors, no assessment overwrites a prior one, and required review tiers match the Module 3.6 policy table.
- Non-goals: Review execution itself (4.7); risk-policy redesign.

### 4.6 Derived artifact generation or update

- Objective: Generate AmendmentMappings and candidate or reviewed EffectiveRecords for the full S6 bundle under the 4.1 schemas, honoring lifecycle-relationship review status, and migrate the Phase 3 prototype artifacts into the derived contract per the Module 3.6 migration strategy.
- Inputs and dependencies: 4.2 registry and lifecycle artifacts; 4.5 risk assessments; the Module 3.6 migration strategy (including `derivation_basis=supplementary_source` plus ICH profile detail for the Addendum-only case).
- Outputs: Contract-conformant mapping and EffectiveRecord artifacts under `structured_data/derived/`; migrated versions of `s6_r1_amendment_mappings.json` and `s6_r1_effective_records.json` with endpoint semantics unchanged and predecessors preserved; generation script; module note; regression tests.
- Validation: Extended `npm run validate:derived` passes for all derived artifacts; unresolved lifecycle relationships yield only candidate `needs_review` EffectiveRecords; no historical EffectiveRecord version is overwritten; the closed relation vocabulary is respected; no cross-family synthesis exists.
- Completion gate: Independent repository review at the `high` artifact-type tier confirms mapping endpoint coverage, derivation-basis correctness, migration fidelity for the four reviewed mappings and four reviewed EffectiveRecords, and jurisdiction/date scoping on all new records.
- Non-goals: Automated relation-type inference presented as reviewed; retiring any effective state without reviewed lifecycle evidence; FDA/EMA derivation details.

### 4.7 Review attestation workflow

- Objective: Implement ReviewAttestation artifacts and aggregate `review_status` calculation, and migrate legacy reviews REV-005 through REV-010 as legacy/repository-review attestations at their documented scope only.
- Inputs and dependencies: 4.5 risk tiers; 4.6 artifacts; Module 3.6 attestation and legacy-migration rules.
- Outputs: Attestation artifacts under `structured_data/derived/reviews/`; validator rules for tier satisfaction, aggregate status derivation (`unreviewed`/`needs_review`/`reviewed`/`rejected`), and disagreement preservation; module note; regression tests.
- Validation: Extended `npm run validate:derived` verifies every record's aggregate status is derivable from its attestations and required tier; conflicting reviews aggregate to `needs_review` absent a resolution attestation; legacy attestations carry no inferred provider, model, or record-level scope that was not documented.
- Completion gate: Independent repository review confirms attestation-to-record coverage, correct aggregate statuses across the full artifact set, and faithful legacy migration.
- Non-goals: Mandatory human review for every record; retroactive expansion of legacy review scope.

### 4.8 Effective-state snapshot generation

- Objective: Generate query-ready EffectiveStateSnapshots for the ICH S6 family with semantic identity from family, jurisdiction, `as_of_date`, review policy, derived contract version, source corpus identity, and calculation-policy version.
- Inputs and dependencies: 4.6 derived artifacts; 4.7 review statuses.
- Outputs: Snapshot artifacts under `structured_data/derived/snapshots/` for both `include_needs_review` (operational default) and `reviewed_only` policies; generation script; validator rules for snapshot identity and historical preservation; module note; regression tests.
- Validation: Extended `npm run validate:derived` verifies snapshot identity fields, that `calculated_at` and other execution metadata do not alter identity, that member records exist with the statuses the policy requires, and that `include_needs_review` snapshots satisfy every mandatory disclosure behavior in the Module 3.6 contract.
- Completion gate: Independent repository review confirms both policy variants are correct, needs-review content is never presented as reviewed, and prior snapshots are preserved.
- Non-goals: Query interface, search, or UI; cross-family snapshots.

### 4.9 Incremental family update

- Objective: Demonstrate adding one new PDF to an existing GuidanceFamily: register the source Document if needed, create edition and lifecycle metadata, identify impacted mappings and EffectiveRecords via the impact-analysis strategy, reassess only affected records, and preserve all unchanged records and prior snapshots.
- Inputs and dependencies: 4.2 registry; 4.8 snapshots; a new PDF designated and supplied by the user (the engine never adds files to `Guideline Files/` itself). If no suitable real PDF is available, the module runs against a clearly labeled fixture under `test/fixtures/` and the limitation is recorded; fixture artifacts must not enter `structured_data/`.
- Outputs: Incremental-update script; before/after evidence that only impacted records changed; module note; regression tests covering the impact-analysis filters in `working_docs/phase4_handoff_plan.md`.
- Validation: Full layered validation passes after the update; unchanged records are byte-identical; superseded EffectiveRecords remain queryable as historical with explicit successor links; unresolved lifecycle relationships produced only candidate `needs_review` records and retired nothing.
- Completion gate: Independent repository review confirms the impact boundary was computed correctly and no historical state was lost or overwritten.
- Non-goals: Bulk corpus processing; simultaneous multi-PDF extraction; re-extraction of the original PDF.

### 4.10 Phase 4 review and expansion readiness

- Objective: Review the complete ICH single-PDF engine end to end and decide readiness for derived contract `1.0.0` and for FDA/EMA profile implementation.
- Inputs and dependencies: 4.1 through 4.9 complete and reviewed; a successful full-pipeline run on the S6 PDF reproducible from `scripts/` alone.
- Outputs: Phase 4 review note; decision entries for (a) derived contract `1.0.0` promotion or continued `0.x`, and (b) FDA/EMA profile go/no-go; status updates to `README.md`, `working_docs/project_scope.md`, and this plan.
- Validation: The full validation suite (`npm run validate:pilots`, `npm run validate:derived`, `npm test`) passes on the final state; every module's review record exists in `working_docs/review_log.md`.
- Completion gate: Independent repository review confirms the engine met the Phase 4 boundary, all module gates were satisfied in order, and the readiness decisions are recorded with rationale. Phase 4 is complete only after this review.
- Non-goals: Starting FDA/EMA implementation inside this module; declaring `1.0.0` without the stability evidence DEC-030 reserves it for.

## Sequencing and gating

Modules execute strictly in order 4.1 → 4.10. A module may not start until its dependencies' completion gates (including their repository reviews) are recorded. Within a module, the order is: sample → validate → full scope → validate → module note and status updates → independent repository review. Discovering a contract defect mid-module stops work on that module; the defect is recorded as a decision proposal against the Module 3.6 contract rather than patched ad hoc.

## Validation strategy

Layered, cumulative, and never regressive:

- source JSON Schema validation and source cross-object validation (existing, unchanged);
- pilot discovery validation (existing, unchanged);
- derived JSON Schema validation (new in 4.1);
- derived cross-object validation (existing, extended in 4.2, 4.5–4.8);
- risk/review-policy validation (new in 4.5/4.7);
- snapshot identity and historical-preservation validation (new in 4.8).

Every module reports the exact commands run and their results. Checks that do not exist yet are reported as `not yet available`; checks that do not apply to the changed files are reported as `not applicable`.

## Deferred beyond Phase 4

Unchanged from the handoff plan: FDA production profile, EMA production profile, UI, answer generation, RAG/search/embeddings, regulatory decision automation, full applicability ontology, and bulk ICH corpus processing.
