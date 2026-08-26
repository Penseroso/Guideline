/**
 * RegulatoryContext construction and validation (Applicability Layer 0.1.0,
 * docs/schema.md, docs/milestone_log.md M6).
 *
 * The one architectural contract this module exists to enforce:
 * **engine/applicability.js's evaluateRule() only ever accepts a validated
 * RegulatoryContext.** How a context got built — hand-authored, matched
 * from question text, or LLM-proposed — is entirely this module's concern,
 * not applicability.js's. That separation is deliberate: a future policy
 * change (e.g. auto-accepting a high-confidence LLM proposal without
 * asking the user to confirm) is a change to *this* module and its
 * caller (engine/cli.js), never to the deterministic evaluator itself.
 *
 * proposeContext() and matchSlotsFromText() both return *candidate*
 * objects — neither is a validated RegulatoryContext, and neither should
 * ever be passed straight into evaluateRule(). Only createContext()'s
 * output (or a plain object that has separately passed validateContext())
 * qualifies.
 */

const fs = require("fs");
const path = require("path");

const CONTEXT_SLOTS_PATH = path.join(__dirname, "..", "data", "ontology", "context_slots.json");
let contextSlotsCache = null;
function loadContextSlots() {
  if (!contextSlotsCache) {
    contextSlotsCache = JSON.parse(fs.readFileSync(CONTEXT_SLOTS_PATH, "utf8"));
  }
  return contextSlotsCache;
}

/**
 * The full RegulatoryContext slot vocabulary — program_slots (static
 * program attributes) plus program_finding_slots (facts about the
 * program a Condition's predicate can be evaluated against). Deliberately
 * excludes retrieval_slots (target_molecule/target_assay/target_topic) —
 * those answer "which existing records should this query retrieve," a
 * different question from "what does the user's program look like,"
 * per context_slots.json's own top-level _comment.
 */
function regulatoryContextSlots() {
  const slots = loadContextSlots();
  return [...slots.program_slots, ...slots.program_finding_slots];
}

function findSlot(slotId, slots = regulatoryContextSlots()) {
  return slots.find((s) => s.slot_id === slotId) || null;
}

/**
 * Rejects any slot key not in the declared vocabulary and any value not in
 * that slot's declared enum. This is the only gate applicability.js
 * trusts — nothing reaches evaluateRule without passing through here.
 */
function validateContext(obj, slots = regulatoryContextSlots()) {
  const errors = [];
  const bySlotId = new Map(slots.map((s) => [s.slot_id, s]));
  for (const [key, value] of Object.entries(obj || {})) {
    const slot = bySlotId.get(key);
    if (!slot) {
      errors.push(`unknown slot "${key}"`);
      continue;
    }
    if (!slot.values.includes(value)) {
      errors.push(`value "${value}" is not declared for slot "${key}" (allowed: ${slot.values.join(", ")})`);
    }
  }
  return { ok: errors.length === 0, errors };
}

/**
 * Validates and returns a plain-object RegulatoryContext. Throws on any
 * unknown slot or out-of-vocabulary value — never silently drops or
 * coerces bad input, since a silently-dropped slot would make
 * evaluateRule() see "insufficient_context" for a slot the caller thought
 * they'd set, which is worse than failing loudly at construction time.
 */
function createContext(obj) {
  const result = validateContext(obj);
  if (!result.ok) {
    throw new Error(`regulatory_context: invalid context — ${result.errors.join("; ")}`);
  }
  return { ...obj };
}

/**
 * Table-driven, LLM-free slot matcher over free text — the RegulatoryContext
 * analogue of engine/text_utils.js's matchRetrievalSlot, but usable as a
 * first pass before ever calling an LLM. Only matches slots that declare
 * `match_terms` in context_slots.json (today: the program_finding_slots,
 * whose values are tied to specific recurring phrasings evidenced by real
 * Condition text — program_slots don't yet have match_terms, since no real
 * query pattern has evidenced a canonical phrase list for them, per
 * docs/schema.md's evidence-first extension policy). Returns a candidate
 * object, not a validated context.
 */
function matchSlotsFromText(text, slots = regulatoryContextSlots()) {
  const lowerText = (text || "").toLowerCase();
  const candidate = {};
  for (const slot of slots) {
    if (!slot.match_terms) continue;
    for (const value of slot.values) {
      const terms = slot.match_terms[value];
      if (terms && terms.some((t) => lowerText.includes(t.toLowerCase()))) {
        candidate[slot.slot_id] = value;
        break;
      }
    }
  }
  return candidate;
}

function proposeContextSchema(slots) {
  const properties = {};
  const required = [];
  for (const slot of slots) {
    properties[slot.slot_id] = { type: ["string", "null"], enum: [...slot.values, null] };
    required.push(slot.slot_id);
  }
  return { type: "object", additionalProperties: false, required, properties };
}

function slotVocabularyText(slots) {
  return slots.map((s) => `- ${s.slot_id}: ${s.description} Allowed values: ${s.values.join(", ")}.`).join("\n");
}

/**
 * LLM-proposed RegulatoryContext candidate — never a validated context.
 * The caller (engine/cli.js in this spike) is responsible for showing the
 * proposal to the user and only calling createContext() on what the user
 * actually confirms. Fails closed: any error (missing client, API
 * failure, malformed response) returns {} rather than throwing or
 * fabricating a value — an empty context makes every downstream rule
 * evaluation read as insufficient_context, which is the correct, honest
 * failure mode (never silently guess a regulatory fact).
 */
async function proposeContext(question, { client, slots = regulatoryContextSlots() } = {}) {
  if (!client) return {};
  try {
    const system =
      "Extract RegulatoryContext slot values that the user's question actually states or clearly implies. " +
      "Only set a slot when the question genuinely supports that value — leave it null otherwise. Never guess.\n\n" +
      "Slots:\n" +
      slotVocabularyText(slots);
    const draft = await client.complete({
      system,
      messages: [{ role: "user", content: question }],
      schema: proposeContextSchema(slots)
    });
    const candidate = {};
    for (const slot of slots) {
      const value = draft[slot.slot_id];
      if (value !== null && value !== undefined) candidate[slot.slot_id] = value;
    }
    return candidate;
  } catch (error) {
    return {};
  }
}

module.exports = {
  regulatoryContextSlots,
  findSlot,
  validateContext,
  createContext,
  matchSlotsFromText,
  proposeContext,
  proposeContextSchema
};
