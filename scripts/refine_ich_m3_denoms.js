const fs = require("fs");
const path = require("path");

const bundlePath = path.resolve(__dirname, "..", "data", "pilots", "ich_m3_nonclinical.json");
const bundle = JSON.parse(fs.readFileSync(bundlePath, "utf8"));

for (const qc of bundle.quantitative_criteria) {
  // Section 7.1: Approach 1 vs Approach 2
  if (qc.source_unit_id === "ich_m3_r2.su.7_1.001") {
    qc.denominator_or_reference = "Approach 1 microdose trial";
  } else if (qc.source_unit_id === "ich_m3_r2.su.7_1.002") {
    qc.denominator_or_reference = "Approach 2 microdose trial";
  }

  // Section 5.1: Clinical trial durations
  if (qc.source_unit_id === "ich_m3_r2.su.5_1.001") {
    if (qc.source_text.includes("3 months in rodents")) {
      qc.parameter = "repeated-dose toxicity study duration (clinical trials up to 3 months)";
      qc.denominator_or_reference = "clinical trials up to 3 months (rodents and non-rodents)";
    } else if (qc.source_text.includes("6 months in rodents")) {
      qc.parameter = "repeated-dose toxicity study duration (clinical trials up to 6 months)";
      qc.denominator_or_reference = "clinical trials up to 6 months (rodents and non-rodents)";
    } else if (qc.source_text.includes("1 month in rodents")) {
      qc.parameter = "repeated-dose toxicity study duration (clinical trials up to 1 month)";
      qc.denominator_or_reference = "clinical trials up to 1 month (rodents and non-rodents)";
    } else if (qc.source_text.includes("2 weeks in rodents")) {
      qc.parameter = "repeated-dose toxicity study duration (clinical trials up to 2 weeks)";
      qc.denominator_or_reference = "clinical trials up to 2 weeks (rodents and non-rodents)";
    } else if (qc.source_text.includes("9 months in non-rodents")) {
      qc.parameter = "repeated-dose toxicity study duration (clinical trials exceeding 6 months)";
      qc.denominator_or_reference = "clinical trials exceeding 6 months (non-rodents)";
    }
  }

  // Section 1.5: High dose selection
  if (qc.source_unit_id === "ich_m3_r2.su.1_5.001") {
    if (qc.source_text.includes("1000 mg/kg")) {
      qc.parameter = "maximum limit dose for general toxicity studies";
      qc.denominator_or_reference = "general toxicity studies limit dose";
    } else if (qc.source_text.includes("2000 mg/kg")) {
      qc.parameter = "high dose for general toxicity studies (clinical dose > 1 g/day)";
      qc.denominator_or_reference = "clinical dose > 1 g/day";
    } else if (qc.source_text.includes("50-fold")) {
      qc.parameter = "exposure margin limit for low toxicity pharmaceuticals";
      qc.denominator_or_reference = "clinical exposure (group mean AUC)";
    }
  }
}

fs.writeFileSync(bundlePath, JSON.stringify(bundle, null, 2), "utf8");
console.log("Successfully refined parameters and denominators in ich_m3_nonclinical.json!");
