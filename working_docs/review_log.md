# Review Log

Use this document to record human review results after review is performed. Do not add planned, assumed, or incomplete reviews as completed entries.

## Review Entry Template

### REV-000: Title

- Date:
- Reviewer:
- Scope reviewed:
- Source document:
- Sections or pages reviewed:
- Files reviewed:
- Findings:
- Required corrections:
- Unresolved items:
- Follow-up owner:
- Status: Open | Resolved | Deferred

## Completed Reviews

### REV-001: Phase 1 ICH M10 Pilot Review

- Date: 2026-07-01
- Reviewer: Repository review
- Scope reviewed: Limited ICH M10 pilot sections `3.2.5.2` and `6.1`; source-boundary, traceability, model-fit, and unresolved-item review.
- Source document: `Guideline Files/ICH M10.pdf`
- Sections or pages reviewed: Section `3.2.5.2` on physical PDF page index `13`; section `6.1` on physical PDF page indexes `34` and `35`.
- Files reviewed: `working_docs/pilot_review_M10.md`; `structured_data/pilots/m10_3_2_5_2.json`; `structured_data/pilots/m10_6_1.json`
- Findings: Pilot review completed and summarized in `working_docs/pilot_review_M10.md`; Phase 1 pilot files were suitable to advance to Phase 2 with documented model-fit items.
- Required corrections: None open in this log entry; Phase 2 migration addressed documented fraction and modality follow-up items.
- Unresolved items: Broader extraction remains pending; selected M10 structural pressure testing was completed later in REV-003.
- Follow-up owner: Future phase owner
- Status: Resolved

### REV-002: Phase 2 Data Contract and Validator Review

- Date: 2026-07-01
- Reviewer: Repository review
- Scope reviewed: Model `0.2.0` data contract, JSON Schema, reusable validator, and migrated pilot bundles.
- Source document: `Guideline Files/ICH M10.pdf`
- Sections or pages reviewed: Existing pilot scope only: sections `3.2.5.2` and `6.1`.
- Files reviewed: `working_docs/schema.md`; `structured_data/schemas/guideline_bundle.schema.json`; `scripts/validate_structured_data.js`; `structured_data/pilots/m10_3_2_5_2.json`; `structured_data/pilots/m10_6_1.json`
- Findings: Phase 2 contract and migrated pilot bundles validate under the repository validator.
- Required corrections: None identified for the merged Phase 2 scope.
- Unresolved items: Selected M10 structural pressure testing was completed later in REV-003; broader cross-guideline validation remains pending.
- Validation command: `npm run validate:pilots`
- Follow-up owner: Future phase owner
- Status: Resolved

### REV-003: Phase 2 Structural Pressure-Test Review

- Date: 2026-07-01
- Reviewer: Repository review
- Scope reviewed: Minimal structural probes for continued table cells, footnote linkage, explicit cross-references, and compound applicability or exception handling.
- Source document: `Guideline Files/ICH M10.pdf`
- Sections or pages reviewed: Table 1 `Critical Reagents` row on physical PDF page index `46`; Table 1 `ISR` row on index `50`; Table 1 `††` note on index `51`; section `7.6.1` cross-reference paragraph on index `43`; section `6.2` final exception paragraph on index `35`.
- Files reviewed: `structured_data/pilots/m10_phase2_table_pressure.json`; `structured_data/pilots/m10_phase2_reference_condition_pressure.json`; rendered PDF page images for printed page labels `36`, `44`, `47`, `51`, and `52`.
- Findings: Model `0.2.0` represented the table, footnote, cross-reference, and compound-condition probes without demonstrated information loss. The two `m10_phase2_*_pressure.json` files are reviewed structural probes and should later be retired or absorbed if the same leaf sections are replaced by fuller canonical bundles. Continued-table coordinates and directional footnote linkage are documentation-guidance issues, not model changes.
- Required corrections: Reviewed and resolved clear semantic classifications for the `††` note instruction, external-reference instruction, feedback encouragement statement, and section `6.2` applicability and exception conditions.
- Unresolved items: Deferred semantic-classification item: `ich_m10.kr.6_2.final_exception` remains `needs_review` because classification of "is not generally required" as description versus requirement-like exception needs human policy confirmation. This does not reopen the structural pressure-test review.
- Validation command: `npm.cmd test`; `npm.cmd run validate:pilots`; `git diff --check`
- Follow-up owner: Future phase owner
- Status: Resolved

### REV-004: Phase 3 Module 3.2 ICH S6(R1) Source-Layer Pilot Review

- Date: 2026-07-05
- Reviewer: Repository review
- Scope reviewed: Module 3.2 S6(R1) Parent-Addendum source-layer pilot; source-text fidelity against the original PDF, Part-aware provenance, traceability fields, model `0.2.0` fit, and appropriateness of every `needs_review` marking.
- Source document: `Guideline Files/ICH S6.pdf` (SHA-256 `05C41D25575259D9C931FCAD33A8227089A8B2F704C0922C0B5F7F411D812E22`)
- Sections or pages reviewed: Part I `3.3 Animal Species/Model Selection` on zero-based PDF indexes `6`–`7` (printed labels `3`–`4`); Part I `Note 1` on index `12` (label `9`); Part II `2 Species Selection`, `2.1 General Principles`, and first paragraph of `2.2 One or Two Species` on index `14` (label `11`); remainder of `2.2` on index `15` (label `12`); Part II `Note 1` on indexes `19`–`20` (labels `16`–`17`) and `Note 2` on index `20` (label `17`). Text extracted with `pdftotext -layout` and compared line-by-line to the bundle.
- Files reviewed: `structured_data/pilots/s6_r1_species_selection.json`; `working_docs/pilot_review_S6_R1.md`; `working_docs/pilot_scope_S6_R1.md`; `working_docs/pdf_assessment_S6_R1.md`; `structured_data/schemas/guideline_bundle.schema.json`; `scripts/validate_structured_data.js`.
- Findings:
  - Source fidelity is faithful. All 29 source units reproduce the PDF text, including the `≤ 14 days` glyph that naive extraction renders as `<`, the split of Part II `Note 1` into 7 paragraph units across indexes `19`–`20`, and correct exclusion of `Note 3` and section `2.3`.
  - Object counts reconcile exactly with `pilot_review_S6_R1.md`: `Document` 1, `Section` 8, `SourceUnit` 29, `KnowledgeRecord` 51, `QuantitativeCriterion` 2, `Condition` 29, `CrossReference` 7. IDs are unique and Part-aware; Parent and Addendum provenance stay separate.
  - Model `0.2.0` fit is confirmed for the selected scope without schema or validator change, consistent with DEC-022 through DEC-024.
  - The two `QuantitativeCriterion` records (`up to 1 month duration` as `not_exceed`; `at least one species` as `at_least`) and the deliberate non-modeling of the `≤ 14 days` `e.g.` example are correct under model `0.2.0`.
