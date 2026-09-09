# Response Intelligence — Workstream 4 Verification

Date: 2026-09-09

Workstream: Retrieval Quality Upgrade

Result: complete; two small, dependency-free fixes implemented and
verified. No hybrid retrieval, BM25 library, embeddings, or reranking was
adopted — the real benchmark did not justify it.

## Method: correcting Workstream 3's benchmark before using it

Per `docs/milestones/response_intelligence.md` §4, this workstream must
"use Workstream 3's taxonomy and fixtures as the benchmark denominator."
Before building on it, Workstream 3's "5/6 confidence-floor probes are
retrieval misses" finding was re-examined and found unusable as-is: every
probe was `"<one real word> xylophone marmalade zeppelin"`, and the "real
word" was a verbatim substring of the ground-truth paragraph's own opening
text, not a synonym or paraphrase. Reproducing one case
(`"addition xylophone marmalade zeppelin"`) against `engine/vector_store.js`
showed the actual mechanism: the keyword store's flat per-token, per-tier
score (`semantic`=3, `source`=2, `section`=1, `document`=0.5, no
term-frequency weighting) let the common word "addition" match several
unrelated records at the higher `semantic` tier, outranking the true
paragraph's `source`-tier match. Real, but only reachable by an artificial
single-real-word query. Addenda were added to
`history/verification/response_intelligence_workstream_3_2026-09-09.md` and
`docs/milestones/response_intelligence.md` §3 documenting this correction.

This workstream built a real benchmark instead:
`scripts/analyze_retrieval_quality.js` (`npm run audit:retrieval-quality`).

- **30 known-synonym regression probes**, auto-generated: for a sample of
  `engine/text_utils.js`'s `REGULATORY_SYNONYMS` (243 entries), find a real
  record whose exact `parameter` is the mapped English term (whole-token
  match, not substring — an early version of this script used substring
  matching and produced false ground-truth associations, e.g. "anti"
  matching inside "antigen" and "cross" matching inside "across"; fixed
  before drawing any conclusion from it), then combine the Korean synonym
  with a second real, distinctive word auto-picked from that same record's
  own `source_text`. Every probe is a realistic multi-word question.
- **3 hand-curated uncovered-synonym probes**: real English synonyms for
  real archive vocabulary verified absent from `REGULATORY_SYNONYMS`
  (`duration`→`length`, `replicates`→`repeats`, `cycles`→`cycling`),
  combined the same way with a real second word from the ground-truth
  record.
- A "hit" means the real `store.search()` (`engine/vector_store.js`) top-5
  contains either the exact ground-truth record or any sibling extracted
  from the same source paragraph (`source_unit_ids[0]`) — a real user is
  equally well served by either, since they share one citation.

## Real measured results

| Benchmark | Before this workstream's fixes | After |
|---|---:|---:|
| Known-synonym regression (n=30) | 28/30 | 28/30 |
| Uncovered-synonym gap (n=3) | 1/3 | 3/3 |

**The 2 uncovered-synonym misses were genuine and are now fixed.**
Neither "repeats" nor "cycling" shared any token with their ground-truth
record (`ich_m10.qc.3_2_5_2.001` / `ich_m10.qc.4_2_7.003`) — confirmed by
direct tokenization check — so no amount of ranking-weight tuning could
have found them; the fix is the missing synonym mapping itself.

**The 2 known-synonym misses (`단백질`/protein, `결합`/binding) are not a
synonym defect.** The synonym mapping is correct; the miss is that both
auto-picked query words are themselves extremely common across the whole
archive: "protein" appears in 303/2,693 records (11.2%) and "therapeutic"
in 331/2,693 (12.3%); "binding" in 234/2,693 (8.7%) and "concentration" in
257/2,693 (9.5%). A 2-word query where both words individually match
roughly one in ten archive records is under-specified by construction, not
a retrieval defect — a real user question would ordinarily include more
distinguishing detail (the real record's own `parameter` text, "amount of
therapeutic protein product used to establish the cut-point," is far more
specific than "protein therapeutic"). The IDF-style fix below did not
change these two rankings at all (identical top-5 before and after),
confirming the gap is query under-specification, not something more
weighting can fix.

