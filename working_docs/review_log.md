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
