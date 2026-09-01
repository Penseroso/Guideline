/**
 * Anthropic adapter for engine/llm_client.js. Only ever loaded when
 * ANTHROPIC_API_KEY is set — see llm_client.js's createClient(). Not
 * unit-tested against the live API (no key in this environment yet);
 * covered indirectly via llm_client's routing tests with this module
 * mocked. Uses Claude's tool-use mechanism to force structured output
 * matching an arbitrary caller-supplied JSON Schema.
 */

const DEFAULT_MODEL = "claude-sonnet-4-5";

function create({ model: configuredModel } = {}) {
  const Anthropic = require("@anthropic-ai/sdk");
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const defaultModel = configuredModel || DEFAULT_MODEL;

  async function complete({ system, messages, schema, maxTokens = 1024, model = defaultModel, signal }) {
    if (schema) {
      const response = await client.messages.create({
        model,
        max_tokens: maxTokens,
        system,
        messages,
        tools: [{ name: "emit_result", description: "Emit the structured result.", input_schema: schema }],
        tool_choice: { type: "tool", name: "emit_result" }
      }, { signal });
      const toolUse = response.content.find((block) => block.type === "tool_use");
      if (!toolUse) throw new Error("anthropic_adapter: model did not return a tool_use block for the requested schema.");
      return toolUse.input;
    }

    const response = await client.messages.create({ model, max_tokens: maxTokens, system, messages }, { signal });
    const textBlock = response.content.find((block) => block.type === "text");
    return { text: textBlock ? textBlock.text : "" };
  }

  return { complete, model: defaultModel };
}

module.exports = { create, DEFAULT_MODEL };
