# Effective-State Prototype: ICH S6(R1) Species Selection

Status: implemented pending repository review. This Module 3.4 prototype creates provisional derived-layer `EffectiveRecord` objects, but it does not mark them reviewed and does not complete Module 3.4.

This artifact is analyst-derived synthesis, not source text. It does not change source model `0.2.0`, the JSON Schema, the validator, the source-layer S6 pilot, or the amendment-mapping artifact.

## Artifacts

- Machine-readable sample: `structured_data/derived/s6_r1_effective_records.json`
- Source records referenced: `structured_data/pilots/s6_r1_species_selection.json`
- Amendment mappings referenced: `structured_data/derived/s6_r1_amendment_mappings.json`

The sample lives under `structured_data/derived/`, outside `structured_data/pilots/`, because `scripts/validate_pilots.js` validates source bundles only. EffectiveRecords are provisional derived-layer artifacts and are not part of the current source bundle schema or validator.

## Field structure

Each EffectiveRecord uses the following provisional fields:

- `effective_record_id`
- `effective_status`
- `review_status`
- `edition_context`
- `amendment_relation_ids`
- `knowledge_record_ids`
- `condition_ids`
- `quantitative_criterion_ids`
- `cross_reference_ids`
- `source_unit_ids`
- `effective_text_en`
- `normalized_ko`
- `synthesis_rationale`
- `representation_limitations`

Provenance is separated by object type to keep the synthesis auditable without changing model `0.2.0`. `normalized_ko` is `null` for every record in this prototype.

## Prototype records

The prototype contains exactly four independently reviewable operative propositions.

| EffectiveRecord | Purpose | Review status |
| --- | --- | --- |
| `ich_s6_r1.eff.part2.2_2.short_term_two_species` | `amend.002` short-term two-species rule with a material condition and quantitative criterion | `needs_review` |
| `ich_s6_r1.eff.part2.2_1.no_relevant_species_pathway` | `amend.003` no-relevant-species pathway; Parent recommendation clarified by Addendum precondition | `needs_review` |
| `ich_s6_r1.eff.part2.2_1.animal_tcr_species_selection` | `amend.004` animal-tissue TCR role; explicit Note 1 context and cross-reference provenance | `needs_review` |
| `ich_s6_r1.eff.part2.notes.adc_unconjugated_toxin_short_term` | Addendum-only ADC unconjugated-toxin short-term study rule | `needs_review` |

All four records use `effective_status=current` because the Addendum is part of the applicable current S6(R1) integrated package. All four records remain `review_status=needs_review` because the implementation task creates and structurally validates the synthesis but does not perform the independent repository review required to accept it.

## Synthesis notes

### Short-term two-species rule

- Amendment relation: `ich_s6_r1.amend.002`
- Source contribution: Parent `ich_s6_r1.kr.part1.3_3.006`; Addendum `ich_s6_r1.kr.part2.2_2.001`
- Material condition: `ich_s6_r1.cond.part2.2_2.001`
- Material quantitative criterion: `ich_s6_r1.qc.part2.2_2.004`

The effective text preserves the Addendum source modality `should be used` and does not weaken it to descriptive wording.

### No-relevant-species pathway

- Amendment relation: `ich_s6_r1.amend.003`
- Source contribution: Parent `ich_s6_r1.kr.part1.3_3.010`; Addendum `ich_s6_r1.kr.part2.2_1.009`
- Material conditions: `ich_s6_r1.cond.part1.3_3.007`; `ich_s6_r1.cond.part2.2_1.004`
- Cross-reference provenance: `ich_s6_r1.xref.part2.2_1.002`

The Parent `should be considered` recommendation remains operative. The Addendum's `can be considered` wording is treated as a clarifying restatement of the same pathway and supplies the orthologous-target precondition; it is not treated as a superseding reduction in normative force.

### Animal-tissue TCR species-selection role

- Amendment relation: `ich_s6_r1.amend.004`
- Source contribution: Parent `ich_s6_r1.kr.part1.3_3.004` and `.005`; Addendum `ich_s6_r1.kr.part2.2_1.007`, `.008`, `ich_s6_r1.kr.part2.notes.005`, and `.014`
- Material conditions: `ich_s6_r1.cond.part1.3_3.002`, `.003`, `ich_s6_r1.cond.part2.2_1.003`, and `ich_s6_r1.cond.part2.notes.002`
- Cross-reference provenance: `ich_s6_r1.xref.part2.2_1.001`

