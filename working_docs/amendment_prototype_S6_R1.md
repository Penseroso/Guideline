# Amendment-Relation Prototype: ICH S6(R1) Species Selection

Status: implemented and reviewed. Repository reviews recorded as REV-005, REV-007, and REV-008 in `working_docs/review_log.md`; Module 3.3 review gate satisfied. `amend.003` is resolved to `clarifies` (REV-008) and `amend.004` is resolved to `narrows` (REV-007).

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
| `amend.003` | `kr.part2.2_1.009` | `kr.part1.3_3.010` | `clarifies` | Approach when no relevant species can be identified |
| `amend.004` | `kr.part2.2_1.007`, `.008`, `kr.part2.notes.005`, `.014` | `kr.part1.3_3.004`, `.005` | `narrows` | Role and permissible use of tissue cross-reactivity evidence in species selection |

### Analyst rationale

- `amend.001` — `clarifies`. Part I 3.3 defines a relevant species and says a variety of techniques can identify one; Part II 2.1 explains the determination (sequence homology, in vitro binding/occupancy, functional-activity assessment) without changing the Parent definition.
- `amend.002` — `narrows`. Part I 3.3 states programs should normally include two relevant species, with one sufficing in justified cases. Part II 2.2 constrains this into specific conditions and adds the explicit restriction that studies in two non-rodent species are not appropriate, limiting the applicability of the general two-species expectation.
- `amend.003` — `clarifies` (resolved in REV-008). Part I 3.3 recommends considering relevant transgenic animals expressing the human receptor or homologous proteins when no relevant species exists. Part II 2.1 begins with `As described in ICH S6 Guideline` and restates the same alternative pathway. The associated condition `ich_s6_r1.cond.part2.2_1.004` preserves the orthologous-target clause as material evidence: it explains a specific mechanism by which no relevant species can be identified, but does not add a new alternative, independent obligation, or broader scope. Amendment mappings currently use `KnowledgeRecord` endpoints; linked `Condition` records must also be followed during effective-state synthesis.
- `amend.004` — `narrows` (resolved in REV-007). Part I 3.3 treats tissue cross-reactivity evidence as part of species relevance for monoclonal antibodies (`kr.part1.3_3.004`) and allows an epitope-negative species to retain some relevance where comparable tissue cross-reactivity is demonstrated (`kr.part1.3_3.005`). Addendum body records `kr.part2.2_1.007`/`.008` carry the primary guidance: animal-tissue tissue cross-reactivity is of limited value and usable only in specific cases. That body source unit explicitly references Note 1, whose records `kr.part2.notes.005` (full-panel animal-tissue TCR not recommended) and `kr.part2.notes.014` (selected animal-tissue evaluation gives only conditional supplemental information) materially define the restriction. Including the Note 1 records does not mean Note 1 independently amends the Parent; the body and referenced Note 1 records together form the complete Addendum meaning. The Addendum neither contradicts nor replaces the Parent — it narrows the scope and evidentiary role of animal-tissue TCR — so the relation is `narrows`, not `modifies` or `conflicts_with`. The `(see Note 1)` contextual link is recorded on the mapping as `contextual_cross_reference_ids` (`ich_s6_r1.xref.part2.2_1.001`).

## Findings for Module 3.5 / 3.6

- **Relation vocabulary coverage.** After the REV-007 resolution of `amend.004` to `narrows`, the species-selection scope exercises two types: `clarifies` (`amend.001`, `amend.003`) and `narrows` (`amend.002`, `amend.004`). Untested by this scope: `supplements`, `modifies`, `broadens`, `replaces`, `supersedes`, `conflicts_with`. No new relation type was needed for the mapped records.
- **Cardinality is many-to-many.** Every sampled mapping relates multiple Addendum records to one or more Parent records. A future amendment-mapping schema (Module 3.5) must support record-level many-to-many relations, not 1:1 only.
- **Addendum-only effective guidance is allowed.** Addendum ADC content — `kr.part2.2_1.014` (ADC species selection follows the same general principles) and Part II Note 2 records (`kr.part2.notes.009`–`.013`, `.015`) — introduces operative guidance with no meaningful Part I §3.3 counterpart. This is not a vocabulary gap, conflict, or unresolved mapping. A future Addendum-only `EffectiveRecord` may cite the applicable Addendum `KnowledgeRecord` objects, applicable `Condition`/`QuantitativeCriteria` records, and materially referenced records as contributing source records; use an empty `amendment-relation IDs` array; set `effective status=current` when the Addendum is part of the applicable current edition; and set `review status=reviewed` only when all contributing records and synthesis are reviewed. The rationale must state that the guidance originates from Addendum-only scope and must not imply modification, replacement, or supersession of a nonexistent Parent record.
- **Relation-boundary decisions are resolved for the pre-Module-3.4 scope.** `amend.003` is `clarifies` after REV-008; `amend.004` (previously modifies vs conflicts_with) was resolved to `narrows` in REV-007 after following its explicit Note 1 reference (see below).
- **Follow explicit references before assigning a relation.** `amend.004` shows that an amendment's meaning can depend on a referenced note: the Part II 2.1 body limits animal-tissue TCR, and the referenced Note 1 completes that limit. Reviewing the referenced content before assigning the relation type changed the reading from a contested modifies/conflicts_with to a clear narrows. This general rule is recorded as DEC-027.

## Repository review (REV-005)

REV-005 verified all four mappings against the Part I §3.3 and Part II §2.1–2.2 source text, confirmed every endpoint resolves to an existing source `KnowledgeRecord`, and confirmed the source layer was not modified.

- `amend.001` (`clarifies`) and `amend.002` (`narrows`) are clearly source-supported and are set to `review_status=reviewed`.
- `amend.003` was later resolved by REV-008 as `clarifies` with `review_status=reviewed`; the prior `supplements` interpretation is removed.
- `amend.004` was left `needs_review` by REV-005 (`modifies` vs `conflicts_with`) and is resolved by REV-007 (below).

## Repository review (REV-007)

REV-007 resolved `amend.004`. Following the general rule now recorded as DEC-027, the reviewer followed the explicit `(see Note 1)` reference on the Addendum body source unit and reviewed the referenced Note 1 records before assigning the relation type.

- Final relation type: `narrows`. Final review status: `reviewed`. `modifies` and `conflicts_with` are removed as interpretations.
- Endpoints expanded to the full evidentiary set: parents `kr.part1.3_3.004` and `kr.part1.3_3.005`; Addendum body `kr.part2.2_1.007`/`.008` plus referenced Note 1 records `kr.part2.notes.005`/`.014`.
- The `(see Note 1)` contextual link (`ich_s6_r1.xref.part2.2_1.001`) is recorded on the mapping via `contextual_cross_reference_ids`. The Note 1 cross-reference remains model-unresolvable (`target_id=null`), but that is not treated as absence of contextual linkage because the raw reference and related Note 1 source units are preserved.

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

  Result after REV-008: 4 mappings, 19 endpoints, 0 unresolved KR IDs, 0 relation types outside the vocabulary.

## Not in scope

- No `EffectiveRecord` or effective-state synthesis (Module 3.4).
- No JSON Schema or validator changes (Module 3.5); no model-version change (Module 3.6).
- No change to Parent or source records; the source layer stays immutable.
