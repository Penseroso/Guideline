/**
 * Narrow entailment check (product_roadmap.md §2.5.1, §2.6 item 4/5).
 * Deliberately does one bounded thing: given a claim and the exact
 * source text it's supposed to come from, answer yes/no + why. This
 * is reused for two different call sites with the same primitive:
 *   - extraction-time: does a drafted KnowledgeRecord/QuantitativeCriterion/
 *     Condition actually follow from its cited source_text (dry-run/
 *     ongoing drift monitoring, §2.5.1).
 *   - answer-time: does a generated answer sentence (Option B) actually
 *     follow from the source_text of the record it cites, before the
 *     answer is shown to the user (§2.6 item 4).
 * Never trusted to grade itself — prefer a different provider/model
 * from whichever produced the claim (config, see engine/llm_client.js).
 */

function entailmentSchema() {
  return {
    type: "object",
    additionalProperties: false,
    required: ["entailed", "reason"],
    properties: {
      entailed: { type: "boolean" },
      reason: { type: "string", minLength: 1 }
    }
  };
}

const SYSTEM_PROMPT =
  "You check whether a claim is directly supported by a given source text. " +
  "Judge strictly from the provided source text only — never use outside knowledge of " +
  "the subject matter. If the claim adds any number, condition, exception, or modality " +
  "(must/should/may) not present in the source text, entailed must be false. " +
  "If the claim is a fair paraphrase with no added or contradicted content, entailed is true.";

async function verifyClaim({ claim, sourceText, client }) {
  if (!claim || !sourceText) {
    return { entailed: false, reason: "missing claim or source_text to check against" };
  }
  const userText = `Source text:\n"""${sourceText}"""\n\nClaim to check:\n"""${claim}"""`;
  const result = await client.complete({
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: userText }],
    schema: entailmentSchema()
  });
  return { entailed: Boolean(result.entailed), reason: result.reason };
}

/**
 * Builds the natural-language claim to verify for one of
 * engine/data_store.js's flattened "answerable record" shapes.
 */
function claimTextFor(record) {
  if (record.type === "quantitative_criterion") {
    const value = record.value_fraction
      ? `${record.value_fraction.numerator}/${record.value_fraction.denominator}`
      : record.value;
    return `${record.parameter} ${record.comparator} ${value}${record.unit ? " " + record.unit : ""}`.trim();
  }
  if (record.type === "condition") return record.source_text;
  return record.source_text; // knowledge_record
}

async function verifyRecord(record, { client }) {
  const claim = claimTextFor(record);
  const result = await verifyClaim({ claim, sourceText: record.source_text, client });
  return { record_id: record.id, record_type: record.type, claim, ...result };
}

module.exports = { entailmentSchema, verifyClaim, claimTextFor, verifyRecord };
