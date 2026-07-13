# Phase 4 Plan

Status: Module 4.1 complete after REV-012; Phase 4 Rebaseline R0 complete after REV-013a; Module 4.2 complete after REV-013b and independently audited and corrected after REV-013c (DEC-053 through DEC-057); Modules 4.3 through 4.12 not started, and Module 4.3 is now eligible to begin. This document concretizes `working_docs/phase4_handoff_plan.md` into an executable module specification under the accepted derived-layer contract (DEC-030, REV-011).

Revision note: this plan was revised before implementation start to (1) state the objective as a regulator-neutral common engine, (2) designate an official two-document test corpus (M10 baseline, S6 stress test), (3) add a generic run/orchestration module and an official corpus full-run module, (4) add a coverage ledger, (5) make legacy artifacts non-destructive regression references, and (6) move the incremental family update after the M10 and S6 full runs. Modules are renumbered 4.1 through 4.12.

Second revision note, also before implementation start: (1) the legacy schema-validation transition is now explicit — Module 4.1 does not enforce the `0.1.0` schemas on Phase 3 prototype artifacts, which remain frozen regression references validated only by the legacy regression validator; (2) the RiskAssessment dependency order between Modules 4.2 and 4.5 is corrected (`current_risk_assessment_id` optional in 4.2, mandatory validation from 4.5); (3) a source model limitation stop rule is added; (4) review terminology is normalized to "items requiring additional review" and "independently reviewed samples"; (5) the FDA/EMA compatibility wording is softened — Phase 4 verifies only ICH-profile containment and claims no FDA/EMA compatibility.

Third revision note, after Module 4.1 architecture correction: DEC-045 through DEC-048 supersede the earlier production-migration assumption. Phase 4 production flow is PDF -> new source extraction -> new contract-conformant derived artifacts -> comparison against Phase 1-3 regression references. It is not Phase 3 prototype -> production successor migration.

Fourth revision note, from the pre-Module-4.2 architecture audit and Rebaseline R0 (DEC-049 through DEC-052, REV-013a): (1) Module 4.5 (risk) and Module 4.7 (review) may not start until their respective governance-policy decisions are recorded (DEC-049); until then, Risk/Review artifacts are validated only for schema conformance and basic reference integrity, and Modules 4.2 through 4.6 produce only `unreviewed`/`needs_review` records with `current_risk_assessment_id=null`; (2) Module 4.2 brings forward *structural* EffectiveStateSnapshot validation (member resolution, identity fields, no tier/aggregation/disclosure policy) so the registry-to-derived-to-snapshot value path is proven on real M10/S6 pilot content before the ingest/extraction/orchestration engine exists, via candidate-only test fixtures under `test/fixtures/derived_contract/` (not production `structured_data/`); (3) ICH S6(R1) registers as one integrated-package DocumentEdition, not two editions joined by a LifecycleRelationship (DEC-050); (4) `scripts/validate_derived.js` accepts multiple source bundles in a manifest, additive to the existing single-bundle behavior (DEC-051), so the two-corpus-document registry can validate against the two canonical minimal Document-identity bundles under `structured_data/source_documents/` (DEC-053) pending full production source bundles; (5) production derived artifacts (registry, and later risk/review/snapshot) live in typed subfolders of `structured_data/derived/`, separate from the frozen Phase 3 prototype file paths (DEC-052); (6) a known contract gaps register is added (see "Known contract gaps" below), including a ReviewAttestation artifact-identity/linkage gap that must be resolved before Module 4.7 starts.

Fifth revision note, from the post-completion audit and correction of Module 4.2 (DEC-053 through DEC-057, REV-013c): (1) the production registry's source-Document identity no longer references `structured_data/pilots/` directly; it references new canonical minimal Document-identity bundles under `structured_data/source_documents/` (DEC-053), resolving the conflict between the original pilot-bootstrap approach and this document's own Engine boundary rule that pilots are not production inputs; (2) `DocumentEdition.edition_role` and `document_status` are closed vocabularies in `core.schema.json`, with `document_status` explicitly distinct from computed effective currentness (DEC-054); (3) `scripts/validate_derived.js` gained an opt-in `strict_registry` manifest flag requiring every supplied GuidanceFamily to have a DocumentEdition and every DocumentEdition to have an EditionSource, enabled for the production registry manifest while every other manifest's generic partial-graph behavior is unchanged (DEC-055); (4) EffectiveStateSnapshot structural validation additionally checks member jurisdiction consistency, not only family consistency (DEC-056); (5) manifest `source_bundles` configuration is hardened against non-string, empty-string, empty-array, and non-array values, which previously crashed instead of producing a validation error (DEC-057).

## Objective

Build a regulator-neutral common engine that processes one complete guideline PDF per extraction run: ingest, structure detection, complete source-layer extraction under source model `0.2.0`, derived-artifact generation under derived contract `0.1.0`, layered validation, review attestations, versioned risk assessment, and query-ready effective-state snapshots.

