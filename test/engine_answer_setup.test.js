const test = require("node:test");
const assert = require("node:assert/strict");

const { loadStore } = require("../engine/data_store");
const { setUpAnswering, OPENAI_GENERATOR_MODEL, OPENAI_VERIFIER_MODEL } = require("../engine/cli");
const { answer } = require("../engine/query_router");

const { records, index } = loadStore();
const KEYS = [
  "ANTHROPIC_API_KEY", "OPENAI_API_KEY",
  "GUIDELINE_GENERATOR_PROVIDER", "GUIDELINE_VERIFIER_PROVIDER",
  "GUIDELINE_GENERATOR_MODEL", "GUIDELINE_VERIFIER_MODEL"
];

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

test("no configured provider still enables local source-excerpt fallback", async () => {
  await withEnv({}, async () => {
    const setup = setUpAnswering(records);
    assert.equal(setup.fallbackMode, "source_excerpts");
    assert.equal(setup.generatorClient, null);
    assert.equal(setup.verifierClient, null);
    assert.ok(setup.store);
    const result = await answer("ICH M10에서 full validation은 언제 필요한가?", records, { ...setup, index });
    assert.equal(result.answered, true);
    assert.equal(result.route, "source_excerpts");
    assert.ok(result.answer_units.length > 0);
  });
});

test("one OpenAI key selects distinct generation and verification models", async () => {
  await withEnv({ OPENAI_API_KEY: "test-key" }, async () => {
    const setup = setUpAnswering(records);
    assert.equal(setup.fallbackMode, "grounded_generation");
    assert.equal(setup.generatorProvider, "openai");
    assert.equal(setup.verifierProvider, "openai");
    assert.equal(setup.generatorModel, OPENAI_GENERATOR_MODEL);
    assert.equal(setup.verifierModel, OPENAI_VERIFIER_MODEL);
    assert.equal(setup.verificationMode, "cross_model");
    assert.notEqual(setup.generatorClient, setup.verifierClient);
    assert.ok(setup.store);
  });
});

test("two configured providers select distinct generation and verification clients", async () => {
  await withEnv({ ANTHROPIC_API_KEY: "test-key-a", OPENAI_API_KEY: "test-key-b" }, async () => {
    const setup = setUpAnswering(records);
    assert.equal(setup.fallbackMode, "grounded_generation");
    assert.equal(setup.generatorProvider, "anthropic");
    assert.equal(setup.verifierProvider, "openai");
    assert.equal(setup.verificationMode, "cross_provider");
    assert.notEqual(setup.generatorClient, setup.verifierClient);
  });
});

test("same-provider configuration accepts distinct explicit models", async () => {
  await withEnv({
    OPENAI_API_KEY: "test-key",
    GUIDELINE_GENERATOR_PROVIDER: "openai",
    GUIDELINE_VERIFIER_PROVIDER: "openai",
    GUIDELINE_GENERATOR_MODEL: "model-generator",
    GUIDELINE_VERIFIER_MODEL: "model-verifier"
  }, async () => {
    const setup = setUpAnswering(records);
    assert.equal(setup.fallbackMode, "grounded_generation");
    assert.equal(setup.generatorModel, "model-generator");
    assert.equal(setup.verifierModel, "model-verifier");
    assert.equal(setup.verificationMode, "cross_model");
  });
});

test("same-provider configuration with the same model fails closed to source excerpts", async () => {
  await withEnv({
    OPENAI_API_KEY: "test-key",
    GUIDELINE_GENERATOR_MODEL: "same-model",
    GUIDELINE_VERIFIER_MODEL: "same-model"
  }, async () => {
    const setup = setUpAnswering(records);
    assert.equal(setup.fallbackMode, "source_excerpts");
    assert.equal(setup.generatorClient, null);
    assert.equal(setup.verifierClient, null);
  });
});
