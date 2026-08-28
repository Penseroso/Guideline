/**
 * engine/server.js
 * M5 Phase 3 (docs/test_record.md Entry 008 / .claude/plans/scalable-
 * floating-elephant.md): local-first HTTP layer over the engine.
 * node:http, zero new dependencies — the repo has zero devDependencies
 * and product_roadmap.md §2.4.1 explicitly prizes "zero running server
 * processes... no separate server to operate." Six routes with no real
 * middleware need don't justify the first framework this codebase has
 * deliberately avoided.
 *
 * Sibling entry point to engine/cli.js — same engine, same
 * setUpOptionB() helper, different front door.
 */

const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const { loadStore } = require("./data_store");
const { setUpOptionB } = require("./cli");
const { answerEnvelope } = require("./answer_envelope");
const { logInteraction } = require("./query_log");
const { recordFeedback, VALID_VERDICTS } = require("./feedback_log");

const WEB_DIR = path.resolve(__dirname, "..", "web");
const MAX_BODY_BYTES = 16 * 1024;
const DEFAULT_OPTION_B_TIMEOUT_MS = 30000;
const OPTION_B_CONCURRENCY = 2;
const OPTION_B_QUEUE_CAP = 8;

// Explicit whitelist — never path.join user input into a filesystem path.
const STATIC_ASSETS = {
  "/": "index.html",
  "/index.html": "index.html",
  "/app.css": "app.css",
  "/app.js": "app.js",
  "/render.js": "render.js",
  "/i18n.js": "i18n.js"
};
const CONTENT_TYPES = { ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8" };

function sendJson(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Content-Length": Buffer.byteLength(payload) });
  res.end(payload);
}

function sendError(res, status, error) {
  sendJson(res, status, { error });
}

async function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        // Reject without destroying the request/socket — destroying it
        // here closes the connection before the 400 response can be
        // written, so the client sees a raw socket error instead of a
        // clean 400. Just stop reading further chunks and let the normal
        // error path send a real HTTP response.
        req.pause();
        reject(Object.assign(new Error("body too large"), { statusCode: 400 }));
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => {
      if (chunks.length === 0) return resolve({});
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")));
      } catch {
        reject(Object.assign(new Error("invalid JSON body"), { statusCode: 400 }));
      }
    });
    req.on("error", reject);
  });
}

/**
 * A small counting semaphore for Option B calls — protects API spend
 * (this is not a security control), not the CLI's FIFO promise queue
 * (engine/cli.js:51), which exists to keep readline output in order and
 * would make concurrent web requests feel serialized/broken.
 */
function createSemaphore(limit) {
  let active = 0;
  const queue = [];
  return async function withSlot(fn) {
    if (active >= limit) {
      if (queue.length >= OPTION_B_QUEUE_CAP) {
        throw Object.assign(new Error("busy"), { statusCode: 429 });
      }
      await new Promise((resolve) => queue.push(resolve));
    }
    active++;
    try {
      return await fn();
    } finally {
      active--;
      const next = queue.shift();
      if (next) next();
    }
  };
}

function withTimeout(promise, ms, label) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(Object.assign(new Error(`${label} timed out after ${ms}ms`), { statusCode: 504 })), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

function isAuthorized(req, authToken) {
  if (!authToken) return true;
  const header = req.headers["authorization"] || "";
  const match = /^Bearer (.+)$/.exec(header);
  if (!match) return false;
  const provided = Buffer.from(match[1]);
  const expected = Buffer.from(authToken);
  if (provided.length !== expected.length) return false;
  return crypto.timingSafeEqual(provided, expected);
}

function serveStatic(req, res, urlPath) {
  const filename = STATIC_ASSETS[urlPath];
  if (!filename) return sendError(res, 404, "not_found");
  const filePath = path.join(WEB_DIR, filename);
  fs.readFile(filePath, (err, data) => {
    if (err) return sendError(res, 404, "not_found");
    const ext = path.extname(filename);
    res.writeHead(200, { "Content-Type": CONTENT_TYPES[ext] || "application/octet-stream" });
    res.end(data);
  });
}

