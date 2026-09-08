/**
 * Shared regression-guard logic for the Stage E1/E2/E3/F promotion scripts.
 * Generalizes scripts/promote_semantic_stage_d.js's assertLiveAudit to take
 * an expected envelope_version and an overridable baseline path, since each
 * Stage E sub-stage bumps ENVELOPE_VERSION independently but all of them
 * must leave the same 16 established-suitable cases untouched.
 */
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const DEFAULT_BASELINE_PATH = path.join(ROOT, "logs", "runtime", "answer_suitability_50_raw_2026-09-07_complete.json");
const OVERLAY_DIR = path.join(ROOT, "data", "derived", "semantic");
const PRESENTATION_DIR = path.join(ROOT, "data", "derived", "presentation", "ko");

const ESTABLISHED_SUITABLE_IDS = [
  "Q02", "Q03", "Q04", "Q08", "Q09", "Q12", "Q14", "Q16",
  "Q17", "Q24", "Q25", "Q29", "Q38", "Q41", "Q45", "Q47"
];

function claimIds(item) {
  return new Set((item.envelope.claims || []).map((claim) => claim.record && claim.record.id || claim.record_id).filter(Boolean));
}

function sameSet(a, b) {
  return a.size === b.size && [...a].every((item) => b.has(item));
}

/**
 * A hash of every semantic overlay + presentation file's exact bytes, in
 * sorted order. `assertLiveAuditRegression` compares this against a value
 * embedded in the live audit itself (run_answer_suitability_audit.js writes
 * it per-entry) so a promotion can never reuse an audit captured against a
 * *different* state of `data/derived/` than what's on disk right now — e.g.
 * an audit run before a manifest's summary_spec/salience_profile went live
 * says nothing about what that manifest's semantic_coverage looks like once
 * it does. Whoever runs a promotion is expected to: apply the review_status
 * flip (or otherwise make the target state current on disk), run a fresh
 * live audit against *that*, then promote — not reuse an older run.
 */
function computeSemanticStateFingerprint() {
  const files = [];
  for (const dir of [OVERLAY_DIR, PRESENTATION_DIR]) {
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
 * established-suitable case's route, mode, and claim-record-id set
 * identical to the baseline. Returns the parsed live audit on success.
 */
function assertLiveAuditRegression(livePath, expectedEnvelopeVersion, baselinePathOverride) {
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
  const currentFingerprint = computeSemanticStateFingerprint();
  if ([...fingerprints][0] !== currentFingerprint) {
    throw new Error(
      "Live audit's semantic_state_fingerprint does not match the current data/derived/ state — " +
      "it was captured against different overlay/presentation data than what's on disk now. " +
      "Activate the target state on disk first, then re-run scripts/run_answer_suitability_audit.js."
    );
  }

  const baselinePath = baselinePathOverride ? path.resolve(baselinePathOverride) : DEFAULT_BASELINE_PATH;
  const baseline = JSON.parse(fs.readFileSync(baselinePath, "utf8"));
  for (const id of ESTABLISHED_SUITABLE_IDS) {
    const before = baseline.find((item) => item.id === id);
    const after = live.find((item) => item.id === id);
    if (!before || !after || before.envelope.route !== after.envelope.route || before.envelope.mode !== after.envelope.mode ||
        !sameSet(claimIds(before), claimIds(after))) {
      throw new Error(`Established suitable answer regressed: ${id}`);
    }
  }
  return live;
}

module.exports = { ESTABLISHED_SUITABLE_IDS, computeSemanticStateFingerprint, assertLiveAuditRegression };
