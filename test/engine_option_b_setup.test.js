const test = require("node:test");
const assert = require("node:assert/strict");

const { loadStore } = require("../engine/data_store");
const { setUpOptionB } = require("../engine/cli");

const { records } = loadStore();
const KEYS = ["ANTHROPIC_API_KEY", "OPENAI_API_KEY", "OPTION_B_GENERATOR_PROVIDER", "OPTION_B_VERIFIER_PROVIDER"];

async function withEnv(values, fn) {
  const saved = Object.fromEntries(KEYS.map((key) => [key, process.env[key]]));
  try {
    for (const key of KEYS) delete process.env[key];
    Object.assign(process.env, values);
    await fn();
  } finally {
    for (const key of KEYS) {
      if (saved[key] === undefined) delete process.env[key];
      else process.env[key] = saved[key];
    }
  }
}

test("no configured provider keeps Option B disabled", async () => {
  await withEnv({}, async () => {
    assert.deepEqual(setUpOptionB(records), {});
  });
});

test("one configured provider selects extractive mode with no model client", async () => {
  await withEnv({ OPENAI_API_KEY: "test-key" }, async () => {
    const setup = setUpOptionB(records);
    assert.equal(setup.optionBMode, "extractive");
    assert.equal(setup.client, null);
    assert.equal(setup.generatorClient, null);
    assert.ok(setup.store);
  });
});

test("two configured providers select distinct generation and verification clients", async () => {
  await withEnv({ ANTHROPIC_API_KEY: "test-key-a", OPENAI_API_KEY: "test-key-b" }, async () => {
    const setup = setUpOptionB(records);
    assert.equal(setup.optionBMode, "generative");
    assert.equal(setup.provider, "anthropic");
    assert.equal(setup.verifierProvider, "openai");
    assert.notEqual(setup.generatorClient, setup.verifierClient);
  });
});

test("requesting the same provider for both roles fails closed to extractive mode", async () => {
  await withEnv({
    ANTHROPIC_API_KEY: "test-key-a",
    OPENAI_API_KEY: "test-key-b",
    OPTION_B_GENERATOR_PROVIDER: "openai",
    OPTION_B_VERIFIER_PROVIDER: "openai"
  }, async () => {
    const setup = setUpOptionB(records);
    assert.equal(setup.optionBMode, "extractive");
    assert.equal(setup.generatorClient, null);
    assert.equal(setup.verifierClient, null);
  });
});
