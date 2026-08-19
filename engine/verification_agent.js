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
  "If the claim is a fair paraphrase with no added or contradicted content, entailed is true. " +
  // Added after a live triage on real M10 3.2.5.2 data (docs/milestone_log.md
  // M1) showed a correct, deliberately narrow criterion (e.g. a general rule split
  // from its own exception into a separate record, per schema.md's own guidance)
  // was being rejected for not restating a sibling record's condition/exception.
  // Verified this addition still rejects the original range-vs-requirement
  // distortion it was not designed to catch, so it's a scope narrowing, not a
  // general loosening.
  "The source text may describe several related but distinct criteria or circumstances " +
  "(e.g. a general case and a separate exception case). The claim under review is only " +
  "about ONE specific criterion drawn from that text. Do not reject the claim merely " +
  "because it does not also restate a DIFFERENT criterion or exception that applies " +
  "under different circumstances — only reject if the claim itself is unsupported or " +
  "contradicted for its own stated circumstance.";

async function verifyClaim({ claim, sourceText, client, model }) {
  if (!claim || !sourceText) {
    return { entailed: false, reason: "missing claim or source_text to check against" };
  }
  const userText = `Source text:\n"""${sourceText}"""\n\nClaim to check:\n"""${claim}"""`;
  const result = await client.complete({
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: userText }],
    schema: entailmentSchema(),
    ...(model ? { model } : {})
  });
  return { entailed: Boolean(result.entailed), reason: result.reason };
}

// Maps the schema's comparator enum to an explicit-but-modality-neutral
// phrase. History (docs/milestone_log.md M1), both directions
// verified against the live API:
//   v1 (bare "parameter at_least N"): a distortion — a descriptive range
//   ("can range from as little as one ... to a nearly full validation")
//   turned into a QuantitativeCriterion — was verified entailed=true. The
//   model read bare "at_least" as merely compatible with the low end of
//   a range, not as an asserted criterion.
//   v2 ("must be at least N — required minimum"): fixed that case, but
//   caused a *new*, broader false-negative regression on real M10
//   3.2.5.2 criteria — reproducible on every "should"-governed criterion,
//   not an isolated miss (found via multi-pass self-consistency triage:
//   7 of 9 criteria with 3/3-pass agreement, all matching known-correct
//   values, were rejected). Root cause: QuantitativeCriterion.comparator
//   (at_least/not_exceed/within) is a mathematical relationship, not a
//   regulatory modality (must/should/may) — modality lives on the linked
//   KnowledgeRecord, which this claim construction doesn't have access
//   to. Hardcoding "must" asserted a stronger modality than the source's
//   actual "should," and the verifier correctly flagged that mismatch.
//   v3 (this version) asserts "this is the specified criterion value,
//   not merely illustrative" without committing to must/should/may —
//   verified live to pass genuine should-level M10 criteria while still
//   rejecting the original range-vs-requirement distortion.
const COMPARATOR_PHRASE = {
  at_least: (value, unit) => `at least ${value}${unit} (this is the specified criterion value for this parameter, not merely an illustrative example or descriptive range)`,
  not_exceed: (value, unit) => `not exceeding ${value}${unit} (this is the specified criterion value for this parameter, not merely an illustrative example or descriptive range)`,
  within: (value, unit) => `within ${value}${unit} (this is the specified criterion value for this parameter, not merely an illustrative example or descriptive range)`
};

// schema.md Model 0.4.0: two patterns COMPARATOR_PHRASE's "specified, not
// illustrative" framing gets wrong, found live on S6(R1) 3.3 — a default
// value with a recognized exception always read as an unconditional bound
// and failed verification; an illustrative "e.g." example always read as a
// specified requirement and failed verification for the opposite reason.
const DEFAULT_WITH_EXCEPTION_PHRASE = {
  at_least: (value, unit) => `normally at least ${value}${unit} (this is the default/typical value for this parameter, not an absolute floor — a recognized exception may permit a different value)`,
  not_exceed: (value, unit) => `normally not exceeding ${value}${unit} (this is the default/typical value for this parameter, not an absolute ceiling — a recognized exception may permit a different value)`,
  within: (value, unit) => `normally within ${value}${unit} (this is the default/typical value for this parameter, not an absolute bound — a recognized exception may permit a different value)`
};
const ILLUSTRATIVE_EXAMPLE_PHRASE = {
  at_least: (value, unit) => `at least ${value}${unit} (this is given as one illustrative example for this parameter, not a specified requirement)`,
  not_exceed: (value, unit) => `not exceeding ${value}${unit} (this is given as one illustrative example for this parameter, not a specified requirement)`,
  within: (value, unit) => `within ${value}${unit} (this is given as one illustrative example for this parameter, not a specified requirement)`
};

/**
 * Builds the natural-language claim to verify for one of
 * engine/data_store.js's flattened "answerable record" shapes.
 */
function claimTextFor(record) {
  if (record.type === "quantitative_criterion") {
    const value = record.value_fraction
      ? `${record.value_fraction.numerator}/${record.value_fraction.denominator}`
      : record.value;
    const unitSuffix = record.unit ? ` ${record.unit}` : "";
    const phraseMap = record.is_illustrative_example
      ? ILLUSTRATIVE_EXAMPLE_PHRASE
      : record.is_default_with_exception
        ? DEFAULT_WITH_EXCEPTION_PHRASE
        : COMPARATOR_PHRASE;
    const phrase = phraseMap[record.comparator];
    const base = phrase ? `${record.parameter} ${phrase(value, unitSuffix)}` : `${record.parameter} ${record.comparator} ${value}${unitSuffix}`;
    // Include denominator_or_reference (the criterion's own applicable
    // circumstance, e.g. "at the LLOQ", "for non-accuracy and precision
    // validation runs") when present. Without it, an exception/special-case
    // criterion's claim reads as if it were the general rule and gets
    // correctly rejected for overstating scope — found via a live triage
    // on real M10 3.2.5.2 data (docs/milestone_log.md M1).
    const scoped = record.denominator_or_reference ? `${base}, applicable to: ${record.denominator_or_reference}` : base;
    return scoped.trim();
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
