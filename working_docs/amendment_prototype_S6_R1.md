# Amendment-Relation Prototype: ICH S6(R1) Species Selection

Status: implemented, pending repository review (REV-005).

This is a Phase 3 Module 3.3 prototype. It creates a small reviewed sample of analyst-derived mappings between Addendum (Part II §2.x) and Parent (Part I §3.3) `KnowledgeRecord` objects, to test the relation-type vocabulary in `working_docs/amendment_effective_strategy.md` against the real REV-004 source records.

Amendment mappings are derived analysis, not source text. This prototype does not change source model `0.2.0`, the JSON Schema, the validator, or any source records, and it does not create effective-state records (Module 3.4).

## Artifacts

- Machine-readable sample: `structured_data/derived/s6_r1_amendment_mappings.json`
- Source records referenced: `structured_data/pilots/s6_r1_species_selection.json`

The sample lives under `structured_data/derived/`, deliberately outside `structured_data/pilots/`, because `scripts/validate_pilots.js` recursively validates every `.json` under `pilots/` against the source bundle schema. Amendment objects are not part of that schema, so placing them under `pilots/` would fail source validation. `derived/` is not discovered by `validate:pilots` and not otherwise validated yet (Module 3.5 candidate).

## Mapping sample

Each mapping is many-to-many at record level: it relates one or more Addendum records to one or more Parent records, with a single reviewed relation type.

| Mapping | Addendum records | Parent records | Relation | Mapped scope |
|---------|------------------|----------------|----------|--------------|
| `amend.001` | `kr.part2.2_1.001`, `.002`, `.003` | `kr.part1.3_3.002`, `.003` | `clarifies` | How a pharmacologically relevant species is determined |
| `amend.002` | `kr.part2.2_2.001`, `.002`, `.004`, `.005` | `kr.part1.3_3.006`, `.007` | `narrows` | Number of species for the general toxicology program |
| `amend.003` | `kr.part2.2_1.009` | `kr.part1.3_3.010` | `supplements` | Approach when no relevant species can be identified |
| `amend.004` | `kr.part2.2_1.007`, `.008` | `kr.part1.3_3.004` | `modifies` | Role of tissue cross-reactivity in species selection |

### Analyst rationale

- `amend.001` — `clarifies`. Part I 3.3 defines a relevant species and says a variety of techniques can identify one; Part II 2.1 explains the determination (sequence homology, in vitro binding/occupancy, functional-activity assessment) without changing the Parent definition.
- `amend.002` — `narrows`. Part I 3.3 states programs should normally include two relevant species, with one sufficing in justified cases. Part II 2.2 constrains this into specific conditions and adds the explicit restriction that studies in two non-rodent species are not appropriate, limiting the applicability of the general two-species expectation.
- `amend.003` — `supplements`. Part I 3.3 recommends considering transgenic animals or homologous proteins when no relevant species exists. Part II 2.1 restates this and adds the orthologous-target trigger condition, citing the ICH S6 Guideline. A `clarifies` reading is tenable and is flagged for reviewer confirmation.
- `amend.004` — `modifies`. Part I 3.3 treats a similar tissue cross-reactivity profile as part of species relevance for monoclonal antibodies. Part II 2.1 repositions tissue cross-reactivity in animal tissues as of limited value for species selection, changing how the Parent criterion should be understood. It is deliberately not `conflicts_with`, because the Addendum narrows the method's role rather than contradicting the Parent; the boundary needs reviewer confirmation.

## Findings for Module 3.5 / 3.6

- **Relation vocabulary coverage.** The species-selection scope exercised four types: `clarifies`, `narrows`, `supplements`, `modifies`. Untested by this scope: `broadens`, `replaces`, `supersedes`, `conflicts_with`. No new relation type was needed for the mapped records.
- **Cardinality is many-to-many.** Every sampled mapping relates multiple Addendum records to one or more Parent records. A future amendment-mapping schema (Module 3.5) must support record-level many-to-many relations, not 1:1 only.
- **Boundary gap: new Addendum scope with no Parent record.** Addendum ADC content — `kr.part2.2_1.014` (ADC species selection follows the same general principles) and Part II Note 2 records (`kr.part2.notes.009`–`.013`, `.015`) — introduces genuinely new scope that has no Part I §3.3 counterpart. None of the eight relation types describes "new scope, no Parent record." This is intentionally left unmapped here and recorded as a vocabulary gap for the Module 3.6 model decision, not forced into an ill-fitting relation.
- **Relation ambiguity is expected.** `amend.003` (supplements vs clarifies) and `amend.004` (modifies vs conflicts_with) are genuine reviewer judgment calls. Every mapping is marked `review_status=needs_review` pending REV-005.

## Verification

- `npm run validate:pilots` → `Validated 5 pilot bundle(s).` (the new `derived/` file is not swept; source validation intact).
- `npm test` → 17/17 (validator unchanged).
- ID-resolution check (reproducible):

  ```
  node -e '
  const fs=require("fs");
  const pilot=JSON.parse(fs.readFileSync("structured_data/pilots/s6_r1_species_selection.json","utf8"));
  const map=JSON.parse(fs.readFileSync("structured_data/derived/s6_r1_amendment_mappings.json","utf8"));
  const krIds=new Set(pilot.knowledge_records.map(k=>k.knowledge_record_id));
  const vocab=new Set(["supplements","clarifies","modifies","narrows","broadens","replaces","supersedes","conflicts_with"]);
  let unresolved=[], badRel=[];
  for(const m of map.amendment_mappings){
    if(!vocab.has(m.relation_type)) badRel.push(m.mapping_id);
    for(const id of [...m.addendum_knowledge_record_ids, ...m.parent_knowledge_record_ids])
      if(!krIds.has(id)) unresolved.push(m.mapping_id+" -> "+id);
  }
  console.log("unresolved:", unresolved, "bad relation_type:", badRel);
  '
  ```

  Result: 4 mappings, 16 endpoints, 0 unresolved KR IDs, 0 relation types outside the vocabulary.

## Not in scope

- No `EffectiveRecord` or effective-state synthesis (Module 3.4).
- No JSON Schema or validator changes (Module 3.5); no model-version change (Module 3.6).
- No change to Parent or source records; the source layer stays immutable.
- REV-005 human review of these mappings is a separate follow-up.