The effective text preserves `can be used`, rather than normalizing it to `may`. The Note 1 source anchor included in this EffectiveRecord is `ich_s6_r1.su.part2.notes.note1.004`, which directly supports the mapped Note 1 operative records. The broader Note 1 definition source unit is not included.

### Addendum-only ADC unconjugated-toxin study

- Amendment relations: empty array
- Source contribution: Addendum `ich_s6_r1.kr.part2.2_1.014`, `ich_s6_r1.kr.part2.notes.009`, and `ich_s6_r1.kr.part2.notes.015`
- Material conditions: `ich_s6_r1.cond.part2.2_1.008`, `ich_s6_r1.cond.part2.notes.005`, and `ich_s6_r1.cond.part2.notes.006`
- Material quantitative criterion: `ich_s6_r1.qc.part2.notes.001`
- Cross-reference provenance: `ich_s6_r1.xref.part2.2_1.005`

This record is Addendum-only operative guidance. It uses full Addendum provenance, an empty `amendment_relation_ids` array, and no fictitious Parent endpoint. The ADC general-principles record `ich_s6_r1.kr.part2.2_1.014` and its condition provide contextual scope for the selected Note 2 short-term-study proposition. The vague `(see above)` reference `ich_s6_r1.xref.part2.2_1.004` is not included because no concrete material contribution was identified for this operative proposition.

## Excluded candidates

- `ich_s6_r1.amend.001` is excluded because the initial prototype already exercises a reviewed `clarifies` synthesis through `amend.003`.
- Other `amend.002` propositions are excluded because they have different conditions, modalities, or operative effects and would require separate EffectiveRecords.
- A standalone ADC general-principles EffectiveRecord is excluded. `ich_s6_r1.kr.part2.2_1.014` alone states that ADC species selection follows the same general principles as an unconjugated antibody, while the referenced Note 2 source unit contains several independent operative propositions. The prototype instead uses `.014` as contextual scope for the selected Addendum-only Note 2 proposition.
- Other Note 2 records (`ich_s6_r1.kr.part2.notes.010`, `.011`, `.012`, `.013`) are excluded because they represent independent operative propositions outside the minimum sample.

## Initial implementation gate

The implementation is structurally acceptable when:

- JSON parses.
- Exactly four EffectiveRecords exist.
- Every EffectiveRecord has `review_status=needs_review`.
- EffectiveRecord IDs are unique.
- Every provenance ID exists.
- Amendment-backed records reference existing reviewed amendment mappings.
- The Addendum-only record has `amendment_relation_ids=[]`.
- Selected Conditions and QuantitativeCriteria are present.
- `needs_review` CrossReferences are documented only as model limitations.
- Source-layer and amendment-mapping files are unchanged.

Focused validation command:

