# Amendment and Effective-State Strategy

## Purpose

This document defines the Phase 3 design baseline for guidelines with Parent and Addendum material. It preserves three distinct layers:

1. immutable source records;
2. reviewed Parent-Addendum amendment mappings;
3. reviewed current effective-state records derived from all applicable sources.

This is a provisional derived-layer strategy. It does not add amendment or effective objects to the JSON Schema and does not modify source model `0.2.0`.

## Source layer

The source layer preserves official source text and provenance.

- Preserve Parent and Addendum source text independently.
- Never overwrite or rewrite Parent records with Addendum wording.
- Maintain exact Part, section, source text, and PDF provenance.
- For an integrated package, use one physical current `Document`.
- Use Part-aware IDs because numbering may restart:
  - `ich_s6_r1.sec.part1...`
  - `ich_s6_r1.sec.part2...`
  - equivalent Part-aware `SourceUnit` IDs.
- Treat source cross-references as source records, not amendment mappings.
- Treat Korean normalized text as source-preserving normalization only when it is added to reviewed source-derived semantic records.

## Source precedence rule

Use official consolidated text when an official textually consolidated edition is available. Otherwise, derive the effective state from reviewed Parent-Addendum mappings. Never silently treat an integrated package as textually consolidated.

## Amendment layer

The amendment layer contains reviewed analyst mappings between Addendum and Parent `KnowledgeRecord` objects. These mappings are derived analysis, not source text.

Provisional relation types:

- `supplements`: the Addendum adds related guidance without changing the Parent record.
- `clarifies`: the Addendum explains or disambiguates a Parent record.
- `modifies`: the Addendum changes how a Parent record should be understood.
- `narrows`: the Addendum limits applicability or scope of a Parent record.
- `broadens`: the Addendum expands applicability or scope of a Parent record.
- `replaces`: the Addendum substitutes different guidance for a Parent record in the mapped scope.
- `supersedes`: the Addendum makes a Parent record no longer current in the mapped scope.
- `conflicts_with`: the Addendum appears inconsistent with a Parent record and requires review before an effective state can be treated as reviewed.

Use record-level mappings by default. Section-level mappings are allowed only as provisional placeholders before record-level mapping is available, and they must remain clearly marked as not yet record-level reviewed.

## Effective-state layer

The effective-state layer contains reviewed synthesis derived from source records and reviewed amendment mappings.

Provisional `EffectiveRecord` concept:

- stable ID;
- contributing source-record IDs;
- amendment-relation IDs;
- effective English text;
- optional Korean text;
- edition/version context;
- synthesis rationale;
- effective status;
- review status.

Rules:

- Effective text is reviewed synthesis, never verbatim source.
- Every effective statement must trace to all contributing records.
- Source records remain immutable.
- `conflicts_with` or unresolved mappings prevent a reviewed effective state.
- A future review UI may show the effective state first, with direct access to Parent and Addendum sources.

## Source-availability scenarios

### Integrated package

An integrated package is a single official PDF that contains Parent and Addendum as separate Parts, but the Addendum changes are not incorporated directly into the Parent body text.

Rules:

- Use one physical current `Document`.
- Preserve separate Part, Section, and `SourceUnit` provenance.
- Require amendment mappings to relate applicable Addendum records to Parent records.
- Derive reviewed effective state from applicable Parent and Addendum records.

The local `Guideline Files/ICH S6.pdf` is classified as an integrated package.

### Textually consolidated edition

A textually consolidated edition is an official edition that incorporates amendment wording directly into the operative body text.

Rules:

- Designate the consolidated edition as the canonical current source.
- Retain Parent and standalone Addendum documents as historical or supporting sources.
- Create current source records directly from the consolidated text.
- Do not generate duplicate canonical semantic records by re-synthesizing Parent and Addendum.
- Amendment mappings may remain for history and change explanation.

### Separate Parent and Addendum PDFs

Use separate physical `Document` records for each immutable PDF. Preserve each source independently with its own checksum, source file path, page indexes, printed page labels, and section IDs. Amendment mappings connect records across the two documents and must not collapse their source provenance.

When no official textually consolidated edition is available, reviewed effective state is derived from reviewed Parent-Addendum mappings.

### Parent, Addendum, and official consolidated edition all available

Preserve each physical source as its own `Document`. Designate the official textually consolidated edition as the canonical current source and create current source records directly from its text. Retain Parent and standalone Addendum documents as historical or supporting sources, and use amendment mappings for history and change explanation rather than generating duplicate canonical semantic records by re-synthesizing Parent and Addendum.

Conflicts between consolidated wording, Parent records, and Addendum mappings require review before historical mappings or explanatory notes are marked reviewed.
