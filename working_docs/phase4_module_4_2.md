# Phase 4 Module 4.2: Family Registry, Lifecycle Artifacts, and Candidate Value-Path Slice

Status: Module 4.2 complete after REV-013b.

## Scope implemented

Module 4.2 implements the production family/edition registry for both official corpus documents and
brings forward a *structural* EffectiveStateSnapshot validation capability and a candidate-only,
fixture-first vertical slice, per the Rebaseline R0 decisions (DEC-049 through DEC-052, REV-013a).

- Production registry artifacts under `structured_data/derived/registry/`: `guidance_family.json`,
  `document_edition.json`, `edition_source.json` for ICH M10 (`edition_role=final`) and ICH S6(R1)
  (`edition_role=integrated_package`, one DocumentEdition, no LifecycleRelationship — DEC-050).
  `current_risk_assessment_id` is `null` on every record (DEC-044, DEC-049); no RiskAssessment or
  ReviewAttestation production artifacts are created in this module.
- A validation manifest, `structured_data/derived/registry/manifest.json`, naming the three registry
  artifact files and the three existing reviewed source pilot bundles (`m10_3_2_5_2.json`,
  `m10_6_1.json`, `s6_r1_species_selection.json`) as `source_bundles`. `npm run validate:registry`
  runs it.
- `scripts/validate_derived.js` extended, additively, to accept a manifest naming multiple
  `source_bundles` (DEC-051): `resolveManifestSourcePaths` accepts either the existing singular
  `source_bundle` or the new plural `source_bundles`, rejects supplying both, validates each bundle
  through the existing `validateBundles` reuse (which already performs DEC-018 cross-file rules:
  identical repeated Document records, context-only repeated Sections, global non-repeatable-ID
  uniqueness), and merges the validated bundles into one source index (`mergeSourceBundles`) before
  contract graph validation runs. The existing single-`source_bundle` manifest and its behavior,
  including the `complete_graph` fixture, are unchanged.
- Structural EffectiveStateSnapshot graph validation (`validateContractSnapshots`): each snapshot's
  `guidance_family_id` resolves to a supplied GuidanceFamily when registry artifacts are supplied;
  each `effective_record_ids` member resolves to a supplied EffectiveRecord; a resolved member's
  `guidance_family_id` must match the snapshot's. No tier, aggregation, or disclosure policy is
  implemented (Module 4.8 scope); schema-level identity-field presence (`jurisdiction`, `as_of_date`,
  `review_policy`, `source_corpus_identity`, `calculation_policy_version`) was already guaranteed by
  the Module 4.1 `effective_state_snapshot.schema.json` and is not re-checked in the validator.
- Two candidate-only, test-fixture-only scenario graphs under `test/fixtures/derived_contract/`:
  - `m10_direct_slice/`: a GuidanceFamily/DocumentEdition/EditionSource plus one EffectiveRecord
    (`derivation_basis=direct_source`, `slice.m10.eff.6_1.022`) and one EffectiveStateSnapshot, built
    from the real, reviewed `structured_data/pilots/m10_6_1.json` KnowledgeRecord `ich_m10.kr.6_1.022`
    ("The parameters of the partial validations should meet the full validation criteria.").
  - `s6_amendment_slice/`: a GuidanceFamily/DocumentEdition/EditionSource (single integrated edition,
    DEC-050) plus one AmendmentMapping (`slice.s6.amend.001`, `relation_type=clarifies`) and one
    EffectiveRecord (`derivation_basis=amendment_synthesis`, ICH `profile_details.ich_derivation_detail
    =parent_addendum_synthesis`) and one snapshot, built from the real, reviewed
    `structured_data/pilots/s6_r1_species_selection.json` records for the same endpoint pair as the
    frozen Phase 3 prototype `ich_s6_r1.amend.001` (`structured_data/derived/s6_r1_amendment_mappings.json`,
    reviewed in REV-005): Parent `ich_s6_r1.kr.part1.3_3.002`/`.003` and Addendum
    `ich_s6_r1.kr.part2.2_1.001`/`.002`/`.003`.
  - All slice records carry `review_status=needs_review` and `current_risk_assessment_id=null`. These
    fixtures are test-only; they are never copied into `structured_data/` and make no production or
    reviewed-effective-state claim.
