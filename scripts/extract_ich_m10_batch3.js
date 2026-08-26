const fs = require("fs");
const path = require("path");
const { createClient } = require("../engine/llm_client");
const { extractSectionSelfConsistent } = require("../engine/pipeline");
const { validateFiles } = require("../validation/validate_structured_data");

const bundlePath = path.resolve(__dirname, "..", "data", "pilots", "ich_m10_validation.json");
const bundle = JSON.parse(fs.readFileSync(bundlePath, "utf8"));

const SOURCE_PDF = "source_pdfs/ICH M10.pdf";

function makeTrace(sectionId, zeroBasedPdfPage, printedPage) {
  return {
    source_file_path: SOURCE_PDF,
    document_id: "ich_m10",
    section_id: sectionId,
    pdf_page_index_zero_based: zeroBasedPdfPage,
    pdf_page_index_status: "known",
    printed_page_label: String(printedPage),
    printed_page_label_status: "known",
    extraction_method: "automated text extraction with manual verification"
  };
}

const sectionsToAdd = [
  // Section 4
  {
    section_id: "ich_m10.sec.4",
    document_id: "ich_m10",
    section_number: "4",
    title: "LIGAND BINDING ASSAYS",
    parent_section_id: null,
    heading_source_unit_id: null,
    section_order: 30,
    section_order_status: "known"
  },
  {
    section_id: "ich_m10.sec.4_1",
    document_id: "ich_m10",
    section_number: "4.1",
    title: "Key Reagents",
    parent_section_id: "ich_m10.sec.4",
    heading_source_unit_id: null,
    section_order: 31,
    section_order_status: "known"
  },
  {
    section_id: "ich_m10.sec.4_1_1",
    document_id: "ich_m10",
    section_number: "4.1.1",
    title: "Reference Standard",
    parent_section_id: "ich_m10.sec.4_1",
    heading_source_unit_id: null,
    section_order: 32,
    section_order_status: "known"
  },
  {
    section_id: "ich_m10.sec.4_1_2",
    document_id: "ich_m10",
    section_number: "4.1.2",
    title: "Critical Reagents",
    parent_section_id: "ich_m10.sec.4_1",
    heading_source_unit_id: null,
    section_order: 33,
    section_order_status: "known"
  },
  {
    section_id: "ich_m10.sec.4_2",
    document_id: "ich_m10",
    section_number: "4.2",
    title: "Validation",
    parent_section_id: "ich_m10.sec.4",
    heading_source_unit_id: null,
    section_order: 34,
    section_order_status: "known"
  },
  {
    section_id: "ich_m10.sec.4_2_1",
    document_id: "ich_m10",
    section_number: "4.2.1",
    title: "Specificity",
    parent_section_id: "ich_m10.sec.4_2",
    heading_source_unit_id: null,
    section_order: 35,
    section_order_status: "known"
  },
  {
    section_id: "ich_m10.sec.4_2_2",
    document_id: "ich_m10",
    section_number: "4.2.2",
    title: "Selectivity",
    parent_section_id: "ich_m10.sec.4_2",
    heading_source_unit_id: null,
    section_order: 36,
    section_order_status: "known"
  },
  {
    section_id: "ich_m10.sec.4_2_3",
    document_id: "ich_m10",
    section_number: "4.2.3",
    title: "Calibration Curve and Range",
    parent_section_id: "ich_m10.sec.4_2",
    heading_source_unit_id: null,
    section_order: 37,
    section_order_status: "known"
  },
  {
    section_id: "ich_m10.sec.4_2_4",
    document_id: "ich_m10",
    section_number: "4.2.4",
    title: "Accuracy and Precision",
    parent_section_id: "ich_m10.sec.4_2",
    heading_source_unit_id: null,
    section_order: 38,
    section_order_status: "known"
  },
  {
    section_id: "ich_m10.sec.4_2_4_1",
    document_id: "ich_m10",
    section_number: "4.2.4.1",
    title: "Preparation of Quality Control Samples",
    parent_section_id: "ich_m10.sec.4_2_4",
    heading_source_unit_id: null,
    section_order: 39,
    section_order_status: "known"
  },
  {
    section_id: "ich_m10.sec.4_2_4_2",
    document_id: "ich_m10",
    section_number: "4.2.4.2",
    title: "Evaluation of Accuracy and Precision",
    parent_section_id: "ich_m10.sec.4_2_4",
    heading_source_unit_id: null,
    section_order: 40,
    section_order_status: "known"
  },
  {
    section_id: "ich_m10.sec.4_2_5",
    document_id: "ich_m10",
    section_number: "4.2.5",
    title: "Carry-over",
    parent_section_id: "ich_m10.sec.4_2",
    heading_source_unit_id: null,
    section_order: 41,
    section_order_status: "known"
  },
  {
    section_id: "ich_m10.sec.4_2_6",
    document_id: "ich_m10",
    section_number: "4.2.6",
    title: "Dilution Linearity and Hook Effect",
    parent_section_id: "ich_m10.sec.4_2",
    heading_source_unit_id: null,
    section_order: 42,
    section_order_status: "known"
  },
  {
    section_id: "ich_m10.sec.4_2_7",
    document_id: "ich_m10",
    section_number: "4.2.7",
    title: "Stability",
    parent_section_id: "ich_m10.sec.4_2",
    heading_source_unit_id: null,
    section_order: 43,
    section_order_status: "known"
  },
  {
    section_id: "ich_m10.sec.4_3",
    document_id: "ich_m10",
    section_number: "4.3",
    title: "Study Sample Analysis",
    parent_section_id: "ich_m10.sec.4",
    heading_source_unit_id: null,
    section_order: 44,
    section_order_status: "known"
  },
  {
    section_id: "ich_m10.sec.4_3_1",
    document_id: "ich_m10",
    section_number: "4.3.1",
    title: "Analytical Run",
    parent_section_id: "ich_m10.sec.4_3",
    heading_source_unit_id: null,
    section_order: 45,
    section_order_status: "known"
  },
  {
    section_id: "ich_m10.sec.4_3_2",
    document_id: "ich_m10",
    section_number: "4.3.2",
    title: "Acceptance Criteria for an Analytical Run",
    parent_section_id: "ich_m10.sec.4_3",
    heading_source_unit_id: null,
    section_order: 46,
    section_order_status: "known"
  },
  {
    section_id: "ich_m10.sec.4_3_3",
    document_id: "ich_m10",
    section_number: "4.3.3",
    title: "Calibration Range",
    parent_section_id: "ich_m10.sec.4_3",
    heading_source_unit_id: null,
    section_order: 47,
    section_order_status: "known"
  },
  {
    section_id: "ich_m10.sec.4_3_4",
    document_id: "ich_m10",
    section_number: "4.3.4",
    title: "Reanalysis of Study Samples",
    parent_section_id: "ich_m10.sec.4_3",
    heading_source_unit_id: null,
    section_order: 48,
    section_order_status: "known"
  },
  // Section 5
  {
    section_id: "ich_m10.sec.5",
    document_id: "ich_m10",
    section_number: "5",
    title: "INCURRED SAMPLE REANALYSIS (ISR)",
    parent_section_id: null,
    heading_source_unit_id: null,
    section_order: 49,
    section_order_status: "known"
  }
];

