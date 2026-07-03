# PDF Assessment: ICH S6(R1)

## Source file

- File path: `Guideline Files/ICH S6.pdf`
- Exact filename: `ICH S6.pdf`
- File size: 271,514 bytes
- SHA-256: `05C41D25575259D9C931FCAD33A8227089A8B2F704C0922C0B5F7F411D812E22`
- PDF page count: 23 physical pages, with zero-based PDF page indexes `0` through `22`

## Visible publication identity

- Issuing body: International Conference on Harmonisation of Technical Requirements for Registration of Pharmaceuticals for Human Use
- Title: `Preclinical Safety Evaluation of Biotechnology-Derived Pharmaceuticals`
- Guideline code and version: `S6(R1)`
- Document type: `ICH Harmonised Tripartite Guideline`
- Parent Guideline date: 16 July 1997
- Current version: Step 4
- Addendum date: 12 June 2011
- Addendum incorporation statement: incorporated at the end of June 2011
- Document history states that the Addendum was incorporated into the parent Guideline, which is now renamed `S6(R1)`.

## Integrated Parent and Addendum status

The local PDF is an integrated S6(R1) PDF containing both the Parent Guideline and the Addendum. It should be represented as one physical `Document` because there is one immutable source file, while preserving separate Part provenance for Parent and Addendum source records.

## Part boundaries and numbering risks

- Front matter:
  - PDF index `0`: cover page.
  - PDF index `1`: document history.
  - PDF indexes `2` and `3`: table of contents, printed labels `i` and `ii`.
- Part I:
  - Starts at PDF index `4`, printed page label `1`.
  - Covers the Parent Guideline.
  - Ends at PDF index `12`, printed page label `9`, with notes.
- Part II:
  - Starts at PDF index `13`, printed page label `10`.
  - Covers the Addendum to S6.
  - Ends at PDF index `22`, printed page label `19`, with references.

Section numbering restarts in Part II. For example, Part I has sections `1`, `1.1`, `1.2`, and `1.3`, and Part II also has sections `1`, `1.1`, `1.2`, and `1.3`. Any S6 IDs must be Part-aware, such as `ich_s6_r1.sec.part1.3_3` and `ich_s6_r1.sec.part2.2_1`, with equivalent Part-aware `SourceUnit` IDs.

## Printed page labels versus PDF indexes

The PDF uses front matter pages without body page labels, Roman-labeled table of contents pages, and Arabic body labels:

- PDF index `0`: cover, no printed page label observed.
- PDF index `1`: document history, no printed page label observed.
- PDF index `2`: printed label `i`.
- PDF index `3`: printed label `ii`.
- PDF indexes `4` through `22`: printed labels `1` through `19`.

Structured records should store the physical zero-based PDF index and the printed page label separately.

## Text extraction quality

Ghostscript `txtwrite` extraction produced usable text from the PDF, so OCR is not the primary path. Extraction quality is acceptable for assessment and targeted sampling, but not clean enough for unsupervised structured extraction.

Observed issues:

- Some initial capital letters are separated or misplaced, for example `Biotechnology` can appear as `IOTECHNOLOGY` plus a separate `B`.
- Nonbreaking spaces or bullet-like spacing markers appear as mojibake placeholder characters in extracted text.
- Headers, footers, and page numbers are extracted with body text.
- Table of contents leader dots and page labels are extracted as text and could be mistaken for body source units.
- Multi-line paragraphs and list items need manual reconstruction checks.

## Tables, figures, footnotes, appendices, and cross-references

- Tables:
  - The document history is table-like front matter.
  - The table of contents is table-like but should not be mistaken for source body records.
  - No body data table was identified during this assessment sample.
- Figures:
  - No figures were identified during this assessment sample.
- Footnotes:
  - No conventional bottom-of-page footnotes were identified during this assessment sample.
  - Part I and Part II contain `Notes` sections that should be modeled as source sections and source units, not footnotes, unless a later pilot identifies actual footnote behavior.
- Appendices:
  - No appendix section was identified during this assessment sample.
- Cross-references:
  - Internal references include parent/addendum section references and note references.
  - External references include ICH S5(R2), S1A, M3(R2), and S9.
  - References in Part II can modify or clarify understanding of Part I, so source cross-references must remain separate from analyst amendment mappings.

## Likely model `0.2.0` pressure points

Model `0.2.0` should be retained for the first S6 source-layer pilot, but S6(R1) is likely to pressure the workflow in these areas:

- Part-aware source identity because Parent and Addendum numbering restarts.
- Distinguishing one physical `Document` from two logical source parts.
- Preserving source records independently from later amendment and effective-state derived layers.
- Separating source cross-references from reviewed amendment mappings.
- Handling dense applicability conditions involving species, pharmacological relevance, product class, clinical use, and development stage.
- Capturing notes and references as source units without treating analyst synthesis as source text.
- Avoiding premature conversion of descriptive or rationale text into requirements.

These are workflow and derived-layer pressure points, not demonstrated source model `0.2.0` failures.

## Recommended small Parent-Addendum pilot scope

Recommended pilot scope for later modules:

- Parent source area: Part I section `3.3 Animal Species/Model Selection`.
- Addendum source area: Part II sections `2 Species Selection`, `2.1 General Principles`, and `2.2 One or Two Species`.

This scope is small, has clear Parent and Addendum relationship potential, includes repeated numbering risk, and is suitable for testing source-layer preservation before any reviewed amendment or effective-state prototype.

Do not expand this into full-guideline extraction without explicit instruction.
