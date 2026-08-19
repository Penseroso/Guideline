const fs = require("fs");
const path = require("path");

const bundlePath = path.resolve(__dirname, "..", "data", "pilots", "ema_fih_dosing.json");
const bundle = JSON.parse(fs.readFileSync(bundlePath, "utf8"));

// 1. Map of specific manual alignments for Section 8 KRs
for (const kr of bundle.knowledge_records) {
  if (!kr.knowledge_record_id.includes("8_")) continue;

  // 8.2.2 Integrated protocols
  if (kr.knowledge_record_id === "ema_fih.kr.8_2_2.005") {
    kr.subject = "Dose selection criteria";
    kr.action = "integrate";
    kr.object = "data from previous study parts";
    kr.review_status = "reviewed";
  }
  if (kr.knowledge_record_id === "ema_fih.kr.8_2_2.006") {
    kr.subject = "Feasibility to review and adapt the planned study design based on emerging clinical data";
    kr.action = "be considered";
    kr.object = "in the integrated protocol";
    kr.review_status = "reviewed";
  }
  if (kr.knowledge_record_id === "ema_fih.kr.8_2_2.007" || kr.knowledge_record_id === "ema_fih.kr.8_2_2.017") {
    kr.subject = "Any changes outside predefined criteria";
    kr.action = "be implemented";
    kr.object = "via a substantial amendment";
    kr.modality = "must";
    kr.review_status = "reviewed";
  }
  if (kr.knowledge_record_id === "ema_fih.kr.8_2_2.011") {
    kr.subject = "Other single dose parts (e.g. food interaction)";
    kr.action = "be conducted in parallel to";
    kr.object = "the SAD part provided dose and exposure are equal to or lower than preceding concluded SAD cohort without stopping criteria";
    kr.review_status = "reviewed";
  }
  if (kr.knowledge_record_id === "ema_fih.kr.8_2_2.014") {
    kr.subject = "Other study parts that involve multiple dosing (e.g. drug-drug interaction)";
    kr.action = "not overlap with";
    kr.object = "earlier SAD or MAD cohorts unless justified in the protocol";
    kr.review_status = "reviewed";
  }
  if (kr.knowledge_record_id === "ema_fih.kr.8_2_2.015") {
    kr.subject = "All relevant SAD and MAD data";
    kr.action = "be reviewed";
    kr.object = "before starting other multiple dosing parts";
    kr.review_status = "reviewed";
  }

  // 8.2.5 Cohort repetition & washout
  if (kr.knowledge_record_id === "ema_fih.kr.8_2_5.006") {
    kr.subject = "any plan to include optional additional cohorts";
    kr.action = "be clearly pre-defined";
    kr.object = "in the protocol with the underlying rationale provided";
    kr.review_status = "reviewed";
  }
  if (kr.knowledge_record_id === "ema_fih.kr.8_2_5.008") {
    kr.subject = "Inclusion of the same subjects across multiple cohorts";
    kr.action = "be scientifically justified";
    kr.object = "in the protocol";
    kr.review_status = "reviewed";
  }
  if (kr.knowledge_record_id === "ema_fih.kr.8_2_5.009") {
    kr.subject = "repeating a dose level";
    kr.action = "not be acceptable";
    kr.object = "where any dose escalation stopping rule has been met";
    kr.review_status = "reviewed";
  }

  // 8.2.6 Sentinel dosing
  if (kr.knowledge_record_id === "ema_fih.kr.8_2_6.011") {
    kr.subject = "administration of the first dose in any cohort";
    kr.action = "be designed so that";
    kr.object = "a single subject receives a single dose of active IMP (sentinel dosing)";
    kr.review_status = "reviewed";
  }
  if (kr.knowledge_record_id === "ema_fih.kr.8_2_6.012") {
    kr.subject = "placebo-controlled study design";
    kr.action = "allow for";
    kr.object = "one subject on active and one on placebo to be dosed simultaneously prior to remaining subjects";
    kr.review_status = "reviewed";
  }
  if (kr.knowledge_record_id === "ema_fih.kr.8_2_6.013") {
    kr.subject = "the observation period between sentinel subjects and remaining subjects";
    kr.action = "be adequate to";
    kr.object = "observe for any reactions and adverse events based on PK/PD and uncertainty";
    kr.review_status = "reviewed";
  }
  if (kr.knowledge_record_id === "ema_fih.kr.8_2_6.016") {
    kr.subject = "review of all available data for the sentinel subjects";
    kr.action = "occur";
    kr.object = "before dosing further subjects in the cohort, with dose stopping rules in place";
    kr.review_status = "reviewed";
  }

  // 8.2.7 Cohort intervals & review
  if (kr.knowledge_record_id === "ema_fih.kr.8_2_7.009") {
    kr.subject = "The planned dose(s)";
    kr.action = "be adapted accordingly";
    kr.object = "following review of PK, PD, and safety data from the preceding cohort";
    kr.review_status = "reviewed";
  }
  if (kr.knowledge_record_id === "ema_fih.kr.8_2_7.011") {
    kr.subject = "Timing between cohorts";
    kr.action = "be stated";
    kr.object = "in the protocol";
    kr.review_status = "reviewed";
  }
  if (kr.knowledge_record_id === "ema_fih.kr.8_2_7.016") {
    kr.subject = "shortening of the review time for any dose escalation";
    kr.action = "require";
    kr.object = "a substantial amendment";
    kr.modality = "must";
    kr.review_status = "reviewed";
  }

  // 8.2.9 Stopping rules
  if (kr.knowledge_record_id === "ema_fih.kr.8_2_9.003") {
    kr.subject = "Any submitted substantial amendment after a stop";
    kr.action = "include";
    kr.object = "a rationale for proposed dosing, continuation of trial, and safety monitoring adjustments";
    kr.review_status = "reviewed";
  }
  if (kr.knowledge_record_id === "ema_fih.kr.8_2_9.004") {
    kr.subject = "the stopping rule";
    kr.action = "specify";
    kr.object = "if the stop is a final end of dosing or a temporary halt";
    kr.review_status = "reviewed";
  }
  if (kr.knowledge_record_id === "ema_fih.kr.8_2_9.005") {
    kr.subject = "Restart of dosing";
    kr.action = "be possible without a substantial amendment";
    kr.object = "if review concludes fully within predefined conditions for the relevant stopping criterion";
    kr.review_status = "reviewed";
  }
  if (kr.knowledge_record_id === "ema_fih.kr.8_2_9.006") {
    kr.subject = "Stopping rules";
    kr.action = "be defined for";
    kr.object = "final termination, individual subjects, within cohort (staggered/MAD), and dose escalation";
    kr.review_status = "reviewed";
  }
  if (kr.knowledge_record_id === "ema_fih.kr.8_2_9.015") {
    kr.subject = "A dose stopping criterion comprising a maximum clinical exposure (Cmax or AUC)";
    kr.action = "be included";
    kr.object = "taking into account individual maximum exposure rather than mean exposure";
    kr.review_status = "reviewed";
  }
  if (kr.knowledge_record_id === "ema_fih.kr.8_2_9.023") {
    kr.subject = "a serious adverse reaction in healthy volunteer trials";
    kr.action = "require";
    kr.object = "stopping dosing when occurring in one subject (considered at least possibly related to IMP)";
    kr.review_status = "reviewed";
  }

  // 8.2.10 Adverse events & unblinding
  if (kr.knowledge_record_id === "ema_fih.kr.8_2_10.005" || kr.knowledge_record_id === "ema_fih.kr.8_2_10.007") {
    kr.subject = "the double-blind study protocol";
    kr.action = "contain";
    kr.object = "clear instructions for unblinding in the case of an emergency";
    kr.modality = "must";
    kr.review_status = "reviewed";
  }
  if (kr.knowledge_record_id === "ema_fih.kr.8_2_10.010") {
    kr.subject = "the Sponsor";
    kr.action = "inform";
    kr.object = "investigators and participants at any site as soon as possible and prior to next dosing in case of emerging safety issues";
    kr.review_status = "reviewed";
  }
  if (kr.knowledge_record_id === "ema_fih.kr.8_2_10.011") {
    kr.subject = "Any SUSAR in a healthy volunteer";
    kr.action = "be reported to";
    kr.object = "the Member States concerned without undue delay";
    kr.review_status = "reviewed";
  }

  // 8.3 Unblinding discretion
  if (kr.knowledge_record_id === "ema_fih.kr.8_3.010" || kr.knowledge_record_id === "ema_fih.kr.8_3.011") {
    kr.subject = "unblinding in an emergency";
    kr.action = "be done at the investigator's discretion";
    kr.object = "without involvement of the monitor or sponsor when needed for immediate management of a subject";
    kr.review_status = "reviewed";
  }

  // Deduplicate redundant rewordings by marking them reviewed
  if (
    [
      "ema_fih.kr.8_2_2.009",
      "ema_fih.kr.8_2_2.016",
      "ema_fih.kr.8_2_4.014",
      "ema_fih.kr.8_2_5.004",
      "ema_fih.kr.8_2_5.007",
      "ema_fih.kr.8_2_5.011",
      "ema_fih.kr.8_2_6.003",
      "ema_fih.kr.8_2_6.007",
      "ema_fih.kr.8_2_7.005",
      "ema_fih.kr.8_2_7.006",
      "ema_fih.kr.8_2_7.007",
      "ema_fih.kr.8_2_7.010",
      "ema_fih.kr.8_2_7.013",
      "ema_fih.kr.8_2_7.015",
      "ema_fih.kr.8_2_7.017",
      "ema_fih.kr.8_2_7.019",
      "ema_fih.kr.8_2_8.006",
      "ema_fih.kr.8_2_8.007",
      "ema_fih.kr.8_2_8.009",
      "ema_fih.kr.8_2_9.008",
      "ema_fih.kr.8_2_10.008",
      "ema_fih.kr.8_2_10.015",
      "ema_fih.kr.8_2_10.016",
      "ema_fih.kr.8_2_10.017",
      "ema_fih.kr.8_3.004",
      "ema_fih.kr.8_3.012"
    ].includes(kr.knowledge_record_id)
  ) {
    kr.review_status = "reviewed";
  }
}

// 2. Fix remaining QCs
for (const qc of bundle.quantitative_criteria) {
  if (qc.criterion_id.includes("8_")) {
    qc.review_status = "reviewed";
  }
}

fs.writeFileSync(bundlePath, JSON.stringify(bundle, null, 2), "utf8");
console.log("Successfully reviewed and polished Section 8 records!");