- Required corrections (applied in this review):
  - Source-casing fidelity: heading source unit `ich_s6_r1.su.part2.2.001` recorded the top-level heading as `2. Species Selection`; the source stream renders it in all capitals (`2. SPECIES SELECTION`, like `3. STUDY DESIGN`), while only subsections `2.1`/`2.2` are title-case. Corrected the source unit to `2. SPECIES SELECTION`; the normalized `Section.title` remains `Species Selection`.
  - Modality under DEC-017: `ich_s6_r1.kr.part1.3_3.007` (`may suffice`) and `ich_s6_r1.kr.part1.3_3.008` (`may be possible`) were tagged `modality=may`, but DEC-017 reserves `may` for permission or allowance and routes epistemic "may = might" wording to `modality=other` with `original_modal_text`. Corrected both to `modality=other` and set `review_status=reviewed`.
  - Resolved two further Part I `3.3` items whose only ambiguity the existing decisions settle: `ich_s6_r1.kr.part1.3_3.005` (`may still be of some relevance`, epistemic `other` + `description`) and `ich_s6_r1.kr.part1.3_3.013` (`may be used as an acceptable alternative`, a genuine permission that correctly keeps `modality=may`) set to `review_status=reviewed`.
- Unresolved items (confirmed as legitimately `needs_review`, not extraction errors; do not block Module 3.2):
  - Twelve `KnowledgeRecord` objects whose open question is the record-type treatment of non-modal evaluative wording — `appropriate`, `sufficient`, `justified`, `critical`, `prudent`, `recommended`, `not warranted`, `calls for` — remain `needs_review`: `ich_s6_r1.kr.part1.3_3.011`; `ich_s6_r1.kr.part1.notes.002`; `ich_s6_r1.kr.part2.2_1.005`, `.008`, `.010`, `.011`, `.012`; `ich_s6_r1.kr.part2.2_2.002`, `.004`, `.005`; `ich_s6_r1.kr.part2.notes.006`, `.011`. Recommend a follow-up decision setting a classification rule for evaluative language so these can be batch-resolved; this policy question is deferred, not a defect.
  - `ich_s6_r1.cond.part2.notes.001` remains `needs_review`: whether "a TCR study might not be technically feasible" is a normative `exception` to the TCR recommendation or a factual feasibility caveat is a genuine judgment call.
  - Four `CrossReference` objects remain `needs_review` because model `0.2.0` has no Note-specific target type and cannot resolve a reference to a `SourceUnit`: `ich_s6_r1.xref.part1.3_3.001` (`(Note 1)`), `ich_s6_r1.xref.part2.2_1.001` (`(see Note 1)`), `ich_s6_r1.xref.part2.2_1.005` (`see Note 2`), and the vague back-reference `ich_s6_r1.xref.part2.2_1.004` (`(see above)`). The three Note references have clear intended targets that the model cannot represent; this is the demonstrated Module 3.5 candidate, not an error.
  - Demonstrated model-limitation candidates for Module 3.5 stand confirmed: (1) no Note/`SourceUnit` cross-reference target type; (2) no exact-count comparator for `QuantitativeCriterion`.
- Validation command: `npm run validate:pilots` (Validated 5 pilot bundle(s)); `npm test` (17/17 pass); `git diff --check` (clean). `ajv` was installed from `package.json` before running; `package-lock.json` left unchanged.
- Follow-up owner: Future phase owner
- Status: Resolved

### REV-005: Phase 3 Module 3.3 ICH S6(R1) Amendment-Relation Prototype Review

- Date: 2026-07-06
- Reviewer: Repository review
- Scope reviewed: Module 3.3 amendment-relation prototype; endpoint traceability, source-faithfulness of each relation-type assignment against the source text, analyst-derived marking, source-layer immutability, and placement outside the source JSON Schema/validator.
- Source document: `Guideline Files/ICH S6.pdf` (SHA-256 `05C41D25575259D9C931FCAD33A8227089A8B2F704C0922C0B5F7F411D812E22`), via the REV-004 source records in `structured_data/pilots/s6_r1_species_selection.json`.
- Sections or pages reviewed: Part I `3.3` (`kr.part1.3_3.002`, `.003`, `.004`, `.006`, `.007`, `.010`) and Part II `2.1`/`2.2` (`kr.part2.2_1.001`, `.002`, `.003`, `.007`, `.008`, `.009`; `kr.part2.2_2.001`, `.002`, `.004`, `.005`).
- Files reviewed: `structured_data/derived/s6_r1_amendment_mappings.json`; `working_docs/amendment_prototype_S6_R1.md`; `working_docs/amendment_effective_strategy.md`; `working_docs/phase3_plan.md`.
- Findings:
  - All four mappings trace to existing source `KnowledgeRecord` IDs (16 endpoints, 0 unresolved) and use only the strategy relation-type vocabulary. Each is explicitly marked analyst-derived. The source layer (`s6_r1_species_selection.json`) is unchanged.
  - Relation assignments are source-faithful: `amend.001` `clarifies` (Part II 2.1 explains how relevancy is determined without changing the Part I 3.3 definition) and `amend.002` `narrows` (Part II 2.2 adds the "two non-rodent species are not appropriate" restriction, limiting the general two-species expectation) are clearly supported and are set to `review_status=reviewed`.
  - Placement under `structured_data/derived/`, outside `structured_data/pilots/`, correctly keeps the artifact out of the source-bundle validation set (DEC-025); `validate:pilots` still reports exactly 5 bundles.
- Required corrections: None. No source record or model change was needed.
- Unresolved items (confirmed as legitimate; do not block Module 3.3):
  - `amend.003` (`supplements` vs `clarifies`) remains `needs_review` as a genuine relation-vocabulary boundary case, deferred to the Module 3.6 vocabulary decision.
  - `amend.004` (`modifies` vs `conflicts_with`) remains `needs_review` because the choice is consequential: a `conflicts_with` reading would block a reviewed effective state for the tissue-cross-reactivity pair (Part I `3_3.004` vs Part II `2_1.007`/`.008`). This must be settled, ideally with domain input, before Module 3.4 effective-state synthesis treats the pair as reviewed.
  - Vocabulary gap confirmed: new Addendum scope with no Parent record (ADC content, `kr.part2.2_1.014` and Part II Note 2) has no fitting relation type; recorded for the Module 3.6 model decision.