The engine core must not hard-code regulator-specific assumptions. Regulator- and document-type-specific behavior enters only through the profile contracts defined by DEC-030 (regulator-neutral core plus regulator profiles). Phase 4 implements exactly one profile, ICH, and proves the engine against the official ICH test corpus below. FDA and EMA remain deferred profile work. Phase 4 review verifies only that ICH-specific logic does not leak outside the ICH profile contract; it makes no FDA or EMA compatibility claim, and no such claim may be made before those profiles and representative documents are implemented and validated.

## Official test corpus

Phase 4 designates two existing source PDFs as the official test corpus. Both must pass complete orchestrated runs (Module 4.10) before Phase 4 can complete.

- Baseline: `Guideline Files/ICH M10.pdf` (source `document_id=ich_m10`). A single final document with no addendum structure. It exercises the simple lifecycle path (`derivation_basis=direct_source`), and the reviewed Phase 1/2 pilots and structural pressure probes under `structured_data/pilots/` provide a verification baseline for overlapping sections.
- Stress test: `Guideline Files/ICH S6.pdf` (source `document_id=ich_s6_r1`). A Parent-Addendum integrated package. It exercises structure detection across Parts, amendment mappings, effective-state synthesis (`amendment_synthesis`, `supplementary_source`), and the full derived layer, with the reviewed Module 3.2 pilot and Phase 3 derived prototypes as verification baselines.

Adding, removing, or substituting corpus documents requires a recorded decision.

## Entry conditions

All entry conditions are satisfied as of REV-011:

- DEC-030 accepted: provisional derived contract `derived_model_version=0.1.0`, regulator-neutral core plus ICH profile, source model `0.2.0` preserved.
- Module 3.6 reviewed (REV-011); Phase 3 complete.
- Source validation (`npm run validate:pilots`) and the regression suite (`npm test`) pass on the current repository state.

Validation-command timeline: at REV-011 (Phase 3 completion) `npm run validate:derived` invoked the Module 3.5 legacy derived-layer validator over the frozen Phase 3 prototypes. Module 4.1 repurposed `npm run validate:derived` to the contract-manifest validator for derived contract `0.1.0`, and the Module 3.5 legacy behavior moved to `npm run validate:legacy`. References to `validate:derived` at or before REV-011 mean the legacy validator; from Module 4.1 onward they mean the contract-manifest validator.

## Engine boundary

Unchanged from `working_docs/phase4_handoff_plan.md` and the Module 3.6 contract:

- One extraction run processes exactly one PDF.
- Historical EffectiveRecords and snapshots are never overwritten.
- Unchanged older PDFs are not re-extracted unless explicitly required.
- No automatic unreviewed cross-document synthesis.
- No regulatory decision engine.

Additional boundary from this revision:

- The engine core is regulator-neutral; regulator specifics live only in profile contracts and profile configuration.
- Reviewed historical artifacts are never modified in place. Phase 1-3 pilots, probes, prototypes, and review records are regression references and audit history, not production inputs for the runtime contract. Later semantic supersession is additive, with explicit predecessor links; removal or retirement of a historical artifact requires a recorded decision.
- Predecessor and successor lineage scope: the Phase 1-3 prototypes are regression references only; they are never the target of a production predecessor or successor link. `history.predecessor_record_ids` is reserved for the semantic or version lineage of genuine future Phase 4 production records, and contract validation (DEC-048) requires a supplied predecessor to share the referencing record's `artifact_type` while still allowing historical predecessor IDs that are not present in the supplied contract graph.

## Common rules binding every module

These apply the repository-wide rules in `AGENTS.md` and the Module 3.6 contract to Phase 4 execution. Every module below inherits them; module sections list only additions.

