/**
 * Deterministic Applicability Engine (Applicability Layer 0.1.0,
 * docs/schema.md, docs/milestone_log.md M6). Given a rule_id
 * (KnowledgeRecord or QuantitativeCriterion) and a validated
 * RegulatoryContext, decides whether the rule applies — using only the
 * archive's own Condition graph and the derived binding layer
 * (data/derived/condition_bindings/) as evidence. No LLM call happens
 * here; every LLM judgment already happened once, offline, in
 * engine/binding_agent.js, and is frozen into the binding files this
 * module reads.
 *
 * Product boundary (docs/project_scope.md, AGENTS.md "not a regulatory
 * decision engine"): this answers "does this rule's own stated scope
 * include the given context," never "is this program's approach
 * acceptable." `not_applicable` always means "the rule excludes this
 * context," never "you don't need to comply." No scores, no ranking,
 * no recommendation — every verdict carries the exact condition_text
 * and citation that produced it.
 */

const fs = require("fs");
const path = require("path");

const { citationFor } = require("./data_store");

const ROOT = path.resolve(__dirname, "..");
const BINDINGS_DIR = path.join(ROOT, "data", "derived", "condition_bindings");
const SCOPE_PROFILES_PATH = path.join(ROOT, "data", "ontology", "document_scope_profiles.json");

let bindingsCache = null;
function loadBindingsByConditionId() {
  if (!bindingsCache) {
    bindingsCache = new Map();
    if (fs.existsSync(BINDINGS_DIR)) {
      for (const file of fs.readdirSync(BINDINGS_DIR)) {
        if (path.extname(file).toLowerCase() !== ".json") continue;
        const doc = JSON.parse(fs.readFileSync(path.join(BINDINGS_DIR, file), "utf8"));
        for (const binding of doc.bindings) bindingsCache.set(binding.condition_id, binding);
      }
    }
  }
  return bindingsCache;
}

let scopeProfilesCache = null;
function loadScopeProfiles() {
  if (!scopeProfilesCache) {
    scopeProfilesCache = JSON.parse(fs.readFileSync(SCOPE_PROFILES_PATH, "utf8"));
  }
  return scopeProfilesCache;
}

/**
 * Maps a document_scope_profiles.json explicit_exclusions string to the
 * RegulatoryContext program slot/value it corresponds to, when one
 * exists. Exclusions with no current RegulatoryContext counterpart
 * (e.g. "ivd", "ligand_binding_assay", "chromatography" — assay-
 * technology concepts that belong to the Option A/B retrieval
 * dimension, not a program-level RegulatoryContext slot) are
 * intentionally left unmapped: the exclusion gate below only ever
 * checks mapped exclusions, per docs/schema.md's evidence-first
 * extension policy — add a mapping once a real bindable need is
 * demonstrated, don't guess one now.
 */
const EXCLUSION_SLOT_MAP = {
  small_molecule: { slot: "molecule_class", value: "small_molecule" },
  atmp: { slot: "molecule_class", value: "atmp" },
  nonclinical: { slot: "development_stage", value: "nonclinical" }
};

function checkScopeExclusionGate(documentId, context) {
  const profiles = loadScopeProfiles();
  const profile = profiles.document_profiles.find((p) => p.document_id === documentId) || null;
  const exclusionsTriggered = [];
  if (profile) {
    for (const exclusion of profile.explicit_exclusions) {
      const mapping = EXCLUSION_SLOT_MAP[exclusion];
      if (mapping && context[mapping.slot] === mapping.value) {
        exclusionsTriggered.push({ exclusion, slot: mapping.slot, value: mapping.value });
      }
    }
  }
  return {
    document_id: documentId,
    matched_profile: profile ? profile.document_id : null,
    exclusions_triggered: exclusionsTriggered
  };
}

function resolveRule(index, ruleId) {
  const kr = index.knowledgeRecords.get(ruleId);
  if (kr) {
    return { rule_type: "knowledge_record", record: kr, source_unit_ids: kr.source_unit_ids };
  }
  const qc = index.quantitativeCriteria.get(ruleId);
  if (qc) {
    return { rule_type: "quantitative_criterion", record: qc, source_unit_ids: [qc.source_unit_id] };
  }
  return null;
}

// --- Three-valued predicate evaluation (true / false / insufficient_context) ---

