/**
 * Shared promotion-lifecycle primitives for every script that flips
 * semantic-overlay objects from `needs_review` to `reviewed`:
 * promote_semantic_summaries.js (summary_specs/salience_profiles) and
 * promote_semantic_presentation.js (Korean presentation entries).
 *
 * Two separate concerns live here:
 *
 * 1. Target-state prepare/verify/finalize/rollback (added to close a real
 *    process gap: every promote_semantic_*.js script used to flip
 *    `needs_review` -> `reviewed` and require a matching live audit in the
 *    SAME invocation — but a live audit can only be captured against a
 *    state that already exists on disk, and there is no way to fabricate
 *    that state without having flipped it first. The original promotion of
 *    the summary/salience layer (see history/verification/
 *    semantic_stage_f_2026-09-08.md) hit exactly this: it reused a
 *    pre-activation audit, which was later found to prove nothing about the
 *    post-activation `semantic_coverage` it was meant to gate, and had to
 *    be re-verified by hand after the fact. `prepareTargetState`/
 *    `verifyAndFinalizePromotion` split this into two independently-callable
 *    steps with a persisted receipt in between, so a real live audit can be
 *    generated *after* prepare and *before* verify, in a separate process
 *    invocation — while every promotion script keeps its existing
 *    single-command default behavior (prepare immediately followed by
 *    verify) for full backward compatibility.
 *
 * 2. `assertLiveAuditRegression`'s established-16-suitable-case regression
 *    guard, generalized to the observation recorded across three
 *    independent live audits for Q25 (history/decision_log/review_log.md
 *    REV-015): a `grounded_generation` answer's claim *selection* among
 *    multiple legitimate candidates is not reproducible run-to-run, while
 *    its route/mode/grounding validity is. Deterministic routes keep the
 *    original exact-claim-set check; `grounded_generation` keeps route,
 *    mode, `answered`, and non-empty/reviewed grounding as hard
 *    requirements, and records a claim-set difference as a diagnostic
 *    instead of a regression. This is a route-keyed policy, not a Q25
 *    carve-out — every one of the 16 established cases goes through the
 *    same two branches based on its own `envelope.route`.
 */
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const DEFAULT_BASELINE_PATH = path.join(ROOT, "logs", "runtime", "answer_suitability_50_raw_2026-09-07_complete.json");
const OVERLAY_DIR = path.join(ROOT, "data", "derived", "semantic");
const PRESENTATION_DIR = path.join(ROOT, "data", "derived", "presentation", "ko");
const PENDING_DIR = path.join(ROOT, "logs", "runtime");

const ESTABLISHED_SUITABLE_IDS = [
  "Q02", "Q03", "Q04", "Q08", "Q09", "Q12", "Q14", "Q16",
  "Q17", "Q24", "Q25", "Q29", "Q38", "Q41", "Q45", "Q47"
];

// grounded_generation is the only route whose claim *selection* is made by
// an LLM choosing among multiple legitimate candidates at answer time
// (engine/query_router.js's answerFallback); every other route (structured,
// list, process, comparison, multi_criterion, ...) resolves candidates via
// deterministic scoring/lookup over already-reviewed data, so the same
// question against the same data always yields the same claim set.
function isStochasticRoute(route) {
  return route === "grounded_generation";
}

function claimIds(item) {
  return new Set((item.envelope.claims || []).map((claim) => claim.record && claim.record.id || claim.record_id).filter(Boolean));
}

function sameSet(a, b) {
  return a.size === b.size && [...a].every((item) => b.has(item));
}

// engine/query_router.js's groundedResult() only ever emits a claim after
// its unit passed independent per-unit entailment verification, and stamps
// envelope-level review_status "needs_review" whenever any cited record
// isn't itself reviewed — reusing that existing invariant here (not
// re-verifying grounding from scratch) is the "per-question minimum
// contract" a grounded_generation established case must still satisfy.
function claimsGroundedAndReviewed(envelope) {
  if (!envelope || !Array.isArray(envelope.claims) || envelope.claims.length === 0) return false;
  if (claimIds({ envelope }).size === 0) return false;
  return envelope.review_status !== "needs_review";
}

/**
 * Evaluates one established-suitable case's before/after pair against the
 * regression policy for its own `after.envelope.route`. Returns
 * `{ ok: true, diagnostic: null | {id, added, removed} }` or
 * `{ ok: false, reason }`. Never throws — callers decide how to aggregate.
 */