- Regression tests in `test/validate_derived.test.js` covering: the production two-document registry
  manifest; multi-bundle merge and unresolved-Document failure; rejection of combining
  `source_bundle` and `source_bundles`; both candidate slices validating end to end; the S6 slice
  mapping's `relation_type`/endpoint reconciliation against the frozen `ich_s6_r1.amend.001` reference;
  the S6 registry and slice each using exactly one integrated-package DocumentEdition with no
  LifecycleRelationship fixture present; and a schema-level demonstration that the closed registry
  schemas already reject source-Document field duplication (`additionalProperties: false`), so no
  redundant validator rule for that was added (see "Validator scope" below).

## Registry identity

`guidance_family_id`, `document_edition_id`, and `edition_source_id` values (`gf.ich_m10`,
`gf.ich_m10.edition.final`, `gf.ich_s6r1`, `gf.ich_s6r1.edition.integrated_package`, and their
EditionSource counterparts) are semantic, guideline-code-based identifiers, not derived from
`Guideline Files/` filenames (`ICH M10.pdf`, `ICH S6.pdf`). Source `Document` identity (`document_id`,
checksum, version label, `schema_model_version`) is referenced from, not duplicated into, the
registry, and is bootstrapped from the existing reviewed pilot bundles (DEC-051) pending full
production source bundles from Modules 4.4/4.10.

## S6(R1) registry model (DEC-050)

ICH S6(R1) registers as **one** GuidanceFamily, **one** DocumentEdition
(`edition_role=integrated_package`), and **one** EditionSource referencing source
`document_id=ich_s6_r1`. No LifecycleRelationship artifact is created for S6 in this module. The
Parent-Addendum relationship inside the single integrated package is represented at the
KnowledgeRecord level through AmendmentMapping and EffectiveRecord (`derivation_basis=
amendment_synthesis`), consistent with DEC-022/DEC-024 (S6 is one physical Document, not two) and
DEC-043 (LifecycleRelationship self-relations are rejected). The `complete_graph` test fixture's
generic two-edition LifecycleRelationship example is a structural demonstration only and was not
treated as the S6 model.

## Validator scope (no closed-schema restatement)

Every derived artifact schema is `additionalProperties: false`, and the registry artifact schemas
(`guidance_family.schema.json`, `document_edition.schema.json`, `edition_source.schema.json`) define
no source path, checksum, or version-label fields. Source-Document field duplication into the
registry is therefore already rejected at JSON Schema validation, and Module 4.2 does not add a
duplicate validator rule for it (a positive test demonstrates the schema rejection directly). Module
4.2 validator additions are limited to graph-level facts the closed schemas cannot express:
cross-artifact reference resolution for the multi-bundle source index, and EffectiveStateSnapshot
member/family resolution.

## Deferred governance (DEC-049)

RiskAssessment and ReviewAttestation remain schema-only in this module; no production RiskAssessment
or ReviewAttestation artifacts are created, and none of Module 4.2's output claims `review_status=
reviewed`. Module 4.5 (risk) and Module 4.7 (review) remain gated on their respective governance-policy
decisions per DEC-049; Module 4.7's gate additionally requires resolving the ReviewAttestation
artifact-identity/linkage gap logged as known gap G1 in `working_docs/phase4_plan.md`.

## Non-goals preserved

- No RiskAssessment or ReviewAttestation production artifacts.
- No full risk-tier derivation, review-tier satisfaction, or review-attestation aggregation.
- No lifecycle relationships to documents not in the repository.
- No effective-state recalculation, ingest, extraction, or orchestration.
- No production (non-fixture) candidate EffectiveRecords or snapshots outside the registry itself.
- No change to source model `0.2.0`, `structured_data/schemas/guideline_bundle.schema.json`, the
  reviewed pilots, or the frozen Phase 3 derived prototypes.

## Items requiring additional review

- REV-013b confirms the registry, multi-bundle manifest support, structural snapshot validation, and
  both candidate slices meet the Module 4.2 completion gate in `working_docs/phase4_plan.md`.
- Module 4.5 and Module 4.7 remain blocked on their DEC-049 governance-policy decisions.
- Full production source bundles (Modules 4.4/4.10) will later supersede the pilot-bootstrapped source
  Document identity additively, without changing registry identity (DEC-051).