function evaluatePredicateLeaf(leaf, context) {
  const actual = Object.prototype.hasOwnProperty.call(context, leaf.slot) ? context[leaf.slot] : undefined;
  if (actual === undefined || actual === null) {
    return { outcome: "insufficient_context", slot: leaf.slot, operator: leaf.operator, expected: leaf.value, actual: null };
  }
  let holds;
  if (leaf.operator === "equals") holds = actual === leaf.value;
  else if (leaf.operator === "not_equals") holds = actual !== leaf.value;
  else if (leaf.operator === "in") holds = leaf.value.includes(actual);
  else if (leaf.operator === "not_in") holds = !leaf.value.includes(actual);
  return { outcome: holds ? "true" : "false", slot: leaf.slot, operator: leaf.operator, expected: leaf.value, actual };
}

/**
 * Kleene 3-valued AND/OR: a definite false short-circuits an all_of group
 * even if another leaf is unresolved (the group is already disproved); a
 * definite true short-circuits an any_of group the same way. Only when no
 * leaf is definite does an unresolved leaf make the whole group
 * insufficient_context.
 */
function evaluatePredicateGroup(predicate, context) {
  const groupType = predicate.all_of ? "all_of" : "any_of";
  const leafResults = predicate[groupType].map((leaf) => evaluatePredicateLeaf(leaf, context));

  let outcome;
  if (groupType === "all_of") {
    if (leafResults.some((r) => r.outcome === "false")) outcome = "false";
    else if (leafResults.some((r) => r.outcome === "insufficient_context")) outcome = "insufficient_context";
    else outcome = "true";
  } else {
    if (leafResults.some((r) => r.outcome === "true")) outcome = "true";
    else if (leafResults.some((r) => r.outcome === "insufficient_context")) outcome = "insufficient_context";
    else outcome = "false";
  }

  return { outcome, group_type: groupType, leaf_results: leafResults };
}

// --- Verdict-priority bookkeeping ---

const VERDICT_RANK = { applicable: 0, conditional: 1, insufficient_context: 2, not_applicable: 3 };

function upgrade(state, verdict, conditionalReason) {
  if (VERDICT_RANK[verdict] > VERDICT_RANK[state.verdict]) {
    state.verdict = verdict;
    // conditional_reason only ever describes a "conditional" verdict; the
    // first cause to reach "conditional" wins if more than one condition
    // produces a different reason — every condition's own outcome is still
    // visible in `basis`, so nothing is hidden, only the single top-line
    // reason is first-wins.
    state.conditional_reason = verdict === "conditional" ? conditionalReason : null;
  }
}

/**
 * @param {string} ruleId - a KnowledgeRecord or QuantitativeCriterion id.
 * @param {object} context - a validated RegulatoryContext (plain object of
 *   slot_id -> value). Never proposed/unvalidated input — see
 *   engine/regulatory_context.js; this module trusts its caller entirely.
 * @param {object} deps - `{ index, bindingsByConditionId }`. `index` is
 *   from engine/data_store.js's buildIndex()/loadStore() (must include the
 *   conditionsByTarget reverse index). `bindingsByConditionId` is
 *   injectable (default: load every data/derived/condition_bindings/*.json
 *   file from disk) so unit tests can exercise this against small
 *   synthetic fixtures instead of depending on the live binding data's
 *   exact contents.
 */
