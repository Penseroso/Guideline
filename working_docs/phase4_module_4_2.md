# Phase 4 Module 4.2: Family Registry, Lifecycle Artifacts, and Candidate Value-Path Slice

Status: Module 4.2 complete after REV-013b; independently audited and corrected after REV-013c
(DEC-053 through DEC-057). This note describes the corrected, current state; see "Post-completion
audit and correction" below for what changed and why.

## Scope implemented

Module 4.2 implements the production family/edition registry for both official corpus documents and
brings forward a *structural* EffectiveStateSnapshot validation capability and a candidate-only,
fixture-first vertical slice, per the Rebaseline R0 decisions (DEC-049 through DEC-052, REV-013a).

- Production registry artifacts under `structured_data/derived/registry/`: `guidance_family.json`,
  `document_edition.json`, `edition_source.json` for ICH M10 (`edition_role=final`) and ICH S6(R1)
  (`edition_role=integrated_package`, one DocumentEdition, no LifecycleRelationship — DEC-050).
  `current_risk_assessment_id` is `null` on every record (DEC-044, DEC-049); no RiskAssessment or
  ReviewAttestation production artifacts are created in this module.
- Two canonical minimal Document-identity bundles, `structured_data/source_documents/ich_m10.json`
  and `structured_data/source_documents/ich_s6_r1.json` (DEC-053): each a source model `0.2.0`
  bundle containing only the `documents` collection (one record, byte-identical to the corresponding
  reviewed pilot's Document record) and empty other collections. These, not `structured_data/pilots/`,
  are the production registry's source-Document identity input.
- A validation manifest, `structured_data/derived/registry/manifest.json`, naming the three registry
  artifact files and the two canonical identity bundles above as `source_bundles`. `npm run
  validate:registry` runs it.
- `scripts/validate_derived.js` extended, additively, to accept a manifest naming multiple
  `source_bundles` (DEC-051 part 2): `resolveManifestSourcePaths` accepts either the existing singular
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
  `source_bundle` and `source_bundles`; both candidate slices validating end to end; an **automated**
  assertion that the S6 slice mapping's `relation_type` and `source_record_ids`/`amending_record_ids`
  endpoint arrays exactly equal the frozen `ich_s6_r1.amend.001` reference's `relation_type` and
  `parent_knowledge_record_ids`/`addendum_knowledge_record_ids` (see "Automated vs. manual S6
  reconciliation coverage" below for what is and is not covered by this assertion); the S6 registry
  and slice each using exactly one integrated-package DocumentEdition with no LifecycleRelationship
  fixture present; and a schema-level demonstration that the closed registry schemas already reject
  source-Document field duplication (`additionalProperties: false`), so no redundant validator rule
  for that was added (see "Validator scope" below).

## Post-completion audit and correction (REV-013c)

An independent audit of the completed Module 4.2 commit found five issues, corrected without
expanding Module 4.2's scope or redesigning the completed architecture:

1. **Registry depended directly on pilot bundles**, contradicting the Engine boundary rule that
   Phase 1-3 pilots are not production inputs. Resolved by DEC-053: two canonical minimal
   Document-identity bundles under `structured_data/source_documents/` replace the direct pilot
   dependency; the additive multi-bundle manifest mechanism (DEC-051 part 2) is unchanged.
2. **`document_status="current"`** conflated the DocumentEdition's own publication status with
   computed effective currentness. Resolved by DEC-054: `edition_role` and `document_status` are now
   closed vocabularies, and the registry uses `document_status="in_force"`.
3. **No strict completeness check** for the production registry — an orphan GuidanceFamily or
   DocumentEdition would pass silently. Resolved by DEC-055: an opt-in `strict_registry` manifest
   flag, enabled only for the production registry manifest, with the existing generic partial-graph
   behavior unchanged by default.
4. **EffectiveStateSnapshot validation checked family but not jurisdiction consistency** for member
   EffectiveRecords. Resolved by DEC-056.
5. **Manifest `source_bundles` accepted malformed entries** (non-string, empty-string, empty array,
   non-array), crashing with an uncaught `TypeError` instead of a clean validation error. Resolved by
   DEC-057.

See `working_docs/review_log.md` REV-013c for the independent review record, and DEC-053 through
DEC-057 in `working_docs/decisions.md` for full rationale. REV-013b's original findings are not
rewritten; they remain the historical record of the state before this correction.

## Registry identity

`guidance_family_id`, `document_edition_id`, and `edition_source_id` values (`gf.ich_m10`,
`gf.ich_m10.edition.final`, `gf.ich_s6r1`, `gf.ich_s6r1.edition.integrated_package`, and their
EditionSource counterparts) are semantic, guideline-code-based identifiers, not derived from
`Guideline Files/` filenames (`ICH M10.pdf`, `ICH S6.pdf`). Source `Document` identity (`document_id`,
checksum, version label, `schema_model_version`) is referenced from, not duplicated into, the
registry. That identity is provided by the canonical minimal Document-identity bundles under
`structured_data/source_documents/` (DEC-053), not by direct reference to `structured_data/pilots/`,
because `working_docs/phase4_plan.md`'s Engine boundary designates Phase 1-3 pilots as regression
references and audit history, not production inputs for the runtime contract. Full production source
bundles from Modules 4.4/4.10 will later carry the same `document_id` and checksum and may supersede
these identity bundles without changing registry identity.

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

## Automated vs. manual S6 reconciliation coverage

The `s6_amendment_slice` fixture's AmendmentMapping (`slice.s6.amend.001`) is reconciled against the
frozen Phase 3 prototype `ich_s6_r1.amend.001` (`structured_data/derived/s6_r1_amendment_mappings.json`,
reviewed `reviewed` in REV-005) at two distinct levels of coverage, which must not be conflated:

- **Automated (regression-tested):** the test `s6_amendment_slice mapping reconciles without
  divergence against the frozen Phase 3 amend.001 reference` in `test/validate_derived.test.js`
  asserts by exact equality that `slice.s6.amend.001`'s `relation_type` equals `ich_s6_r1.amend.001`'s
  `relation_type` (`clarifies`), and that its `source_record_ids`/`amending_record_ids` arrays equal
  the frozen mapping's `parent_knowledge_record_ids`/`addendum_knowledge_record_ids` arrays. This
  structural equivalence is checked on every test run and would fail if either endpoint set or the
  relation type ever diverged.
- **Manual (asserted by this review, not independently automated):** the prose-level synthesis —
  `slice.s6.amend.001`'s `analyst_rationale` and `original_relationship_wording`, and
  `slice.s6.eff.relevant_species_determination`'s `effective_text_en` and `synthesis_rationale` — was
  authored fresh for the contract-conformant shape and manually checked against the frozen prototype's
  rationale text and REV-005/REV-008's findings for meaning-level consistency. No automated test
  compares natural-language field content; there is no reliable exact-match or fuzzy-match assertion
  for prose meaning, so this level of reconciliation is asserted by reviewer judgment, not enforced by
  the test suite.

Both the module note and `working_docs/phase4_plan.md`'s Module 4.2 completion gate state this
distinction explicitly rather than describing the reconciliation as uniformly "automated" or as a
single unqualified claim.

## Validator scope (no closed-schema restatement)

Every derived artifact schema is `additionalProperties: false`, and the registry artifact schemas
(`guidance_family.schema.json`, `document_edition.schema.json`, `edition_source.schema.json`) define
no source path, checksum, or version-label fields. Source-Document field duplication into the
registry is therefore already rejected at JSON Schema validation, and Module 4.2 does not add a
duplicate validator rule for it (a positive test demonstrates the schema rejection directly). Module
4.2 validator additions are limited to graph-level facts the closed schemas cannot express:
cross-artifact reference resolution for the multi-bundle source index; EffectiveStateSnapshot member,
family, and jurisdiction resolution (DEC-056); and, when a manifest opts in with `strict_registry:
true`, registry completeness — every supplied GuidanceFamily has at least one DocumentEdition, and
every supplied DocumentEdition has at least one EditionSource (DEC-055). `strict_registry` is off by
default so the existing generic partial-graph fixtures and tests are unaffected; only
`structured_data/derived/registry/manifest.json` enables it.

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
  REV-013c independently audits and corrects that completed state per DEC-053 through DEC-057.
- Module 4.5 and Module 4.7 remain blocked on their DEC-049 governance-policy decisions.
- Full production source bundles (Modules 4.4/4.10) will later supersede the canonical minimal
  Document-identity bundles under `structured_data/source_documents/` additively, without changing
  registry identity (DEC-053).
- The prose-level S6 reconciliation (rationale and effective-text wording) remains manually asserted,
  not automated; see "Automated vs. manual S6 reconciliation coverage" above.
