# Build scripts

One-time scripts used to extract, clean, sanitize, and Korean-normalize the
six guideline bundles now committed under `data/guidelines/`, plus the two
completed schema-version migrations (`migrate_ko_knowledge_attestations.js`,
`migrate_semantic_overlay_v0_2.js`) and the ICH S6(R1) 13-facet
structural-gap backfill (`backfill_ich_s6_gap_sections.js` and its
`reverify_ich_s6_gap_sections.js` companion, closed 2026-09-08 — see
`docs/milestone_log.md`).

None of these are wired to a `package.json` script and none are `require()`d
by anything under `engine/`, `scripts/`, or `test/` — each did its job once
against a specific historical state of the archive and has no ongoing
function now that state is committed and reviewed. Kept here rather than
deleted for the same reason as every other `history/` artifact: reproducing
exactly how a specific bundle's records were first drafted is cheaper to
look up than to reconstruct from scratch if a real question about extraction
methodology ever comes up. If you need to actually re-extract or re-backfill
something today, treat these as reference, not as a runnable pipeline —
write a fresh script against the live schema instead of reviving one of
these as-is.
