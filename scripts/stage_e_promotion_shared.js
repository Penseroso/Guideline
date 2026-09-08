/**
 * Shared regression-guard logic for the Stage E1/E2/E3 promotion scripts.
 * Generalizes scripts/promote_semantic_stage_d.js's assertLiveAudit to take
 * an expected envelope_version and an overridable baseline path, since each
 * Stage E sub-stage bumps ENVELOPE_VERSION independently but all of them
 * must leave the same 16 established-suitable cases untouched.
 */
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const DEFAULT_BASELINE_PATH = path.join(ROOT, "logs", "runtime", "answer_suitability_50_raw_2026-09-07_complete.json");

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
 * Throws unless `livePath` is a complete 50-unique-id audit fully on
 * `expectedEnvelopeVersion`, with every established-suitable case's route,
 * mode, and claim-record-id set identical to the baseline. Returns the
 * parsed live audit on success.
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

module.exports = { ESTABLISHED_SUITABLE_IDS, assertLiveAuditRegression };