- Validation command: `npm run validate:pilots` (Validated 5 pilot bundle(s)); `npm test` (17/17 pass); endpoint ID-resolution check (16 endpoints, 0 unresolved, 0 relation types outside vocabulary); `git diff --check` (clean).
- Follow-up owner: Future phase owner
- Status: Resolved

### REV-006: Phase 3 ICH S6(R1) Evaluative-Language Classification Audit

- Date: 2026-07-06
- Reviewer: Repository review
- Scope reviewed: Record-type and modality classification of fourteen S6(R1) `KnowledgeRecord` objects — the twelve evaluative-language records left `needs_review` after REV-004 plus two already-reviewed records re-audited for consistency (`ich_s6_r1.kr.part2.2_1.002`, `ich_s6_r1.kr.part2.2_1.006`). This is a prerequisite review for Module 3.4.
- Source document: `Guideline Files/ICH S6.pdf` (SHA-256 `05C41D25575259D9C931FCAD33A8227089A8B2F704C0922C0B5F7F411D812E22`).
- Sections or pages reviewed: Part I `3.3` and `Note 1`; Part II `2.1`, `2.2`, and `Note 1` — the source units already reproduced in the REV-004 pilot.
- Files reviewed: `structured_data/pilots/s6_r1_species_selection.json`; `working_docs/schema.md`; `working_docs/decisions.md`; `working_docs/pilot_review_S6_R1.md`.
- Findings:
  - Applied the DEC-026 rule: `record_type=recommendation` when a statement determines selection, allowance, exclusion, necessity, sufficiency, justification, or appropriateness of a regulatory action, study, method, or evidence; `record_type=description` only for information value, function, capability, or factual characteristics. Non-enum evaluative wording kept as `modality=other` with exact `original_modal_text`, not converted to `must`/`should`/`may`.
  - All fourteen audited records resolve to `record_type=recommendation` and `review_status=reviewed`. No `KnowledgeRecord` in the pilot remains `needs_review`.
- Required corrections (applied):
  - `description` → `recommendation`: `ich_s6_r1.kr.part1.notes.002`, `ich_s6_r1.kr.part2.2_1.002`, `ich_s6_r1.kr.part2.2_1.006`, `ich_s6_r1.kr.part2.2_1.008`, `ich_s6_r1.kr.part2.2_2.005`.
  - `ich_s6_r1.kr.part2.2_2.005` also: `modality=none` → `modality=other`, `original_modal_text=null` → `"is justified"`.
  - The remaining nine audited records were already `recommendation`; their `record_type`, `modality`, and source wording were preserved and `review_status` set to `reviewed`.
- Unresolved items:
  - `ich_s6_r1.cond.part2.notes.001` (Condition) and four `CrossReference` objects (`xref.part1.3_3.001`, `xref.part2.2_1.001`, `.004`, `.005`) remain `needs_review` from REV-004; they are out of scope for this evaluative-language audit.
  - Amendment mappings `amend.003` and `amend.004` remain `needs_review` from REV-005 and were not touched.
- Validation command: `npm run validate:pilots` (Validated 5 pilot bundle(s)); `npm test` (17/17 pass); scripted check confirming exactly the fourteen target records changed, only within `record_type`/`modality`/`original_modal_text`/`review_status`, with no other `KnowledgeRecord` altered; `git diff --check` (clean).
- Follow-up owner: Future phase owner
- Status: Resolved

### REV-007: Phase 3 ICH S6(R1) Amendment Mapping `amend.004` Resolution

- Date: 2026-07-06
- Reviewer: Repository review
- Scope reviewed: Resolution of amendment mapping `ich_s6_r1.amend.004` (tissue cross-reactivity in species selection), left `needs_review` by REV-005. Prerequisite for Module 3.4.
- Source document: `Guideline Files/ICH S6.pdf` (SHA-256 `05C41D25575259D9C931FCAD33A8227089A8B2F704C0922C0B5F7F411D812E22`).
- Sections or pages reviewed: Part I `3.3` (`kr.part1.3_3.004`, `.005`); Part II `2.1` body (`kr.part2.2_1.007`, `.008`); Part II `Note 1` (`kr.part2.notes.005`, `.014`), reached by following the explicit `(see Note 1)` reference `xref.part2.2_1.001` on source unit `su.part2.2_1.005`.
- Files reviewed: `structured_data/derived/s6_r1_amendment_mappings.json`; `working_docs/amendment_prototype_S6_R1.md`; `working_docs/amendment_effective_strategy.md`; `structured_data/pilots/s6_r1_species_selection.json`.
- Findings:
  - Following the explicit Note 1 reference (per DEC-027) resolved the contested reading. The Addendum body records `kr.part2.2_1.007`/`.008` carry the primary species-selection guidance (animal-tissue tissue cross-reactivity is of limited value and usable only in specific cases). Note 1 records `kr.part2.notes.005` (full-panel animal-tissue TCR not recommended) and `kr.part2.notes.014` (selected animal-tissue evaluation gives only conditional supplemental information) materially define the restriction.
  - The Addendum neither contradicts nor replaces the Parent; it narrows the scope and evidentiary role of animal-tissue tissue cross-reactivity in species selection. `modifies` and `conflicts_with` are removed as interpretations.
  - Including Note 1 records as endpoints does not make Note 1 an independent amendment of the Parent; the body records and referenced Note 1 records together form the complete Addendum meaning. The `(see Note 1)` link is recorded on the mapping via `contextual_cross_reference_ids`; the Note-target model limitation is unchanged and not treated as absence of contextual linkage.
- Required corrections (applied):
  - `ich_s6_r1.amend.004`: `relation_type` `modifies` → `narrows`; `review_status` `needs_review` → `reviewed`; parent endpoints → `kr.part1.3_3.004`, `.005`; Addendum endpoints → `kr.part2.2_1.007`, `.008`, `kr.part2.notes.005`, `.014`; added `contextual_cross_reference_ids=["ich_s6_r1.xref.part2.2_1.001"]`; `mapped_scope` updated. Recorded the general reference-review rule as DEC-027.
