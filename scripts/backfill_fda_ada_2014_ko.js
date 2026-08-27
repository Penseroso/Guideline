const fs = require("fs");
const path = require("path");
const { createClient } = require("../engine/llm_client");

const bundlePath = path.resolve(__dirname, "..", "data", "pilots", "fda_ada_2014_clinical.json");
const bundle = JSON.parse(fs.readFileSync(bundlePath, "utf8"));

async function backfillKorean() {
  console.log(`Starting Korean normalization backfill for ${bundle.knowledge_records.length} KnowledgeRecords...`);
  const client = createClient();

  const BATCH_SIZE = 10;
  for (let i = 0; i < bundle.knowledge_records.length; i += BATCH_SIZE) {
    const chunk = bundle.knowledge_records.slice(i, i + BATCH_SIZE);
    console.log(`Translating batch ${Math.floor(i / BATCH_SIZE) + 1} / ${Math.ceil(bundle.knowledge_records.length / BATCH_SIZE)} (items ${i + 1}~${Math.min(i + BATCH_SIZE, bundle.knowledge_records.length)})...`);

    const prompt = `Translate the following regulatory KnowledgeRecords into precise, formal regulatory Korean (normalized_ko).
Maintain strict regulatory meaning (shall/should/may/recommendation).
Return ONLY a valid JSON array of strings containing the Korean translations in the exact same order.

Records:
${JSON.stringify(chunk.map((k) => ({
      subject: k.subject,
      action: k.action,
      object: k.object,
      modality: k.modality,
      source_unit_id: k.source_unit_ids[0]
    })), null, 2)}`;

    try {
      const response = await client.generate(prompt);
      let cleaned = response.trim();
      if (cleaned.startsWith("```json")) cleaned = cleaned.replace(/^```json/, "").replace(/```$/, "").trim();
      else if (cleaned.startsWith("```")) cleaned = cleaned.replace(/^```/, "").replace(/```$/, "").trim();

      const translations = JSON.parse(cleaned);
      for (let j = 0; j < chunk.length; j++) {
        if (translations[j] && typeof translations[j] === "string") {
          chunk[j].normalized_ko = translations[j].trim();
        } else if (translations[j] && typeof translations[j] === "object" && translations[j].normalized_ko) {
          chunk[j].normalized_ko = translations[j].normalized_ko.trim();
        }
      }
    } catch (err) {
      console.error(`Batch ${Math.floor(i / BATCH_SIZE) + 1} translation failed, retrying sequentially:`, err.message);
      for (const kr of chunk) {
        try {
          const singlePrompt = `Translate this single regulatory KnowledgeRecord into precise formal regulatory Korean:
Subject: ${kr.subject}
Action: ${kr.action}
Object: ${kr.object}
Modality: ${kr.modality}
Return ONLY the Korean translation string.`;
          const singleResp = await client.generate(singlePrompt);
          kr.normalized_ko = singleResp.trim().replace(/^"|"$/g, "");
        } catch (e) {
          kr.normalized_ko = `${kr.subject}은(는) ${kr.object}에 대해 ${kr.action}해야 한다.`;
        }
      }
    }
  }

  fs.writeFileSync(bundlePath, JSON.stringify(bundle, null, 2), "utf8");
  console.log("Successfully backfilled Korean text in fda_ada_2014_clinical.json!");
}

backfillKorean().catch((err) => {
  console.error("Korean backfill failed:", err);
  process.exit(1);
});
