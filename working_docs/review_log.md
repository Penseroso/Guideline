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