```powershell
@'
const fs = require("fs");
const eff = JSON.parse(fs.readFileSync("structured_data/derived/s6_r1_effective_records.json", "utf8"));
const pilot = JSON.parse(fs.readFileSync("structured_data/pilots/s6_r1_species_selection.json", "utf8"));
const mappings = JSON.parse(fs.readFileSync("structured_data/derived/s6_r1_amendment_mappings.json", "utf8"));
const records = eff.effective_records || [];
const by = (items, key) => new Map(items.map((item) => [item[key], item]));
const ids = {
  knowledge_record_ids: by(pilot.knowledge_records, "knowledge_record_id"),
  condition_ids: by(pilot.conditions, "condition_id"),
  quantitative_criterion_ids: by(pilot.quantitative_criteria, "criterion_id"),
  cross_reference_ids: by(pilot.cross_references, "xref_id"),
  source_unit_ids: by(pilot.source_units, "source_unit_id")
};
const mapById = by(mappings.amendment_mappings, "mapping_id");
const required = new Map([
  ["ich_s6_r1.eff.part2.2_2.short_term_two_species", {
    amendment_relation_ids: ["ich_s6_r1.amend.002"],
    condition_ids: ["ich_s6_r1.cond.part2.2_2.001"],
    quantitative_criterion_ids: ["ich_s6_r1.qc.part2.2_2.004"]
  }],
  ["ich_s6_r1.eff.part2.2_1.no_relevant_species_pathway", {
    amendment_relation_ids: ["ich_s6_r1.amend.003"],
    condition_ids: ["ich_s6_r1.cond.part1.3_3.007", "ich_s6_r1.cond.part2.2_1.004"]
  }],
  ["ich_s6_r1.eff.part2.2_1.animal_tcr_species_selection", {
    amendment_relation_ids: ["ich_s6_r1.amend.004"],
    condition_ids: ["ich_s6_r1.cond.part1.3_3.002", "ich_s6_r1.cond.part1.3_3.003", "ich_s6_r1.cond.part2.2_1.003", "ich_s6_r1.cond.part2.notes.002"],
    cross_reference_ids: ["ich_s6_r1.xref.part2.2_1.001"]
  }],
  ["ich_s6_r1.eff.part2.notes.adc_unconjugated_toxin_short_term", {
    amendment_relation_ids: [],
    condition_ids: ["ich_s6_r1.cond.part2.2_1.008", "ich_s6_r1.cond.part2.notes.005", "ich_s6_r1.cond.part2.notes.006"],
    quantitative_criterion_ids: ["ich_s6_r1.qc.part2.notes.001"],
    cross_reference_ids: ["ich_s6_r1.xref.part2.2_1.005"]
  }]
]);
let errors = [];
if (records.length !== 4) errors.push(`expected 4 EffectiveRecords, found ${records.length}`);
const recordIds = new Set();
for (const record of records) {
  if (recordIds.has(record.effective_record_id)) errors.push(`duplicate EffectiveRecord ID ${record.effective_record_id}`);
  recordIds.add(record.effective_record_id);
  if (record.effective_status !== "current") errors.push(`${record.effective_record_id} effective_status is not current`);
  if (record.review_status !== "needs_review") errors.push(`${record.effective_record_id} review_status is not needs_review`);
  for (const [field, sourceIds] of Object.entries(ids)) {
    for (const id of record[field] || []) if (!sourceIds.has(id)) errors.push(`${record.effective_record_id} unresolved ${field}: ${id}`);
  }
  for (const id of record.amendment_relation_ids || []) {
    const mapping = mapById.get(id);
    if (!mapping) errors.push(`${record.effective_record_id} unresolved amendment relation: ${id}`);
    else if (mapping.review_status !== "reviewed") errors.push(`${record.effective_record_id} amendment relation not reviewed: ${id}`);
  }
  const req = required.get(record.effective_record_id);
  if (!req) errors.push(`unexpected EffectiveRecord ${record.effective_record_id}`);
  else {
    for (const [field, values] of Object.entries(req)) {
      for (const value of values) if (!(record[field] || []).includes(value)) errors.push(`${record.effective_record_id} missing ${field}: ${value}`);
    }
  }
  for (const xrefId of record.cross_reference_ids || []) {
    const xref = ids.cross_reference_ids.get(xrefId);
    if (xref && xref.review_status === "needs_review" && !(record.representation_limitations || []).join(" ").includes(xrefId)) {
      errors.push(`${record.effective_record_id} needs_review CrossReference lacks representation limitation note: ${xrefId}`);
    }
  }
}
const adc = records.find((record) => record.effective_record_id === "ich_s6_r1.eff.part2.notes.adc_unconjugated_toxin_short_term");
if (!adc || adc.amendment_relation_ids.length !== 0) errors.push("Addendum-only ADC record must have empty amendment_relation_ids");
if (errors.length) {
  console.error(errors.join("\n"));
  process.exit(1);
}
console.log("EffectiveRecord prototype validation passed: 4 records, all needs_review, provenance resolved.");
'@ | node
```

Repository checks:

```powershell
npm.cmd test
npm.cmd run validate:pilots
git diff --check
git diff -- structured_data/pilots/s6_r1_species_selection.json
git diff -- structured_data/derived/s6_r1_amendment_mappings.json
```

The final two diff commands should produce no diff.

## Later repository-review gate

A separate review task should:

- Check each effective statement against the source records.
- Confirm source modality is preserved or any synthesis decision is explicitly justified.
- Confirm no material condition, quantity, exception, or Note limitation is omitted.
- Confirm no unsupported regulatory requirement is introduced.
- Distinguish representation limitations from substantive uncertainty.
- Apply required corrections.
- Change accepted EffectiveRecords to `review_status=reviewed`.
- Add the completed review entry to `working_docs/review_log.md`.
- Mark Module 3.4 complete in `working_docs/phase3_plan.md`.

## Non-goals

- No source-layer changes.
- No amendment-mapping changes unless a verified defect is found.
- No JSON Schema, validator, dependency, or model-version changes.
- No Korean translations.
- No full S6 extraction.
- No Module 3.5 or 3.6 implementation.
- No regulatory suitability conclusions, study-design recommendations, automated decisions, Go/No-Go judgments, scoring systems, or web application.