function servePdf(req, res, urlObj, index) {
  const documentId = decodeURIComponent(urlObj.pathname.replace("/pdf/", ""));
  // Resolved only through index.documents — never from user-supplied path
  // segments, so a request can never escape source_pdfs/.
  const doc = index.documents.get(documentId);
  const sourcePath = doc && doc.source_file_path;
  if (!sourcePath || !fs.existsSync(sourcePath)) return sendError(res, 404, "document_not_found");
  fs.readFile(sourcePath, (err, data) => {
    if (err) return sendError(res, 500, "internal");
    res.writeHead(200, { "Content-Type": "application/pdf" });
    res.end(data);
  });
}

let unhandledRejectionLoggerRegistered = false;
function registerUnhandledRejectionLogger() {
  // Guarded module-level registration — startServer() is called once per
  // test in test/engine_server.test.js; without this guard each call adds
  // another process-wide listener (MaxListenersExceededWarning).
  if (unhandledRejectionLoggerRegistered) return;
  unhandledRejectionLoggerRegistered = true;
  process.on("unhandledRejection", (err) => {
    // eslint-disable-next-line no-console
    console.error("engine/server.js: unhandled rejection:", err);
  });
}

/**
 * startServer({ port, host, authToken, optionBTimeoutMs, deps }) -> http.Server
 * `deps` (optional): { client, store } to inject instead of the real
 * setUpOptionB() — used by tests to avoid a live LLM call, and by callers
 * that already have {records, index, client, store} from elsewhere.
 */