function evaluateRule(ruleId, context, { index, bindingsByConditionId: injectedBindings }) {
  const resolved = resolveRule(index, ruleId);
  if (!resolved) {
    throw new Error(`applicability: unknown rule_id "${ruleId}" (not a KnowledgeRecord or QuantitativeCriterion)`);
  }
  const { rule_type, record, source_unit_ids } = resolved;
  const primarySourceUnit = index.sourceUnits.get(source_unit_ids[0]);
  const documentId = primarySourceUnit.document_id;
  const citations = source_unit_ids.map((id) => citationFor(index, id)).filter(Boolean);

  const scopeBasis = checkScopeExclusionGate(documentId, context);

  const state = { verdict: "applicable", conditional_reason: null };
  const basis = [];
  const unresolvedSlots = new Set();

  if (scopeBasis.exclusions_triggered.length > 0) {
    upgrade(state, "not_applicable", null);
  }

  const conditionIds = index.conditionsByTarget.get(ruleId) || [];
  const bindingsByConditionId = injectedBindings || loadBindingsByConditionId();

  for (const conditionId of conditionIds) {
    const condition = index.conditions.get(conditionId);
    if (!condition) continue;
    const binding = bindingsByConditionId.get(conditionId);

    const entry = {
      condition_id: conditionId,
      condition_type: condition.condition_type,
      condition_text: condition.condition_text,
      binding_id: binding ? binding.binding_id : null,
      binding_role: binding ? binding.binding_role : null,
      binding_verification_status: binding ? binding.verification_status : null
    };

    if (!binding) {
      // A condition attached to this rule with no authored binding yet —
      // most of the archive's 279 conditions are outside this spike's
      // ~71-condition binding slice (docs/product_roadmap.md M6). Silently
      // treating this as "applicable" would overclaim; the honest answer
      // is "there's evidence here we haven't structured yet," which is
      // exactly what conditional + a dedicated reason communicates.
      basis.push({ ...entry, outcome: "unbound_condition" });
      upgrade(state, "conditional", "unbound_condition");
      continue;
    }

    if (binding.bindability === "non_bindable") {
      basis.push({ ...entry, outcome: "non_bindable" });
      upgrade(state, "conditional", "non_bindable_condition");
      continue;
    }

    const predicateEval = evaluatePredicateGroup(binding.predicate, context);

    if (predicateEval.outcome === "insufficient_context") {
      for (const leaf of predicateEval.leaf_results) {
        if (leaf.outcome === "insufficient_context") unresolvedSlots.add(leaf.slot);
      }
      basis.push({ ...entry, outcome: "insufficient_context", leaf_results: predicateEval.leaf_results });
      upgrade(state, "insufficient_context", null);
      continue;
    }

    const predicateHolds = predicateEval.outcome === "true";
    // A needs_review binding is exposed in `basis` (binding_verification_status
    // is always included in `entry`) but must never itself ground a
    // not_applicable verdict — it hasn't passed the binding pipeline's own
    // entailment/full-scope checks, so trusting it enough to tell a user a
    // rule definitely doesn't apply would overclaim on unverified evidence.
    // Downgraded to conditional instead of dropped: the evidence is real
    // (a full_scope/exception binding does exist and does point this way),
    // just not yet trustworthy enough for the strongest verdict.
    const trustedForExclusion = binding.verification_status === "verified";

    if (binding.binding_role === "exception" && predicateHolds) {
      if (trustedForExclusion) {
        basis.push({ ...entry, outcome: "exception_triggered", leaf_results: predicateEval.leaf_results });
        upgrade(state, "not_applicable", null);
      } else {
        basis.push({ ...entry, outcome: "exception_triggered_unverified", leaf_results: predicateEval.leaf_results });
        upgrade(state, "conditional", "unverified_binding");
      }
    } else if (binding.binding_role === "full_scope" && !predicateHolds) {
      if (trustedForExclusion) {
        basis.push({ ...entry, outcome: "full_scope_violated", leaf_results: predicateEval.leaf_results });
        upgrade(state, "not_applicable", null);
      } else {
        basis.push({ ...entry, outcome: "full_scope_violated_unverified", leaf_results: predicateEval.leaf_results });
        upgrade(state, "conditional", "unverified_binding");
      }
    } else if (binding.binding_role === "partial_scope" && !predicateHolds) {
      // Already the conservative verdict regardless of trust — a false
      // partial_scope predicate never reaches not_applicable either way,
      // so there is no stronger claim here for verification_status to gate.
      basis.push({ ...entry, outcome: "partial_scope_mismatch", leaf_results: predicateEval.leaf_results });
      upgrade(state, "conditional", "partial_scope_mismatch");
    } else if (trustedForExclusion) {
      // Predicate holds and nothing disqualifies — the rule is applicable
      // under this condition, and the binding is trusted enough to say so.
      basis.push({ ...entry, outcome: "satisfied", leaf_results: predicateEval.leaf_results });
    } else {
      // Same trust gate as the not_applicable-producing branches above,
      // applied for consistency: a needs_review binding isn't trustworthy
      // enough to silently resolve the rule as applicable either — that
      // would hide exactly the kind of unverified evidence this layer
      // exists to surface, just on the inclusion side instead of the
      // exclusion side.
      basis.push({ ...entry, outcome: "satisfied_unverified", leaf_results: predicateEval.leaf_results });
      upgrade(state, "conditional", "unverified_binding");
    }
  }

  return {
    rule_id: ruleId,
    rule_type,
    verdict: state.verdict,
    conditional_reason: state.conditional_reason,
    basis,
    scope_basis: scopeBasis,
    unresolved_slots: [...unresolvedSlots],
    citations,
    rule_review_status: record.review_status
  };
}

module.exports = {
  evaluateRule,
  evaluatePredicateLeaf,
  evaluatePredicateGroup,
  checkScopeExclusionGate,
  resolveRule,
  EXCLUSION_SLOT_MAP
};
