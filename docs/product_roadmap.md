# Product Roadmap

Document status: Active. Decisions affecting this document are recorded in `docs/milestone_log.md` (one entry per milestone), not as individual `DEC-`/`REV-` entries — that convention is retired.

Supersedes the earlier Phase 3/4 module-sequencing plans as the forward-looking plan; those no longer describe current intent. The non-goal boundary that excluded search/embeddings/RAG/web application (previously in `docs/project_scope.md`, `AGENTS.md`) is also superseded — see the updated versions of those files.

This document was drafted alongside the frozen audit at `history/audits/repository_audit_2026-08-18.md`. Read that first if you want the historical evidence; this document is the active decision built on top of it.

## 1. Target Product Profile (TPP)

### 1.1 Product

A conversational assistant that answers regulatory questions about ICH guidelines (starting with M10 and S6(R1)) by retrieving and quoting the structured archive, with every factual claim traceable to an exact document, section, and PDF page. The product's defining constraint is not "be a good chatbot" — it is **never state a regulatory fact that is not grounded in a specific archived source record**. Fluency is secondary to grounding.

### 1.2 Users

Unchanged from `docs/project_scope.md`: internal reviewers and analysts who need to inspect and verify regulatory guideline content. They are domain experts who will notice a wrong citation or a fabricated criterion — the product must be built assuming an adversarial, expert reader, not a casual user who will take an answer at face value.

### 1.3 Core promise (what "hallucination-free" means operationally)

Not "the model never generates incorrect tokens" — that is not achievable. Operationally, hallucination-free means:

1. Every regulatory claim in an answer (a requirement, a threshold, a condition, a modality) is either a direct quote/paraphrase of a specific `KnowledgeRecord` / `QuantitativeCriterion` / `Condition` / `SourceUnit`, or the answer says it doesn't know.
2. Every such claim carries a visible citation (document, section, PDF page) that a reviewer can open and check.
3. `review_status`/`value_status` on the underlying record is surfaced, not hidden — an answer built on a `needs_review` record says so.
4. The assistant never synthesizes a requirement, threshold, or recommendation that isn't in the source, even when asked a question that invites it to ("what accuracy would be acceptable for X" when X isn't covered — the answer is "not found in the archived scope," not an inference).
5. Amendment/effective-state complexity (parent vs. addendum, superseded vs. current) is surfaced explicitly rather than silently collapsed to one answer, using the existing `AmendmentMapping`/`EffectiveRecord` derived-layer design once populated.

### 1.4 Functional scope

In scope:
- Natural-language Q&A over the structured archive (initially M10 + S6(R1) pilot sections; expands with coverage).
- Mandatory inline citation (document/section/page + `source_unit_id`) on every factual sentence.
- Explicit refusal ("not covered in the current archive") when no grounded record supports an answer, instead of falling back to model world-knowledge about ICH guidelines.
- Surfacing conflicting or amended guidance (parent vs. addendum) rather than picking one silently.
- Surfacing modality (`must`/`should`/`may`/`other`) precisely — the product must never blur "may" into "must."

Out of scope (unchanged from the prior non-goals, and this boundary is *not* superseded by this roadmap):
- Regulatory suitability conclusions ("is my study design acceptable").
- Study-design recommendations.
- Automated decision making, Go/No-Go judgments, scoring systems.

This split matters: the previous non-goals list conflated "don't build an app" (an implementation-layer decision, now reversed) with "don't give regulatory advice" (a product-boundary decision, still in force). This roadmap only reverses the former.

### 1.5 Success metrics (initial, to be refined once an eval set exists — see Milestone M1)

- **Citation precision**: % of factual sentences in answers whose cited source record actually supports the claim (target: 100% on a curated eval set before any wider rollout; this is the metric the whole architecture below is chosen to make achievable).
- **Refusal correctness**: % of out-of-scope/uncovered questions correctly answered "not found" rather than guessed.
- **Coverage**: fraction of target guideline sections with structured, reviewed records available to answer from (currently very low — see audit).
- **Review-status transparency**: 0 answers presenting `needs_review`/`unreviewed` content as if fully reviewed.

## 2. Implementation Approach: RAG and Alternatives

### 2.1 What "RAG's structural limits" actually refers to

Plain (naive) RAG — embed arbitrary text chunks, retrieve top-k by cosine similarity, stuff into a prompt, let the model generate freely — has known failure modes that are especially dangerous in this domain:

- **Chunking destroys structure.** Splitting PDF text into fixed-size windows breaks the requirement/condition/exception/cross-reference linkage this project's schema (`docs/schema.md`) deliberately keeps structurally separate. A chunk boundary can separate a criterion from the exception that limits it.
- **Retrieval recall failure → silent generation gap-filling.** If the right chunk isn't retrieved, the model still answers, often plausibly and wrongly, because nothing forces it to say "not found."
- **Faithfulness failure even with correct retrieval.** Even given the right passage, generative models add unsupported detail, especially in comparative or conditional phrasing ("provided that...", "except when...") — exactly the shape of most conditions/exceptions modeled here.
- **Embedding similarity is not regulatory relevance.** "must be validated" and "need not be validated" are close in embedding space but opposite in modality. Naive semantic retrieval alone can retrieve the wrong-polarity record and the generator can quietly assert it.
- **No native effective-state/version reasoning.** Which of parent-vs-addendum currently applies is a graph-traversal question, not a similarity-search question.
- **No native refusal signal.** Vanilla RAG has no structural mechanism to say "no evidence" — refusal has to be bolted on with prompting, which is unreliable in isolation.

None of this means "don't use retrieval + an LLM." It means: **don't throw away the structured graph and fall back to naive chunk-and-embed.** That graph is this repository's actual asset (see audit §"Reusable strengths"), and a RAG design that ignores it is strictly worse than one that uses it.

### 2.2 Options considered

**A. Structured query, no generation for facts.** Map the user's question to a query over the JSON graph (by parameter, section, guideline, keyword) and render the answer as a template filled from `KnowledgeRecord`/`QuantitativeCriterion` fields plus verbatim `source_text`, with citation. Zero hallucination risk for the facts themselves, because no LLM ever generates a regulatory claim — it only ever selects and formats. Limitation: brittle for open-ended natural-language phrasing and multi-part questions; needs an intent/entity resolution step, and coverage is capped by how much is structured.

**B. Schema-anchored grounded RAG.** Retrieve at `KnowledgeRecord`/`SourceUnit`/`Condition` granularity (not arbitrary chunks) — using embeddings, keyword search, or both, over these already-normalized objects — then constrain generation so the model may only quote or lightly paraphrase the retrieved objects and must attach their IDs to every sentence. A post-generation verification pass checks that each cited sentence is actually entailed by (or a close paraphrase of) its cited `source_text`/record fields, and strips or flags anything that fails. This is still "RAG," but the retrieval unit is the domain object this project already built, not a naive text window, and generation is closed-loop verified rather than trusted.

**C. Hybrid (A first, B as fallback).** Attempt structured query (A) first. If the question doesn't cleanly map to a structured query (open-ended, comparative, cross-section, or the archive doesn't have a matching field), fall back to schema-anchored grounded RAG (B) for the same underlying data. The router can be simple (does a structured query return a confident match?) before it needs to be an LLM-based intent classifier.