- Unresolved items:
  - `ich_s6_r1.amend.003` (`supplements` vs `clarifies`) remains `needs_review`, deferred to the Module 3.6 vocabulary decision; not touched.
  - The Note 1 `CrossReference` model limitation (`target_id=null`) is unchanged and out of scope.
- Validation command: `npm run validate:pilots` (Validated 5 pilot bundle(s)); `npm test` (17/17 pass); scripted check confirming only `amend.004` changed among mappings, all six endpoints exist, `relation_type="narrows"`, `review_status="reviewed"`; `git diff --check` (clean).
- Follow-up owner: Future phase owner
- Status: Resolved

### REV-008: Phase 3 ICH S6(R1) pre-Module-3.4 decision closure

- Date: 2026-07-06
- Reviewer: Repository review
- Scope reviewed: Resolution of amendment mapping `ich_s6_r1.amend.003` and Addendum-only effective-guidance handling before Module 3.4. No Module 3.4 `EffectiveRecord` objects were created.
- Source document: `Guideline Files/ICH S6.pdf` (SHA-256 `05C41D25575259D9C931FCAD33A8227089A8B2F704C0922C0B5F7F411D812E22`), via existing S6 pilot source records.
- Sections or pages reviewed: Part I §3.3 (`ich_s6_r1.kr.part1.3_3.010`); Part II §2.1 (`ich_s6_r1.kr.part2.2_1.009` and condition `ich_s6_r1.cond.part2.2_1.004`); candidate Addendum-only examples `ich_s6_r1.kr.part2.2_1.014` and Part II Note 2 records `ich_s6_r1.kr.part2.notes.009`, `.010`, `.011`, `.012`, `.013`, and `.015`.
- Files reviewed: `structured_data/derived/s6_r1_amendment_mappings.json`; `working_docs/amendment_prototype_S6_R1.md`; `working_docs/amendment_effective_strategy.md`; `working_docs/decisions.md`; `working_docs/phase3_plan.md`.
- Findings:
  - `amend.003` is source-faithful as `clarifies`: Part II §2.1 begins with `As described in ICH S6 Guideline` and restates the same alternative pathway described in Part I §3.3 for cases where no relevant species exists. The condition `ich_s6_r1.cond.part2.2_1.004` preserves the orthologous-target mechanism as material evidence, but does not create a new alternative, independent obligation, or broader scope.
  - The current `KnowledgeRecord` endpoints for `amend.003` remain unchanged. Amendment mappings currently use `KnowledgeRecord` endpoints, while linked `Condition` records must also be followed during effective-state synthesis.
  - Addendum-only operative guidance may produce an Addendum-derived `EffectiveRecord` with full Addendum provenance and an empty amendment-relation ID array. This does not imply amendment, replacement, or supersession of a nonexistent Parent record, and absence of a Parent counterpart is not a conflict or unresolved mapping.
- Required corrections (applied): `ich_s6_r1.amend.003` `relation_type` `supplements` → `clarifies`; `review_status` `needs_review` → `reviewed`; `analyst_rationale` updated to cite `ich_s6_r1.cond.part2.2_1.004` and remove the prior `supplements` interpretation. Strategy and prototype documentation updated to permit Addendum-only `EffectiveRecord` handling without creating effective records.
- Unresolved items: No remaining pre-Module-3.4 amendment-decision blocker is identified in this scope. Actual Module 3.4 synthesis remains unstarted and must still review all contributing source records, conditions, quantitative criteria, cross-references, and materially referenced source units for each proposed `EffectiveRecord`.
- Validation command: `npm test`; `npm run validate:pilots`; scripted amendment check for `amend.003` relation/status/endpoints/rationale, Addendum-only strategy text, and unchanged non-`amend.003` mappings; `git diff --check`.
- Follow-up owner: Future phase owner
- Status: Resolved

### REV-009: Phase 3 Module 3.4 ICH S6(R1) Effective-State Prototype Review

- Date: 2026-07-06
- Reviewer: Repository review
- Scope reviewed: Independent review of all four Module 3.4 `EffectiveRecord` objects against contributing `KnowledgeRecord`, `Condition`, `QuantitativeCriterion`, `CrossReference`, `SourceUnit`, and amendment-mapping records.
- Source document: `Guideline Files/ICH S6.pdf` (SHA-256 `05C41D25575259D9C931FCAD33A8227089A8B2F704C0922C0B5F7F411D812E22`), via existing S6 pilot source records.
- Sections or pages reviewed: Part I `3.3`; Part II `2.1`, `2.2`, Note 1, and Note 2 within the Module 3.4 effective-state scope.
- Files reviewed: `structured_data/derived/s6_r1_effective_records.json`; `structured_data/derived/s6_r1_amendment_mappings.json`; `structured_data/pilots/s6_r1_species_selection.json`; `working_docs/effective_state_prototype_S6_R1.md`; `working_docs/amendment_effective_strategy.md`; `working_docs/phase3_plan.md`.
- Findings:
  - All four EffectiveRecords are supported as current S6(R1) effective-state synthesis after correction.
  - The TCR record needed fuller Parent text in `effective_text_en` and a rationale explicitly preserving Parent `.004`/`.005`, Parent Conditions `.002`/`.003`, Addendum `.007`/`.008`, Note 1 `.005`/`.014`, and the source wording `can be used`.
  - The ADC record needed narrowing to the Note 2 short-term unconjugated-toxin proposition only. The novel-toxin general-principles statement is a separate proposition and is excluded.
  - Representation limitations for note-target cross-references remain model issues, not substantive blockers.
- Required corrections: Corrected the TCR effective text and rationale; removed `ich_s6_r1.kr.part2.2_1.014`, `ich_s6_r1.cond.part2.2_1.008`, `ich_s6_r1.xref.part2.2_1.005`, and `ich_s6_r1.su.part2.2_1.008` from the ADC record; replaced the ADC effective text and rationale; removed the obsolete ADC CrossReference representation limitation; changed all four EffectiveRecords to `review_status=reviewed`.
- Unresolved items: None for Module 3.4. EffectiveRecords remain provisional derived-layer artifacts outside source model `0.2.0`, JSON Schema, and the current validator.
- Validation command: Focused EffectiveRecord review check; `npm.cmd test`; `npm.cmd run validate:pilots`; `git diff --check`; protected-file diff checks for `structured_data/pilots/s6_r1_species_selection.json` and `structured_data/derived/s6_r1_amendment_mappings.json`.
- Follow-up owner: Future phase owner
- Status: Resolved

