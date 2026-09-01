# Regulatory Guideline Archive

A hallucination-resistant conversational assistant for regulatory guidelines, built on a traceable structured-data archive. Every answer is grounded in cited source text; the assistant refuses rather than invents when nothing in the archive supports a question. See `docs/product_roadmap.md` for the target product profile, implementation approach, and active roadmap — start there for current direction.

## Current Status

- **Data model**: `docs/schema.md`, model version `0.5.0`, enforced by `data/schemas/guideline_bundle.schema.json`. See `docs/coverage/` for the current per-guideline section matrices and `docs/milestone_log.md` for milestone status.
- **Engine** (`engine/`): loads and indexes the pilot bundles and routes automatically through structured evidence, grounded generation, verbatim source excerpts, then refusal. Local structured answers and excerpt retrieval work without an API key. One OpenAI key can use distinct generator and verifier models; OpenAI + Anthropic can instead verify across providers. Every answer surfaces the record's own attached `Condition`s as a verbatim caveat, never a judgment about whether they hold. Try it with `npm run chat`.
- **Web UI** (`web/`, M5): a local-first HTTP API (`engine/server.js`) and vanilla-JS UI over the same engine. `npm run serve` binds `127.0.0.1` by default. When `GUIDELINE_AUTH_TOKEN` is set, API, UI assets, and PDFs all require either Bearer auth or browser Basic auth using username `guideline` and the token as password.
- **Validation**: `npm test` (unit tests, mocked LLM calls, no network), `npm run validate:pilots` (schema + cross-reference validation over all pilot bundles), `npm run eval` (gold question/citation regression set, structured route only by default, zero API cost).

An M6 spike explored a separate "Applicability Engine" (given a structured program context, deterministically evaluate whether a specific rule applies) on top of a derived `Condition`→predicate layer. It was discontinued as a standalone module after a real-usage review found it added a large separate architecture on top of a narrow, 3-guideline island of coverage — see `docs/milestone_log.md` M6 and `history/applicability_engine/` for the full record. Two improvements it surfaced were cherry-picked into this engine directly (both described above): additional Korean regulatory-term synonyms, and the `Condition` caveat now shown on every answer.

## Repository Map

- `source_pdfs/`: immutable original guideline PDFs.
- `docs/`: active project scope, data model, coverage matrices, verification summary, roadmap, and milestone index.
- `data/`: the reviewed pilot bundles, the source JSON Schema (`data/pilots/`, `data/schemas/`), and the declarative document/section scope ontology (`data/ontology/`).
- `engine/`: the chatbot/extraction/verification application layer, plus `server.js` (HTTP API).
- `web/`: the local-first web UI served by `engine/server.js` (vanilla HTML/CSS/JS, no build step).
- `validation/`: reproducible validation scripts.
- `test/`: unit tests (mocked LLM clients — no live API calls in CI) and schema validation tests.
- `logs/`: the tracked evaluation drift record plus Git-ignored `logs/runtime/` question and feedback logs. Runtime logs may contain sensitive text; disable them with `GUIDELINE_LOG_ENABLED=false` or redirect them with the path variables in `.env.example`.
- `history/`: frozen audits, source assessments, detailed verification/milestone narratives, historical usage artifacts, and discontinued prototypes. Nothing under this directory is an active source of truth.

## Security and privacy defaults

- Keep the default loopback bind for local use. For any non-loopback deployment, terminate HTTPS at a trusted reverse proxy; Basic credentials must never cross an unencrypted network.
- Browser POST requests must be same-origin JSON. Cross-origin and browser-simple `text/plain` submissions are rejected, and loopback mode accepts only localhost Host headers. Set `GUIDELINE_ALLOWED_HOSTS` explicitly when a reverse proxy uses another hostname.
- Full question/answer and feedback logs are plaintext. Live logs are Git-ignored under `logs/runtime/` by default; use the path variables in `.env.example` to store them elsewhere with deployment-appropriate file permissions, or disable persistence. There is no automatic retention deletion.
- Grounded generation has a 30-second default deadline, a two-request concurrency limit, abort propagation to both supported SDKs, and a fixed two-model-call maximum.

## Key Documents

- `docs/product_roadmap.md`: target product profile, implementation-approach decision (RAG and alternatives, agent-driven extraction/verification), and the active roadmap.
- `docs/milestone_log.md`: active decision record, one entry per roadmap milestone — the source of truth for what changed, why, and what it affects.
- `docs/verification_status.md`: current accepted verification baseline and explicitly open verification work.
- `docs/coverage/`: current per-guideline coverage matrices.
- `docs/schema.md`: the current data model.
- `docs/project_scope.md`: mission, users, design principles, and non-goals.
- `history/audits/`, `history/source_assessments/`, `history/verification/`, and `history/milestones/`: frozen evidence and completed-milestone detail.
- `AGENTS.md`: repository-wide operating rules for agents.