- Source integrity: never modify, rename, move, or overwrite files in `Guideline Files/`. New source PDFs are added only by the user.
- Traceability: every generated structured record traces to a document, section, and PDF page; physical page index and printed page number remain distinguished.
- No invented requirements: descriptive text is not converted into requirements; original modal wording is preserved; unsupported values use `null`, `unknown`, or `needs_review`.
- Contract separation: source model `0.2.0` and `structured_data/schemas/guideline_bundle.schema.json` are not modified for derived needs. AmendmentMapping and EffectiveRecord never enter the source bundle schema.
- Source model limitation stop rule: if processing demonstrates that model `0.2.0` loses source information, the module in progress stops. Ad hoc field additions and silent schema changes are prohibited; a separate source-model version decision is opened in `working_docs/decisions.md`, and the module resumes only after that decision is recorded.
- Regulator neutrality: stage implementations take the regulator profile as input; ICH-specific logic outside the ICH profile contract is a defect.
- Sample-first workflow: each stage module proves its behavior on bounded representative samples from both corpus documents and passes validation before the full corpus runs in Module 4.10.
- Non-destructive history: existing reviewed artifacts (Phase 1-3 pilots, probes, derived prototypes) are regression references and audit history, not production inputs, and never the target of a production predecessor or successor link. They are never modified in place or deleted. Predecessor links (`history.predecessor_record_ids`) are reserved for the semantic or version lineage between genuine Phase 4 production records.
- Coverage accounting: every stage that extracts, validates, or reviews content updates the relevant coverage ledger; completeness claims are accepted only when backed by the ledger.
- Validation gate: a module is not complete until every existing applicable validation command has been run and reported. Existing M10/source-pilot validation behavior must remain byte-for-byte unchanged unless a module explicitly and reviewably extends it.
- Decision and review recording: material design choices are recorded as `DEC-0NN` in `working_docs/decisions.md`; each module's completion gate includes an independent repository review recorded as `REV-0NN` in `working_docs/review_log.md`, following the Phase 3 precedent.
- Status coherence: `README.md`, `working_docs/project_scope.md`, and this plan are updated when a module completes, and must never claim more progress than the review log supports.
- Regression tests: engine code added under `scripts/` gains `node --test` coverage under `test/` for demonstrated failure modes, mirroring the Module 3.5 approach.
- Completion reports state files changed, validation commands and results, items requiring additional review, and scope intentionally not completed.

## Coverage ledger

Each corpus document gets a coverage ledger (proposed: `structured_data/bundles/<document_id>/coverage_ledger.json`), initialized from the structure manifest at ingest and updated by every subsequent stage.

Per manifest section or unit, the ledger records:

- extraction status (`not_started`, `extracted`, `excluded`);
- validation status;
- review status;
- derived-layer coverage where applicable (mappings, EffectiveRecords);
- for `excluded` entries, the reason and the decision ID authorizing the exclusion.

Ledger rules:

- The ledger must stay consistent with the structure manifest and the actual bundle contents; divergence is a validation error.
- Status history is preserved; entries change status but are never deleted.
- The Module 4.10 completeness gate is defined against the ledger: every manifest entry is `extracted` and validated, or `excluded` under a recorded decision.

## Proposed repository layout additions

Paths below are the working proposal for Phase 4 outputs. Each path becomes fixed when the module that first writes it records its decision entry; deviations require a recorded decision, not silent relocation.

