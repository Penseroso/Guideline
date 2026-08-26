const fs = require("fs");
const readline = require("readline");

const { loadStore } = require("./data_store");
const { answer } = require("./query_router");
const { createStore } = require("./vector_store");
const { createClient, availableProviders } = require("./llm_client");
const { logInteraction } = require("./query_log");
const { createContext } = require("./regulatory_context");

// Case-insensitive: a real M2 session logged "EXIT" (all-caps) as a
// refused question instead of quitting — found live, docs/milestone_log.md M2.
function isExitCommand(question) {
  return /^(exit|quit)$/i.test(question);
}

function isContextCommand(line) {
  return /^:context\b/i.test(line.trim());
}

/**
 * Pure parse+apply for the interactive `:context` command (Applicability
 * Layer 0.1.0). Kept side-effect-free and separate from main()'s readline
 * loop so it's directly unit-testable, the same pattern as isExitCommand.
 * Never applies an invalid slot/value silently — createContext() throwing
 * is caught here and reported as a message, leaving the prior context
 * (`current`) untouched.
 *
 * `:context`             -> show the current context
 * `:context set K V`     -> validate and set one slot (all-or-nothing:
 *                            the whole resulting context must validate)
 * `:context clear`       -> reset to {}
 */
function applyContextCommand(current, line) {
  const parts = line.trim().split(/\s+/);
  const [, sub, key, value] = parts;

  if (!sub) {
    return { context: current, message: `Current context: ${JSON.stringify(current)}` };
  }
  if (sub === "clear") {
    return { context: {}, message: "Context cleared." };
  }
  if (sub === "set" && key && value !== undefined) {
    try {
      const next = createContext({ ...current, [key]: value });
      return { context: next, message: `Set ${key}=${value}. Context: ${JSON.stringify(next)}` };
    } catch (error) {
      return { context: current, message: error.message };
    }
  }
  return { context: current, message: "Usage: :context | :context set <slot> <value> | :context clear" };
}

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

// --context <file>: load a starting RegulatoryContext at startup. Fails
// fast (exit 1) on an invalid file — a confirmed context is the only thing
// this CLI will ever hand to the applicability engine, so an invalid
// --context argument is a usage error, not something to silently ignore.
function loadInitialContext(argv) {
  const flagIndex = argv.indexOf("--context");
  if (flagIndex === -1) return {};
  const file = argv[flagIndex + 1];
  if (!file) {
    console.error("--context requires a file path");
    process.exit(2);
  }
  try {
    return createContext(JSON.parse(fs.readFileSync(file, "utf8")));
  } catch (error) {
    console.error(`Failed to load --context ${file}: ${error.message}`);
    process.exit(1);
  }
}

async function main() {
  const { records, index } = loadStore();
  const { client, store, provider } = setUpOptionB(records);
  let context = loadInitialContext(process.argv.slice(2));

  console.log(
    `Regulatory Guideline Archive — MVP CLI.\n` +
    `${index.documents.size} document(s), ${records.length} answerable record(s) loaded. ` +
    (provider
      ? `Option B fallback active (${provider}).`
      : `Option A (structured query) only — no LLM provider configured, see .env.example.`) +
    `\nType a question, ":context" to inspect/set the RegulatoryContext, or "exit" to quit.\n`
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
      if (isContextCommand(question)) {
        const result = applyContextCommand(context, question);
        context = result.context;
        console.log(result.message);
        console.log("");
        rl.prompt();
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

module.exports = { main, setUpOptionB, isExitCommand, isContextCommand, applyContextCommand, loadInitialContext };