## Decision gate and what was implemented

Both fixes below are the minimal, dependency-free tier explicitly allowed
by the milestone ("only adopt hybrid retrieval / BM25 / embeddings /
reranking if benchmark results actually justify it") — the benchmark
justified two small, targeted changes, not new retrieval machinery:

1. **`engine/text_utils.js`**: added `"repeats"`, `"repeat"`, and
   `"cycling"` to `REGULATORY_SYNONYMS`, mapping to `replicates`/`cycles`
   — fixes the 2 confirmed real vocabulary gaps directly.
2. **`engine/vector_store.js`**: `createKeywordStore()` now tracks
   document frequency per token at `index()` time and adds a small,
   capped, document-frequency-aware bonus (`idfBonus`, weight `0.3`) on top
   of each token's existing field-tier score in `search()`. The field-tier
   hierarchy (`semantic` > `source` > `section` > `document`) still
   dominates ranking; the bonus only nudges a rare, distinctive token ahead
   of a near-ubiquitous one at the *same* tier — exactly the mechanism that
   caused Workstream 3's original artificial-probe observation, now fixed
   at its root for any future query that hits it, not just that one probe
   shape.

No embedding provider, hybrid retrieval, or BM25 library was adopted.
`engine/vector_store.js`'s existing `createVectorStore` embedding path
remains unused and unintegrated — no caller passes `embed`, and its
`better-sqlite3`/`sqlite-vec` dependency cannot compile a native binary on
this machine (no C++ toolchain), a real infrastructure constraint noted
for any future workstream that revisits embeddings.

## Verification

- `npm run audit:retrieval-quality` — 28/30 known-synonym, 3/3
  uncovered-synonym, reproducible, writes
  `logs/runtime/response_intelligence_workstream_4_retrieval_benchmark.json`.
- New tests in `test/engine_vector_store.test.js`: a rare token outranks a
  common one at the same field tier (synthetic, deterministic); the two
  real `repeats`/`cycling` cases resolve correctly.
- `npm test` — 430/430 (428 baseline + 2 new), including all 6 pre-existing
  `engine_vector_store.test.js` pins (keyword-mode ranking order, the
  ADA-evaluation-method regression case, vector-mode plumbing) unchanged.
- `npm run validate:guidelines` — 6/6.
- `npm run validate:ko` — 2,693/2,693.
- `npm run audit:ko` — 1,495/1,495 reviewed, 0 issues.
- `npm run validate:semantic` — 6/6 overlays and presentations.
- `npm run audit:routing:hardening` — 220/220, 42 mode/intent diagnostics
  (unchanged from Workstream 1/3 — confirms this change is isolated to
  `store.search()`'s fallback/generation retrieval path and does not touch
  `query_router.js`'s own `scoreRecord`/structured routing scorer).
- `npm run eval` — 24/24; citation precision, claim grounding, and refusal
  correctness each 100%.

## Remaining risk/follow-up

- `IDF_BONUS_WEIGHT = 0.3` was chosen to be large enough to matter (fixed
  the originally-observed common-word-collision shape in unit tests) while
  small enough that the field-tier hierarchy still dominates and no
  existing pinned test regressed. It was not exhaustively tuned against a
  larger corpus; if a future workstream finds more real ranking misses,
  revisit this constant with a bigger benchmark rather than assuming it is
  optimal.
- The "protein"/"binding" under-specified-query gap is not fixed and, per
  the analysis above, may not be meaningfully fixable by ranking-weight
  tuning alone — a two-generic-word query has limited retrievable
  precision by construction. If this proves to matter in practice, the
  real fix is more specific fallback query construction upstream (e.g.
  combining more of the original question's content words), not further
  retrieval-layer changes, and should be measured with real user questions
  rather than assumed.
- Embeddings remain unintegrated and infrastructurally blocked on this
  machine. If a future workstream revisits them, `better-sqlite3`/
  `sqlite-vec`'s native build requirement is a real prerequisite to resolve
  first, independent of any retrieval-quality justification.