### REV-010: Phase 3 Module 3.5 Derived-Layer Validator Review

- Date: 2026-07-06
- Reviewer: Repository review
- Scope reviewed: Independent review of the merged Module 3.5 derived-layer validator on `main`, including merge commit `a71bc9132aecceaa6e6f893deec0848f6d5770d5`; validator architecture, CLI behavior, exported functions, regression coverage, current S6 artifact compatibility, source-pilot validation compatibility, and Module 3.5 completion documentation.
- Source document: Not applicable; this review covered validation code and reviewed structured artifacts rather than source-text extraction.
- Sections or pages reviewed: Not applicable.
- Files reviewed: `scripts/validate_derived.js`; `test/validate_derived.test.js`; `test/fixtures/derived/`; `package.json`; `working_docs/derived_layer_validator_module_3_5.md`; `working_docs/phase3_plan.md`; `working_docs/review_log.md`; `scripts/validate_structured_data.js`; `scripts/validate_pilots.js`; `structured_data/pilots/s6_r1_species_selection.json`; `structured_data/derived/s6_r1_amendment_mappings.json`; `structured_data/derived/s6_r1_effective_records.json`.
- Validation architecture findings:
  - The derived-layer validator remains separate from source-bundle and M10 validation. `scripts/validate_structured_data.js` and `scripts/validate_pilots.js` are unchanged, and `validate:pilots` still scans only `structured_data/pilots/`.
  - No new dependency, source model change, or JSON Schema change is introduced.
  - The validator exports reusable functions and provides a working CLI with exit code `0` for success, `1` for validation failure, and `2` for usage/configuration failure.
  - Production validation does not hard-code S6 record counts or specific EffectiveRecord IDs, does not infer Addendum-only status, and does not impose an unapproved `effective_status` vocabulary.
  - The derived-layer validator covers the demonstrated Module 3.3-3.5 structural failure modes, including duplicate IDs, missing or wrong-layer references, invalid relation/review statuses, reviewed mapping and contributor status consistency, mapping endpoint coverage, required provenance fields, provenance-graph closure, and the documented CrossReference representation-limitation exception.
  - The five artifact/document identity checks are implemented: amendment `artifact.layer` must equal `amendment_mapping`; effective `artifact.layer` must equal `effective_state`; amendment and effective artifact `document_id` values must match; every `edition_context.document_id` must equal the effective artifact `document_id`; and every SourceUnit referenced by an EffectiveRecord must have the same `document_id` as that EffectiveRecord's `edition_context.document_id`.
- Regression-test findings:
  - `test/validate_derived.test.js` includes focused negative regression tests for demonstrated structural failure modes and for each of the five artifact/document identity rules.
  - The current reviewed S6 source, amendment, and effective-state artifacts are included in a positive regression and pass without modification.
  - CLI regression tests cover success, validation failure, usage failure, and unreadable configured file failure.
- Compatibility findings:
  - Current reviewed S6 derived artifacts pass `validate:derived` without modification: 4 amendment mappings and 4 EffectiveRecords.
  - Existing source-pilot and M10 validation behavior remains unchanged: `validate:pilots` validates 5 pilot bundles, and the existing source-bundle validator tests continue to pass.
  - No unintended changes were made to `structured_data/pilots/`, `structured_data/derived/`, `structured_data/schemas/guideline_bundle.schema.json`, `scripts/validate_structured_data.js`, `scripts/validate_pilots.js`, or `package-lock.json`.
- Required corrections: None.
- Unresolved items: None for Module 3.5. Remaining derived-layer model and schema decisions, including whether amendment mappings and EffectiveRecords become schema-backed or first-class model objects, remain deferred to Module 3.6.
- Validation command: `npm test` attempted first but was blocked by the local PowerShell execution policy for `npm.ps1`; equivalent Windows shim commands were then run successfully: `npm.cmd test` (67/67 pass); `npm.cmd run validate:pilots` (Validated 5 pilot bundle(s)); `npm.cmd run validate:derived` (Validated 4 amendment mapping(s) and 4 EffectiveRecord(s)); `git diff --check` (clean). Additional protected-file diff checks confirmed no unintended changes to `structured_data/pilots/`, `structured_data/derived/`, `structured_data/schemas/guideline_bundle.schema.json`, `scripts/validate_structured_data.js`, `scripts/validate_pilots.js`, or `package-lock.json`.
- Follow-up owner: Future Module 3.6 owner
- Status: Resolved

### REV-011: Phase 3 Module 3.6 Derived Contract and Phase 4 Handoff Review

- Date: 2026-07-06
- Reviewer: Repository review
- Scope reviewed: Independent review of Phase 3 Module 3.6 implementation at commit `e97f80fd4e1f77ce2b4bb908abf7a60b7beb0537`; DEC-030; `working_docs/derived_contract_module_3_6.md`; `working_docs/phase4_handoff_plan.md`; Module 3.6 and Phase 3 status documentation; consistency with existing repository decisions and validation behavior.
- Source document: Not applicable; this review covered architecture and workflow documentation rather than source-text extraction.
- Sections or pages reviewed: Not applicable.
- Files reviewed: `working_docs/decisions.md`; `working_docs/derived_contract_module_3_6.md`; `working_docs/phase4_handoff_plan.md`; `working_docs/phase3_plan.md`; `README.md`; `working_docs/review_log.md`; `working_docs/derived_layer_validator_module_3_5.md`; `working_docs/schema.md`; `structured_data/schemas/guideline_bundle.schema.json`; `scripts/validate_derived.js`; `scripts/validate_structured_data.js`; `scripts/validate_pilots.js`; `structured_data/pilots/s6_r1_species_selection.json`; `structured_data/derived/s6_r1_amendment_mappings.json`; `structured_data/derived/s6_r1_effective_records.json`.
- Decision findings:
  - DEC-030 is consistent with the approved Module 3.6 plan and existing repository decisions. It retains source model `0.2.0`, starts the independent derived contract at `derived_model_version=0.1.0`, and reserves `1.0.0` for a later stability gate after schemas, validators, migrations, and Phase 4 evidence are reviewed.
  - The source `Document` remains the canonical physical-PDF record. The derived family/edition registry references existing source `document_id` values and does not duplicate source path, checksum, version-label, or source-identity fields.
  - The documented derived core/profile boundary preserves a regulator-neutral core with ICH, FDA, and EMA profile extension points without implementing production FDA or EMA profiles.
  - Same-family synthesis is constrained: reviewed lifecycle relationships may support reviewed EffectiveRecords; unresolved lifecycle relationships may produce only candidate `needs_review` EffectiveRecords and must not automatically supersede or replace existing effective state.
  - Review attestations, non-inventive legacy review migration, versioned RiskAssessment history, aggregate `review_status`, `include_needs_review` disclosures, and `reviewed_only` strict mode are documented consistently with the approved plan.
  - EffectiveStateSnapshot identity is separated from execution metadata: identity derives from family, jurisdiction, `as_of_date`, review policy, derived contract version, source corpus identity, and calculation-policy version; `calculated_at` is metadata only.
