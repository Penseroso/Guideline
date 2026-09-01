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

const OPENAI_GENERATOR_MODEL = "gpt-5.6-terra";
const OPENAI_VERIFIER_MODEL = "gpt-5.6-sol";

/**
 * Sets up the semantic answer routes:
 * structured answer -> grounded generation -> source excerpts -> refusal.
 * Local source retrieval is always available and never depends on an API key.
 */
function setUpAnswering(records) {
  const store = createStore(); // keyword mode until an embed function is wired up
  store.index(records);
  const providers = availableProviders();
  if (providers.length === 0) {
    return {
      generatorClient: null,
      verifierClient: null,
      store,
      generatorProvider: null,
      verifierProvider: null,
      generatorModel: null,
      verifierModel: null,
      verificationMode: "none",
      configuredProviders: [],
      fallbackMode: "source_excerpts"
    };
  }

  const requestedGenerator = process.env.GUIDELINE_GENERATOR_PROVIDER || null;
  const requestedVerifier = process.env.GUIDELINE_VERIFIER_PROVIDER || null;
  const generatorProvider = requestedGenerator && providers.includes(requestedGenerator) ? requestedGenerator : providers[0];
  const verifierProvider = requestedVerifier && providers.includes(requestedVerifier)
    ? requestedVerifier
    : providers.find((name) => name !== generatorProvider) || generatorProvider;

  const generatorModel = process.env.GUIDELINE_GENERATOR_MODEL ||
    (generatorProvider === "openai" ? OPENAI_GENERATOR_MODEL : null);
  const verifierModel = process.env.GUIDELINE_VERIFIER_MODEL ||
    (verifierProvider === "openai"
      ? verifierProvider === generatorProvider ? OPENAI_VERIFIER_MODEL : OPENAI_GENERATOR_MODEL
      : null);

  // A same-provider verifier must use a distinct model. If the provider has
  // no configured/default distinct pair, fail closed to verbatim excerpts.
  if (verifierProvider === generatorProvider && (!generatorModel || !verifierModel || generatorModel === verifierModel)) {
    return {
      generatorClient: null,
      verifierClient: null,
      store,
      generatorProvider,
      verifierProvider,
      generatorModel,
      verifierModel,
      verificationMode: "none",
      configuredProviders: providers,
      fallbackMode: "source_excerpts"
    };
  }

  const generatorClient = createClient(generatorProvider, { model: generatorModel || undefined });
  const verifierClient = createClient(verifierProvider, { model: verifierModel || undefined });
  return {
    generatorClient,
    verifierClient,
    store,
    generatorProvider,
    verifierProvider,
    generatorModel: generatorClient.model,
    verifierModel: verifierClient.model,
    verificationMode: generatorProvider === verifierProvider ? "cross_model" : "cross_provider",
    configuredProviders: providers,
    fallbackMode: "grounded_generation"
  };
}

async function main() {
  const { records, index } = loadStore();
  const setup = setUpAnswering(records);
  const { generatorClient, verifierClient, store, generatorProvider, verifierProvider, generatorModel, verifierModel, fallbackMode } = setup;

  console.log(
    `Regulatory Guideline Archive — MVP CLI.\n` +
    `${index.documents.size} document(s), ${records.length} answerable record(s) loaded. ` +
    (fallbackMode === "grounded_generation"
      ? `Grounded generation active (${generatorProvider}/${generatorModel} generation + ${verifierProvider}/${verifierModel} verification).`
      : "Structured answers with source-excerpt fallback active (no generated answer).") +
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
        const result = await answer(question, records, { generatorClient, verifierClient, store, index, fallbackMode });
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

module.exports = { main, setUpAnswering, isExitCommand, OPENAI_GENERATOR_MODEL, OPENAI_VERIFIER_MODEL };