function evaluateEstablishedCase(id, before, after) {
  if (!before) return { ok: false, reason: `${id}: missing from baseline` };
  if (!after) return { ok: false, reason: `${id}: missing from live audit` };
  if (before.envelope.route !== after.envelope.route) {
    return { ok: false, reason: `${id}: route regressed (${before.envelope.route} -> ${after.envelope.route})` };
  }
  if (before.envelope.mode !== after.envelope.mode) {
    return { ok: false, reason: `${id}: mode regressed (${before.envelope.mode} -> ${after.envelope.mode})` };
  }
  if (Boolean(before.envelope.answered) !== Boolean(after.envelope.answered)) {
    return { ok: false, reason: `${id}: answered regressed (${before.envelope.answered} -> ${after.envelope.answered})` };
  }

  const beforeIds = claimIds(before);
  const afterIds = claimIds(after);

  if (!isStochasticRoute(after.envelope.route)) {
    if (!sameSet(beforeIds, afterIds)) {
      return { ok: false, reason: `${id}: claim set regressed for deterministic route "${after.envelope.route}"` };
    }
    return { ok: true, diagnostic: null };
  }

  if (!claimsGroundedAndReviewed(after.envelope)) {
    return { ok: false, reason: `${id}: grounded_generation claims are empty or not reviewed` };
  }
  if (sameSet(beforeIds, afterIds)) return { ok: true, diagnostic: null };
  return {
    ok: true,
    diagnostic: {
      id,
      route: after.envelope.route,
      added: [...afterIds].filter((item) => !beforeIds.has(item)).sort(),
      removed: [...beforeIds].filter((item) => !afterIds.has(item)).sort()
    }
  };
}

/**
 * A hash of every semantic overlay + presentation file's exact bytes, in
 * sorted order. `assertLiveAuditRegression` compares this against a value
 * embedded in the live audit itself (run_answer_suitability_audit.js writes
 * it per-entry) so a promotion can never reuse an audit captured against a
 * *different* state of `data/derived/` than what's on disk right now — e.g.
 * an audit run before a manifest's summary_spec/salience_profile went live
 * says nothing about what that manifest's semantic_coverage looks like once
 * it does. Whoever runs a promotion is expected to: activate the target
 * state on disk (prepareTargetState), run a fresh live audit against
 * *that*, then verify (verifyAndFinalizePromotion) — never reuse an older
 * run.
 */
function computeSemanticStateFingerprint(dirs = [OVERLAY_DIR, PRESENTATION_DIR]) {
  const files = [];
  for (const dir of dirs) {
    const dirLabel = path.basename(dir);
    for (const name of fs.readdirSync(dir).filter((item) => item.endsWith(".json")).sort()) {
      files.push({ label: `${dirLabel}/${name}`, content: fs.readFileSync(path.join(dir, name), "utf8") });
    }
  }
  files.sort((a, b) => a.label.localeCompare(b.label));
  const hash = crypto.createHash("sha256");
  for (const file of files) hash.update(`${file.label}:${file.content}\n---\n`, "utf8");
  return hash.digest("hex");
}

/**
 * Throws unless `livePath` is a complete 50-unique-id audit fully on
 * `expectedEnvelopeVersion`, captured against the exact semantic overlay
 * state currently on disk (see computeSemanticStateFingerprint), with every
 * established-suitable case satisfying evaluateEstablishedCase's
 * route-keyed policy. Returns `{ live, diagnostics }` on success —
 * `diagnostics` is the (possibly empty) list of non-fatal claim-set
 * differences recorded for stochastic established cases; always logged,
 * never thrown.
 */
