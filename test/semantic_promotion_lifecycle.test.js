const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const {
  ESTABLISHED_SUITABLE_IDS,
  isStochasticRoute,
  evaluateEstablishedCase,
  computeSemanticStateFingerprint,
  assertLiveAuditRegression,
  prepareTargetState,
  rollbackPreparedState,
  finalizePreparedState,
  verifyAndFinalizePromotion,
  readPendingReceipt
} = require("../scripts/semantic_promotion_lifecycle");

// Real Q25 claim sets recorded across three independent live audits
// (history/decision_log/review_log.md REV-015) — used verbatim as the
// stochastic-route fixture so the policy is tested against the actual
// documented incident, not an invented example.
const Q25_BASELINE_CLAIMS = ["fda_ada.kr.II.002", "fda_ada.kr.II.006", "fda_ada.kr.III_A.005", "fda_ada.kr.IV_A_3.001"];
const Q25_STAGE_E_CLAIMS = ["fda_ada.kr.II.002", "fda_ada.kr.II.006", "fda_ada.kr.III.002", "fda_ada.kr.IV_A_3.001"];
const Q25_STAGE_F_CLAIMS = ["fda_ada.kr.II.002", "fda_ada.kr.II.006", "fda_ada.kr.III.002", "fda_ada.kr.III_A.005", "fda_ada.kr.IV_A_3.001"];

function entry(id, { route, mode, claimIds, answered = true, reviewStatus = "reviewed", envelopeVersion = "2.5.0" }) {
  return {
    id,
    envelope: {
      envelope_version: envelopeVersion,
      answered,
      route,
      mode,
      review_status: reviewStatus,
      claims: claimIds.map((recordId) => ({ record_id: recordId }))
    }
  };
}

test("isStochasticRoute: only grounded_generation is stochastic", () => {
  assert.equal(isStochasticRoute("grounded_generation"), true);
  assert.equal(isStochasticRoute("structured"), false);
  assert.equal(isStochasticRoute("refusal"), false);
});

test("evaluateEstablishedCase: deterministic route requires exact claim-set equality", () => {
  const before = entry("Q02", { route: "structured", mode: "section_overview", claimIds: ["a", "b"] });
  const sameAfter = entry("Q02", { route: "structured", mode: "section_overview", claimIds: ["b", "a"] });
  assert.deepEqual(evaluateEstablishedCase("Q02", before, sameAfter), { ok: true, diagnostic: null });

  const differentAfter = entry("Q02", { route: "structured", mode: "section_overview", claimIds: ["a", "c"] });
  const verdict = evaluateEstablishedCase("Q02", before, differentAfter);
  assert.equal(verdict.ok, false);
  assert.match(verdict.reason, /claim set regressed for deterministic route/);
});

test("evaluateEstablishedCase: Q25's three real grounded_generation claim sets (REV-015) are all accepted with a diagnostic, never a regression", () => {
  const baseline = entry("Q25", { route: "grounded_generation", mode: "generated", claimIds: Q25_BASELINE_CLAIMS });
  const stageE = entry("Q25", { route: "grounded_generation", mode: "generated", claimIds: Q25_STAGE_E_CLAIMS });
  const stageF = entry("Q25", { route: "grounded_generation", mode: "generated", claimIds: Q25_STAGE_F_CLAIMS });

  const first = evaluateEstablishedCase("Q25", baseline, stageE);
  assert.equal(first.ok, true);
  assert.deepEqual(first.diagnostic.added, ["fda_ada.kr.III.002"]);
  assert.deepEqual(first.diagnostic.removed, ["fda_ada.kr.III_A.005"]);

  const second = evaluateEstablishedCase("Q25", baseline, stageF);
  assert.equal(second.ok, true);
  assert.deepEqual(second.diagnostic.added, ["fda_ada.kr.III.002"]);
  assert.deepEqual(second.diagnostic.removed, []);

  const third = evaluateEstablishedCase("Q25", stageE, stageF);
  assert.equal(third.ok, true);
  assert.deepEqual(third.diagnostic.added, ["fda_ada.kr.III_A.005"]);
});

test("evaluateEstablishedCase: grounded_generation still hard-fails on route, mode, or answered regression", () => {
  const before = entry("Q08", { route: "grounded_generation", mode: "generated", claimIds: ["x"] });
  assert.equal(evaluateEstablishedCase("Q08", before, entry("Q08", { route: "structured", mode: "generated", claimIds: ["x"] })).ok, false);
  assert.equal(evaluateEstablishedCase("Q08", before, entry("Q08", { route: "grounded_generation", mode: "list", claimIds: ["x"] })).ok, false);
  assert.equal(evaluateEstablishedCase("Q08", before, entry("Q08", { route: "grounded_generation", mode: "generated", claimIds: ["x"], answered: false })).ok, false);
});

