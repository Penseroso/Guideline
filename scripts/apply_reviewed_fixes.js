const fs = require("fs");
const path = require("path");

const bundlePath = path.resolve(__dirname, "..", "data", "pilots", "ema_fih_dosing.json");
const bundle = JSON.parse(fs.readFileSync(bundlePath, "utf8"));

// 1. Fix KRs with negation or missing actions
for (const kr of bundle.knowledge_records) {
  // 7.2 MABEL integration (attach whenever possible condition)
  if (kr.knowledge_record_id === "ema_fih.kr.7_2.013" || kr.knowledge_record_id === "ema_fih.kr.7_2.031") {
    kr.action = "be integrated in";
    kr.object = "a suitable modelling approach for the determination of the MABEL, PAD and/or ATD";
    kr.review_status = "reviewed";
  }

  // 7.2 IB rationale
  if (kr.knowledge_record_id === "ema_fih.kr.7_2.018") {
    kr.subject = "A scientific rationale for the starting dose";
    kr.action = "be included";
    kr.object = "in the IB (in addition to the protocol)";
    kr.review_status = "reviewed";
  }

  // 7.3 Negation: may not be appropriate
  if (kr.knowledge_record_id === "ema_fih.kr.7_3.006") {
    kr.action = "not be appropriate";
    kr.object = "in some instances (when substantially lower than expected pharmacological dose)";
    kr.review_status = "reviewed";
  }

  // 7.3 Negation: may not limit
  if (
    kr.knowledge_record_id === "ema_fih.kr.7_3.009" ||
    kr.knowledge_record_id === "ema_fih.kr.7_3.013" ||
    kr.knowledge_record_id === "ema_fih.kr.7_3.015"
  ) {
    kr.action = "not limit";
    kr.object = "the dose-escalation or highest dose investigated in a CT in patients with advanced cancer if appropriately justified";
    kr.review_status = "reviewed";
  }

  // 7.4 Dose increment adaptation
  if (kr.knowledge_record_id === "ema_fih.kr.7_4.006") {
    kr.action = "be guided by non-clinical dose/exposure relationships and adapted";
    kr.object = "following review of emerging clinical data from previous cohorts";
    kr.review_status = "reviewed";
  }

  // 7.4 Smaller dose increments
  if (kr.knowledge_record_id === "ema_fih.kr.7_4.007") {
    kr.action = "be considered";
    kr.object = "in later parts of SAD/MAD when non-linear PK indicates supra-proportional exposure";
    kr.review_status = "reviewed";
  }

  // 7.6 Higher exposures in MAD
  if (kr.knowledge_record_id === "ema_fih.kr.7_6.005") {
    kr.action = "be considered in a MAD part";
    kr.object = "if emerging clinical data suggests tolerance to adverse effects seen in SAD, provided pre-specified and below max exposure";
    kr.review_status = "reviewed";
  }
}

// 2. Fix QCs: set illustrative example flag on dosing frequency examples
for (const qc of bundle.quantitative_criteria) {
  if (qc.criterion_id.includes("7_6")) {
    if (qc.parameter.includes("dosing frequency")) {
      qc.is_illustrative_example = true;
      qc.review_status = "reviewed";
    } else if (qc.parameter.includes("exposure in a MAD part")) {
      qc.review_status = "reviewed";
    }
  }
}

fs.writeFileSync(bundlePath, JSON.stringify(bundle, null, 2), "utf8");
console.log("Successfully updated and reviewed clear records in ema_fih_dosing.json");
