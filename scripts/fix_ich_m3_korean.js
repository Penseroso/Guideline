const fs = require("fs");
const path = require("path");
const { createClient } = require("../engine/llm_client");

const bundlePath = path.resolve(__dirname, "..", "data", "pilots", "ich_m3_nonclinical.json");
const bundle = JSON.parse(fs.readFileSync(bundlePath, "utf8"));

async function fixRemaining() {
  const client = createClient();
  const nonHangul = bundle.knowledge_records.filter(
    (kr) => !kr.normalized_ko || !/[ㄱ-ㅎ|ㅏ-ㅣ|가-힣]/.test(kr.normalized_ko)
  );

  console.log(`Translating ${nonHangul.length} remaining non-Hangul KRs...`);

  for (let i = 0; i < nonHangul.length; i++) {
    const kr = nonHangul[i];
    const text = kr.original_modal_text || kr.action || kr.subject || "";
    try {
      const response = await client.complete({
        system: "You are a professional regulatory translator. Translate the following regulatory requirement into natural, formal Korean. Output ONLY the Korean translated sentence without extra explanation.",
        messages: [{ role: "user", content: text }]
      });
      const ko = (response.text || "").trim().replace(/^"|"$/g, "");
      if (ko && /[ㄱ-ㅎ|ㅏ-ㅣ|가-힣]/.test(ko)) {
        kr.normalized_ko = ko;
      }
    } catch (e) {
      console.warn(`Error on ${kr.knowledge_record_id}:`, e.message);
    }
    if ((i + 1) % 10 === 0 || i === nonHangul.length - 1) {
      console.log(`  Progress: ${i + 1} / ${nonHangul.length}`);
    }
  }

  fs.writeFileSync(bundlePath, JSON.stringify(bundle, null, 2), "utf8");
  const remaining = bundle.knowledge_records.filter(
    (kr) => !kr.normalized_ko || !/[ㄱ-ㅎ|ㅏ-ㅣ|가-힣]/.test(kr.normalized_ko)
  );
  console.log(`Remaining non-Hangul KRs: ${remaining.length}`);
}

fixRemaining().catch(console.error);