test("evaluateEstablishedCase: grounded_generation still hard-fails on empty or non-reviewed grounding", () => {
  const before = entry("Q08", { route: "grounded_generation", mode: "generated", claimIds: ["x"] });
  const empty = evaluateEstablishedCase("Q08", before, entry("Q08", { route: "grounded_generation", mode: "generated", claimIds: [] }));
  assert.equal(empty.ok, false);
  assert.match(empty.reason, /empty or not reviewed/);

  const needsReview = evaluateEstablishedCase("Q08", before, entry("Q08", { route: "grounded_generation", mode: "generated", claimIds: ["y"], reviewStatus: "needs_review" }));
  assert.equal(needsReview.ok, false);
  assert.match(needsReview.reason, /empty or not reviewed/);
});

test("all 16 established-suitable IDs are covered by the deterministic/stochastic split without a Q25-specific carve-out", () => {
  // Documents which contract each established case currently exercises
  // (route observed live in logs/runtime/answer_suitability_50_raw_2026-09-08_stage_g.json),
  // guarding against silently reclassifying one without noticing.
  const deterministic = new Set(["Q02", "Q03", "Q04", "Q09", "Q14", "Q47"]);
  const stochastic = new Set(["Q08", "Q12", "Q16", "Q17", "Q24", "Q25", "Q29", "Q38", "Q41", "Q45"]);
  assert.equal(deterministic.size + stochastic.size, ESTABLISHED_SUITABLE_IDS.length);
  for (const id of ESTABLISHED_SUITABLE_IDS) assert.ok(deterministic.has(id) || stochastic.has(id), `${id} not classified`);
  for (const id of stochastic) assert.equal(isStochasticRoute("grounded_generation"), true, id);
  for (const id of deterministic) assert.equal(isStochasticRoute("structured"), false, id);
});

// ---------------------------------------------------------------------
// Lifecycle: prepare -> [live audit generated separately] -> verify ->
// finalize / rollback, exercised entirely against temp fixture
// directories — never data/derived/.
// ---------------------------------------------------------------------

function makeTempWorkspace() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "promotion-lifecycle-"));
  const overlayDir = path.join(root, "semantic");
  const presentationDir = path.join(root, "presentation");
  const pendingDir = path.join(root, "runtime");
  fs.mkdirSync(overlayDir, { recursive: true });
  fs.mkdirSync(presentationDir, { recursive: true });
  fs.mkdirSync(pendingDir, { recursive: true });
  return { root, overlayDir, presentationDir, pendingDir };
}

function writeOverlayFixture(overlayDir, summaries) {
  const file = path.join(overlayDir, "doc.json");
  fs.writeFileSync(file, JSON.stringify({ document_id: "doc", summary_specs: summaries }, null, 2));
  return file;
}

function buildLiveAuditFixture({ fingerprint, envelopeVersion, established }) {
  const results = [];
  for (const id of ESTABLISHED_SUITABLE_IDS) {
    const override = established[id] || {};
    results.push({
      ...entry(id, { route: "structured", mode: "detail", claimIds: ["shared_claim"], envelopeVersion, ...override }),
      semantic_state_fingerprint: fingerprint
    });
  }
  let n = 0;
  while (results.length < 50) {
    n += 1;
    const id = `X${String(n).padStart(2, "0")}`;
    if (ESTABLISHED_SUITABLE_IDS.includes(id)) continue;
    results.push({ ...entry(id, { route: "structured", mode: "detail", claimIds: ["filler"], envelopeVersion }), semantic_state_fingerprint: fingerprint });
  }
  return results;
}

test("prepareTargetState: flips needs_review to reviewed, writes a pending receipt, and refuses to double-prepare", () => {
  const { overlayDir, pendingDir } = makeTempWorkspace();
  const file = writeOverlayFixture(overlayDir, [
    { summary_id: "s1", review_status: "needs_review" },
    { summary_id: "s2", review_status: "reviewed" }
  ]);
  const collections = [{ dir: overlayDir, collectionKey: "summary_specs", idField: "summary_id" }];

  const receipt = prepareTargetState("t1", collections, { pendingDir, fingerprintDirs: [overlayDir] });
  assert.equal(receipt.status, "pending");
  assert.deepEqual(receipt.changed.map((item) => item.id), ["s1"]);
  const onDisk = JSON.parse(fs.readFileSync(file, "utf8"));
  assert.equal(onDisk.summary_specs.find((item) => item.summary_id === "s1").review_status, "reviewed");
  assert.equal(onDisk.summary_specs.find((item) => item.summary_id === "s2").review_status, "reviewed");

  assert.throws(() => prepareTargetState("t1", collections, { pendingDir, fingerprintDirs: [overlayDir] }), /already pending/);
});

