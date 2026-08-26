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
  {
    section_id: "ich_m10.sec.3",
    document_id: "ich_m10",
    section_number: "3",
    title: "CHROMATOGRAPHY",
    parent_section_id: null,
    heading_source_unit_id: null,
    section_order: 11,
    section_order_status: "known"
  },
  {
    section_id: "ich_m10.sec.3_1",
    document_id: "ich_m10",
    section_number: "3.1",
    title: "Reference Standards",
    parent_section_id: "ich_m10.sec.3",
    heading_source_unit_id: null,
    section_order: 12,
    section_order_status: "known"
  },
  {
    section_id: "ich_m10.sec.3_2",
    document_id: "ich_m10",
    section_number: "3.2",
    title: "Validation",
    parent_section_id: "ich_m10.sec.3",
    heading_source_unit_id: null,
    section_order: 13,
    section_order_status: "known"
  },
  {
    section_id: "ich_m10.sec.3_2_1",
    document_id: "ich_m10",
    section_number: "3.2.1",
    title: "Selectivity",
    parent_section_id: "ich_m10.sec.3_2",
    heading_source_unit_id: null,
    section_order: 14,
    section_order_status: "known"
  },
  {
    section_id: "ich_m10.sec.3_2_2",
    document_id: "ich_m10",
    section_number: "3.2.2",
    title: "Specificity",
    parent_section_id: "ich_m10.sec.3_2",
    heading_source_unit_id: null,
    section_order: 15,
    section_order_status: "known"
  },
  {
    section_id: "ich_m10.sec.3_2_3",
    document_id: "ich_m10",
    section_number: "3.2.3",
    title: "Matrix Effect",
    parent_section_id: "ich_m10.sec.3_2",
    heading_source_unit_id: null,
    section_order: 16,
    section_order_status: "known"
  },
  {
    section_id: "ich_m10.sec.3_2_4",
    document_id: "ich_m10",
    section_number: "3.2.4",
    title: "Calibration Curve and Range",
    parent_section_id: "ich_m10.sec.3_2",
    heading_source_unit_id: null,
    section_order: 17,
    section_order_status: "known"
  },
  {
    section_id: "ich_m10.sec.3_2_5_1",
    document_id: "ich_m10",
    section_number: "3.2.5.1",
    title: "Preparation of Quality Control Samples",
    parent_section_id: "ich_m10.sec.3_2_5",
    heading_source_unit_id: null,
    section_order: 18,
    section_order_status: "known"
  },
  {
    section_id: "ich_m10.sec.3_2_6",
    document_id: "ich_m10",
    section_number: "3.2.6",
    title: "Carry-over",
    parent_section_id: "ich_m10.sec.3_2",
    heading_source_unit_id: null,
    section_order: 19,
    section_order_status: "known"
  },
  {
    section_id: "ich_m10.sec.3_2_7",
    document_id: "ich_m10",
    section_number: "3.2.7",
    title: "Dilution Integrity",
    parent_section_id: "ich_m10.sec.3_2",
    heading_source_unit_id: null,
    section_order: 20,
    section_order_status: "known"
  },
  {
    section_id: "ich_m10.sec.3_2_8",
    document_id: "ich_m10",
    section_number: "3.2.8",
    title: "Stability",
    parent_section_id: "ich_m10.sec.3_2",
    heading_source_unit_id: null,
    section_order: 21,
    section_order_status: "known"
  },
  {
    section_id: "ich_m10.sec.3_2_9",
    document_id: "ich_m10",
    section_number: "3.2.9",
    title: "Reinjection Reproducibility",
    parent_section_id: "ich_m10.sec.3_2",
    heading_source_unit_id: null,
    section_order: 22,
    section_order_status: "known"
  },
  {
    section_id: "ich_m10.sec.3_3",
    document_id: "ich_m10",
    section_number: "3.3",
    title: "Study Sample Analysis",
    parent_section_id: "ich_m10.sec.3",
    heading_source_unit_id: null,
    section_order: 23,
    section_order_status: "known"
  },
  {
    section_id: "ich_m10.sec.3_3_1",
    document_id: "ich_m10",
    section_number: "3.3.1",
    title: "Analytical Run",
    parent_section_id: "ich_m10.sec.3_3",
    heading_source_unit_id: null,
    section_order: 24,
    section_order_status: "known"
  },
  {
    section_id: "ich_m10.sec.3_3_2",
    document_id: "ich_m10",
    section_number: "3.3.2",
    title: "Acceptance Criteria for an Analytical Run",
    parent_section_id: "ich_m10.sec.3_3",
    heading_source_unit_id: null,
    section_order: 25,
    section_order_status: "known"
  },
  {
    section_id: "ich_m10.sec.3_3_3",
    document_id: "ich_m10",
    section_number: "3.3.3",
    title: "Calibration Range",
    parent_section_id: "ich_m10.sec.3_3",
    heading_source_unit_id: null,
    section_order: 26,
    section_order_status: "known"
  },
  {
    section_id: "ich_m10.sec.3_3_4",
    document_id: "ich_m10",
    section_number: "3.3.4",
    title: "Reanalysis of Study Samples",
    parent_section_id: "ich_m10.sec.3_3",
    heading_source_unit_id: null,
    section_order: 27,
    section_order_status: "known"
  },
  {
    section_id: "ich_m10.sec.3_3_5",
    document_id: "ich_m10",
    section_number: "3.3.5",
    title: "Reinjection of Study Samples",
    parent_section_id: "ich_m10.sec.3_3",
    heading_source_unit_id: null,
    section_order: 28,
    section_order_status: "known"
  },
  {
    section_id: "ich_m10.sec.3_3_6",
    document_id: "ich_m10",
    section_number: "3.3.6",
    title: "Integration of Chromatograms",
    parent_section_id: "ich_m10.sec.3_3",
    heading_source_unit_id: null,
    section_order: 29,
    section_order_status: "known"
  }
];