function assertLiveAuditRegression(livePath, expectedEnvelopeVersion, baselinePathOverride, { fingerprintDirs } = {}) {
  const live = JSON.parse(fs.readFileSync(livePath, "utf8"));
  if (live.length !== 50 || new Set(live.map((item) => item.id)).size !== 50) {
    throw new Error("Live audit must contain exactly 50 unique question ids");
  }
  const invalid = live.filter((item) => item.error || !item.envelope || !Array.isArray(item.envelope.claims));
  if (invalid.length > 0) throw new Error(`Live audit has invalid envelopes: ${invalid.map((item) => item.id).join(", ")}`);
  const wrongVersion = live.filter((item) => item.envelope.envelope_version !== expectedEnvelopeVersion);
  if (wrongVersion.length > 0) {
    throw new Error(`Live audit is not fully on answer contract ${expectedEnvelopeVersion}: ${wrongVersion.map((item) => item.id).join(", ")}`);
  }
  const fingerprints = new Set(live.map((item) => item.semantic_state_fingerprint));
  if (fingerprints.size !== 1 || fingerprints.has(undefined)) {
    throw new Error("Live audit is missing semantic_state_fingerprint (regenerate it with the current scripts/run_answer_suitability_audit.js)");
  }
  const currentFingerprint = computeSemanticStateFingerprint(fingerprintDirs);
  if ([...fingerprints][0] !== currentFingerprint) {
    throw new Error(
      "Live audit's semantic_state_fingerprint does not match the current data/derived/ state — " +
      "it was captured against different overlay/presentation data than what's on disk now. " +
      "Activate the target state on disk first (prepareTargetState), then re-run scripts/run_answer_suitability_audit.js."
    );
  }

  const baselinePath = baselinePathOverride ? path.resolve(baselinePathOverride) : DEFAULT_BASELINE_PATH;
  const baseline = JSON.parse(fs.readFileSync(baselinePath, "utf8"));
  const diagnostics = [];
  for (const id of ESTABLISHED_SUITABLE_IDS) {
    const before = baseline.find((item) => item.id === id);
    const after = live.find((item) => item.id === id);
    const verdict = evaluateEstablishedCase(id, before, after);
    if (!verdict.ok) throw new Error(`Established suitable answer regressed: ${verdict.reason}`);
    if (verdict.diagnostic) diagnostics.push(verdict.diagnostic);
  }
  if (diagnostics.length > 0) {
    console.log(`Regression guard: ${diagnostics.length} established grounded_generation case(s) selected a different (still grounded, reviewed) claim set — diagnostic only, not a regression:`);
    for (const diagnostic of diagnostics) {
      console.log(`  ${diagnostic.id}: +[${diagnostic.added.join(", ")}] -[${diagnostic.removed.join(", ")}]`);
    }
  }
  return { live, diagnostics };
}

// ---------------------------------------------------------------------
// Promotion lifecycle: prepare (flip + persist receipt) -> [fresh live
// audit, run separately] -> verify (fingerprint + regression) -> finalize
// on success / rollback on failure or explicit cancel.
// ---------------------------------------------------------------------

function pendingReceiptPath(label, pendingDir = PENDING_DIR) {
  return path.join(pendingDir, `promotion_pending_${label}.json`);
}

function readPendingReceipt(label, pendingDir = PENDING_DIR) {
  const file = pendingReceiptPath(label, pendingDir);
  if (!fs.existsSync(file)) return null;
  return { file, data: JSON.parse(fs.readFileSync(file, "utf8")) };
}

