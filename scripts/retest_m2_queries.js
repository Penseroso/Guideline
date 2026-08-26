const fs = require("fs");
const path = require("path");
const { createClient } = require("../engine/llm_client");
const { loadStore } = require("../engine/data_store");
const { createStore } = require("../engine/vector_store");
const { answer } = require("../engine/query_router");

async function main() {
  console.log("=== Re-evaluating M2 Real User Queries against Live Engine ===");

  const client = createClient();
  const { records } = loadStore();

  const vectorStore = createStore();
  vectorStore.index(records);

  // Load questions from log
  const logFile = path.resolve(__dirname, "..", "logs", "m2_queries.jsonl");
  const lines = fs.readFileSync(logFile, "utf8").trim().split("\n");
  const rawEntries = lines.map((l) => JSON.parse(l));

  // Filter unique questions, skip exit commands
  const seen = new Set();
  const testCases = [];
  for (const entry of rawEntries) {
    const q = (entry.question || "").trim();
    if (!q || q.toLowerCase() === "exit" || q.toLowerCase() === "exity") continue;
    if (!seen.has(q)) {
      seen.add(q);
      testCases.push({
        question: q,
        originalAnswered: entry.answered,
        originalPath: entry.path,
        originalText: entry.answer_text
      });
    }
  }

  console.log(`Loaded ${testCases.length} unique user questions to re-test.\n`);

  const results = [];
  let newlyAnsweredCount = 0;
  let stillAnsweredCount = 0;
  let stillRefusedCount = 0;

  for (let i = 0; i < testCases.length; i++) {
    const tc = testCases[i];
    process.stdout.write(`[${i + 1}/${testCases.length}] "${tc.question}" ... `);
    const start = Date.now();
    const res = await answer(tc.question, records, { client, store: vectorStore });
    const elapsed = Date.now() - start;

    const status = res.answered ? "ANSWERED" : "REFUSED";
    console.log(`${status} (Path ${res.path}, ${elapsed}ms)`);

    if (res.answered && !tc.originalAnswered) {
      newlyAnsweredCount++;
    } else if (res.answered && tc.originalAnswered) {
      stillAnsweredCount++;
    } else {
      stillRefusedCount++;
    }

    results.push({
      index: i + 1,
      question: tc.question,
      original: { answered: tc.originalAnswered, path: tc.originalPath, text: tc.originalText },
      current: { answered: res.answered, path: res.path, text: res.text, citations: res.record?.citations || [] }
    });
  }

  console.log("\n==================================================");
  console.log("M2 RE-EVALUATION SUMMARY");
  console.log("==================================================");
  console.log(`Total Unique Questions: ${testCases.length}`);
  console.log(`Originally Answered (2026-08-19): ${testCases.filter((t) => t.originalAnswered).length} / ${testCases.length} (${Math.round((testCases.filter((t) => t.originalAnswered).length / testCases.length) * 100)}%)`);
  console.log(`Currently Answered (2026-08-26): ${stillAnsweredCount + newlyAnsweredCount} / ${testCases.length} (${Math.round(((stillAnsweredCount + newlyAnsweredCount) / testCases.length) * 100)}%)`);
  console.log(`  - Retained Answered: ${stillAnsweredCount}`);
  console.log(`  - Newly Answered (Gaps Closed by EMA/FDA Ingestion): ${newlyAnsweredCount}`);
  console.log(`  - Still Refused (Remaining Knowledge Gaps): ${stillRefusedCount}`);

  console.log("\n--- DETAILED QUESTION BREAKDOWN ---");
  for (const r of results) {
    const icon = r.current.answered ? "✅" : "❌";
    const delta = r.current.answered && !r.original.answered ? " [NEWLY RESOLVED]" : "";
    console.log(`\n${icon} Q${r.index}: "${r.question}"${delta}`);
    console.log(`   Path: ${r.current.path} | Answered: ${r.current.answered}`);
    if (r.current.answered) {
      console.log(`   Answer Preview: ${r.current.text.split("\n")[0].slice(0, 100)}...`);
    } else {
      console.log(`   Refusal Reason: ${r.current.text}`);
    }
  }

  const outPath = path.resolve(__dirname, "..", "logs", "m2_reeval_report.json");
  fs.writeFileSync(outPath, JSON.stringify(results, null, 2), "utf8");
  console.log(`\nFull report saved to: ${outPath}`);
}

main().catch(console.error);
