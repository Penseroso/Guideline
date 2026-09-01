const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const { loadStore } = require("../engine/data_store");
const { setUpAnswering } = require("../engine/cli");
const { startServer } = require("../engine/server");
const { createStore } = require("../engine/vector_store");

const FIXTURE_PATH = path.resolve(__dirname, "..", "test", "fixtures", "live_route_questions.json");
const REQUEST_TIMEOUT_MS = 120000;

function baseUrl(server) {
  return `http://127.0.0.1:${server.address().port}`;
}

async function listen(server) {
  if (server.listening) return;
  await new Promise((resolve, reject) => {
    server.once("listening", resolve);
    server.once("error", reject);
  });
}

async function close(server) {
  if (!server.listening) return;
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
}

function assertGroundedClaims(testCase, envelope, index) {
  if (!envelope.answered) {
    assert.deepEqual(envelope.claims, [], `${testCase.id}: a refusal must not expose claims`);
    return;
  }

  assert.ok(envelope.claims.length > 0, `${testCase.id}: an answered route must include at least one claim`);
  for (const claim of envelope.claims) {
    assert.ok(claim.source_unit_id, `${testCase.id}: claim is missing source_unit_id`);
    assert.ok(index.sourceUnits.has(claim.source_unit_id), `${testCase.id}: source_unit_id does not resolve: ${claim.source_unit_id}`);
    assert.equal(claim.citation && claim.citation.source_unit_id, claim.source_unit_id, `${testCase.id}: citation and claim source_unit_id differ`);
  }
}

function assertGeneratedAnswerQuality(testCase, envelope) {
  if (envelope.route !== "grounded_generation") return;
  assert.ok(envelope.answer_units.length > 0, `${testCase.id}: generated answer has no answer units`);
  for (const unit of envelope.answer_units) {
    const text = String(unit.text || "").trim();
    assert.ok(text.length >= 20, `${testCase.id}: generated unit is too fragmentary: ${JSON.stringify(text)}`);
    assert.match(text, /[가-힣]/, `${testCase.id}: Korean response contains no Korean text`);
    assert.doesNotMatch(text, /[\u0400-\u04FF\u0600-\u06FF\u0900-\u097F\u3040-\u30FF]/, `${testCase.id}: generated answer mixed an unexpected writing system`);
    assert.match(text, /[.!?。]$/, `${testCase.id}: generated unit is not a complete sentence`);
    const claim = claimForAnswerUnit(unit, envelope.claims);
    assert.notEqual(text, claim && claim.record && claim.record.source_text, `${testCase.id}: generated route returned a raw source chunk`);
  }
}

function claimForAnswerUnit(unit, claims) {
  return (claims || []).find((claim) =>
    (unit.record_id && claim.record && unit.record_id === claim.record.id) ||
    (unit.source_unit_id && unit.source_unit_id === claim.source_unit_id)
  );
}

async function ask(server, testCase) {
  const response = await fetch(`${baseUrl(server)}/api/ask`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question: testCase.question, response_language: "ko" }),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
  });
  const body = await response.json();
  assert.equal(response.status, 200, `${testCase.id}: HTTP ${response.status} ${JSON.stringify(body)}`);
  return body;
}

async function runProfile(profile, questions, deps, index) {
  const server = startServer({
    port: 0,
    host: "127.0.0.1",
    deps,
    fallbackTimeoutMs: REQUEST_TIMEOUT_MS,
    loggingEnabled: false
  });
  await listen(server);

  try {
    const healthResponse = await fetch(`${baseUrl(server)}/api/health`);
    const health = await healthResponse.json();
    assert.equal(healthResponse.status, 200);
    assert.equal(health.status, "ok");

    console.log(`\n[${profile}] ${health.generator_provider || "local"}/${health.generator_model || "excerpts"} -> ${health.verifier_provider || "local"}/${health.verifier_model || "none"}`);
    for (const testCase of questions) {
      const startedAt = Date.now();
      const envelope = await ask(server, testCase);
      if (testCase.expect_route) {
        assert.equal(envelope.route, testCase.expect_route, `${testCase.id}: unexpected route (refusal=${JSON.stringify(envelope.refusal)})`);
      }
      if (testCase.expect_mode) {
        assert.equal(envelope.mode, testCase.expect_mode, `${testCase.id}: unexpected mode`);
      }
      assert.equal(envelope.answered, testCase.expect_answered, `${testCase.id}: unexpected answered value`);
      if (testCase.expect_refusal_kind) {
        assert.equal(envelope.refusal && envelope.refusal.kind, testCase.expect_refusal_kind, `${testCase.id}: unexpected refusal kind`);
      }
      assertGroundedClaims(testCase, envelope, index);
      assertGeneratedAnswerQuality(testCase, envelope);
      if (testCase.expect_document_ids) {
        const actualDocumentIds = new Set(envelope.claims.map((claim) => claim.citation && claim.citation.document_id).filter(Boolean));
        for (const documentId of testCase.expect_document_ids) {
          assert.ok(actualDocumentIds.has(documentId), `${testCase.id}: expected a grounded claim from ${documentId}, got ${[...actualDocumentIds].join(", ")}`);
        }
      }
      const kind = testCase.robustness ? "ROBUST" : "PASS";
      console.log(`${kind} ${testCase.id}: route=${envelope.route}, mode=${envelope.mode}, claims=${envelope.claims.length}, ${Date.now() - startedAt}ms`);
    }
  } finally {
    await close(server);
  }
}

async function main() {
  const fixture = JSON.parse(fs.readFileSync(FIXTURE_PATH, "utf8"));
  const { records, index } = loadStore();
  const liveDeps = setUpAnswering(records);
  assert.equal(
    liveDeps.fallbackMode,
    "grounded_generation",
    "Live route test requires a usable, distinct generator/verifier pair in .env"
  );

  const excerptStore = createStore();
  excerptStore.index(records);
  const excerptDeps = {
    generatorClient: null,
    verifierClient: null,
    store: excerptStore,
    generatorProvider: null,
    verifierProvider: null,
    generatorModel: null,
    verifierModel: null,
    verificationMode: "none",
    fallbackMode: "source_excerpts"
  };

  const byProfile = Object.groupBy(fixture.questions, (testCase) => testCase.profile);
  await runProfile("live", byProfile.live || [], liveDeps, index);
  await runProfile("excerpts", byProfile.excerpts || [], excerptDeps, index);
  console.log(`\nLive semantic-route API test: ${fixture.questions.length}/${fixture.questions.length} passed.`);
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error.stack || error.message || error);
    process.exitCode = 1;
  });
}

module.exports = { assertGroundedClaims, assertGeneratedAnswerQuality, runProfile };