test("rollbackPreparedState: reverts exactly what prepare changed and marks the receipt rolled_back", () => {
  const { overlayDir, pendingDir } = makeTempWorkspace();
  const file = writeOverlayFixture(overlayDir, [{ summary_id: "s1", review_status: "needs_review" }]);
  const collections = [{ dir: overlayDir, collectionKey: "summary_specs", idField: "summary_id" }];

  prepareTargetState("t2", collections, { pendingDir, fingerprintDirs: [overlayDir] });
  const receipt = rollbackPreparedState("t2", { pendingDir });
  assert.equal(receipt.status, "rolled_back");
  const onDisk = JSON.parse(fs.readFileSync(file, "utf8"));
  assert.equal(onDisk.summary_specs[0].review_status, "needs_review");

  // Re-preparing after rollback is allowed (this is the normal retry path).
  const second = prepareTargetState("t2", collections, { pendingDir, fingerprintDirs: [overlayDir] });
  assert.equal(second.status, "pending");
  assert.throws(() => rollbackPreparedState("t3", { pendingDir }), /No pending promotion receipt/);
});

test("verifyAndFinalizePromotion: rejects a stale/pre-activation live audit and auto-rolls-back this promotion's flip", () => {
  const { overlayDir, pendingDir } = makeTempWorkspace();
  const auditDir = path.join(pendingDir, "audits");
  fs.mkdirSync(auditDir, { recursive: true });
  const file = writeOverlayFixture(overlayDir, [{ summary_id: "s1", review_status: "needs_review" }]);
  const collections = [{ dir: overlayDir, collectionKey: "summary_specs", idField: "summary_id" }];

  prepareTargetState("t4", collections, { pendingDir, fingerprintDirs: [overlayDir] });

  // A live audit stamped with a fingerprint from BEFORE the flip (i.e.
  // captured against the pre-activation state) must never pass.
  const staleFingerprint = computeSemanticStateFingerprint([overlayDir]).split("").reverse().join(""); // deliberately wrong
  const liveFile = path.join(auditDir, "live.json");
  fs.writeFileSync(liveFile, JSON.stringify(buildLiveAuditFixture({ fingerprint: staleFingerprint, envelopeVersion: "2.5.0", established: {} })));
  const baselineFile = path.join(auditDir, "baseline.json");
  fs.writeFileSync(baselineFile, JSON.stringify(buildLiveAuditFixture({ fingerprint: staleFingerprint, envelopeVersion: "2.5.0", established: {} })));

  assert.throws(
    () => verifyAndFinalizePromotion("t4", liveFile, "2.5.0", baselineFile, { pendingDir, fingerprintDirs: [overlayDir] }),
    /does not match the current data\/derived\/ state/
  );
  const receipt = readPendingReceipt("t4", pendingDir);
  assert.equal(receipt.data.status, "rolled_back");
  const onDisk = JSON.parse(fs.readFileSync(file, "utf8"));
  assert.equal(onDisk.summary_specs[0].review_status, "needs_review");
});

