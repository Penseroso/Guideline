/**
 * Provider-agnostic LLM boundary (product_roadmap.md §2.5, "provider
 * chosen by env var, not hardcoded"). Extraction/verification/generation
 * code (engine/extraction_agent.js, engine/verification_agent.js,
 * engine/query_router.js Option B) must only ever call `complete()`
 * from here — never import an SDK directly — so swapping or running
 * both providers side by side (e.g. extraction on one, verification
 * on a different one, per product_roadmap.md §2.5.1's correlated-
 * blind-spot mitigation) is a config change, not a code change.
 *
 * Interface:
 *   complete({ system, messages, schema, maxTokens, signal }) -> Promise<object|{text}>
 *     - schema (optional): a JSON Schema object. When present, the
 *       adapter forces structured/tool-use output conforming to it
 *       and returns the parsed object directly.
 *     - when schema is omitted, returns { text: "..." } (plain
 *       completion — used for the entailment yes/no check and for
 *       Option B's constrained generation).
 */

require("dotenv").config({ path: require("path").resolve(__dirname, "..", ".env"), quiet: true });

const PROVIDERS = {
  anthropic: { envVar: "ANTHROPIC_API_KEY", module: "./anthropic_adapter" },
  openai: { envVar: "OPENAI_API_KEY", module: "./openai_adapter" }
};

function availableProviders() {
  return Object.entries(PROVIDERS)
    .filter(([, cfg]) => Boolean(process.env[cfg.envVar]))
    .map(([name]) => name);
}

/**
 * @param {"anthropic"|"openai"} [preferred] - required provider; if
 *   omitted, picks the first configured provider in PROVIDERS order.
 */
function createClient(preferred) {
  const candidates = preferred ? [preferred] : Object.keys(PROVIDERS);

  for (const name of candidates) {
    const cfg = PROVIDERS[name];
    if (!cfg) throw new Error(`llm_client: unknown provider "${name}". Known: ${Object.keys(PROVIDERS).join(", ")}`);
    if (process.env[cfg.envVar]) {
      const adapter = require(cfg.module);
      return { provider: name, ...adapter.create() };
    }
  }

  const tried = candidates.map((name) => PROVIDERS[name] && PROVIDERS[name].envVar).filter(Boolean);
  throw new Error(
    `llm_client: no LLM provider configured. Set one of: ${tried.join(", ")}. ` +
    `See .env.example. (Requested: ${preferred || "any"})`
  );
}

module.exports = { createClient, availableProviders, PROVIDERS };
