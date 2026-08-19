const readline = require("readline");

const { loadStore } = require("./data_store");
const { answer } = require("./query_router");
const { createStore } = require("./vector_store");
const { createClient, availableProviders } = require("./llm_client");
const { logInteraction } = require("./query_log");

/**
 * Option B only activates when a provider is actually configured
 * (product_roadmap.md §2.4.1 — LLM use is optional per sub-step).
 * With no key set, this CLI runs Option A only, at zero API cost.
 */
function setUpOptionB(records) {
  const providers = availableProviders();
  if (providers.length === 0) return {};

  const client = createClient();
  const store = createStore(); // keyword mode until an embed function is wired up
  store.index(records);
  return { client, store, provider: client.provider };
}

async function main() {
  const { records, index } = loadStore();
  const { client, store, provider } = setUpOptionB(records);

  console.log(
    `Regulatory Guideline Archive — MVP CLI.\n` +
    `${index.documents.size} document(s), ${records.length} answerable record(s) loaded. ` +
    (provider
      ? `Option B fallback active (${provider}).`
      : `Option A (structured query) only — no LLM provider configured, see .env.example.`) +
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
      if (question === "exit" || question === "quit") {
        rl.close();
        return;
      }
      if (question) {
        const result = await answer(question, records, { client, store });
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

module.exports = { main, setUpOptionB };