- Phase 4 boundary findings:
  - `working_docs/phase4_handoff_plan.md` keeps Phase 4 planned and not started.
  - The handoff processes exactly one PDF per extraction run, supports cumulative family history, preserves historical effective states, and prohibits simultaneous multi-PDF extraction and automatic unreviewed cross-document synthesis.
  - The Phase 4 modules preserve layered validation: source schema and cross-object validation, derived schema validation, derived cross-object validation, risk/review-policy validation, and snapshot identity and history validation.
- Compatibility findings:
  - Source model `0.2.0`, source JSON Schema, source validation, M10 validation, pilot validation, derived validator code, tests, dependencies, structured data, and PDFs remain unchanged by this review.
  - Current reviewed S6 source and derived artifacts continue to pass existing validation without modification.
- Required corrections: None. Status documentation was updated after successful review to record REV-011, mark Module 3.6 complete, and mark Phase 3 complete while keeping Phase 4 planned and not started.
- Unresolved items: None for Module 3.6 or Phase 3. Derived schemas, migrations, validator extensions, artifact migrations, Phase 4 engine implementation, FDA/EMA production profiles, UI, answer generation, and full applicability ontology remain deferred to Phase 4 or later approved work.
- Validation command: `npm.cmd test` (67/67 pass); `npm.cmd run validate:pilots` (Validated 5 pilot bundle(s)); `npm.cmd run validate:derived` (Validated 4 amendment mapping(s) and 4 EffectiveRecord(s)); `git diff --check` (clean); protected-file diff checks for `structured_data/`, `structured_data/schemas/guideline_bundle.schema.json`, `scripts/`, `test/`, `package.json`, `package-lock.json`, and `Guideline Files/` (no unintended changes).
- Follow-up owner: Phase 4 owner
- Status: Resolved

### REV-013a: Phase 4 Rebaseline R0 Review

- Date: 2026-07-13
- Reviewer: Repository review
- Scope reviewed: Independent review of the pre-Module-4.2 architecture audit and Rebaseline R0: reconciliation of the Phase 4 module authority between `working_docs/phase4_handoff_plan.md` and `working_docs/phase4_plan.md`; consolidation of the artifact-authority boundary statement; the CI validation gap closure; and decisions DEC-049 (governance-policy staging with concrete 4.5/4.7 gates), DEC-050 (S6(R1) single integrated-package DocumentEdition), DEC-051 (registry source-Document bootstrap and multi-bundle manifest support), and DEC-052 (production-vs-frozen `structured_data/derived/` path boundary). R0 is documentation, CI configuration, and decision recording only; no schema, structured-data, or validator-behavior change is in scope for this review.
- Source document: Not applicable; this review covered planning documentation, decision records, and CI configuration rather than source-text extraction.
- Sections or pages reviewed: Not applicable.
- Files reviewed: `working_docs/phase4_handoff_plan.md`; `working_docs/phase4_plan.md`; `README.md`; `working_docs/phase4_module_4_1.md`; `working_docs/decisions.md`; `.github/workflows/validate.yml`; `working_docs/project_scope.md`.
- Findings:
  - `phase4_handoff_plan.md`'s superseded "Ordered Phase 4 modules" section (a 4.1-4.10 list with different module boundaries than the concretized plan) is replaced with a pointer naming `phase4_plan.md` as sole module authority; the handoff's milestones, processing boundary, impact-analysis strategy, and deferred-work sections are retained unchanged.
  - The artifact-authority boundary is now stated once, in `README.md`; `phase4_module_4_1.md` references it instead of restating it.
  - `.github/workflows/validate.yml` now runs `npm run validate:derived` and `npm run validate:legacy` in addition to `npm test` and `npm run validate:pilots`, closing the prior CI gap over the derived contract and the frozen Phase 3 prototypes.
  - DEC-049 stages Risk/Review governance: Modules 4.2-4.6 use Risk/Review only as schema-conformant structures with basic reference integrity; Module 4.5 is gated on a risk-policy decision and Module 4.7 on a review-aggregation decision, the latter also required to resolve the ReviewAttestation artifact-identity/linkage gap logged as known gap G1.
  - DEC-050 fixes the S6(R1) registry model as one GuidanceFamily, one DocumentEdition (`edition_role=integrated_package`), one EditionSource, and no LifecycleRelationship, consistent with the existing DEC-022/DEC-024 single-physical-Document finding and the DEC-043 self-relation prohibition.
  - DEC-051 bootstraps registry source-Document identity from the existing reviewed pilot bundles (no fabricated identity; frozen pilots unchanged) and authorizes an additive multi-`source_bundles` manifest extension to `scripts/validate_derived.js`, preserving the existing single-`source_bundle` behavior.
  - DEC-052 fixes production derived artifacts (registry, and later risk/review/snapshot) under typed subfolders of `structured_data/derived/`, leaving the two frozen Phase 3 prototype files at their current root-level paths, unmoved.
  - A known contract gaps register (G1-G4) is added to `phase4_plan.md`, naming each gap, its resolution decision, and the module gate that applies.
