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
- For an integrated S6(R1) PDF, use one physical `Document`.
- Use Part-aware IDs because numbering may restart:
  - `ich_s6_r1.sec.part1...`
  - `ich_s6_r1.sec.part2...`
  - equivalent Part-aware `SourceUnit` IDs.
- Treat source cross-references as source records, not amendment mappings.
- Treat Korean normalized text as source-preserving normalization only when it is added to reviewed source-derived semantic records.

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

### Integrated Parent and Addendum PDF

Use one physical `Document` for the immutable PDF. Preserve Parent and Addendum source units separately through Part-aware sections, Part-aware source-unit IDs, printed page labels, and zero-based PDF page indexes. Amendment mappings and effective-state records are derived later and must reference the preserved source records.

### Separate Parent and Addendum PDFs

Use separate physical `Document` records for each immutable PDF. Preserve each source independently with its own checksum, source file path, page indexes, printed page labels, and section IDs. Amendment mappings connect records across the two documents and must not collapse their source provenance.

### Parent, Addendum, and official consolidated edition all available

Preserve each physical source as its own `Document`. Treat the official consolidated edition as a source document with its own provenance, not as a replacement for Parent or Addendum records. Effective-state synthesis may use the consolidated edition as contributing evidence only when its source role and edition context are explicit. Conflicts between consolidated wording, Parent records, and Addendum mappings require review before a reviewed effective state is created.
