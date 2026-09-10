const { tokenize } = require("./text_utils");

/**
 * Retrieval interface for grounded generation and source-excerpt fallback,
 * product_roadmap.md §2.2/§2.5). Two backends behind one interface:
 *
 *  - Keyword mode (default, no `embed` function supplied): a plain
 *    inverted token index, zero LLM/API cost. This is what's actually
 *    exercised in production, since no embedding provider is configured.
 *  - Vector mode (an `embed(text) -> number[]` function supplied):
 *    sqlite-vec, file-based, no server — per product_roadmap.md §2.5
 *    selection criteria (native Node binding, no separate process). No
 *    caller in this codebase passes `embed` (verified), so this path is
 *    dead in production — only exercised directly by
 *    test/engine_vector_store.test.js. `better-sqlite3`/`sqlite-vec` are
 *    `require`d lazily inside createVectorStore(), not at module load, so
 *    the rest of the app (keyword mode, everything that actually runs)
 *    never depends on a compiled native binary being available on every
 *    machine — whether the local build toolchain can produce one is not
 *    guaranteed and shouldn't gate anything outside this one path.
 *    `better-sqlite3`/`sqlite-vec` live in devDependencies, not
 *    dependencies, for the same reason: nothing in the production path
 *    needs them installed.
 *
 * Both modes expose the same `index(records)` / `search(query, k)`
 * shape so callers (engine/query_router.js's fallback routes) never
 * need to know which backend is active.
 */
function createStore({ embed } = {}) {
  if (embed) return createVectorStore(embed);
  return createKeywordStore();
}

// scripts/analyze_retrieval_quality.js's realistic multi-word benchmark
// found the correct record missing from the top-5 specifically when its
// one matching query token was also common
// across roughly a third or more of the whole archive (e.g. "protein" in
// 303/~900 records, "binding" in 234/~900) — the flat per-tier score alone
// can't tell a distinctive term from a ubiquitous one. `idfBonus` adds a
// document-frequency-aware nudge on top of the existing tier score, small
// enough that the tier hierarchy (semantic > source > section > document)
// still dominates ranking, while a rare token now counts for more than a
// near-universal one.
const IDF_BONUS_WEIGHT = 0.3;

function createKeywordStore() {
  let indexed = [];
  let fieldTokenSets = [];
  let documentFrequency = new Map();

  function idfBonus(token) {
    const df = documentFrequency.get(token) || 0;
    if (df === 0 || indexed.length === 0) return 0;
    return Math.log((indexed.length + 1) / (df + 1)) * IDF_BONUS_WEIGHT;
  }

  return {
    mode: "keyword",
    index(records) {
      indexed = records;
      fieldTokenSets = records.map((record) => ({
        semantic: new Set(tokenize([record.parameter, record.subject, record.action, record.object, record.condition_type, record.condition_text].filter(Boolean).join(" "))),
        source: new Set(tokenize([record.normalized_ko, record.source_text].filter(Boolean).join(" "))),
        section: new Set(tokenize([record.section_number, ...(record.section_path || [])].filter(Boolean).join(" "))),
        document: new Set(tokenize([record.document_id && record.document_id.replace(/_/g, " "), record.guideline_code, record.document_title].filter(Boolean).join(" ")))
      }));
      documentFrequency = new Map();
      for (const fields of fieldTokenSets) {
        const allTokens = new Set([...fields.semantic, ...fields.source, ...fields.section, ...fields.document]);
        for (const token of allTokens) documentFrequency.set(token, (documentFrequency.get(token) || 0) + 1);
      }
    },
    async search(query, k = 5) {
      const qTokens = new Set(tokenize(query));
      const processIntent = ["evaluation", "assessment", "method", "approach", "process", "procedure", "testing"].some((token) => qTokens.has(token));
      const processCues = new Set(["approach", "process", "procedure", "comprises", "initially", "then", "followed", "step", "steps", "tiered", "sequence"]);
      const scored = indexed
        .map((record, i) => {
          const fields = fieldTokenSets[i];
          let score = 0;
          let matchedTokenCount = 0;
          for (const token of qTokens) {
            let tokenScore = 0;
            if (fields.semantic.has(token)) tokenScore = 3;
            else if (fields.source.has(token)) tokenScore = 2;
            else if (fields.section.has(token)) tokenScore = 1;
            else if (fields.document.has(token)) tokenScore = 0.5;
            if (tokenScore > 0) {
              score += tokenScore + idfBonus(token);
              matchedTokenCount++;
            }
          }
          if (processIntent) {
            for (const cue of processCues) if (fields.source.has(cue)) score += 0.75;
          }
          return { record, score, matched_token_count: matchedTokenCount };
        })
        .filter((s) => s.score > 0)
        .sort((a, b) => b.score - a.score);

      // Deduplicate by source_text to yield diverse, distinct paragraphs across sections
      const seen = new Set();
      const diverse = [];
      for (const item of scored) {
        const key = item.record.source_text;
        if (!seen.has(key)) {
          seen.add(key);
          diverse.push(item);
          if (diverse.length >= k) break;
        }
      }
      return diverse;
    }
  };
}

function createVectorStore(embed) {
  const Database = require("better-sqlite3");
  const sqliteVec = require("sqlite-vec");
  const db = new Database(":memory:");
  sqliteVec.load(db);
  db.exec(`CREATE VIRTUAL TABLE records USING vec0(embedding float[%DIM%])`.replace(
    "%DIM%",
    "1" // replaced with the real embedding dimension on first index() call
  ));

  let indexed = [];
  let ready = false;

  return {
    mode: "vector",
    async index(records) {
      indexed = records;
      const vectors = await Promise.all(records.map((r) => embed(searchableTextOf(r))));
      if (vectors.length > 0) {
        const dim = vectors[0].length;
        db.exec("DROP TABLE records");
        db.exec(`CREATE VIRTUAL TABLE records USING vec0(embedding float[${dim}])`);
      }
      const insert = db.prepare("INSERT INTO records(embedding) VALUES (?)");
      db.transaction(() => {
        for (const v of vectors) insert.run(JSON.stringify(v));
      })();
      ready = true;
    },
    async search(query, k = 5) {
      if (!ready) throw new Error("vector_store: index() must be called before search()");
      const qVector = await embed(query);
      const rows = db
        .prepare("SELECT rowid, distance FROM records WHERE embedding MATCH ? ORDER BY distance LIMIT ?")
        .all(JSON.stringify(qVector), k);
      return rows.map((row) => ({ record: indexed[row.rowid - 1], score: 1 - row.distance }));
    }
  };
}

function searchableTextOf(record) {
  return [
    record.document_id,
    record.guideline_code,
    record.document_title,
    ...(record.section_path || []),
    record.section_number,
    record.parameter,
    record.subject,
    record.action,
    record.object,
    record.condition_type,
    record.condition_text,
    record.normalized_ko,
    record.source_text
  ]
    .filter(Boolean)
    .join(" ");
}

module.exports = { createStore, createKeywordStore, createVectorStore };