- Compatibility findings: No schema, structured-data, or validator-code change was made in R0. `npm test` (139/139 pass), `npm run validate:pilots` (5 pilot bundles), `npm run validate:legacy` (4 legacy amendment mappings, 4 legacy EffectiveRecords), and `npm run validate:derived` (1 AmendmentMapping, 1 EffectiveRecord against the existing `complete_graph` fixture) all match REV-012 output exactly. `Guideline Files/`, `structured_data/schemas/guideline_bundle.schema.json`, `structured_data/pilots/`, and the two frozen `structured_data/derived/*.json` prototypes are unchanged.
- Required corrections: None.
- Unresolved items: None for Rebaseline R0. Module 4.2 implementation (registry artifacts, multi-bundle manifest support, structural snapshot validation, candidate-only vertical-slice fixtures) remains to be completed and separately reviewed under REV-013b.
- Validation command: `npm test` (139/139 pass); `npm run validate:pilots` (Validated 5 pilot bundle(s)); `npm run validate:legacy` (Validated 4 legacy amendment mapping(s) and 4 legacy EffectiveRecord(s)); `npm run validate:derived` (Validated contract graph with 1 AmendmentMapping record(s) and 1 EffectiveRecord record(s)); `git diff --check` (clean); protected-file diff against the REV-012 base for `Guideline Files`, `structured_data/schemas/guideline_bundle.schema.json`, `structured_data/pilots`, and the two Phase 3 derived prototypes (no changes).
- Follow-up owner: Module 4.2 owner
- Status: Resolved

### REV-013b: Phase 4 Module 4.2 Family Registry, Lifecycle Artifacts, and Candidate Value-Path Slice Review

- Date: 2026-07-13
- Reviewer: Repository review
- Scope reviewed: Independent completion-gate review of Phase 4 Module 4.2: production family/edition
  registry for both official corpus documents; the additive multi-bundle manifest extension to
  `scripts/validate_derived.js` (DEC-051); structural EffectiveStateSnapshot graph validation brought
  forward from Module 4.8; and two candidate-only, fixture-first vertical-slice scenarios (`m10_direct_slice`,
  `s6_amendment_slice`) demonstrating the registry-to-derived-to-snapshot path against real, reviewed
  M10 and S6 pilot content. Confirmed the Module 4.2 completion gate in `working_docs/phase4_plan.md`
  and the R0 decisions (DEC-049 through DEC-052) it implements.
- Source document: Not applicable; this review covered derived-layer registry artifacts, validator
  code, fixtures, tests, and status documentation rather than source-text extraction.
- Sections or pages reviewed: Not applicable.
- Files reviewed: `structured_data/derived/registry/guidance_family.json`;
  `structured_data/derived/registry/document_edition.json`;
  `structured_data/derived/registry/edition_source.json`;
  `structured_data/derived/registry/manifest.json`; `scripts/validate_derived.js`;
  `test/validate_derived.test.js`; `test/fixtures/derived_contract/m10_direct_slice/`;
  `test/fixtures/derived_contract/s6_amendment_slice/`;
  `test/fixtures/derived_contract/invalid/source_bundle_and_source_bundles.json`; `package.json`;
  `.github/workflows/validate.yml`; `working_docs/phase4_module_4_2.md`; `working_docs/phase4_plan.md`;
  `working_docs/decisions.md`; `README.md`; `working_docs/project_scope.md`.
- Findings:
  - Registry identity (`gf.ich_m10`, `gf.ich_s6r1`, and their edition/edition-source IDs) is
    semantic and guideline-code-based, independent of `Guideline Files/` filenames. No source
    `Document` path, checksum, or version-label field is duplicated into the registry; this is
    enforced structurally by the closed (`additionalProperties: false`) registry schemas, confirmed
    by a positive schema-rejection test rather than a new validator rule.
  - The S6(R1) registry uses exactly one GuidanceFamily, one DocumentEdition
    (`edition_role=integrated_package`), and one EditionSource, with no LifecycleRelationship
    artifact, consistent with DEC-050 and the existing DEC-022/DEC-024 single-physical-Document
    finding and the DEC-043 self-relation prohibition.
  - The multi-bundle manifest extension is additive: `resolveManifestSourcePaths` accepts the
    existing singular `source_bundle` or the new plural `source_bundles`, rejects combining both,
    reuses the existing `validateBundles` cross-file rules (DEC-018) per bundle, and merges validated
    bundles via `mergeSourceBundles` before graph validation. The existing single-`source_bundle`
    `complete_graph` fixture behavior is unchanged and re-verified. The production two-document
    registry validates against all three bootstrap pilot bundles (`m10_3_2_5_2.json`, `m10_6_1.json`,
    `s6_r1_species_selection.json`) via `structured_data/derived/registry/manifest.json` and
    `npm run validate:registry`.
  - Structural EffectiveStateSnapshot validation (`validateContractSnapshots`) resolves
    `guidance_family_id` and `effective_record_ids` members against supplied artifacts and rejects a
    member EffectiveRecord from a different family, without implementing tier, aggregation, or
    disclosure policy (confirmed deferred to Module 4.8).
  - Both candidate slices validate end to end against real pilot content: `m10_direct_slice` produces
    one `derivation_basis=direct_source` EffectiveRecord and one snapshot from
    `structured_data/pilots/m10_6_1.json`; `s6_amendment_slice` produces one AmendmentMapping and one
    `derivation_basis=amendment_synthesis` EffectiveRecord (with ICH
    `ich_derivation_detail=parent_addendum_synthesis`) and one snapshot from
    `structured_data/pilots/s6_r1_species_selection.json`. All slice records carry
    `review_status=needs_review` and no slice output claims reviewed or production status.
  - The S6 slice's AmendmentMapping (`slice.s6.amend.001`) reconciles without unexplained semantic
    divergence against the frozen Phase 3 prototype `ich_s6_r1.amend.001`
    (`structured_data/derived/s6_r1_amendment_mappings.json`, reviewed `reviewed` in REV-005): same
    `relation_type=clarifies`, same Parent and Addendum `KnowledgeRecord` endpoints. The frozen
    prototype file itself is unread-only referenced and remains byte-identical.
  - RiskAssessment and ReviewAttestation remain schema-only; no production instances were created;
    `current_risk_assessment_id` is `null` on every Module 4.2 registry record, consistent with
    DEC-044 and the DEC-049 governance staging gate.
- Compatibility findings: Source model `0.2.0`, `structured_data/schemas/guideline_bundle.schema.json`,
  `structured_data/pilots/`, `Guideline Files/`, and both frozen Phase 3 prototype files
  (`structured_data/derived/s6_r1_amendment_mappings.json`,
  `structured_data/derived/s6_r1_effective_records.json`) are unchanged relative to the REV-013a base
  (protected-file diff returned no changes). `package-lock.json` is unchanged.
- Required corrections: None.
- Unresolved items: None for Module 4.2. Module 4.5 (risk) and Module 4.7 (review) remain gated on
  their DEC-049 governance-policy decisions, the latter also required to resolve the ReviewAttestation
  artifact-identity/linkage gap (known gap G1). Full production source bundles (Modules 4.4/4.10) will
  later supersede the pilot-bootstrapped source Document identity additively.
