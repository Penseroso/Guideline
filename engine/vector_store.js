const { tokenize } = require("./text_utils");

/**
 * Retrieval interface for grounded generation and source-excerpt fallback,
 * product_roadmap.md §2.2/§2.5). Two backends behind one interface:
 *
 *  - Keyword mode (default, no `embed` function supplied): a plain
 *    inverted token index, zero LLM/API cost. This is what's actually
 *    exercised today, since no embedding provider is configured yet.
 *  - Vector mode (an `embed(text) -> number[]` function supplied):
 *    sqlite-vec, file-based, no server — per product_roadmap.md §2.5
 *    selection criteria (native Node binding, no separate process).
 *    No caller in this codebase passes `embed` today (verified), so
 *    this path is dead in practice — `better-sqlite3`/`sqlite-vec` are
 *    `require`d lazily inside createVectorStore(), not at module load,
 *    so the rest of the app (keyword mode, everything that actually
 *    runs) never depends on `better-sqlite3` having a compiled native
 *    binary available. Found necessary live: this machine has no C++
 *    build toolchain, and `better-sqlite3` has no prebuilt-binary
 *    fallback in the installed version — an unconditional top-level
 *    require here would have broken every caller of this module, not
 *    just the unused vector path.
 *
 * Both modes expose the same `index(records)` / `search(query, k)`
 * shape so callers (engine/query_router.js's fallback routes) never
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