**D. Fine-tune a model on the corpus.** Rejected. The corpus is small and changes are correctness-critical (an amendment changes what's "current"); baking facts into model weights makes them unauditable, uncitable per-answer, and stale on every guideline update. Fine-tuning solves the wrong problem here (style/behavior) and actively hurts the one that matters (per-claim traceability).

**E. Long-context stuffing (put a whole guideline in the prompt).** Useful as a *fallback or cross-check tool*, not a primary architecture: it sidesteps retrieval-recall-miss for single-document questions, but does nothing for faithfulness (the model can still assert unsupported content from within a huge context) or for citation precision, and cost/latency degrade badly once the corpus covers many guidelines and jurisdictions instead of one PDF.

### 2.3 External check against 2026 industry practice

2026 production RAG practice (checked via web search, not restated here — findings were reported to the user in chat on 2026-08-18) independently converges on the same shape as §2.2's decision: hybrid vector+graph retrieval over naive single-index RAG, retrieval treated as one part of a broader "context engineering" problem rather than a bolt-on, and span-level citation verification as the standard hallucination defense (this directly supports defense-layer 4 in §2.6). It does not change the §2.2 conclusion. Two reusable, evaluated-not-yet-adopted implications: (1) existing eval tooling (RAGAS, DeepEval) should be evaluated for reuse at M1 (§3) instead of building a bespoke harness; (2) this project's schema-level graph precision (typed modality, conditions/exceptions as first-class objects) is what generic GraphRAG systems try to reconstruct after the fact from unstructured text — an existing asset here, not a gap.

### 2.4 Decision

**Use C: structured query first, schema-anchored grounded RAG (B) as fallback — never naive chunk-embedding RAG, never fine-tuning as the primary mechanism.** Long-context stuffing (E) may be used later as an internal cross-check/verification aid, not as the answer-generation path.

Rationale: this repository already paid the cost of building a graph more precise than what most RAG systems retrofit after the fact (typed modality, conditions/exceptions as first-class objects, page-level traceability, `review_status`). An architecture that doesn't route through that graph wastes the project's actual investment and reintroduces the exact hallucination risks the schema was designed to prevent. Recorded in `docs/milestone_log.md` (M0).

### 2.4.1 Cost note: LLM use is optional per sub-step, not mandatory end-to-end

Neither preprocessing nor answering strictly requires an LLM API call everywhere:
- Preprocessing is not eliminated by M1 (§3) — it is deferred and staged. Content the chatbot answers from must still go through the schema (this is *why* naive raw-PDF chunking was rejected in §2.1). SourceUnit-level extraction (verbatim text + page anchor, little judgment) is cheaper than KnowledgeRecord/Condition-level semantic classification (the actual source of the audited governance cost, `history/audits/repository_audit_2026-08-18.md` §3) — expand the cheap tier more freely than the expensive one when M3 comes.
- Option A's NL→query matching can often be done with keyword/regex matching over the closed vocabularies already in the schema (`parameter`, `section_number`, `guideline_code`, etc.) — no LLM call required for the common case.
- Option A's answer step needs no generation at all: it fills a template from typed fields plus verbatim `source_text`.
- Option B's default should be **extractive** (show the matched `source_text` excerpt(s) verbatim with citation, no paraphrase) rather than generative-by-default. Free-form generation is an escalation for when extractive quoting reads too disjointed, not the default path — this keeps cost near zero for most traffic and keeps the strongest hallucination guarantee (nothing generated to verify).
- A local/open-source model is a valid substitute for a cloud API where used, trading per-query API cost for hosting cost — a later decision, not an M1 blocker.

### 2.5 Scale reconsideration

The eventual target is closer to "many regulators" (ICH + FDA + EMA + OECD) than "a couple more ICH guidelines," reached incrementally rather than all at once. That changes two calls from §2.4/§2.4.1, made explicitly to avoid a costly rewrite once incremental additions accumulate:

- **Retrieval index: adopt an embeddable vector store from M1, not later.** Plain in-memory array search (as implied by §2.4.1) would need to be replaced once volume grows — a real migration. An embeddable local vector store behind a thin retrieval interface avoids that: the same interface scales from today's ~93 records to a much larger corpus, and can later point at a hosted backend without touching the generation/citation-verification code above it. Selection criteria for M1 (final pick made when M1 starts, not here): the current stack is pure Node.js with zero running server processes (`package.json` — one dependency, `node --test`); prefer an option with a native Node binding and no separate server to operate, e.g. LanceDB (has a Node SDK, file-based) or sqlite-vec (via `better-sqlite3`, file-based) — evaluate those two first. A client/server tool (e.g. a standalone Chroma server) is a fallback only if neither embedded option fits, since it adds an operational component this project doesn't otherwise have.
- **Extraction: move to schema-constrained LLM extraction starting at M1, not deferred.** Manual curation (the source of the audited governance cost — roughly one governance entry per 2.5-2.7 structured records, `history/audits/repository_audit_2026-08-18.md` §3) cannot cover a multi-regulator corpus — this isn't a trend preference, it's a volume requirement. Mechanics:
  1. `SourceUnit`-level extraction stays mechanical (verbatim text + page trace, minimal judgment) — unchanged from today's process. Rule for page-spanning paragraphs (confirmed pervasive by a full read of both source PDFs — occurs at most page boundaries in both documents, `docs/milestone_log.md` M0): split at the page break into two `SourceUnit`s, each with its own correct `pdf_page_index_zero_based`/`printed_page_label`, linked via `related_source_unit_ids` — never force one page trace onto text that spans two pages. This uses existing fields only; no schema change.
  2. An LLM proposes `KnowledgeRecord`/`QuantitativeCriterion`/`Condition`/`CrossReference` candidates using the **existing** `data/schemas/guideline_bundle.schema.json` as a schema-constrained output target (JSON mode / tool-use / structured-output APIs, not free-form prompting) — the model can only emit values inside the schema's closed vocabularies (`record_type`, `modality`, `condition_type`, etc.), which also avoids the inconsistent-ontology problem generic GraphRAG-style auto-extraction has across documents, since the ontology is fixed instead of invented per document. Invocation granularity: one call per `Section` (its ordered `SourceUnit` texts + IDs as input), not per-`SourceUnit` (too fragmented — conditions/criteria commonly span multiple sentences) or per-document (too large to localize errors in); output references the input `source_unit_ids`, never restates their text.
  3. The LLM never generates or paraphrases `source_text` — that field is always copied verbatim from step 1. LLM fallibility is confined to the classification/labeling layer, which already has a review safety net (step 4).
  4. Every LLM-produced record is schema-validated immediately with the existing validator (`validation/validate_structured_data.js`) and starts at `review_status=needs_review` (the vocabulary already supports this — no schema change).
- What does *not* change: dedicated graph-database products (Neo4j etc.) stay deferred — the existing ID-referenced JSON graph (`CrossReference`/`Condition.applies_to_ids`) is already additive across accumulated files by design (each document is a self-contained bundle per `docs/schema.md`'s bundle contract, and cross-references resolve across the whole validated set) and doesn't degrade the way linear vector search does, so there's no equivalent migration trap to preempt there. A regulator-neutral derived-contract layer for amendment/effective-state tracking was explored early and archived, unused, at M1 (`docs/milestone_log.md`); if a second regulator's real data later needs this, design it fresh against the live schema rather than reviving the archived design.

### 2.5.1 No human review loop: agent extraction, agent verification

Per-document human read-through is dropped from the default pipeline — time cost and ROI don't support it at multi-regulator scale, and it isn't what makes the pipeline trustworthy anyway. What makes it trustworthy is keeping generation and verification at *different task granularities*, not assuming an agent checking another agent's output is automatically safe (two LLM calls of the same kind can share the same blind spot).

- **Extraction agent** (§2.5 step 2): broad judgment task (classify record_type/modality, extract criteria/conditions) — the highest-error-rate step, by design constrained to the schema's closed vocabularies.
- **Verification agent**: a separate, deliberately narrower task — for each drafted field/claim, check only whether it is entailed by the specific `source_text` it cites. This is a bounded yes/no check, not open classification, so it is inherently more reliable than the extraction step even though it's also an LLM/agent call. Prefer a different model/provider from the extraction agent where practical, to reduce correlated blind spots. Failing entailment does not discard the record — it stays `needs_review` and visible, never silently dropped or silently promoted.
- **Sampling-based drift monitoring**: since no human reads every record, the eval harness (moved up to M1, see §3) is the only mechanism that can catch a systematic pipeline error (e.g., the extraction agent consistently mishandling one phrasing pattern across many documents). Periodic sampling, weighted toward higher-risk fields (`QuantitativeCriterion` values, `modality=must`/`should`, exception `Condition`s), re-checked with a stronger/different model, with tracked error rate over time — this is what a human spot-check would have caught, done as monitoring instead of gating.
- **`review_status` meaning changes accordingly**: `reviewed` now means "passed the extraction + verification + validator pipeline," not "a human read it." TPP §1.3 already commits to surfacing `review_status` rather than hiding it — that commitment now specifically means never implying human review took place when it didn't. If this distinction later needs its own field rather than overloading `review_status`, that's a schema change to make when real ambiguity is demonstrated, not preemptively — the same evidence-first bar `docs/schema.md`'s extension notes already set for adding any new controlled vocabulary.

### 2.6 Hallucination defense in depth

Layered, not single-point:
1. Schema-level anchoring (exists today: `source_unit_ids`, page trace, `modality`, `condition_ids`).
2. Retrieval scoped to graph objects, not raw chunks (Option B/C above — to build).
3. Generation constrained to quote/cite specific record IDs (to build).
4. Post-hoc citation verification before an answer is shown (string-containment or entailment check against `source_text` — to build).
5. A separate, narrower verification agent at extraction time (§2.5.1), not a human read-through — to build, part of M1.
6. Explicit refusal path reusing the existing `needs_review`/`unknown`/`unresolved` vocabulary the schema already has, surfaced to the end user rather than only to analysts (to build).
7. Effective-state/date-aware resolution using `EffectiveRecord` once the derived layer is populated beyond the S6 prototype (to build).
8. Sampling-based drift monitoring via an eval set of gold question/citation pairs — moved up to M1 (§3), since without human review this is the only systemic error detector, not a later nice-to-have.

## 3. Roadmap

The initial audit established the ordering below; M0-M5 are now complete at MVP level. Current verification numbers live in `docs/verification_status.md`, current coverage in `docs/coverage/`, and detailed historical evidence under `history/`.

- **M0 — Foundation audit + roadmap.** Done. `history/audits/repository_audit_2026-08-18.md` + this document.
- **M1 — Chatbot MVP + extraction/verification pipeline, built on scale-ready primitives. Done (2026-08-19).** All items delivered and measured, not just built: (1) `KnowledgeRecord`/`SourceUnit`/`Condition` indexed behind a thin retrieval interface (`engine/data_store.js`, `engine/vector_store.js`); (2) schema-constrained extraction agent (§2.5) and a separate, narrower verification agent (§2.5.1), wired together in `engine/pipeline.js`; (3) gold question/citation eval set + sampling-based drift monitoring (`engine/eval_harness.js`, 9/9 passing); (4) Option A structured-query answering (§2.2), exercised live; (5) Option B grounded-RAG fallback (§2.2), exercised against a live model for the first time on 2026-08-19 (`docs/milestone_log.md` M1) — both a real answer and the no-candidates refusal path confirmed; (6) citation-verification check before any answer is shown; (7) explicit refusal when nothing matches. **Entailment-check accuracy against real source text was measured, not assumed**: acceptance bar set at KR≥90% / QC≥85% / Cond≥95% reviewed-of-extracted — a forward-tracking target for M2+ to improve toward, not an M1 gate (historical measured baseline, `history/verification/engine_test_record_through_2026-08-28.md` Entry 004: KR 88.4%, QC 71.4%, Cond 97.6% — QC in particular has real, tracked headroom). The current baseline is summarized in `docs/verification_status.md`.
- **M2 — Use it, watch where it fails. Done (2026-08-19).** Real target-user questions established recurring coverage gaps and drove M3. New questions and feedback are written to the configured deployment-local runtime paths (`logs/runtime/` by default), never committed automatically. The original evidence snapshot is frozen at `history/usage/m2_queries_2026-08-19_to_2026-08-28.jsonl`.
- **M3 — Coverage expansion. Done (2026-08-27).** Real M2 gaps drove six current ICH/FDA/EMA bundles. Per-guideline section matrices live in `docs/coverage/`; further expansion remains usage-driven rather than a full-document batch pass.
- **M4 — Amendment/effective-state–aware answering. Done (2026-08-27).** Comparison and amendment modes now render claim-level grounded content only. The abandoned derived-contract experiment remains frozen under `history/derived_contract/` and is not an active dependency.
- **M5 — Local-first production MVP. Core scope done (2026-08-28).** Delivered the HTTP API, minimal web UI, authentication, monitoring aggregation, feedback flow, answer-page readability, and security hardening. Remaining work is live two-provider verification, post-M1 extraction-accuracy re-measurement, and deployment/TLS/retention decisions if the product moves beyond local-first use.
- **M6 — Regulatory World Model / Applicability Engine spike. Explored, then discontinued as a separate module (2026-08-25/26).** A separately-scoped, additive spike (not a TPP change — §1.4's non-goal boundary was never touched) evaluating whether a specific rule applies given a structured RegulatoryContext, using the existing `Condition` graph as evidence. The applicability-model-generalizes hypothesis it set out to test held (0 new RegulatoryContext slot types needed across three guideline shapes, 71 conditions), but a real-usage review found the resulting verdict architecture (its own CLI, a four-value judgment, binding roles) too much separate maintenance surface for a 71-of-279-condition coverage island with no natural-language entry point. Discontinued as a standalone module; code and data archived at `history/applicability_engine/`, full narrative in `docs/milestone_log.md` M6. Two findings were kept as direct improvements to the existing engine instead (additional Korean synonyms in `engine/text_utils.js`; a `Condition` caveat now shown on every `engine/query_router.js` answer, using data that was already being computed correctly but never displayed).

## 4. Governance

Logging convention and the repository cleanup verdict live in `AGENTS.md` (the active rule) and `docs/milestone_log.md` M0 (what was decided and why) — not restated here, since this document is about what to build, not how decisions get recorded.