- Validation command: `npm test` (152/152 pass); `npm run validate:pilots` (Validated 5 pilot
  bundle(s)); `npm run validate:legacy` (Validated 4 legacy amendment mapping(s) and 4 legacy
  EffectiveRecord(s)); `npm run validate:derived` (Validated contract graph with 1 AmendmentMapping
  record(s) and 1 EffectiveRecord record(s), unchanged from REV-012); `npm run validate:registry`
  (Validated contract graph with 0 AmendmentMapping record(s) and 0 EffectiveRecord record(s));
  `node scripts/validate_derived.js --manifest test/fixtures/derived_contract/m10_direct_slice/manifest.json`
  (1 EffectiveRecord record); `node scripts/validate_derived.js --manifest test/fixtures/derived_contract/s6_amendment_slice/manifest.json`
  (1 AmendmentMapping record, 1 EffectiveRecord record); `git diff --check` (clean); protected-file
  diff against the REV-013a base for `Guideline Files`, `structured_data/schemas/guideline_bundle.schema.json`,
  `structured_data/pilots`, the two Phase 3 derived prototypes, and `package-lock.json` (no changes).
- Follow-up owner: Module 4.3 owner
- Status: Resolved

### REV-012: Phase 4 Module 4.1 Derived Contract Schema Scaffold Review

- Date: 2026-07-06
- Reviewer: Repository review
- Scope reviewed: Independent completion-gate review of Phase 4 Module 4.1 at commit `b7d821cc4d9a6122c5eb7108a8ab200c0fa8d1f2`. Confirmed that the derived contract schema scaffold, production contract validator, source-bundle revalidation, source-unit evidence requirements, global contract ID uniqueness, predecessor-history integrity, and partial EditionSource handling express the Module 3.6 contract without expanding it, and that the Module 4.1/4.2 scope boundary and Phase 1-3 regression-reference boundary hold.
- Source document: Not applicable; this review covered derived-layer schemas, validator code, fixtures, tests, and status documentation rather than source-text extraction.
- Sections or pages reviewed: Not applicable.
- Files reviewed: `scripts/validate_derived.js`; `scripts/validate_legacy_derived.js`; `scripts/validate_structured_data.js`; `structured_data/schemas/derived/core.schema.json`; `structured_data/schemas/derived/artifacts/*.schema.json`; `structured_data/schemas/derived/profiles/ich.schema.json`; `test/validate_derived.test.js`; `test/fixtures/derived_contract/`; `working_docs/phase4_module_4_1.md`; `working_docs/phase4_plan.md`; `working_docs/decisions.md`; `working_docs/review_log.md`; `README.md`; `working_docs/project_scope.md`.
- Findings:
  - Production and legacy validation are separated: `scripts/validate_derived.js` is contract-manifest based and contains no Phase 3 prototype paths or filename dispatch; `scripts/validate_legacy_derived.js` retains the Module 3.5 legacy behavior exposed by `npm run validate:legacy`.
  - The manifest validator revalidates the supplied source bundle with the source model `0.2.0` validator (`validateBundles`) before derived validation. Order is source schema and source cross-object validation, then derived artifact schema validation, then derived contract graph validation; a source-validation failure stops before graph validation. Confirmed end to end: an invalid source bundle fails `validate:derived` with only the source error, and the derived graph error that would otherwise appear does not.
  - LifecycleRelationship, AmendmentMapping, and EffectiveRecord `source_references` accept only source-unit-level references requiring `document_id`, `section_id`, and `source_unit_id` together (`sourceUnitLevelSourceRef`); the separate `documentLevelSourceRef` shape carries only `document_id`. No source text or page fields were re-added to derived artifacts.
  - Global contract ID uniqueness is enforced within a file, across files of one artifact type, and across artifact types.
  - Predecessor-history integrity rejects self-references and cycles, and a supplied predecessor must share the referencing record's `artifact_type`; predecessor IDs absent from the supplied graph are allowed as historical lineage.
  - Partial EditionSource coverage is rejected per record: authorization is skipped when no referenced edition has an EditionSource, runs when all do, and fails with an incomplete-registry error when only some do, for LifecycleRelationship from/to editions, AmendmentMapping source/amending editions, and EffectiveRecord own edition plus referenced AmendmentMapping editions. Whole-of-production registry completeness remains Module 4.2 scope.
  - The Phase 1-3 prototypes are regression references and audit history only, and are never production predecessor or successor targets; documentation states this consistently.
  - The Module 4.1/4.2 scope boundary holds: Module 4.1 fixes the structural contract and generic graph rules; production registry data and reviewed controlled vocabularies remain Module 4.2 scope.
- Compatibility findings:
  - Source model `0.2.0`, `structured_data/schemas/guideline_bundle.schema.json`, `structured_data/pilots/`, and the frozen Phase 3 prototypes `structured_data/derived/s6_r1_amendment_mappings.json` and `structured_data/derived/s6_r1_effective_records.json` are unchanged relative to base commit `0d143a375176f2e7522ff1d7e0310f53f658f780` (protected-file diff returned no changes).
- Required corrections: None.
- Unresolved items: None for Module 4.1. Production registry data and completeness, risk assessment, review attestation, snapshot, ingest, extraction, orchestration, UI, FDA/EMA production profiles, and derived contract `1.0.0` remain deferred to Module 4.2 and later Phase 4 modules.
- Validation command: `npm.cmd test` (139/139 pass); `npm.cmd run validate:pilots` (Validated 5 pilot bundle(s)); `npm.cmd run validate:legacy` (Validated 4 legacy amendment mapping(s) and 4 legacy EffectiveRecord(s)); `npm.cmd run validate:derived` (Validated contract graph with 1 AmendmentMapping record(s) and 1 EffectiveRecord record(s)); `git diff --check` (clean); protected-file diff against `0d143a375176f2e7522ff1d7e0310f53f658f780` for `Guideline Files`, `structured_data/schemas/guideline_bundle.schema.json`, `structured_data/pilots`, and the two Phase 3 derived prototypes (no changes). `npm.cmd run validate` requires explicit file arguments and was not run bare; full source-validator behavior is exercised through `validate:pilots` and the `validate:derived` source-bundle revalidation.
- Follow-up owner: Phase 4 owner
- Status: Resolved