- `structured_data/schemas/derived/`: derived core, artifact, and ICH profile JSON Schemas (4.1).
- `structured_data/source_documents/<document_id>.json`: canonical minimal source model `0.2.0` bundles containing only the `documents` collection (one record, byte-identical to the corresponding reviewed pilot's Document record) plus empty other collections, used as the production registry's source-Document identity input so it does not depend directly on `structured_data/pilots/` (4.2, DEC-053). Distinct from the fuller per-document bundles reserved for `structured_data/bundles/<document_id>/` (4.3, 4.10).
- `structured_data/derived/registry/`: GuidanceFamily, DocumentEdition, EditionSource, LifecycleRelationship artifacts (4.2).
- `structured_data/derived/risk/`: versioned RiskAssessment history (4.5).
- `structured_data/derived/reviews/`: ReviewAttestation artifacts for actual Phase 4 outputs (4.7).
- `structured_data/derived/snapshots/`: EffectiveStateSnapshot artifacts (4.8).
- `structured_data/bundles/<document_id>/`: per-document full-run outputs — structure manifest, coverage ledger, and complete source-layer bundles — kept separate from the frozen pilot bundles under `structured_data/pilots/` (4.3, 4.10).
- `structured_data/runs/`: run manifests produced by the orchestrator (4.9).
- `scripts/`: engine stage scripts and the orchestrator; one script per pipeline stage, reproducible, no hidden state.
- `test/fixtures/derived_contract/<scenario_name>/`: per-scenario subdirectory-plus-manifest convention for contract-graph fixtures (4.2 introduces `m10_direct_slice/` and `s6_amendment_slice/`); later modules add scenario directories rather than overloading the flat `valid/`/`invalid/` fixture directories. Fixtures never enter `structured_data/` (DEC-052 boundary applies to production artifacts only).

## Modules

### 4.1 Derived contract schema scaffold

- Objective: Implement JSON Schemas for the derived contract: a regulator-neutral core (shared definitions for IDs, artifact metadata, derivation basis, review attestation, aggregate review status, risk assessment references, lifecycle relationship, effective-state context, and provenance references), per-artifact schemas, and the initial ICH profile. All derived artifacts declare `derived_model_version=0.1.0`.
- Inputs and dependencies: DEC-030; the Module 3.6 contract; the reviewed prototype artifacts under `structured_data/derived/` as fit-evidence (they are not migrated in this module).
- Outputs: Schemas under `structured_data/schemas/derived/`; `scripts/validate_derived.js` validates contract `0.1.0` artifacts from a manifest and runs schema validation before contract graph validation; `scripts/validate_legacy_derived.js` preserves isolated Phase 3 regression validation; new regression tests, including fixtures demonstrating both schema acceptance and schema rejection; a module note `working_docs/phase4_module_4_1.md`; decision entries for schema structure choices.
- Validation: `npm run validate:derived` passes against a complete contract graph fixture and manifest; `npm run validate:legacy` passes against the frozen Phase 3 prototypes; existing cross-object checks and all 3.5-era tests still pass through the legacy validator; `npm run validate:pilots` unchanged.
- Completion gate: Independent repository review confirms the schemas express the Module 3.6 contract without expanding it, the core/profile split holds (profiles extend or constrain, never duplicate the core; no ICH concept leaks into core definitions), the closed relation vocabulary is enforced, source schema `0.2.0` is untouched, and the legacy transition boundary is explicit: Phase 3 prototype artifacts are historical regression references, not production migration inputs.
- Non-goals: FDA/EMA profile schemas beyond named placeholders; retroactive schema enforcement on Phase 3 prototype artifacts; prototype migration; source schema changes; derived contract `1.0.0`.

### 4.2 Family registry, lifecycle artifacts, and candidate value-path slice

- Objective: Implement GuidanceFamily, DocumentEdition, and EditionSource registry artifacts and create the initial registry entries for both corpus documents; implement the LifecycleRelationship artifact structure for future inter-edition use; bring forward *structural* EffectiveStateSnapshot graph validation; and demonstrate, through candidate-only test fixtures, that the registry-to-derived-to-snapshot value path validates end to end against real M10 and S6 pilot content before the ingest/extraction/orchestration engine exists.
- Inputs and dependencies: 4.1 schemas; Rebaseline R0 decisions (DEC-049 through DEC-052, REV-013a); existing source `document_id=ich_s6_r1` and `document_id=ich_m10` as the canonical physical-PDF records, provided by the canonical minimal Document-identity bundles under `structured_data/source_documents/` (DEC-053), not by direct reference to `structured_data/pilots/`.
- Outputs:
  - Registry artifacts under `structured_data/derived/registry/`: an ICH S6 GuidanceFamily with **one** DocumentEdition (`edition_role=integrated_package`) and one EditionSource referencing `ich_s6_r1` — no LifecycleRelationship, per DEC-050 — and an ICH M10 GuidanceFamily with one DocumentEdition (`edition_role=final`) and one EditionSource referencing `ich_m10`. `current_risk_assessment_id` remains optional/null in this module (DEC-044, DEC-049); RiskAssessment and ReviewAttestation production artifacts are not created here.
  - `scripts/validate_derived.js` extended, additively, to accept a manifest naming multiple `source_bundles` (DEC-051), validate each via the existing `validateBundles` reuse, and merge them into one source index before graph validation; the existing single-`source_bundle` manifest and its behavior are unchanged.
  - Structural EffectiveStateSnapshot graph validation: snapshot member IDs resolve to supplied EffectiveRecords; identity fields (`guidance_family_id`, jurisdiction, `as_of_date`, review policy, derived contract version, source corpus identity, calculation-policy version) are present; execution metadata (for example `calculated_at`) does not affect identity checks. No tier/aggregation/disclosure policy (Module 4.8 scope).
  - Two candidate-only scenario fixtures under `test/fixtures/derived_contract/` (`m10_direct_slice/`, `s6_amendment_slice/`), each with its own manifest referencing an existing reviewed source pilot: `m10_direct_slice` produces one EffectiveRecord (`derivation_basis=direct_source`) and one snapshot from an M10 pilot; `s6_amendment_slice` produces one or two AmendmentMappings and one EffectiveRecord (`derivation_basis=amendment_synthesis`, ICH `parent_addendum_synthesis` detail) and one snapshot from `s6_r1_species_selection.json`, reconciled against the frozen Phase 3 prototypes as a semantic reference only. All slice records are `unreviewed`/`needs_review`. These fixtures are test-only and never enter `structured_data/`.
  - Regression tests; module note `working_docs/phase4_module_4_2.md`.
- Validation: Extended `npm run validate:derived` covers registry artifacts, multi-bundle manifests, and structural snapshot graph checks including family and jurisdiction consistency (DEC-056). Source-Document path/checksum/version-field duplication into the registry is already rejected at JSON Schema validation (every registry schema is closed with `additionalProperties:false` and defines no such fields); the validator adds only graph-level checks schemas cannot express (cross-artifact reference resolution, multi-bundle source resolution, snapshot member/family/jurisdiction resolution, and, when `strict_registry: true` is set, registry completeness — DEC-055). Manifest `source_bundles` configuration is hardened against non-string, empty-string, empty-array, and non-array values (DEC-057).
- Completion gate (REV-013b, independently audited and corrected after REV-013c): Independent repository review confirms registry identity is independent of folder names under `Guideline Files/` (review-level check); the S6 registry uses one integrated-package edition with no LifecycleRelationship (DEC-050); the two-document registry validates against the two canonical minimal Document-identity bundles under `structured_data/source_documents/` (DEC-053) via the new multi-bundle manifest, with no direct production dependency on `structured_data/pilots/`, while the existing single-bundle `complete_graph` fixture is re-verified unchanged; `structured_data/derived/registry/manifest.json` sets `strict_registry: true` and every GuidanceFamily/DocumentEdition resolves completely (DEC-055); `DocumentEdition.edition_role`/`document_status` use closed vocabularies with `document_status` distinct from effective currentness (DEC-054); both candidate slices validate end to end producing `needs_review`/`unreviewed` records and snapshots, with an automated regression test confirming structural reconciliation (relation_type and KnowledgeRecord endpoint IDs) of the S6 slice mapping against the frozen `ich_s6_r1.amend.001` reference, and no unexplained divergence found on manual review of the prose-level synthesis; frozen artifacts remain byte-identical; `validate:pilots`, `validate:legacy`, `validate:derived`, `validate:registry` (validating `structured_data/derived/registry/manifest.json` against the two canonical identity bundles), and `npm test` all pass.
- Non-goals: Lifecycle relationships to documents not in the repository; effective-state recalculation; full risk-tier derivation, review-tier satisfaction, or review-attestation aggregation (deferred to 4.5/4.7 per DEC-049); production (non-fixture) candidate EffectiveRecords or snapshots — the slice is test-only.

### 4.3 Single-PDF ingest and structure detection

- Objective: Implement the document-neutral ingest stage: verify the target PDF checksum against its source Document record, produce a structure manifest identifying section hierarchy, physical and printed pages, tables, notes, and cross-reference candidates, and initialize the coverage ledger from the manifest. Run it against both corpus PDFs.
- Inputs and dependencies: source model `0.2.0`; `working_docs/pdf_assessment_M10.md` and `working_docs/pdf_assessment_S6_R1.md`; 4.1/4.2 only for artifact metadata conventions.
- Outputs: An ingest/structure script under `scripts/` that takes the target document and profile as input; structure manifests and initialized coverage ledgers under `structured_data/bundles/ich_m10/` and `structured_data/bundles/ich_s6_r1/`, with per-item confidence and `needs_review` flags for uncertain boundaries; a coverage ledger schema and validator rules; regression tests against fixture excerpts; module note recording detection accuracy against independently reviewed samples from both PDFs.
- Validation: Manifests are syntactically valid and internally consistent (unique section IDs, page ranges within document bounds; Part I/Part II hierarchy preserved for S6); ledgers agree with their manifests; independently reviewed samples from both documents (designated-reviewer verification) confirm detected boundaries; results reported.
- Completion gate: Independent repository review confirms the manifests match each PDF's actual structure for the reviewed samples, uncertain detections are flagged `needs_review` rather than silently resolved, the same stage code handled both documents without document-specific branches outside profile input, and each run touched exactly one PDF.
- Non-goals: Text normalization; KnowledgeRecord creation; OCR beyond what the assessed PDFs require.

### 4.4 Source-layer extraction stage

- Objective: Implement the reusable source-layer extraction stage generating SourceUnits, Sections, KnowledgeRecords, Conditions, QuantitativeCriteria, and CrossReferences under model `0.2.0`, and prove it on bounded representative section-group samples from both corpus documents. Full-document extraction is deferred to Module 4.10.
- Inputs and dependencies: 4.3 structure manifests and coverage ledgers; existing source JSON Schema and `scripts/validate_structured_data.js`.
- Outputs: Extraction script under `scripts/`; sample bundle output under `structured_data/bundles/<document_id>/` with corresponding ledger updates; reconciliation notes comparing overlapping scope against the reviewed M10 pilots (baseline) and the reviewed S6 pilot (stress); module note; regression tests.
- Validation: Sample bundles pass source JSON Schema and cross-object validation; IDs unique; references resolve; traceability fields present; every record uncertain in type, modality, or applicability is `needs_review`; ledger status matches actual extracted content; overlap with the reviewed pilots is reconciled with no unexplained semantic divergence. The frozen pilot files themselves are unchanged.
- Completion gate: Independent repository review of the sample records confirms source fidelity (no invented requirements, modality preserved, tables and notes preserved as entities) on both documents, and confirms all reviewed artifacts are unchanged.
- Non-goals: Full-document extraction (4.10); Korean normalization unless separately assigned; pilot bundle replacement or retirement.

### 4.5 Source validation and risk assessment

- Objective: Run full source validation as a pipeline stage and create the initial versioned RiskAssessment events for both corpus documents and the Phase 4 artifacts produced so far.
- Inputs and dependencies: 4.4 sample bundles; Module 3.6 risk policy (risk scale, risk factors, artifact-type minimums, review-tier table); **the DEC-049 risk-policy decision recorded** — Module 4.5 may not start before this gate.
- Outputs: RiskAssessment artifacts under `structured_data/derived/risk/` with rationale, risk factors, assessor attestation reference, and required review tier computed as the higher of document risk and artifact-type minimum; validator rules for risk-history integrity, including making the registry `current_risk_assessment_id` mandatory from this module on (ending the Module 4.2 optional allowance); module note; regression tests.
- Validation: Extended `npm run validate:derived` verifies risk artifacts and required-tier derivation, and now requires that every registry entry carries a current-risk reference resolving to the latest assessment in its history.
- Completion gate: Independent repository review confirms risk levels are justified by recorded factors, no assessment overwrites a prior one, and required review tiers match the Module 3.6 policy table.
- Non-goals: Review execution itself (4.7); risk-policy redesign.

### 4.6 Derived artifact generation and regression reconciliation

- Objective: Implement the derived-artifact stage generating AmendmentMappings and candidate or reviewed EffectiveRecords under the 4.1 schemas from newly generated source-layer records, honoring lifecycle-relationship review status, and reconcile overlapping output against Phase 1-3 regression references.
- Inputs and dependencies: 4.2 registry and lifecycle artifacts; 4.5 risk assessments; 4.4 newly generated source-layer records; Phase 1-3 pilots, probes, and prototypes as frozen comparison references only.
- Outputs: Contract-conformant mapping and EffectiveRecord artifacts under `structured_data/derived/` for the 4.4 sample scope, exercising `direct_source` on M10 samples and `amendment_synthesis`/`supplementary_source` on S6 samples; generation script; regression reconciliation notes comparing overlapping output against frozen references without converting those references into production predecessors; module note; regression tests.
- Validation: Extended `npm run validate:derived` passes for generated contract artifacts; `npm run validate:legacy` continues to pass for the frozen Phase 3 prototypes; `structured_data/derived/s6_r1_amendment_mappings.json` and `structured_data/derived/s6_r1_effective_records.json` are byte-identical to their reviewed state; unresolved lifecycle relationships yield only candidate `needs_review` EffectiveRecords; no historical EffectiveRecord version is overwritten; the closed relation vocabulary is respected; no cross-family synthesis exists.
- Completion gate: Independent repository review at the `high` artifact-type tier confirms mapping endpoint coverage, derivation-basis correctness, jurisdiction/date scoping on all new records, regression reconciliation against the frozen Phase 3 references where scopes overlap, and that no legacy file was modified, moved, migrated, or deleted.
- Non-goals: Automated relation-type inference presented as reviewed; retiring any effective state without reviewed lifecycle evidence; deleting, rewriting, or migrating legacy artifacts; FDA/EMA derivation details.

### 4.7 Review attestation workflow

- Objective: Implement ReviewAttestation artifacts and aggregate `review_status` calculation for actual Phase 4 outputs.
- Inputs and dependencies: 4.5 risk tiers; 4.6 artifacts; Module 3.6 attestation rules; **the DEC-049 review-aggregation decision recorded** — Module 4.7 may not start before this gate, and that decision must also resolve the ReviewAttestation artifact-identity/linkage gap (known contract gap G1 below): no schema field currently links a record to the ReviewAttestation(s) that justify its `review_status`, and the validator performs no graph validation of `covered_artifact_ids`/`covered_record_ids` or of RiskAssessment `assessor_attestation_id`/`override_attestation_id`.
- Outputs: Attestation artifacts under `structured_data/derived/reviews/`; validator rules for tier satisfaction, aggregate status derivation (`unreviewed`/`needs_review`/`reviewed`/`rejected`), and disagreement preservation; module note; regression tests.
- Validation: Extended `npm run validate:derived` verifies every Phase 4 output record's aggregate status is derivable from its attestations and required tier; conflicting reviews aggregate to `needs_review` absent a resolution attestation; historical REV records remain audit history and are not migrated into production ReviewAttestations unless a later decision explicitly assigns a production use.
- Completion gate: Independent repository review confirms attestation-to-record coverage and correct aggregate statuses across the actual Phase 4 output artifact set.
- Non-goals: Mandatory human review for every record; retroactive expansion of legacy review scope.

### 4.8 Effective-state snapshot generation

- Objective: Implement the snapshot stage generating query-ready EffectiveStateSnapshots with semantic identity from family, jurisdiction, `as_of_date`, review policy, derived contract version, source corpus identity, and calculation-policy version, proven on the 4.6 sample-scope artifacts.
- Inputs and dependencies: 4.6 derived artifacts; 4.7 review statuses.
- Outputs: Snapshot artifacts under `structured_data/derived/snapshots/` for both `include_needs_review` (operational default) and `reviewed_only` policies; generation script; validator rules for snapshot identity and historical preservation; module note; regression tests.
- Validation: Extended `npm run validate:derived` verifies snapshot identity fields, that `calculated_at` and other execution metadata do not alter identity, that member records exist with the statuses the policy requires, and that `include_needs_review` snapshots satisfy every mandatory disclosure behavior in the Module 3.6 contract.
- Completion gate: Independent repository review confirms both policy variants are correct, needs-review content is never presented as reviewed, and prior snapshots are preserved.
- Non-goals: Query interface, search, or UI; cross-family snapshots.

### 4.9 Generic run orchestration

- Objective: Implement a generic orchestrator that executes the full pipeline (4.3 ingest → 4.4 extraction → 4.5 validation and risk → 4.6 derived artifacts → 4.7 attestations → 4.8 snapshots) for one PDF in one command, driven entirely by a run configuration, with no document- or regulator-specific code paths outside profile contracts.
- Inputs and dependencies: All stage modules 4.3 through 4.8 complete and reviewed.
- Outputs: Orchestrator script under `scripts/` (proposed: `scripts/run_engine.js`) taking a run configuration that names the source `document_id`, guidance family, regulator profile, jurisdiction, `as_of_date`, review policy, and calculation-policy version; a run manifest artifact under `structured_data/runs/` per run recording configuration, stage order, commands, tool versions, input and output artifact IDs, validation results, and coverage ledger deltas; support for bounded-scope runs (the 4.4 sample scopes) used as the module's own proof; module note; regression tests including stage-failure propagation (a failed stage halts the run and leaves prior artifacts untouched).
- Validation: An orchestrated bounded-scope run on each corpus document reproduces the reviewed stage-module outputs (byte-identical where determinism is expected, semantically identical otherwise, with any nondeterminism documented); the run manifest accounts for every artifact the run touched; a deliberately failed stage demonstrates halt-without-corruption; all existing validation commands pass.
- Completion gate: Independent repository review confirms the orchestrator adds no semantics of its own (stages remain individually runnable and produce the same results), configuration fully determines behavior, and run manifests make each run reproducible and auditable.
- Non-goals: Parallel or multi-PDF runs; scheduling or daemon behavior; retry-with-modification logic that could mask stage defects.

### 4.10 Official corpus full runs

- Objective: Execute complete orchestrated runs over the official test corpus: first the M10 baseline run, then the S6 stress run. Each run produces the full source-layer bundle, derived artifacts, attestations, risk assessments, snapshots, a complete coverage ledger, and a run manifest.
- Inputs and dependencies: 4.9 orchestrator reviewed; both structure manifests and ledgers from 4.3.
- Outputs: Complete bundles under `structured_data/bundles/ich_m10/` and `structured_data/bundles/ich_s6_r1/`; derived artifacts, snapshots, and run manifests for both families; reconciliation notes against all frozen pilot and probe files; module note per run.
- Validation: For each document, the full layered validation suite passes; the coverage ledger shows every manifest entry `extracted` and validated, or `excluded` under a recorded decision; overlap with the frozen M10 pilots, M10 pressure probes, and S6 pilot is reconciled with no unexplained semantic divergence; frozen files are byte-identical to their reviewed state. Extraction proceeds section-group by section-group with validation between groups, not in one uncontrolled pass; the M10 run completes and is reviewed before the S6 run starts. If either run demonstrates that model `0.2.0` loses source information, the source model limitation stop rule applies: the run stops, no ad hoc fields or silent schema changes are made, and a separate source-model version decision is opened before the run resumes.
- Completion gate: Independent repository review per run, at a risk-weighted record sample, confirms source fidelity and ledger-backed completeness. Any decision to absorb or retire the M10 pressure probes or pilot bundles in favor of the fuller canonical bundles is recorded separately and executed non-destructively (supersession links, not deletion).
- Non-goals: Processing both PDFs in one run; modifying any frozen pilot, probe, or prototype file; cross-family synthesis.

### 4.11 Incremental family update

- Objective: Demonstrate adding one new PDF to an existing GuidanceFamily: register the source Document if needed, create edition and lifecycle metadata, identify impacted mappings and EffectiveRecords via the impact-analysis strategy, reassess only affected records, and preserve all unchanged records and prior snapshots.
- Inputs and dependencies: Both Module 4.10 corpus runs complete and reviewed (the incremental update must run against a real, complete family state, not sample scope); a new PDF designated and supplied by the user (the engine never adds files to `Guideline Files/` itself). If no suitable real PDF is available, the module runs against a clearly labeled fixture under `test/fixtures/` and the limitation is recorded; fixture artifacts must not enter `structured_data/`.
- Outputs: Incremental-update script; before/after evidence that only impacted records changed; coverage ledger for the new document; module note; regression tests covering the impact-analysis filters in `working_docs/phase4_handoff_plan.md`.
- Validation: Full layered validation passes after the update; unchanged records are byte-identical; superseded EffectiveRecords remain queryable as historical with explicit successor links; unresolved lifecycle relationships produced only candidate `needs_review` records and retired nothing.
- Completion gate: Independent repository review confirms the impact boundary was computed correctly and no historical state was lost or overwritten.
- Non-goals: Bulk corpus processing; simultaneous multi-PDF extraction; re-extraction of the original PDFs.

### 4.12 Phase 4 review and expansion readiness

- Objective: Review the complete regulator-neutral engine end to end and decide readiness for derived contract `1.0.0` and for FDA/EMA profile implementation.
- Inputs and dependencies: 4.1 through 4.11 complete and reviewed; both official corpus runs reproducible from `scripts/` and their run manifests alone.
- Outputs: Phase 4 review note; decision entries for (a) derived contract `1.0.0` promotion or continued `0.x`, and (b) FDA/EMA profile go/no-go, informed by an explicit assessment of how much of the M10/S6 behavior lived in profile contracts versus core code; status updates to `README.md`, `working_docs/project_scope.md`, and this plan.
- Validation: The full validation suite (`npm run validate:pilots`, `npm run validate:derived`, `npm test`) passes on the final state; both coverage ledgers are complete; every module's review record exists in `working_docs/review_log.md`.
- Completion gate: Independent repository review confirms the engine met the Phase 4 boundary, both corpus runs satisfied their gates, all module gates were satisfied in order, and the readiness decisions are recorded with rationale. Phase 4 is complete only after this review.
- Non-goals: Starting FDA/EMA implementation inside this module; declaring `1.0.0` without the stability evidence DEC-030 reserves it for.

## Known contract gaps

Logged at Rebaseline R0 (REV-013a) for resolution at a named later module; not fixed ahead of that
module's scope.

- **G1 — ReviewAttestation artifact-identity / linkage gap (resolve before Module 4.7 starts).**
  Derived records carry only an aggregate `review_status`; no schema field links a record to the
  ReviewAttestation(s) that justify it, and `scripts/validate_derived.js` performs no graph validation
  of ReviewAttestation `covered_artifact_ids`/`covered_record_ids`, or of RiskAssessment
  `assessor_attestation_id`/`override_attestation_id`. The Module 3.6 "hybrid" model (records reference
  attestation IDs; attestations hold reviewer detail) is not yet expressed in the derived schemas. The
  Module 4.7 gating decision (DEC-049) must define linkage direction and authority, whether covered IDs
  must resolve, and how RiskAssessment assessor/override attestation references resolve.
- **G2 — Multi-bundle registry validation.** Resolved by DEC-051; implemented in Module 4.2.
- **G3 — Source-Document production bootstrap.** Resolved by DEC-053 (superseding DEC-051 part 1):
  the registry references canonical minimal Document-identity bundles under `structured_data/source_documents/`, not `structured_data/pilots/`; full production bundles later supersede additively, same identity.
- **G4 — Governance policy tables not yet enforced.** Tracked by DEC-049; concrete re-gates at Module
  4.5 (risk-policy decision) and Module 4.7 (review-aggregation decision, which also closes G1).

## Sequencing and gating

Modules execute strictly in order 4.1 → 4.12, with Rebaseline R0 (documentation, CI, and decision recording only — no schema, structured-data, or validator-behavior change) inserted between Module 4.1 and Module 4.2 and gated by REV-013a. A module may not start until its dependencies' completion gates (including their repository reviews) are recorded; Module 4.5 additionally requires the DEC-049 risk-policy decision, and Module 4.7 additionally requires the DEC-049 review-aggregation decision (which also closes known gap G1). Within Module 4.10, the M10 baseline run completes and is reviewed before the S6 stress run starts. Within a module, the order is: sample → validate → full scope → validate → module note and status updates → independent repository review. Discovering a contract defect mid-module stops work on that module; the defect is recorded as a decision proposal — against the Module 3.6 contract for derived-layer defects, or as a source-model version decision under the source model limitation stop rule for demonstrated `0.2.0` source-information loss — rather than patched ad hoc.

## Validation strategy

Layered, cumulative, and never regressive:

- source JSON Schema validation and source cross-object validation (existing, unchanged);
- pilot discovery validation (existing, unchanged);
- derived JSON Schema validation (new in 4.1);
- derived cross-object validation (existing, extended in 4.2, 4.5–4.8);
- risk/review-policy validation (new in 4.5/4.7);
- snapshot identity and historical-preservation validation (new in 4.8);
- coverage-ledger consistency and completeness validation (new in 4.3, gated in 4.10);
- run-manifest reproducibility validation (new in 4.9).

Every module reports the exact commands run and their results. Checks that do not exist yet are reported as `not yet available`; checks that do not apply to the changed files are reported as `not applicable`.

## Deferred beyond Phase 4

Unchanged from the handoff plan: FDA production profile, EMA production profile, UI, answer generation, RAG/search/embeddings, regulatory decision automation, full applicability ontology, and bulk ICH corpus processing.
