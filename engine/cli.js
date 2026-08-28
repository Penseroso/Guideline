const readline = require("readline");

const { loadStore } = require("./data_store");
const { answer } = require("./query_router");
const { createStore } = require("./vector_store");
const { createClient, availableProviders } = require("./llm_client");
const { logInteraction } = require("./query_log");

// Case-insensitive: a real M2 session logged "EXIT" (all-caps) as a
// refused question instead of quitting — found live, docs/milestone_log.md M2.
function isExitCommand(question) {
  return /^(exit|quit)$/i.test(question);
}

/**
 * Option B only activates when a provider is actually configured
 * (product_roadmap.md §2.4.1 — LLM use is optional per sub-step).
 * With no key set, this CLI runs Option A only, at zero API cost.
 */
function setUpOptionB(records) {
  const providers = availableProviders();
  if (providers.length === 0) return {};

  const store = createStore(); // keyword mode until an embed function is wired up
  store.index(records);
  const requestedGenerator = process.env.OPTION_B_GENERATOR_PROVIDER || null;
  const requestedVerifier = process.env.OPTION_B_VERIFIER_PROVIDER || null;
  const generatorProvider = requestedGenerator && providers.includes(requestedGenerator) ? requestedGenerator : providers[0];
  const verifierProvider = requestedVerifier && providers.includes(requestedVerifier)
    ? requestedVerifier
    : providers.find((name) => name !== generatorProvider) || null;

  if (!verifierProvider || verifierProvider === generatorProvider) {
    return {
      client: null,
      generatorClient: null,
      verifierClient: null,
      store,
      provider: null,
      verifierProvider: null,
      configuredProviders: providers,
      optionBMode: "extractive"
    };
  }

  const generatorClient = createClient(generatorProvider);
  const verifierClient = createClient(verifierProvider);
  return {
    client: generatorClient,
    generatorClient,
    verifierClient,
    store,
    provider: generatorProvider,
    verifierProvider,
    configuredProviders: providers,
    optionBMode: "generative"
  };
}

async function main() {
  const { records, index } = loadStore();
  const { client, generatorClient, verifierClient, store, provider, verifierProvider, optionBMode } = setUpOptionB(records);

  console.log(
    `Regulatory Guideline Archive — MVP CLI.\n` +
    `${index.documents.size} document(s), ${records.length} answerable record(s) loaded. ` +
    (optionBMode === "generative"
      ? `Option B fallback active (${provider} generation + ${verifierProvider} verification).`
      : optionBMode === "extractive"
        ? "Option B extractive fallback active (no generated answer)."
        : "Option A (structured query) only — no LLM provider configured, see .env.example.") +
    `\nType a question, or "exit" to quit.\n`
  );

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout, prompt: "> " });
  rl.prompt();

  // Piped multi-line input (e.g. `printf "q1\nexit\n" | node engine/cli.js`)
  // can deliver both "line" events, and the stream's own "close", before an
  // earlier async handler's console.log has run — pause()/resume() alone
  // did not prevent this (verified). An explicit FIFO promise queue does:
  // "close" only exits after every queued line has actually finished.
  let queue = Promise.resolve();

  rl.on("line", (line) => {
    queue = queue.then(async () => {
      const question = line.trim();
      if (isExitCommand(question)) {
        rl.close();
        return;
      }
      if (question) {
        const result = await answer(question, records, { client, generatorClient, verifierClient, store, index, optionBMode });
        console.log(result.text);
        if (result.answered && result.review_status !== "reviewed") {
          console.log(`[review_status: ${result.review_status} — not fully reviewed]`);
        }
        console.log("");
        logInteraction(question, result);
      }
      rl.prompt();
    });
  });

  rl.on("close", () => {
    queue.then(() => process.exit(0));
  });
}

if (require.main === module) {
  main();
}

module.exports = { main, setUpOptionB, isExitCommand };
