/**
 * OpenAI adapter for engine/llm_client.js. Only ever loaded when
 * OPENAI_API_KEY is set — see llm_client.js's createClient(). Not
 * unit-tested against the live API (no key in this environment yet);
 * covered indirectly via llm_client's routing tests with this module
 * mocked. Uses Structured Outputs (json_schema response_format) to
 * force output matching an arbitrary caller-supplied JSON Schema.
 */

function create() {
  const OpenAI = require("openai");
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  // Default is Terra, not the flagship Sol: extraction/verification here are
  // well-scoped, single-call, schema-constrained tasks, not the "hard
  // problems, long autonomous tasks" Sol is priced/marketed for. Terra
  // matches GPT-5.5-level performance at half Sol's cost. Escalate to
  // gpt-5.6-sol only if a real dry-run measurement shows Terra's accuracy
  // falling short of the existing human-reviewed baseline — not before.
  async function complete({ system, messages, schema, maxTokens = 1024, model = "gpt-5.6-terra", signal }) {
    const chatMessages = system ? [{ role: "system", content: system }, ...messages] : [...messages];

    if (schema) {
      const response = await client.chat.completions.create({
        model,
        max_completion_tokens: maxTokens,
        messages: chatMessages,
        response_format: {
          type: "json_schema",
          json_schema: { name: "emit_result", schema, strict: true }
        }
      }, { signal });
      const content = response.choices[0].message.content;
      if (!content) throw new Error("openai_adapter: model returned no content for the requested schema.");
      return JSON.parse(content);
    }

    const response = await client.chat.completions.create({ model, max_completion_tokens: maxTokens, messages: chatMessages }, { signal });
    return { text: response.choices[0].message.content || "" };
  }

  return { complete };
}

module.exports = { create };
