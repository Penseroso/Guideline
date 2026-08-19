const fs = require("fs");
const path = require("path");

const bundlePath = path.resolve(__dirname, "..", "data", "pilots", "ema_fih_dosing.json");
const bundle = JSON.parse(fs.readFileSync(bundlePath, "utf8"));

// Find the Section 7.4 dose increment KR
const krIndex = bundle.knowledge_records.findIndex((kr) => kr.knowledge_record_id === "ema_fih.kr.7_4.006");

if (krIndex !== -1) {
  // Replace single compound KR with 2 clean atomic KRs
  const kr1 = {
    knowledge_record_id: "ema_fih.kr.7_4.006",
    source_unit_ids: ["ema_fih.su.7_4.002"],
    record_type: "recommendation",
    modality: "should",
    original_modal_text: "should",
    subject: "The dose increment between two dose levels",
    action: "be guided by",
    object: "the dose/exposure-toxicity or the dose/exposure-effect relationship defined in the non-clinical studies",
    normalized_ko: "두 용량 수준 간의 용량 증량 폭은 비임상 시험에서 정의된 용량/노출-독성 또는 용량/노출-효능 관계에 의해 결정되어야 한다.",
    review_status: "reviewed"
  };

  const kr2 = {
    knowledge_record_id: "ema_fih.kr.7_4.011",
    source_unit_ids: ["ema_fih.su.7_4.002"],
    record_type: "recommendation",
    modality: "should",
    original_modal_text: "should",
    subject: "The dose increment between two dose levels",
    action: "be adapted",
    object: "following review of emerging clinical data from previous cohorts",
    normalized_ko: "용량 증량 폭은 이전 코호트로부터 도출된 임상 데이터를 검토한 후 상황에 맞게 조정되어야 한다.",
    review_status: "reviewed"
  };

  bundle.knowledge_records.splice(krIndex, 1, kr1, kr2);
}

fs.writeFileSync(bundlePath, JSON.stringify(bundle, null, 2), "utf8");
console.log("Successfully split compound dose increment requirement into 2 atomic KRs in ema_fih_dosing.json");