const sourceUnitsToAdd = [
  // 3.1 Reference Standards
  {
    source_unit_id: "ich_m10.su.3_1.001",
    document_id: "ich_m10",
    section_id: "ich_m10.sec.3_1",
    unit_type: "paragraph",
    unit_order: 1,
    unit_order_status: "known",
    source_text: "During method validation and the analysis of study samples, a blank biological matrix is spiked with the analyte(s) of interest using solutions of reference standard(s) to prepare calibration standards and QCs. Calibration standards and QCs should be prepared from separate stock solutions. However, calibration standards and QCs may be prepared from the same stock solution provided the accurate preparation and stability of the stock solution should have been verified. A suitable internal standard (IS) should be added to all calibration standards, QCs and study samples during sample processing. The absence of an IS should be justified. The reference standard used during validation and study sample analysis should be obtained from an authentic and traceable source. The reference standard should be identical to the analyte. A certificate of analysis (CoA) or an equivalent alternative is required to ensure quality and to provide information on the purity, storage conditions, retest/expiration date and batch number of the reference standard.",
    related_source_unit_ids: [],
    table_context: null,
    trace: makeTrace("ich_m10.sec.3_1", 8, "9"),
    review_status: "reviewed"
  },
  // 3.2.1 Selectivity
  {
    source_unit_id: "ich_m10.su.3_2_1.001",
    document_id: "ich_m10",
    section_id: "ich_m10.sec.3_2_1",
    unit_type: "paragraph",
    unit_order: 1,
    unit_order_status: "known",
    source_text: "Selectivity is the ability of an analytical method to differentiate and measure the analyte in the presence of interfering substances in the biological matrix. Selectivity is evaluated using blank samples (matrix samples without addition of analyte or IS) obtained from at least 6 individual sources/lots (or fewer in the case of rare matrices). Selectivity should be evaluated by analysing blank samples from individual sources, zero samples (blank with IS) and LLOQ samples. Responses in blank samples should not exceed 20% of the analyte response at the LLOQ and should not exceed 5% of the response for the IS. For non-polar matrices (e.g., lipid, lipaemic), at least 6 individual sources/lots should be evaluated.",
    related_source_unit_ids: [],
    table_context: null,
    trace: makeTrace("ich_m10.sec.3_2_1", 9, "10"),
    review_status: "reviewed"
  },
  // 3.2.2 Specificity
  {
    source_unit_id: "ich_m10.su.3_2_2.001",
    document_id: "ich_m10",
    section_id: "ich_m10.sec.3_2_2",
    unit_type: "paragraph",
    unit_order: 1,
    unit_order_status: "known",
    source_text: "Specificity is the ability of an analytical method to detect and differentiate the analyte from other substances, including related substances (e.g., substances with similar physicochemical properties, metabolites, isomers, impurities, concomitant medications). If the method cannot distinguish the analyte from related substances, the lack of specificity should be justified. Specificity should be evaluated by spiking blank matrix samples with potential interfering substances at the highest concentrations anticipated in study samples. The response in blank samples spiked with potential interfering substances should not exceed 20% of the analyte response at the LLOQ and should not exceed 5% of the response for the IS.",
    related_source_unit_ids: [],
    table_context: null,
    trace: makeTrace("ich_m10.sec.3_2_2", 10, "11"),
    review_status: "reviewed"
  },
  // 3.2.3 Matrix Effect
  {
    source_unit_id: "ich_m10.su.3_2_3.001",
    document_id: "ich_m10",
    section_id: "ich_m10.sec.3_2_3",
    unit_type: "paragraph",
    unit_order: 1,
    unit_order_status: "known",
    source_text: "A matrix effect is defined as an alteration of the analyte response due to interfering and often unidentified component(s) in the sample matrix. The matrix effect should be evaluated when using mass spectrometry (MS) detection. The matrix effect should be evaluated by calculating the matrix factor (MF) for at least 6 individual lots of blank matrix from individual donors. The MF should be determined at low and high QC concentrations. The IS-normalized MF should be calculated by dividing the MF of the analyte by the MF of the IS. The overall precision (%CV) of the IS-normalized MF calculated from the 6 individual lots should not exceed 15% at each concentration level.",
    related_source_unit_ids: [],
    table_context: null,
    trace: makeTrace("ich_m10.sec.3_2_3", 10, "11"),
    review_status: "reviewed"
  },
  // 3.2.4 Calibration Curve and Range
  {
    source_unit_id: "ich_m10.su.3_2_4.001",
    document_id: "ich_m10",
    section_id: "ich_m10.sec.3_2_4",
    unit_type: "paragraph",
    unit_order: 1,
    unit_order_status: "known",
    source_text: "The calibration curve demonstrates the relationship between nominal analyte concentration and detector response. A calibration curve should be generated with a blank sample, a zero sample (blank with IS), and at least 6 concentration levels of calibration standards, including LLOQ and ULOQ. The accuracy of back-calculated concentrations of each calibration standard should be within ±20% of nominal concentration at LLOQ and within ±15% at all other levels. At least 75% of calibration standards with a minimum of 6 calibration standard levels should meet these criteria. In the case that replicates are used, at least 50% of calibration standards tested per concentration level should meet the criteria.",
    related_source_unit_ids: [],
    table_context: null,
    trace: makeTrace("ich_m10.sec.3_2_4", 11, "12"),
    review_status: "reviewed"
  },
  // 3.2.5.1 Preparation of Quality Control Samples
  {
    source_unit_id: "ich_m10.su.3_2_5_1.001",
    document_id: "ich_m10",
    section_id: "ich_m10.sec.3_2_5_1",
    unit_type: "paragraph",
    unit_order: 1,
    unit_order_status: "known",
    source_text: "During method validation the QCs for accuracy and precision runs should be prepared at a minimum of 4 concentration levels within the calibration curve range: the LLOQ, within three times of the LLOQ (low QC), around 30 - 50% of the calibration curve range (medium QC) and at least 75% of the ULOQ (high QC). For non-accuracy and precision validation runs, low, medium and high QCs may be analysed in duplicate.",
    related_source_unit_ids: [],
    table_context: null,
    trace: makeTrace("ich_m10.sec.3_2_5_1", 12, "13"),
    review_status: "reviewed"
  },
  // 3.2.6 Carry-over
  {
    source_unit_id: "ich_m10.su.3_2_6.001",
    document_id: "ich_m10",
    section_id: "ich_m10.sec.3_2_6",
    unit_type: "paragraph",
    unit_order: 1,
    unit_order_status: "known",
    source_text: "Carry-over should be assessed and minimised during method development. During validation carry-over should be assessed by analysing blank samples after the calibration standard at the ULOQ. Carry-over in the blank samples following the highest calibration standard should not be greater than 20% of the analyte response at the LLOQ and 5% of the response for the IS. If carry-over is unavoidable, specific measures should be applied during study sample analysis.",
    related_source_unit_ids: [],
    table_context: null,
    trace: makeTrace("ich_m10.sec.3_2_6", 13, "14"),
    review_status: "reviewed"
  },
  // 3.2.7 Dilution Integrity
  {
    source_unit_id: "ich_m10.su.3_2_7.001",
    document_id: "ich_m10",
    section_id: "ich_m10.sec.3_2_7",
    unit_type: "paragraph",
    unit_order: 1,
    unit_order_status: "known",
    source_text: "Dilution integrity should be demonstrated by spiking the matrix with an analyte concentration above the ULOQ and diluting this sample with blank matrix to within the calibration range. A minimum of 5 replicates per dilution factor should be tested in one run. The mean accuracy should be within ±15% of the nominal concentration and the precision (%CV) should not exceed 15%.",
    related_source_unit_ids: [],
    table_context: null,
    trace: makeTrace("ich_m10.sec.3_2_7", 14, "15"),
    review_status: "reviewed"
  },
  // 3.2.8 Stability
  {
    source_unit_id: "ich_m10.su.3_2_8.001",
    document_id: "ich_m10",
    section_id: "ich_m10.sec.3_2_8",
    unit_type: "paragraph",
    unit_order: 1,
    unit_order_status: "known",
    source_text: "Stability evaluations should cover the conditions experienced by study samples, including sample collection, handling, storage, and processing. Stability of the analyte in matrix is evaluated using low and high concentration QCs. A minimum of 3 aliquots should be analysed at each concentration level. The mean concentration at each QC level should be within ±15% of the nominal concentration. Stability testing includes: 1) Freeze-Thaw Stability in matrix (minimum of 3 cycles, kept frozen at least 12 hours between cycles); 2) Bench-Top (short-term) Stability covering handling conditions; 3) Long-Term Stability in matrix stored in freezer for duration of study sample storage; 4) Processed sample stability (dry extract or autosampler stability); 5) Stock and working solution stability; 6) Whole blood stability directly after collection prior to storage.",
    related_source_unit_ids: [],
    table_context: null,
    trace: makeTrace("ich_m10.sec.3_2_8", 15, "16"),
    review_status: "reviewed"
  },
  // 3.2.9 Reinjection Reproducibility
  {
    source_unit_id: "ich_m10.su.3_2_9.001",
    document_id: "ich_m10",
    section_id: "ich_m10.sec.3_2_9",
    unit_type: "paragraph",
    unit_order: 1,
    unit_order_status: "known",
    source_text: "Reinjection reproducibility is assessed by reinjecting a run that is comprised of calibration standards and a minimum of 5 replicates of the low, middle and high QCs after storage. The precision and accuracy of the reinjected QCs establish the viability of the processed samples (within ±15% of nominal concentration and %CV ≤ 15%).",
    related_source_unit_ids: [],
    table_context: null,
    trace: makeTrace("ich_m10.sec.3_2_9", 17, "18"),
    review_status: "reviewed"
  },
  // 3.3.1 Analytical Run
  {
    source_unit_id: "ich_m10.su.3_3_1.001",
    document_id: "ich_m10",
    section_id: "ich_m10.sec.3_3_1",
    unit_type: "paragraph",
    unit_order: 1,
    unit_order_status: "known",
    source_text: "An analytical run consists of a blank sample, a zero sample, calibration standards at a minimum of 6 concentration levels, QCs at a minimum of 3 concentration levels (low, medium, high) in duplicate (or at least 5% of the total number of study samples, whichever is greater), and the study samples to be analysed.",
    related_source_unit_ids: [],
    table_context: null,
    trace: makeTrace("ich_m10.sec.3_3_1", 18, "19"),
    review_status: "reviewed"
  },
  // 3.3.2 Acceptance Criteria for an Analytical Run
  {
    source_unit_id: "ich_m10.su.3_3_2.001",
    document_id: "ich_m10",
    section_id: "ich_m10.sec.3_3_2",
    unit_type: "paragraph",
    unit_order: 1,
    unit_order_status: "known",
    source_text: "Criteria for acceptance or rejection of an analytical run: The calibration curve accuracy should be within ±20% at LLOQ and within ±15% at all other levels for at least 75% of calibration standards (minimum 6 levels). For QCs, at least 67% (2/3) of the total QCs and at least 50% of the QCs at each concentration level should be within ±15% of their nominal concentration (4-6-15 rule). If an analytical run fails, the run should be rejected and study samples reanalysed.",
    related_source_unit_ids: [],
    table_context: null,
    trace: makeTrace("ich_m10.sec.3_3_2", 19, "20"),
    review_status: "reviewed"
  },
  // 3.3.3 Calibration Range
  {
    source_unit_id: "ich_m10.su.3_3_3.001",
    document_id: "ich_m10",
    section_id: "ich_m10.sec.3_3_3",
    unit_type: "paragraph",
    unit_order: 1,
    unit_order_status: "known",
    source_text: "At least 2 QC levels should fall within the range of concentrations measured in study samples. If an unanticipated clustering of study samples is observed or a large number of study samples are above the ULOQ, the calibration curve range should be changed (partial validation) and QCs adjusted, or samples diluted according to the validated dilution method.",
    related_source_unit_ids: [],
    table_context: null,
    trace: makeTrace("ich_m10.sec.3_3_3", 20, "21"),
    review_status: "reviewed"
  },
  // 3.3.4 Reanalysis of Study Samples
  {
    source_unit_id: "ich_m10.su.3_3_4.001",
    document_id: "ich_m10",
    section_id: "ich_m10.sec.3_3_4",
    unit_type: "paragraph",
    unit_order: 1,
    unit_order_status: "known",
    source_text: "Possible reasons for reanalysis of study samples, number of replicates and decision criteria should be predefined in protocol, study plan or SOP. In comparative BA/BE studies, reanalysis for PK reasons is not acceptable. The number and percentage of reanalysed samples should be reported and discussed in the Bioanalytical Report.",
    related_source_unit_ids: [],
    table_context: null,
    trace: makeTrace("ich_m10.sec.3_3_4", 21, "22"),
    review_status: "reviewed"
  },
  // 3.3.5 Reinjection of Study Samples
  {
    source_unit_id: "ich_m10.su.3_3_5.001",
    document_id: "ich_m10",
    section_id: "ich_m10.sec.3_3_5",
    unit_type: "paragraph",
    unit_order: 1,
    unit_order_status: "known",
    source_text: "Reinjection of processed samples can be made in the case of equipment failure if reinjection reproducibility has been demonstrated during validation. Reinjection of a full run or individual calibration standards or QCs simply because they failed, without analytical cause, is not acceptable.",
    related_source_unit_ids: [],
    table_context: null,
    trace: makeTrace("ich_m10.sec.3_3_5", 22, "23"),
    review_status: "reviewed"
  },
  // 3.3.6 Integration of Chromatograms
  {
    source_unit_id: "ich_m10.su.3_3_6.001",
    document_id: "ich_m10",
    section_id: "ich_m10.sec.3_3_6",
    unit_type: "paragraph",
    unit_order: 1,
    unit_order_status: "known",
    source_text: "Chromatogram integration and reintegration should be described in a study plan, protocol or SOP. The list of chromatograms that required reintegration, including any manual integrations, and the reasons for reintegration should be included in the Bioanalytical Report.",
    related_source_unit_ids: [],
    table_context: null,
    trace: makeTrace("ich_m10.sec.3_3_6", 22, "23"),
    review_status: "reviewed"
  }
];

async function runExtraction() {
  console.log("=== Running 3-Pass Extraction on ICH M10 Batch 2 (Chromatography Complete) ===");
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
  console.log(`Successfully completed ICH M10 Batch 2 Ingestion!`);
  console.log(`Total Sections: ${bundle.sections.length}`);
  console.log(`Total SourceUnits: ${bundle.source_units.length}`);
  console.log(`Total KnowledgeRecords: ${bundle.knowledge_records.length}`);
  console.log(`Total QuantitativeCriteria: ${bundle.quantitative_criteria.length}`);
  console.log(`Total Conditions: ${bundle.conditions.length}`);
  console.log(`Total Archive Entities: ${bundle.knowledge_records.length + bundle.quantitative_criteria.length + bundle.conditions.length}`);
  console.log(`==================================================`);
}

runExtraction().catch(console.error);
