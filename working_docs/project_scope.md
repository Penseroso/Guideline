# Project Scope

## Mission and Product Value

Build a traceable regulatory knowledge archive that preserves official guideline source text and supports reusable structured records. The archive should help users find relevant regulatory statements, understand requirements, quantitative criteria, conditions, and exceptions, verify results against exact source text and PDF locations, compare related content across sections and later documents, and reuse reviewed structured information.

## Users and Initial Product Target

The primary users are internal reviewers and analysts who need to inspect and verify regulatory guideline content. The initial product target is a hallucination-resistant conversational guideline assistant: a chat interface that answers regulatory questions from the structured archive with mandatory source citation, refusing or flagging uncertainty rather than inventing content. Full target-product-profile detail lives in `working_docs/product_roadmap.md`.

## Canonical Data and Design Principles

Canonical sources are immutable official PDFs and reviewed, Git-managed structured JSON. Databases, search indexes, embeddings, retrieval context, comparison views, and application data are derived and reproducible.

The foundation must preserve source traceability, separate source-derived records from analyst-derived mappings or interpretations, support multiple documents and coexisting document versions, and remain compatible with future cross-document comparison.

## Current Status

See `working_docs/milestone_log.md` for the active, up-to-date status and decision record — it is updated with every roadmap milestone, this file is not. For historical Phase 0-4 process narration (superseded), see `history/README.md`.

## Non-Goals

The following remain outside scope unless explicitly requested, because they are a product-boundary decision (what the assistant is allowed to conclude), not an implementation-layer decision (what gets built):

- Regulatory suitability conclusions.
- Study-design recommendations.
- Automated decision making.
- Go/No-Go judgments.
- Scoring systems.

Schema changes and extraction-automation changes are live decisions requiring a `working_docs/milestone_log.md` entry, not pre-ruled-out — see `working_docs/schema.md`'s evidence-first extension policy.
