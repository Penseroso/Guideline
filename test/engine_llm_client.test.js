const test = require("node:test");
const assert = require("node:assert/strict");

const { createClient, availableProviders } = require("../engine/llm_client");

function withEnv(vars, fn) {
  const saved = {};
  for (const key of Object.keys(vars)) saved[key] = process.env[key];
  for (const [key, value] of Object.entries(vars)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  try {
    return fn();
  } finally {
    for (const key of Object.keys(vars)) {
      if (saved[key] === undefined) delete process.env[key];
      else process.env[key] = saved[key];
    }
  }
}

test("createClient throws a clear, actionable error when no provider is configured", () => {
  withEnv({ ANTHROPIC_API_KEY: undefined, OPENAI_API_KEY: undefined }, () => {
    assert.throws(() => createClient(), /no LLM provider configured/);
  });
});

test("createClient picks anthropic when ANTHROPIC_API_KEY is set (construction only, no network call)", () => {
  withEnv({ ANTHROPIC_API_KEY: "test-key-not-real", OPENAI_API_KEY: undefined }, () => {
    const client = createClient();
    assert.equal(client.provider, "anthropic");
    assert.equal(typeof client.complete, "function");
  });
});

test("createClient picks openai when only OPENAI_API_KEY is set", () => {
  withEnv({ ANTHROPIC_API_KEY: undefined, OPENAI_API_KEY: "test-key-not-real" }, () => {
    const client = createClient();
    assert.equal(client.provider, "openai");
  });
});

test("createClient(preferred) honors an explicit provider request over env-order default", () => {
  withEnv({ ANTHROPIC_API_KEY: "a", OPENAI_API_KEY: "b" }, () => {
    assert.equal(createClient("openai").provider, "openai");
    assert.equal(createClient("anthropic").provider, "anthropic");
  });
});

test("createClient(preferred) throws if the requested provider's key is missing, even if another provider is configured", () => {
  withEnv({ ANTHROPIC_API_KEY: "a", OPENAI_API_KEY: undefined }, () => {
    assert.throws(() => createClient("openai"), /no LLM provider configured/);
  });
});

test("createClient rejects an unknown provider name", () => {
  withEnv({ ANTHROPIC_API_KEY: "a" }, () => {
    assert.throws(() => createClient("not-a-real-provider"), /unknown provider/);
  });
});

test("availableProviders reflects which env vars are currently set", () => {
  withEnv({ ANTHROPIC_API_KEY: "a", OPENAI_API_KEY: undefined }, () => {
    assert.deepEqual(availableProviders(), ["anthropic"]);
  });
  withEnv({ ANTHROPIC_API_KEY: undefined, OPENAI_API_KEY: undefined }, () => {
    assert.deepEqual(availableProviders(), []);
  });
});