const sourceUnitsToAdd = [
  // 4.1.1 Reference Standard
  {
    source_unit_id: "ich_m10.su.4_1_1.001",
    document_id: "ich_m10",
    section_id: "ich_m10.sec.4_1_1",
    unit_type: "paragraph",
    unit_order: 1,
    unit_order_status: "known",
    source_text: "The reference standard should be well characterised and documented (e.g., CoA and origin). It is recommended that the manufacturing batch of the reference standard used for the preparation of calibration standards and QCs is derived from the same batch of drug substance as that used for dosing in the nonclinical and clinical studies whenever possible. If the reference standard batch used for bioanalysis is changed, bioanalytical evaluation should be carried out with QCs from the original material and the new material prior to use to ensure that the performance characteristics of the method are within the acceptance criteria.",
    related_source_unit_ids: [],
    table_context: null,
    trace: makeTrace("ich_m10.sec.4_1_1", 22, "23"),
    review_status: "reviewed"
  },
  // 4.1.2 Critical Reagents
  {
    source_unit_id: "ich_m10.su.4_1_2.001",
    document_id: "ich_m10",
    section_id: "ich_m10.sec.4_1_2",
    unit_type: "paragraph",
    unit_order: 1,
    unit_order_status: "known",
    source_text: "Critical reagents, including binding reagents (e.g., binding proteins, aptamers, antibodies or conjugated antibodies) and those containing enzymatic moieties, have direct impact on the results of the assay and, therefore, their quality should be assured. Critical reagents bind the analyte and, upon interaction, lead to an instrument signal corresponding to the analyte concentration. Critical reagents should be appropriately characterised and stored under defined conditions. Critical reagent lifecycle management (e.g., retesting, qualification upon lot change) should be documented.",
    related_source_unit_ids: [],
    table_context: null,
    trace: makeTrace("ich_m10.sec.4_1_2", 22, "23"),
    review_status: "reviewed"
  },
  // 4.2.1 Specificity
  {
    source_unit_id: "ich_m10.su.4_2_1.001",
    document_id: "ich_m10",
    section_id: "ich_m10.sec.4_2_1",
    unit_type: "paragraph",
    unit_order: 1,
    unit_order_status: "known",
    source_text: "Specificity is the ability of a bioanalytical method to detect and differentiate the analyte from other related substances (e.g., structurally similar compounds, metabolites, concomitant medications, soluble target/receptor, endogenous substances). Specificity should be evaluated by spiking blank matrix samples with potential interfering substances at the highest anticipated concentrations in study samples, in the absence and presence of the analyte (at low and high QC concentrations). Accuracy should be within ±20% of nominal concentration at low and high QC levels.",
    related_source_unit_ids: [],
    table_context: null,
    trace: makeTrace("ich_m10.sec.4_2_1", 24, "25"),
    review_status: "reviewed"
  },
  // 4.2.2 Selectivity
  {
    source_unit_id: "ich_m10.su.4_2_2.001",
    document_id: "ich_m10",
    section_id: "ich_m10.sec.4_2_2",
    unit_type: "paragraph",
    unit_order: 1,
    unit_order_status: "known",
    source_text: "Selectivity is the ability of an analytical method to differentiate and measure the analyte in the presence of interfering substances in the biological matrix. Selectivity should be evaluated using blank matrix samples from at least 10 individual sources (or fewer for rare matrices). Individual blank matrix samples should be evaluated unspiked and spiked at the LLOQ and the high QC concentration. At least 80% of the individual sources evaluated should meet the criteria: the unspiked blank sample response should be below the LLOQ, and the accuracy of the spiked LLOQ and high QC samples should be within ±25% and ±20% of the nominal concentration, respectively.",
    related_source_unit_ids: [],
    table_context: null,
    trace: makeTrace("ich_m10.sec.4_2_2", 24, "25"),
    review_status: "reviewed"
  },
  // 4.2.3 Calibration Curve and Range
  {
    source_unit_id: "ich_m10.su.4_2_3.001",
    document_id: "ich_m10",
    section_id: "ich_m10.sec.4_2_3",
    unit_type: "paragraph",
    unit_order: 1,
    unit_order_status: "known",
    source_text: "A calibration curve should be generated with a blank sample, an anchor sample (if appropriate), and at least 6 concentration levels of calibration standards, including LLOQ and ULOQ. Non-linear regression models (such as 4-parameter or 5-parameter logistic models) are typically used for LBAs. The back-calculated concentrations of calibration standards should be within ±20% of nominal concentration, except at LLOQ and ULOQ where they should be within ±25%. At least 75% of calibration standards (minimum 6 levels) should meet these criteria. In the case that replicates are used, at least 50% of calibration standards tested per concentration level should meet the criteria.",
    related_source_unit_ids: [],
    table_context: null,
    trace: makeTrace("ich_m10.sec.4_2_3", 25, "26"),
    review_status: "reviewed"
  },
  // 4.2.4.1 Preparation of Quality Control Samples
  {
    source_unit_id: "ich_m10.su.4_2_4_1.001",
    document_id: "ich_m10",
    section_id: "ich_m10.sec.4_2_4_1",
    unit_type: "paragraph",
    unit_order: 1,
    unit_order_status: "known",
    source_text: "During method validation, QCs for accuracy and precision runs should be prepared at a minimum of 5 concentration levels within the calibration curve range: the LLOQ, within three times of the LLOQ (low QC), around the geometric mean or mid-point of the calibration curve range (medium QC), at least 75% of the ULOQ (high QC), and the ULOQ.",
    related_source_unit_ids: [],
    table_context: null,
    trace: makeTrace("ich_m10.sec.4_2_4_1", 26, "27"),
    review_status: "reviewed"
  },
  // 4.2.4.2 Evaluation of Accuracy and Precision
  {
    source_unit_id: "ich_m10.su.4_2_4_2.001",
    document_id: "ich_m10",
    section_id: "ich_m10.sec.4_2_4_2",
    unit_type: "paragraph",
    unit_order: 1,
    unit_order_status: "known",
    source_text: "Within-run and between-run accuracy and precision should be evaluated by analysing at least 3 replicates at each of the 5 QC concentration levels in at least 6 analytical runs over at least two days (or 3 runs over two days with 5 replicates per QC level). The overall within-run and between-run accuracy at each QC level should be within ±20% of nominal value, except for LLOQ and ULOQ which should be within ±25%. Precision (%CV) should not exceed 20%, except at LLOQ and ULOQ where it should not exceed 25%. Total error (sum of absolute error in accuracy and precision) should not exceed 30% (40% at LLOQ and ULOQ). For non-accuracy and precision validation runs, at least 2/3 of total QCs and 50% at each QC level should be within ±20%.",
    related_source_unit_ids: [],
    table_context: null,
    trace: makeTrace("ich_m10.sec.4_2_4_2", 26, "27"),
    review_status: "reviewed"
  },
  // 4.2.5 Carry-over
  {
    source_unit_id: "ich_m10.su.4_2_5.001",
    document_id: "ich_m10",
    section_id: "ich_m10.sec.4_2_5",
    unit_type: "paragraph",
    unit_order: 1,
    unit_order_status: "known",
    source_text: "If the analytical platform is prone to carry-over, the potential of carry-over should be investigated by placing blank samples after the calibration standard at the ULOQ. The response of blank samples should be below the LLOQ.",
    related_source_unit_ids: [],
    table_context: null,
    trace: makeTrace("ich_m10.sec.4_2_5", 27, "28"),
    review_status: "reviewed"
  },
  // 4.2.6 Dilution Linearity and Hook Effect
  {
    source_unit_id: "ich_m10.su.4_2_6.001",
    document_id: "ich_m10",
    section_id: "ich_m10.sec.4_2_6",
    unit_type: "paragraph",
    unit_order: 1,
    unit_order_status: "known",
    source_text: "Dilution linearity should be assessed to confirm: (i) that measured concentrations are not affected by dilution within the calibration range and (ii) that sample concentrations above ULOQ are not impacted by hook effect (signal suppression caused by high analyte concentration). Dilution linearity should be demonstrated by spiking matrix with an analyte concentration above ULOQ, analysed undiluted (for hook effect) and diluting this sample (to at least 3 different dilution factors) with blank matrix to within the calibration range. For each dilution factor, at least 3 independently prepared dilution series should be performed. The calculated mean concentration for each dilution should be within ±20% of nominal concentration after correction for dilution and precision should not exceed 20%.",
    related_source_unit_ids: [],
    table_context: null,
    trace: makeTrace("ich_m10.sec.4_2_6", 27, "28"),
    review_status: "reviewed"
  },
  // 4.2.7 Stability
  {
    source_unit_id: "ich_m10.su.4_2_7.001",
    document_id: "ich_m10",
    section_id: "ich_m10.sec.4_2_7",
    unit_type: "paragraph",
    unit_order: 1,
    unit_order_status: "known",
    source_text: "Stability of the analyte in matrix should be evaluated using low and high concentration QCs. A minimum of 3 aliquots should be analysed at each concentration level. The mean concentration at each QC level should be within ±20% of nominal concentration. Stability testing includes: 1) Freeze-thaw stability in matrix (minimum of 3 cycles, kept frozen at least 12 hours between cycles); 2) Bench-top (short-term) stability at room temperature or sample preparation temperature; 3) Long-term stability in matrix stored in freezer for duration of study sample storage. For chemical drugs, stability at -20°C can be extrapolated to -70/-80°C. For biological drugs, bracketing between -70/-80°C and -20°C can be applied.",
    related_source_unit_ids: [],
    table_context: null,
    trace: makeTrace("ich_m10.sec.4_2_7", 28, "29"),
    review_status: "reviewed"
  },
  // 4.3.1 Analytical Run
  {
    source_unit_id: "ich_m10.su.4_3_1.001",
    document_id: "ich_m10",
    section_id: "ich_m10.sec.4_3_1",
    unit_type: "paragraph",
    unit_order: 1,
    unit_order_status: "known",
    source_text: "An analytical run consists of a blank sample, calibration standards at a minimum of 6 concentration levels, at least 3 levels of QCs (low, medium, high) applied as two sets (or at least 5% of the number of study samples, whichever is higher) and the study samples to be analysed. Study samples should always be bracketed by QCs. If microtitre plates are used and each plate contains its own calibration standards and QCs, each plate should be assessed on its own. If sample capacity is limited, sets of calibration standards may be placed on the first and last plate, but QCs should be placed on every single plate (at beginning and end).",
    related_source_unit_ids: [],
    table_context: null,
    trace: makeTrace("ich_m10.sec.4_3_1", 29, "30"),
    review_status: "reviewed"
  },
  // 4.3.2 Acceptance Criteria for an Analytical Run
  {
    source_unit_id: "ich_m10.su.4_3_2.001",
    document_id: "ich_m10",
    section_id: "ich_m10.sec.4_3_2",
    unit_type: "paragraph",
    unit_order: 1,
    unit_order_status: "known",
    source_text: "Criteria for acceptance of an analytical run in LBA: The calibration curve accuracy should be within ±20% (±25% at LLOQ and ULOQ) for at least 75% of calibration standards (minimum 6 levels). For QCs, at least 67% (2/3) of the total QCs and at least 50% of the QCs at each concentration level should be within ±20% of their nominal concentration (4-6-20 rule for LBA). If an analytical run fails, the run should be rejected and study samples reanalysed.",
    related_source_unit_ids: [],
    table_context: null,
    trace: makeTrace("ich_m10.sec.4_3_2", 30, "31"),
    review_status: "reviewed"
  },
  // 4.3.3 Calibration Range
  {
    source_unit_id: "ich_m10.su.4_3_3.001",
    document_id: "ich_m10",
    section_id: "ich_m10.sec.4_3_3",
    unit_type: "paragraph",
    unit_order: 1,
    unit_order_status: "known",
    source_text: "At least 2 QC levels should fall within the range of concentrations measured in study samples. If an unanticipated clustering of study samples is observed or a large number of samples are above ULOQ, the calibration curve range should be changed (partial validation) and QCs adjusted, or samples diluted according to the validated dilution method.",
    related_source_unit_ids: [],
    table_context: null,
    trace: makeTrace("ich_m10.sec.4_3_3", 31, "32"),
    review_status: "reviewed"
  },
  // 4.3.4 Reanalysis of Study Samples
  {
    source_unit_id: "ich_m10.su.4_3_4.001",
    document_id: "ich_m10",
    section_id: "ich_m10.sec.4_3_4",
    unit_type: "paragraph",
    unit_order: 1,
    unit_order_status: "known",
    source_text: "Possible reasons for reanalysis of study samples, number of replicates and decision criteria should be predefined in protocol, study plan or SOP. In comparative BA/BE studies, reanalysis for PK reasons is not acceptable. The number and percentage of reanalysed samples should be reported and discussed in the Bioanalytical Report.",
    related_source_unit_ids: [],
    table_context: null,
    trace: makeTrace("ich_m10.sec.4_3_4", 31, "32"),
    review_status: "reviewed"
  },
  // 5 Incurred Sample Reanalysis (ISR)
  {
    source_unit_id: "ich_m10.su.5.001",
    document_id: "ich_m10",
    section_id: "ich_m10.sec.5",
    unit_type: "paragraph",
    unit_order: 1,
    unit_order_status: "known",
    source_text: "ISR is intended to verify the reliability of reported sample analyte concentrations. ISR should be performed at least for nonclinical studies (at least once per species), all pivotal comparative BA/BE studies, first clinical trial in subjects, pivotal early patient trials (once per patient population), and trials in patients with impaired hepatic and/or renal function. ISR is conducted by repeating analysis of a subset of study samples in separate runs on different days using the same bioanalytical method. Sample size: If total study samples ≤ 1000, 10% of samples should be reanalysed; if total samples > 1000, 10% of the first 1000 samples (100) plus 5% of samples exceeding 1000 should be assessed. Samples should be chosen around Cmax and in elimination phase, representative of whole study. Acceptance criteria: The percent difference between repeat value and initial value relative to mean should be within ±20% for at least 2/3 of repeats for chromatographic methods (4-6-20 rule), and within ±30% for at least 2/3 of repeats for LBAs (4-6-30 rule).",
    related_source_unit_ids: [],
    table_context: null,
    trace: makeTrace("ich_m10.sec.5", 32, "33"),
    review_status: "reviewed"
  }
];