test("verifyAndFinalizePromotion: accepts a fresh matching-fingerprint audit, keeps the flip, and finalizes", () => {
  const { overlayDir, pendingDir } = makeTempWorkspace();
  const auditDir = path.join(pendingDir, "audits");
  fs.mkdirSync(auditDir, { recursive: true });
  const file = writeOverlayFixture(overlayDir, [{ summary_id: "s1", review_status: "needs_review" }]);
  const collections = [{ dir: overlayDir, collectionKey: "summary_specs", idField: "summary_id" }];

  const receipt = prepareTargetState("t5", collections, { pendingDir, fingerprintDirs: [overlayDir] });
  const freshFingerprint = computeSemanticStateFingerprint([overlayDir]);
  assert.equal(receipt.post_fingerprint, freshFingerprint);

  const liveFile = path.join(auditDir, "live.json");
  const baselineFile = path.join(auditDir, "baseline.json");
  const established = { Q25: { route: "grounded_generation", mode: "generated", claimIds: Q25_STAGE_F_CLAIMS } };
  const baselineEstablished = { Q25: { route: "grounded_generation", mode: "generated", claimIds: Q25_BASELINE_CLAIMS } };
  fs.writeFileSync(liveFile, JSON.stringify(buildLiveAuditFixture({ fingerprint: freshFingerprint, envelopeVersion: "2.5.0", established })));
  fs.writeFileSync(baselineFile, JSON.stringify(buildLiveAuditFixture({ fingerprint: "irrelevant-for-baseline", envelopeVersion: "2.5.0", established: baselineEstablished })));

  const { diagnostics } = verifyAndFinalizePromotion("t5", liveFile, "2.5.0", baselineFile, { pendingDir, fingerprintDirs: [overlayDir] });
  assert.ok(diagnostics.some((item) => item.id === "Q25"));

  const finalReceipt = readPendingReceipt("t5", pendingDir);
  assert.equal(finalReceipt.data.status, "finalized");
  const onDisk = JSON.parse(fs.readFileSync(file, "utf8"));
  assert.equal(onDisk.summary_specs[0].review_status, "reviewed");

  // Nothing pending left to verify or roll back a second time.
  assert.throws(() => verifyAndFinalizePromotion("t5", liveFile, "2.5.0", baselineFile, { pendingDir, fingerprintDirs: [overlayDir] }), /No pending promotion receipt/);
  assert.throws(() => rollbackPreparedState("t5", { pendingDir }), /No pending promotion receipt/);
});

test("verifyAndFinalizePromotion: a deterministic established case's claim-set regression still fails the whole promotion and rolls back", () => {
  const { overlayDir, pendingDir } = makeTempWorkspace();
  const auditDir = path.join(pendingDir, "audits");
  fs.mkdirSync(auditDir, { recursive: true });
  const file = writeOverlayFixture(overlayDir, [{ summary_id: "s1", review_status: "needs_review" }]);
  const collections = [{ dir: overlayDir, collectionKey: "summary_specs", idField: "summary_id" }];

  prepareTargetState("t6", collections, { pendingDir, fingerprintDirs: [overlayDir] });
  const fingerprint = computeSemanticStateFingerprint([overlayDir]);

  const liveFile = path.join(auditDir, "live.json");
  const baselineFile = path.join(auditDir, "baseline.json");
  const established = { Q02: { route: "structured", mode: "section_overview", claimIds: ["different_claim"] } };
  fs.writeFileSync(liveFile, JSON.stringify(buildLiveAuditFixture({ fingerprint, envelopeVersion: "2.5.0", established })));
  fs.writeFileSync(baselineFile, JSON.stringify(buildLiveAuditFixture({ fingerprint: "irrelevant", envelopeVersion: "2.5.0", established: {} })));

  assert.throws(
    () => verifyAndFinalizePromotion("t6", liveFile, "2.5.0", baselineFile, { pendingDir, fingerprintDirs: [overlayDir] }),
    /Established suitable answer regressed: Q02/
  );
  const receipt = readPendingReceipt("t6", pendingDir);
  assert.equal(receipt.data.status, "rolled_back");
});

test("prepareTargetState: an empty collections list (e.g. presentation, reviewed at authoring time) still produces a valid pending receipt", () => {
  const { overlayDir, pendingDir } = makeTempWorkspace();
  writeOverlayFixture(overlayDir, [{ summary_id: "s1", review_status: "reviewed" }]);
  const receipt = prepareTargetState("t7", [], { pendingDir, fingerprintDirs: [overlayDir] });
  assert.equal(receipt.status, "pending");
  assert.deepEqual(receipt.changed, []);
  assert.equal(receipt.post_fingerprint, computeSemanticStateFingerprint([overlayDir]));
});

test("assertLiveAuditRegression: still enforces the exactly-50-unique-ids invariant unchanged", () => {
  const { overlayDir } = makeTempWorkspace();
  const fingerprint = computeSemanticStateFingerprint([overlayDir]);
  const file = path.join(os.tmpdir(), `live-${Date.now()}.json`);
  fs.writeFileSync(file, JSON.stringify(buildLiveAuditFixture({ fingerprint, envelopeVersion: "9.9.9", established: {} }).slice(0, 3)));
  assert.throws(() => assertLiveAuditRegression(file, "9.9.9", undefined, { fingerprintDirs: [overlayDir] }), /exactly 50 unique question ids/);
});
