const Database = require("better-sqlite3");
const sqliteVec = require("sqlite-vec");

const { tokenize } = require("./text_utils");

/**
 * Retrieval interface for Option B (schema-anchored grounded RAG,
 * product_roadmap.md §2.2/§2.5). Two backends behind one interface:
 *
 *  - Keyword mode (default, no `embed` function supplied): a plain
 *    inverted token index, zero LLM/API cost. This is what's actually
 *    exercised today, since no embedding provider is configured yet.
 *  - Vector mode (an `embed(text) -> number[]` function supplied):
 *    sqlite-vec, file-based, no server — per product_roadmap.md §2.5
 *    selection criteria (native Node binding, no separate process).
 *
 * Both modes expose the same `index(records)` / `search(query, k)`
 * shape so callers (engine/query_router.js's Option B path) never
 * need to know which backend is active.
 */
function createStore({ embed } = {}) {
  if (embed) return createVectorStore(embed);
  return createKeywordStore();
}

function createKeywordStore() {
  let indexed = [];
  let tokenSets = [];

  return {
    mode: "keyword",
    index(records) {
      indexed = records;
      tokenSets = records.map((r) => new Set(tokenize(searchableTextOf(r))));
    },
    async search(query, k = 5) {
      const qTokens = new Set(tokenize(query));
      const scored = indexed
        .map((record, i) => {
          let shared = 0;
          for (const t of qTokens) if (tokenSets[i].has(t)) shared += 1;
          return { record, score: shared };
        })
        .filter((s) => s.score > 0)
        .sort((a, b) => b.score - a.score);
      return scored.slice(0, k);
    }
  };
}

function createVectorStore(embed) {
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
  return [record.section_number, record.parameter, record.condition_type, record.source_text]
    .filter(Boolean)
    .join(" ");
}

module.exports = { createStore, createKeywordStore, createVectorStore };