function writeReceipt(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

/**
 * Step 1: flips every `needs_review` object in the given collections to
 * `reviewed`, writing each touched file to disk immediately — a manifest's
 * `semantic_coverage` can only be observed as reviewed once it actually is,
 * so the flip has to be real and on-disk before any live audit run after it
 * means anything. Persists a receipt recording exactly what changed (and
 * the resulting fingerprint) so a later, separate `verifyAndFinalizePromotion`
 * or `rollbackPreparedState` call can act on precisely this promotion.
 *
 * `collections`: `[{ dir, collectionKey, idField }]`. Pass `[]` for a
 * target whose review_status is set at authoring time rather than by a
 * separate flip (e.g. semantic-presentation entries) — prepare then only
 * records the current (already-target) fingerprint, so the same
 * prepare -> audit -> verify lifecycle still applies uniformly.
 *
 * Refuses to run if a receipt for this label is already `pending` — call
 * `verifyAndFinalizePromotion` or `rollbackPreparedState` first. A `label`
 * whose previous promotion was already `finalized` or `rolled_back` may be
 * prepared again (this is the normal "re-verify with a fresh audit" case).
 */
function prepareTargetState(label, collections, { pendingDir = PENDING_DIR, fingerprintDirs } = {}) {
  const existing = readPendingReceipt(label, pendingDir);
  if (existing && existing.data.status === "pending") {
    throw new Error(
      `A promotion is already pending for "${label}" (prepared ${existing.data.prepared_at}). ` +
      `Finalize or roll it back first: ${path.relative(ROOT, existing.file)}`
    );
  }
  const preFingerprint = computeSemanticStateFingerprint(fingerprintDirs);
  const changed = [];
  for (const { dir, collectionKey, idField } of collections) {
    for (const name of fs.readdirSync(dir).filter((item) => item.endsWith(".json")).sort()) {
      const file = path.join(dir, name);
      const overlay = JSON.parse(fs.readFileSync(file, "utf8"));
      let touched = false;
      for (const object of overlay[collectionKey] || []) {
        if (object.review_status !== "needs_review") continue;
        object.review_status = "reviewed";
        changed.push({ file, collectionKey, idField, id: object[idField] });
        touched = true;
      }
      if (touched) fs.writeFileSync(file, `${JSON.stringify(overlay, null, 2)}\n`, "utf8");
    }
  }
  const receipt = {
    label,
    status: "pending",
    prepared_at: new Date().toISOString(),
    changed,
    pre_fingerprint: preFingerprint,
    post_fingerprint: computeSemanticStateFingerprint(fingerprintDirs)
  };
  writeReceipt(pendingReceiptPath(label, pendingDir), receipt);
  return receipt;
}

/** Reverts exactly the flips a pending prepareTargetState() made, by id — never touches anything from a different, already-finalized promotion. */
function rollbackPreparedState(label, { pendingDir = PENDING_DIR } = {}) {
  const existing = readPendingReceipt(label, pendingDir);
  if (!existing || existing.data.status !== "pending") {
    throw new Error(`No pending promotion receipt for "${label}" to roll back.`);
  }
  const byFile = new Map();
  for (const item of existing.data.changed) {
    if (!byFile.has(item.file)) byFile.set(item.file, []);
    byFile.get(item.file).push(item);
  }
  for (const [file, items] of byFile) {
    const overlay = JSON.parse(fs.readFileSync(file, "utf8"));
    for (const item of items) {
      const object = (overlay[item.collectionKey] || []).find((entry) => entry[item.idField] === item.id);
      if (object) object.review_status = "needs_review";
    }
    fs.writeFileSync(file, `${JSON.stringify(overlay, null, 2)}\n`, "utf8");
  }
  existing.data.status = "rolled_back";
  existing.data.rolled_back_at = new Date().toISOString();
  writeReceipt(existing.file, existing.data);
  return existing.data;
}

function finalizePreparedState(label, { pendingDir = PENDING_DIR } = {}) {
  const existing = readPendingReceipt(label, pendingDir);
  if (!existing || existing.data.status !== "pending") {
    throw new Error(`No pending promotion receipt for "${label}" to finalize.`);
  }
  existing.data.status = "finalized";
  existing.data.finalized_at = new Date().toISOString();
  writeReceipt(existing.file, existing.data);
  return existing.data;
}

/**
 * Step 3+4/5: requires a `pending` receipt for `label` whose recorded
 * post-flip fingerprint still matches the current disk state (catches an
 * unrelated change sneaking in between prepare and verify), then runs
 * `assertLiveAuditRegression` (which independently re-derives and checks
 * the current fingerprint against the live audit's own embedded value —
 * the two checks are redundant on purpose: this one gives a clear
 * "the pending receipt itself is stale" diagnostic, the other guarantees a
 * pre-activation or otherwise-stale audit can never pass regardless of
 * receipt state). Finalizes the receipt on success; rolls back exactly
 * this promotion's flip on any failure and re-throws.
 */
function verifyAndFinalizePromotion(label, livePath, expectedEnvelopeVersion, baselinePathOverride, { pendingDir = PENDING_DIR, fingerprintDirs } = {}) {
  const existing = readPendingReceipt(label, pendingDir);
  if (!existing || existing.data.status !== "pending") {
    throw new Error(`No pending promotion receipt for "${label}" — call prepareTargetState first.`);
  }
  try {
    const currentFingerprint = computeSemanticStateFingerprint(fingerprintDirs);
    if (existing.data.post_fingerprint !== currentFingerprint) {
      throw new Error(
        `Disk state has drifted since "${label}" was prepared — the pending receipt is stale. ` +
        "Roll it back and prepare again before generating a new live audit."
      );
    }
    const result = assertLiveAuditRegression(livePath, expectedEnvelopeVersion, baselinePathOverride, { fingerprintDirs });
    const receipt = finalizePreparedState(label, { pendingDir });
    return { ...result, receipt };
  } catch (error) {
    rollbackPreparedState(label, { pendingDir });
    throw error;
  }
}

module.exports = {
  ESTABLISHED_SUITABLE_IDS,
  isStochasticRoute,
  evaluateEstablishedCase,
  computeSemanticStateFingerprint,
  assertLiveAuditRegression,
  pendingReceiptPath,
  readPendingReceipt,
  prepareTargetState,
  rollbackPreparedState,
  finalizePreparedState,
  verifyAndFinalizePromotion
};
