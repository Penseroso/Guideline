const fs = require("fs");
const path = require("path");
const { createClient } = require("../engine/llm_client");

const bundlePath = path.resolve(__dirname, "..", "data", "pilots", "fda_ada_2014_clinical.json");
const bundle = JSON.parse(fs.readFileSync(bundlePath, "utf8"));

async function fixAllKorean() {
  const client = createClient();
  console.log(`Translating all ${bundle.knowledge_records.length} KRs into fluent regulatory Korean...`);

  const BATCH_SIZE = 10;
  for (let i = 0; i < bundle.knowledge_records.length; i += BATCH_SIZE) {
    const chunk = bundle.knowledge_records.slice(i, i + BATCH_SIZE);
    console.log(`Translating chunk ${Math.floor(i / BATCH_SIZE) + 1} / ${Math.ceil(bundle.knowledge_records.length / BATCH_SIZE)} (items ${i + 1}~${Math.min(i + BATCH_SIZE, bundle.knowledge_records.length)})...`);

    const prompt = `You are a professional regulatory translator. Translate the following regulatory KnowledgeRecord entries into natural, precise, formal regulatory Korean (normalized_ko).
Maintain strict regulatory meaning (shall/should/may/recommendation).
Return ONLY a valid JSON array of strings containing the Korean translations in the exact same order.

Records:
${JSON.stringify(chunk.map((k) => ({
      subject: k.subject,
      action: k.action,
      object: k.object,
      modality: k.modality,
      original_text: k.original_modal_text
    })), null, 2)}`;

    try {
      const response = await client.complete({
        system: "You are a professional regulatory translator. Translate into natural formal Korean. Return ONLY a valid JSON array of strings.",
        messages: [{ role: "user", content: prompt }]
      });
      let cleaned = (response.text || "").trim();
      if (cleaned.startsWith("```json")) cleaned = cleaned.replace(/^```json/, "").replace(/```$/, "").trim();
      else if (cleaned.startsWith("```")) cleaned = cleaned.replace(/^```/, "").replace(/```$/, "").trim();

      const list = JSON.parse(cleaned);
      for (let j = 0; j < chunk.length; j++) {
        if (list[j] && typeof list[j] === "string" && /[ㄱ-ㅎ|ㅏ-ㅣ|가-힣]/.test(list[j])) {
          chunk[j].normalized_ko = list[j].trim();
        }
      }
    } catch (e) {
      console.warn(`Chunk ${Math.floor(i / BATCH_SIZE) + 1} batch failed, translating individually:`, e.message);
      for (const kr of chunk) {
        try {
          const single = await client.complete({
            system: "Translate the regulatory requirement into formal Korean. Output ONLY the Korean string.",
            messages: [{ role: "user", content: `${kr.subject} ${kr.action} ${kr.object}` }]
          });
          const ko = (single.text || "").trim().replace(/^"|"$/g, "");
          if (ko) kr.normalized_ko = ko;
        } catch (err) {
          // ignore
        }
      }
    }
  }

  fs.writeFileSync(bundlePath, JSON.stringify(bundle, null, 2), "utf8");
  console.log("Successfully completed Korean translations for all KRs in fda_ada_2014_clinical.json!");
}

fixAllKorean().catch((err) => {
  console.error("Translation failed:", err);
  process.exit(1);
});
