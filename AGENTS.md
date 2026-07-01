# Regulatory Guideline Archive

## Objective

Build an objective, traceable, and reusable structured-data archive of regulatory guidelines.

The current pilot document is ICH M10. The project is an archive and knowledge-structuring project, not a regulatory decision engine.

## Source hierarchy

1. Original guideline PDF
2. Official addenda, Q&A, or training materials
3. Structured source text extracted from the original
4. Korean normalized text
5. Interpretation or review notes

Lower-level materials must never overwrite or be represented as higher-level source authority.

## Directory contract

* `Guideline Files/`: immutable original source PDFs
* `structured_data/`: machine-readable structured outputs and schemas
* `working_docs/`: project scope, schema definitions, extraction rules, decisions, and review logs
* `scripts/`: reproducible extraction and validation scripts
* `.agents/skills/`: reusable workflows only after the workflow has been validated

## Source integrity

* Never modify, rename, move, or overwrite files in `Guideline Files/`.
* Do not create regulatory requirements that are not present in the source.
* Preserve sufficient source text to verify every structured record.
* Every structured record must be traceable to a document, section, and PDF page.
* Distinguish the physical PDF page index from the printed page number when both are available.
* Preserve tables, footnotes, exceptions, and cross-references as separate entities when material.

## Data separation

Keep the following fields conceptually and structurally separate:

* source text
* Korean normalized text
* quantitative criteria
* conditions and applicability
* exceptions
* footnotes
* cross-references
* interpretation or review notes

`normalized_ko` must preserve the meaning of the source. It must not contain additional recommendations, explanations, or inferred requirements.

Use `null`, `unknown`, or `needs_review` when the source does not support a confident value.

## Regulatory language

Do not automatically convert descriptive text into a requirement.

Distinguish, where supported by the source:

* must
* should
* may
* recommendation
* description

Preserve the original modal verb or wording in the source record.

## Workflow

* Inspect relevant source and project documentation before editing.
* For complex or ambiguous work, prepare a plan before implementation.
* Structure a small representative sample before processing a full document.
* Do not expand the assigned section range without explicit instruction.
* Update `working_docs/schema.md` when the data model changes.
* Record material design decisions in `working_docs/decisions.md`.
* Run the relevant validation script after modifying structured data.
* Review the Git diff before declaring completion.

## Validation

A task is not complete until the validation checks that exist and apply to the changed files have been run and reported. Do not claim unavailable validation passed; report unavailable checks as `not yet available` and irrelevant checks as `not applicable`.

For structured data changes, applicable checks include:

* structured files are syntactically valid
* schema validation passes
* IDs are unique
* references resolve to existing entities
* required source-traceability fields are present
* unresolved items are marked `needs_review`
* validation commands and results are reported

JSON Schema and validation-script checks are mandatory once those artifacts exist and structured data is changed.

## Completion report

At the end of each task, report only:

1. Files changed
2. Validation commands and results
3. Items requiring human review
4. Scope intentionally not completed

## Current exclusions

Do not implement unless explicitly requested:

* regulatory suitability conclusions
* study-design recommendations
* automated decision making
* Go/No-Go judgments
* scoring systems
* a web application
* extraction of the entire guideline in one uncontrolled pass
