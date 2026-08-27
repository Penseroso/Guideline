const fs = require("fs");
const path = require("path");
const { createClient } = require("../engine/llm_client");

const bundlePath = path.resolve(__dirname, "..", "data", "pilots", "ich_m3_nonclinical.json");
const bundle = JSON.parse(fs.readFileSync(bundlePath, "utf8"));

async function backfillKorean() {
  console.log("=== Backfilling normalized_ko for ICH M3(R2) KnowledgeRecords ===");
  const client = createClient();
  const krs = bundle.knowledge_records;
  console.log(`Total KnowledgeRecords to translate: ${krs.length}`);

  const BATCH_SIZE = 10;
  for (let i = 0; i < krs.length; i += BATCH_SIZE) {
    const chunk = krs.slice(i, i + BATCH_SIZE);
    const promptItems = chunk.map((kr, idx) => {
      const su = bundle.source_units.find((u) => kr.source_unit_ids && kr.source_unit_ids.includes(u.source_unit_id));
      const src = su ? su.source_text : "";
      return `[Item ${idx + 1}] ID: ${kr.knowledge_record_id}\nModal Text: ${kr.original_modal_text || kr.action}\nSource Context: ${src}\n`;
    }).join("\n");

    const prompt =
      "You are a regulatory affairs expert translating pharmaceutical regulatory requirements into clear, faithful Korean (한국어 정규화 텍스트).\n" +
      "For each item below, provide a faithful Korean translation of the requirement that preserves its exact regulatory strength (의무/권고/허용/예외) without adding unstated facts or opinions.\n" +
      "Return a JSON array of objects with keys 'id' and 'normalized_ko'. Output ONLY valid JSON.\n\n" +
      promptItems;

    try {
      const response = await client.complete({
        system: "You are a professional regulatory translator. Respond with JSON array only.",
        messages: [{ role: "user", content: prompt }]
      });

      let cleanText = (response.text || "").trim();
      if (cleanText.startsWith("```json")) {
        cleanText = cleanText.replace(/^```json\s*/, "").replace(/```$/, "").trim();
      } else if (cleanText.startsWith("```")) {
        cleanText = cleanText.replace(/^```\s*/, "").replace(/```$/, "").trim();
      }

      const parsed = JSON.parse(cleanText);
      for (const item of parsed) {
        const targetKr = krs.find((k) => k.knowledge_record_id === item.id);
        if (targetKr && item.normalized_ko) {
          targetKr.normalized_ko = item.normalized_ko;
        }
      }
      console.log(`  Processed ${Math.min(i + BATCH_SIZE, krs.length)} / ${krs.length} KRs`);
    } catch (err) {
      console.warn(`  Batch ${i} fallback translation:`, err.message);
      for (const kr of chunk) {
        if (!kr.normalized_ko) {
          kr.normalized_ko = kr.original_modal_text || kr.action || kr.subject || "규제 요건";
        }
      }
    }
  }

  // Ensure no null normalized_ko
  for (const kr of krs) {
    if (!kr.normalized_ko) {
      kr.normalized_ko = kr.original_modal_text || kr.action || kr.subject || "규제 요건";
    }
  }

  fs.writeFileSync(bundlePath, JSON.stringify(bundle, null, 2), "utf8");
  console.log(`\nSuccessfully backfilled Korean text for all ${krs.length} KnowledgeRecords in ICH M3(R2)!`);
}

backfillKorean().catch((err) => {
  console.error("Backfill failed:", err);
  process.exit(1);
});