function startServer({
  port = Number(process.env.GUIDELINE_PORT) || 8787,
  host = process.env.GUIDELINE_HOST || "127.0.0.1",
  authToken = process.env.GUIDELINE_AUTH_TOKEN || "",
  optionBTimeoutMs = Number(process.env.OPTION_B_TIMEOUT_MS) || DEFAULT_OPTION_B_TIMEOUT_MS,
  deps,
  // Overridable so tests never write into the real logs/ files — logs/
  // m2_queries.jsonl in particular is a real historical record analyzed
  // in docs/test_record.md, not scratch space.
  queryLogPath,
  feedbackLogPath
} = {}) {
  // The actual security control for M5: refuse to become a public surface
  // by accident. One `if`, and it's the permanent guardrail — the day
  // someone changes GUIDELINE_HOST, this stops the unauthenticated-public
  // mistake at the source instead of relying on remembering to also set a
  // token (M5 plan §7).
  if (host !== "127.0.0.1" && host !== "localhost" && !authToken) {
    throw new Error(
      `engine/server.js: refusing to start bound to "${host}" with no GUIDELINE_AUTH_TOKEN set. ` +
      "Binding beyond localhost with no auth would silently create a public, unauthenticated surface. " +
      "Set GUIDELINE_AUTH_TOKEN before binding non-loopback."
    );
  }

  const { records, index } = loadStore();
  const optionB = deps || setUpOptionB(records);
  const { client, store, provider } = optionB;
  const optionBSemaphore = createSemaphore(OPTION_B_CONCURRENCY);
  const startedAt = Date.now();

  const server = http.createServer((req, res) => {
    handleRequest(req, res).catch((err) => {
      // Critical rule: an internal/LLM error must NEVER render as a
      // refusal envelope — that would fabricate a negative regulatory
      // fact. Distinct status, distinct body shape, always.
      const status = err.statusCode || 500;
      sendError(res, status, status === 429 ? "busy" : status === 504 ? "upstream_timeout" : status === 400 ? "invalid_request" : "internal");
    });
  });

  async function handleRequest(req, res) {
    const urlObj = new URL(req.url, `http://${req.headers.host || "localhost"}`);
    const pathName = urlObj.pathname;

    if (pathName.startsWith("/api/")) {
      if (!isAuthorized(req, authToken)) return sendError(res, 401, "unauthorized");
    }

    if (pathName === "/api/health") {
      return sendJson(res, 200, {
        status: "ok",
        uptime_s: Math.round((Date.now() - startedAt) / 1000),
        documents: index.documents.size,
        records: records.length,
        provider: provider || null,
        option_b_available: Boolean(client && store),
        auth: authToken ? "enabled" : "disabled"
      });
    }

    if (pathName === "/api/documents" && req.method === "GET") {
      const docs = [...index.documents.values()].map((d) => ({
        document_id: d.document_id,
        guideline_code: d.guideline_code,
        title: d.title,
        record_count: records.filter((r) => r.document_id === d.document_id).length
      }));
      return sendJson(res, 200, { documents: docs });
    }

    if (pathName === "/api/ask" && req.method === "POST") {
      let body;
      try {
        body = await readJsonBody(req);
      } catch (e) {
        return sendError(res, e.statusCode || 400, "invalid_request");
      }
      if (typeof body.question !== "string" || !body.question.trim()) {
        return sendError(res, 400, "invalid_request");
      }
      const allowOptionB = body.allow_option_b !== false;
      const effectiveDeps = allowOptionB ? { client, store, index } : { index };

      let envelope;
      if (allowOptionB && client && store) {
        envelope = await optionBSemaphore(() =>
          withTimeout(answerEnvelope(body.question, records, effectiveDeps), optionBTimeoutMs, "Option B")
        );
      } else {
        envelope = await answerEnvelope(body.question, records, effectiveDeps);
      }

      const interactionId = `int_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;
      logInteraction(body.question, {
        path: envelope.path,
        answered: envelope.answered,
        review_status: envelope.review_status,
        text: envelope.prose,
        interaction_id: interactionId,
        mode: envelope.mode,
        timing_ms: envelope.timing_ms,
        claims: envelope.claims,
        source: "web"
      }, queryLogPath);

      return sendJson(res, 200, { ...envelope, interaction_id: interactionId });
    }

    if (pathName === "/api/feedback" && req.method === "POST") {
      let body;
      try {
        body = await readJsonBody(req);
      } catch (e) {
        return sendError(res, e.statusCode || 400, "invalid_request");
      }
      if (!VALID_VERDICTS.includes(body.verdict) || typeof body.question !== "string" || !body.question) {
        return sendError(res, 400, "invalid_request");
      }
      const record = recordFeedback(body, feedbackLogPath);
      return sendJson(res, 200, { ok: true, feedback_id: record.feedback_id });
    }

    if (pathName.startsWith("/pdf/") && req.method === "GET") {
      return servePdf(req, res, urlObj, index);
    }

    if (req.method === "GET" && Object.prototype.hasOwnProperty.call(STATIC_ASSETS, pathName)) {
      return serveStatic(req, res, pathName);
    }

    return sendError(res, 404, "not_found");
  }

  registerUnhandledRejectionLogger();

  server.listen(port, host);
  return server;
}

function main() {
  require("dotenv").config({ path: path.resolve(__dirname, "..", ".env"), quiet: true });
  const port = Number(process.env.GUIDELINE_PORT) || 8787;
  const host = process.env.GUIDELINE_HOST || "127.0.0.1";
  const authToken = process.env.GUIDELINE_AUTH_TOKEN || "";
  const server = startServer({ port, host, authToken });
  server.on("listening", () => {
    console.log(`Regulatory Guideline Archive server listening on http://${host}:${port}`);
    console.log(authToken ? "Auth: enabled (bearer token required on /api/*)" : "Auth: disabled (no GUIDELINE_AUTH_TOKEN set)");
  });
}

if (require.main === module) {
  main();
}

module.exports = { startServer };