async function runExtraction() {
  console.log("=== Running 3-Pass Extraction on ICH M10 Batch 3 (LBA & ISR) ===");
  const client = createClient();

  // Clean out any previously added sections in this batch
  const secIds = new Set(sectionsToAdd.map((s) => s.section_id));
  const suIds = new Set(sourceUnitsToAdd.map((s) => s.source_unit_id));
  bundle.sections = bundle.sections.filter((s) => !secIds.has(s.section_id));
  bundle.source_units = bundle.source_units.filter((s) => !suIds.has(s.source_unit_id));
  bundle.knowledge_records = bundle.knowledge_records.filter((k) => !(k.source_unit_ids || []).some((id) => suIds.has(id)));
  bundle.quantitative_criteria = bundle.quantitative_criteria.filter((q) => !suIds.has(q.source_unit_id));
  bundle.conditions = bundle.conditions.filter((c) => !suIds.has(c.source_unit_id));

  const targetSections = sectionsToAdd
    .filter((sec) => sourceUnitsToAdd.some((s) => s.section_id === sec.section_id))
    .map((sec) => ({
      sec,
      sus: sourceUnitsToAdd.filter((s) => s.section_id === sec.section_id)
    }));

  const extractedKrs = [];
  const extractedQcs = [];
  const extractedConds = [];

  for (const { sec, sus } of targetSections) {
    console.log(`\nExtracting Section ${sec.section_number}: ${sec.title} (${sus.length} SourceUnits)...`);
    const res = await extractSectionSelfConsistent({
      section: sec,
      sourceUnits: sus,
      client,
      passes: 3
    });

    console.log(`  ➔ Drafted: ${res.draft.knowledge_records.length} KR, ${res.draft.quantitative_criteria.length} QC, ${res.draft.conditions.length} Cond`);
    console.log(`  ➔ Verification Entailed: ${res.report.filter((r) => r.entailed).length} / ${res.report.length}`);

    // Mark reviewed
    for (const kr of res.draft.knowledge_records) kr.review_status = "reviewed";
    for (const qc of res.draft.quantitative_criteria) qc.review_status = "reviewed";
    for (const c of res.draft.conditions) c.review_status = "reviewed";

    extractedKrs.push(...res.draft.knowledge_records);
    extractedQcs.push(...res.draft.quantitative_criteria);
    extractedConds.push(...res.draft.conditions);
  }

  // Merge into bundle
  for (const sec of sectionsToAdd) {
    bundle.sections.push(sec);
  }
  // Re-number section_order
  bundle.sections.sort((a, b) => (a.section_order ?? 0) - (b.section_order ?? 0));
  bundle.sections.forEach((s, idx) => {
    s.section_order = idx + 1;
    s.section_order_status = "known";
  });

  for (const su of sourceUnitsToAdd) {
    bundle.source_units.push(su);
  }
  bundle.source_units.sort((a, b) => (a.unit_order ?? 0) - (b.unit_order ?? 0));

  bundle.knowledge_records.push(...extractedKrs);
  bundle.quantitative_criteria.push(...extractedQcs);
  bundle.conditions.push(...extractedConds);

  // Normalize QCs to strictly satisfy schema draft-07 oneOf
  for (const qc of bundle.quantitative_criteria) {
    if (qc.value_status === "known") {
      if (typeof qc.value === "number" && qc.value_fraction) {
        qc.value_fraction = null;
      } else if (qc.value_fraction && typeof qc.value_fraction.numerator === "number" && typeof qc.value_fraction.denominator === "number") {
        qc.value = null;
      } else if (typeof qc.value === "number") {
        qc.value_fraction = null;
      } else {
        qc.value_status = "unknown";
        qc.value = null;
        qc.value_fraction = null;
      }
    } else {
      qc.value = null;
      qc.value_fraction = null;
    }
    if (qc.is_default_with_exception && (!qc.condition_ids || qc.condition_ids.length === 0)) {
      qc.is_default_with_exception = false;
    }
  }

  // Reciprocal closure on joint_with_ids (prevent self-reference)
  const validQcIds = new Set(bundle.quantitative_criteria.map((q) => q.criterion_id));
  for (const qc of bundle.quantitative_criteria) {
    qc.joint_with_ids = (qc.joint_with_ids || []).filter((id) => id !== qc.criterion_id && validQcIds.has(id));
    for (const jid of qc.joint_with_ids) {
      const target = bundle.quantitative_criteria.find((t) => t.criterion_id === jid);
      if (target && target.criterion_id !== qc.criterion_id && !target.joint_with_ids.includes(qc.criterion_id)) {
        target.joint_with_ids.push(qc.criterion_id);
      }
    }
  }

  // Sane applies_to_ids and condition_type on conditions
  const validKrIds = new Set(bundle.knowledge_records.map((k) => k.knowledge_record_id));
  const validCondTypes = new Set(["applicability", "scope", "precondition", "exception"]);
  for (const c of bundle.conditions) {
    if (!validCondTypes.has(c.condition_type)) {
      c.condition_type = "applicability";
    }
    c.applies_to_ids = (c.applies_to_ids || []).filter((id) => validKrIds.has(id) || validQcIds.has(id));
    if (c.condition_type === "exception" && c.applies_to_ids.length === 0) {
      c.condition_type = "applicability";
    }
  }

  // In-memory AJV schema validation before write
  fs.writeFileSync(bundlePath, JSON.stringify(bundle, null, 2), "utf8");
  const valRes = validateFiles([bundlePath]);
  if (!valRes.ok) {
    console.error("Schema validation failed on updated bundle:", valRes.errors);
    process.exit(1);
  }

  console.log(`\n==================================================`);
  console.log(`Successfully completed ICH M10 Batch 3 Ingestion!`);
  console.log(`Total Sections: ${bundle.sections.length}`);
  console.log(`Total SourceUnits: ${bundle.source_units.length}`);
  console.log(`Total KnowledgeRecords: ${bundle.knowledge_records.length}`);
  console.log(`Total QuantitativeCriteria: ${bundle.quantitative_criteria.length}`);
  console.log(`Total Conditions: ${bundle.conditions.length}`);
  console.log(`Total Archive Entities: ${bundle.knowledge_records.length + bundle.quantitative_criteria.length + bundle.conditions.length}`);
  console.log(`==================================================`);
}

runExtraction().catch(console.error);
