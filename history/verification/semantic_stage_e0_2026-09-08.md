# Semantic overlay Stage E0 verification — 2026-09-08

## Scope and ordering

Stage D (`history/verification/semantic_stage_d_2026-09-08.md`) left three overlay objects unconnected at runtime: `summary_specs`, the Korean semantic presentation overlay, and `salience_profiles`. These are being activated one at a time — Stage E1 (`summary_specs` structure), Stage E2 (presentation sentences), Stage E3 (`salience_profiles` exposure ordering) — using only the existing pilot-scope objects (5 `summary_specs`, 3 presentation files, 7 `salience_profiles`). Authoring these three for the 47 manifests Stage D added is out of scope here and deferred to a separate Stage F.

Stage E0 is a precondition for Stage E3 specifically: `salienceProfile` had no `review_status` field at all, unlike every other overlay object (`facets`, `relations`, `coverage_manifests`, `comparison_bindings`, `summary_specs`), so there was no way to gate which profiles are safe to serve versus still-unreviewed. Stage E0 adds that field and migrates existing data before any salience consumption code is written.

## Change

- `data/schemas/derived_semantic_overlay.schema.json`: `salienceProfile.required` now includes `"review_status"`, with `"review_status": { "$ref": "#/definitions/reviewStatus" }` added to its `properties`. `semantic_overlay_version` const moved from `"0.2.0"` to `"0.3.0"`.
- `scripts/migrate_semantic_overlay_v0_3.js` (new): idempotent migration setting `semantic_overlay_version: "0.3.0"` and `review_status: "needs_review"` on every `salience_profiles[]` entry across all 6 `data/derived/semantic/*.json` files (preserving any existing `review_status` if one is ever present).
- `scripts/build_semantic_stage_d.js`: its hardcoded `semantic_overlay_version = "0.2.0"` assignment updated to `"0.3.0"`, since this authoring script is idempotent/re-runnable and would otherwise downgrade the version and break schema validation if re-run for a future Stage F expansion.
- `test/semantic_stage_d_inventory.test.js`: version assertion updated from `"0.2.0"` to `"0.3.0"`.
- `test/validate_semantic_overlay.test.js`: added a case asserting a `salience_profiles` entry missing `review_status` fails schema validation.
- No change to `engine/`, `web/`, or `ENVELOPE_VERSION` (`2.2.0`) — this stage touches only the overlay schema and data, not the public answer envelope shape.

## Verification

- `node scripts/migrate_semantic_overlay_v0_3.js` — migrated all 6 files; spot-checked `fda_ada.json` shows both `salience_profiles` entries with `review_status: "needs_review"` and `semantic_overlay_version: "0.3.0"`.
- `node validation/validate_semantic_overlay.js` — "Validated 6 semantic overlay file(s) and 3 presentation file(s)."
- `npm.cmd test` — 362/362 passed (361 prior + 1 new schema-failure case).
- `node scripts/check_semantic_overlay_promotion.js` — runs cleanly against the migrated data (mechanical checks unaffected; salience is still outside this script's scope, consistent with it never having covered `summary_specs`/`salience_profiles`).
