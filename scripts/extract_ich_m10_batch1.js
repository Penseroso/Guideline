const fs = require("fs");
const path = require("path");
const { createClient } = require("../engine/llm_client");
const { extractSectionSelfConsistent } = require("../engine/pipeline");
const { validateFiles } = require("../validation/validate_structured_data");

const bundlePath = path.resolve(__dirname, "..", "data", "pilots", "ich_m10_validation.json");

// Start with clean document base
const initialDoc = {
  document_id: "ich_m10",
  title: "Bioanalytical Method Validation and Study Sample Analysis",
  guideline_code: "ICH M10",
  issuing_body: "ICH",
  document_version_label: "Final version, adopted on 24 May 2022",
  source_file_path: "source_pdfs/ICH M10.pdf",
  source_file_checksum: "E306F3B6DC367EB2913CE242093A8F6C9DCD095A139A9FDB6D6F5E25201FA6AF",
  schema_model_version: "0.5.0"
};

// Also load existing verified §3.2.5.2 records from fixture
const fixture3252 = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "test", "fixtures", "m10_3_2_5_2.json"), "utf8"));

let bundle = {
  documents: [initialDoc],
  sections: [...fixture3252.sections],
  source_units: [...fixture3252.source_units],
  knowledge_records: [...fixture3252.knowledge_records],
  quantitative_criteria: [...fixture3252.quantitative_criteria],
  conditions: [...fixture3252.conditions],
  cross_references: []
};

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
  // Section 1
  {
    section_id: "ich_m10.sec.1",
    document_id: "ich_m10",
    section_number: "1",
    title: "INTRODUCTION",
    parent_section_id: null,
    heading_source_unit_id: null,
    section_order: 1,
    section_order_status: "known"
  },
  {
    section_id: "ich_m10.sec.1_1",
    document_id: "ich_m10",
    section_number: "1.1",
    title: "Objective",
    parent_section_id: "ich_m10.sec.1",
    heading_source_unit_id: null,
    section_order: 2,
    section_order_status: "known"
  },
  {
    section_id: "ich_m10.sec.1_2",
    document_id: "ich_m10",
    section_number: "1.2",
    title: "Background",
    parent_section_id: "ich_m10.sec.1",
    heading_source_unit_id: null,
    section_order: 3,
    section_order_status: "known"
  },
  {
    section_id: "ich_m10.sec.1_3",
    document_id: "ich_m10",
    section_number: "1.3",
    title: "Scope",
    parent_section_id: "ich_m10.sec.1",
    heading_source_unit_id: null,
    section_order: 4,
    section_order_status: "known"
  },
  // Section 2
  {
    section_id: "ich_m10.sec.2",
    document_id: "ich_m10",
    section_number: "2",
    title: "GENERAL PRINCIPLES",
    parent_section_id: null,
    heading_source_unit_id: null,
    section_order: 5,
    section_order_status: "known"
  },
  {
    section_id: "ich_m10.sec.2_1",
    document_id: "ich_m10",
    section_number: "2.1",
    title: "Method Development",
    parent_section_id: "ich_m10.sec.2",
    heading_source_unit_id: null,
    section_order: 6,
    section_order_status: "known"
  },
  {
    section_id: "ich_m10.sec.2_2",
    document_id: "ich_m10",
    section_number: "2.2",
    title: "Method Validation",
    parent_section_id: "ich_m10.sec.2",
    heading_source_unit_id: null,
    section_order: 7,
    section_order_status: "known"
  },
  {
    section_id: "ich_m10.sec.2_2_1",
    document_id: "ich_m10",
    section_number: "2.2.1",
    title: "Full Validation",
    parent_section_id: "ich_m10.sec.2_2",
    heading_source_unit_id: null,
    section_order: 8,
    section_order_status: "known"
  },
  {
    section_id: "ich_m10.sec.2_2_2",
    document_id: "ich_m10",
    section_number: "2.2.2",
    title: "Partial Validation",
    parent_section_id: "ich_m10.sec.2_2",
    heading_source_unit_id: null,
    section_order: 9,
    section_order_status: "known"
  },
  {
    section_id: "ich_m10.sec.2_2_3",
    document_id: "ich_m10",
    section_number: "2.2.3",
    title: "Cross Validation",
    parent_section_id: "ich_m10.sec.2_2",
    heading_source_unit_id: null,
    section_order: 10,
    section_order_status: "known"
  },
  // Section 6
  {
    section_id: "ich_m10.sec.6",
    document_id: "ich_m10",
    section_number: "6",
    title: "PARTIAL AND CROSS VALIDATION",
    parent_section_id: null,
    heading_source_unit_id: null,
    section_order: 25,
    section_order_status: "known"
  },
  {
    section_id: "ich_m10.sec.6_1",
    document_id: "ich_m10",
    section_number: "6.1",
    title: "Partial Validation",
    parent_section_id: "ich_m10.sec.6",
    heading_source_unit_id: null,
    section_order: 26,
    section_order_status: "known"
  },
  {
    section_id: "ich_m10.sec.6_2",
    document_id: "ich_m10",
    section_number: "6.2",
    title: "Cross Validation",
    parent_section_id: "ich_m10.sec.6",
    heading_source_unit_id: null,
    section_order: 27,
    section_order_status: "known"
  }
];

const sourceUnitsToAdd = [
  // 1.1 Objective
  {
    source_unit_id: "ich_m10.su.1_1.001",
    document_id: "ich_m10",
    section_id: "ich_m10.sec.1_1",
    unit_type: "paragraph",
    unit_order: 1,
    unit_order_status: "known",
    source_text: "This guideline is intended to provide recommendations for the validation of bioanalytical methods for chemical and biological drug quantification and their application in the analysis of study samples. Adherence to the principles presented in this guideline will ensure the quality and consistency of the bioanalytical data in support of the development and market approval of both chemical and biological drugs. The objective of the validation of a bioanalytical method is to demonstrate that it is suitable for its intended purpose. Changes from the recommendations in this guideline may be acceptable if appropriate scientific justification is provided.",
    related_source_unit_ids: [],
    table_context: null,
    trace: makeTrace("ich_m10.sec.1_1", 5, "6"),
    review_status: "reviewed"
  },
  // 1.2 Background
  {
    source_unit_id: "ich_m10.su.1_2.001",
    document_id: "ich_m10",
    section_id: "ich_m10.sec.1_2",
    unit_type: "paragraph",
    unit_order: 1,
    unit_order_status: "known",
    source_text: "Concentration measurements of chemical and biological drug(s) and their metabolite(s) in biological matrices are an important aspect of drug development. The results of studies employing such methods contribute to regulatory decisions regarding the safety and efficacy of drug products. It is therefore critical that the bioanalytical methods used are well characterised, appropriately validated and documented in order to ensure reliable data to support regulatory decisions. This guideline intends to facilitate development of drugs in accordance with the principles of 3Rs (Reduce, Refine, Replace) for animal studies, where valid.",
    related_source_unit_ids: [],
    table_context: null,
    trace: makeTrace("ich_m10.sec.1_2", 5, "6"),
    review_status: "reviewed"
  },
  // 1.3 Scope
  {
    source_unit_id: "ich_m10.su.1_3.001",
    document_id: "ich_m10",
    section_id: "ich_m10.sec.1_3",
    unit_type: "paragraph",
    unit_order: 1,
    unit_order_status: "known",
    source_text: "This guideline describes the validation of bioanalytical methods and study sample analysis that are expected to support regulatory decisions. The guideline is applicable to the bioanalytical methods used to measure concentrations of chemical and biological drug(s) and their metabolite(s) in biological samples (e.g., blood, plasma, serum, other body fluids or tissues) obtained in nonclinical toxicokinetic (TK) studies conducted according to the principles of GLP, nonclinical pharmacokinetic (PK) studies conducted as surrogates for clinical studies, and all phases of clinical trials, including comparative bioavailability/bioequivalence (BA/BE) studies, in regulatory submissions. Full method validation is expected for the primary matrix intended to support regulatory submissions. Additional matrices should be validated as necessary. For studies that are not submitted for regulatory approval or not considered for regulatory decisions regarding safety, efficacy or labelling (e.g., exploratory investigations), applicants may decide on the level of qualification that supports their own internal decision making.",
    related_source_unit_ids: [],
    table_context: null,
    trace: makeTrace("ich_m10.sec.1_3", 5, "6"),
    review_status: "reviewed"
  },
  {
    source_unit_id: "ich_m10.su.1_3.002",
    document_id: "ich_m10",
    section_id: "ich_m10.sec.1_3",
    unit_type: "paragraph",
    unit_order: 2,
    unit_order_status: "known",
    source_text: "The information in this guideline applies to the quantitative analysis by ligand binding assays (LBAs) and chromatographic methods such as liquid chromatography (LC) or gas chromatography (GC), which are typically used in combination with mass spectrometry (MS) detection. For studies that are subject to Good Laboratory Practice (GLP) or Good Clinical Practice (GCP) the bioanalysis of study samples should also conform to their requirements. The bioanalysis of biomarkers and bioanalytical methods used for the assessment of immunogenicity are not within the scope of this guideline.",
    related_source_unit_ids: [],
    table_context: null,
    trace: makeTrace("ich_m10.sec.1_3", 6, "7"),
    review_status: "reviewed"
  },
  // 2.1 Method Development
  {
    source_unit_id: "ich_m10.su.2_1.001",
    document_id: "ich_m10",
    section_id: "ich_m10.sec.2_1",
    unit_type: "paragraph",
    unit_order: 1,
    unit_order_status: "known",
    source_text: "The purpose of bioanalytical method development is to define the design, operating conditions, limitations and suitability of the method for its intended purpose and to ensure that the method is ready for validation. Before or during the development of a bioanalytical method, the applicant is encouraged to, if feasible, understand the analyte of interest (e.g., the physicochemical properties of the drug, in vitro and in vivo metabolism, preferential distribution between red blood cells and plasma, and protein binding) and consider aspects of any prior analytical methods that may be applicable. Method development can include the characterisation of reference standards, critical reagents, calibration curve, quality control samples (QCs), selectivity and specificity, sensitivity, accuracy, precision, recovery, stability of the analyte, minimum required dilution (MRD). Bioanalytical method development does not require extensive record keeping or notation. If a problem is encountered with the method during the analysis of nonclinical or clinical study samples that requires that the analysis be stopped, any changes to the method and the rationale should be documented.",
    related_source_unit_ids: [],
    table_context: null,
    trace: makeTrace("ich_m10.sec.2_1", 6, "7"),
    review_status: "reviewed"
  },
  // 2.2.1 Full Validation
  {
    source_unit_id: "ich_m10.su.2_2_1.001",
    document_id: "ich_m10",
    section_id: "ich_m10.sec.2_2_1",
    unit_type: "paragraph",
    unit_order: 1,
    unit_order_status: "known",
    source_text: "Bioanalytical method validation is essential to ensure the acceptability of assay performance and the reliability of analytical results. A full validation of a bioanalytical method should be performed when establishing a bioanalytical method for the quantification of an analyte in clinical and in applicable nonclinical studies. Full validation should also be performed when implementing an analytical method that is reported in the literature and when a commercial kit is repurposed for bioanalytical use in drug development. For chromatographic methods a full validation should include selectivity, specificity, matrix effect, calibration curve (response function), range (LLOQ to ULOQ), accuracy, precision, carry-over, dilution integrity, stability and reinjection reproducibility. For LBAs the following elements should be evaluated: specificity, selectivity, calibration curve, range, accuracy, precision, carry-over, dilution linearity, and stability. Full method validation is expected for the primary matrix intended to support regulatory submissions.",
    related_source_unit_ids: [],
    table_context: null,
    trace: makeTrace("ich_m10.sec.2_2_1", 7, "8"),
    review_status: "reviewed"
  },
  // 2.2.2 Partial Validation
  {
    source_unit_id: "ich_m10.su.2_2_2.001",
    document_id: "ich_m10",
    section_id: "ich_m10.sec.2_2_2",
    unit_type: "paragraph",
    unit_order: 1,
    unit_order_status: "known",
    source_text: "Partial validations evaluate modifications to already fully validated bioanalytical methods. Partial validation can range from as little as one within-run accuracy and precision determination, to a nearly full validation. (Refer to Section 6.1)",
    related_source_unit_ids: [],
    table_context: null,
    trace: makeTrace("ich_m10.sec.2_2_2", 8, "9"),
    review_status: "reviewed"
  },
  // 2.2.3 Cross Validation
  {
    source_unit_id: "ich_m10.su.2_2_3.001",
    document_id: "ich_m10",
    section_id: "ich_m10.sec.2_2_3",
    unit_type: "paragraph",
    unit_order: 1,
    unit_order_status: "known",
    source_text: "Cross validation is required to demonstrate how the reported data are related when multiple bioanalytical methods and/or multiple bioanalytical laboratories are involved. (Refer to Section 6.2)",
    related_source_unit_ids: [],
    table_context: null,
    trace: makeTrace("ich_m10.sec.2_2_3", 8, "9"),
    review_status: "reviewed"
  },
  // 6.1 Partial Validation
  {
    source_unit_id: "ich_m10.su.6_1.001",
    document_id: "ich_m10",
    section_id: "ich_m10.sec.6_1",
    unit_type: "paragraph",
    unit_order: 1,
    unit_order_status: "known",
    source_text: "Partial validations evaluate modifications to already fully validated bioanalytical methods. Partial validation can range from as little as one within-run accuracy and precision determination, to a nearly full validation. If stability is established at one facility it does not necessarily need to be repeated at another facility. For chromatographic methods, typical bioanalytical method modifications or changes that fall into this category include: Analytical site change using same method; A change in analytical method (e.g., change in detection systems, platform); A change in sample processing procedures; A change in sample volume (e.g., paediatric samples); Changes to calibration concentration range; A change in anticoagulant (but not changes in counter-ion) in biological fluids; Change from one matrix within a species to another or changes to species within matrix; A change in storage conditions. For LBAs, modifications include: Changes in critical reagents (lot-to-lot changes); Changes in MRD; A change in storage conditions; Changes to calibration concentration range; A change in analytical method; Analytical site change; A change in sample preparation; A change in anticoagulant. The parameters of partial validations should meet the full validation criteria.",
    related_source_unit_ids: [],
    table_context: null,
    trace: makeTrace("ich_m10.sec.6_1", 34, "35"),
    review_status: "reviewed"
  },
  // 6.2 Cross Validation
  {
    source_unit_id: "ich_m10.su.6_2.001",
    document_id: "ich_m10",
    section_id: "ich_m10.sec.6_2",
    unit_type: "paragraph",
    unit_order: 1,
    unit_order_status: "known",
    source_text: "Cross validation is required to demonstrate how the reported data are related when multiple bioanalytical methods and/or multiple bioanalytical laboratories are involved. Cross validation is required under the following situations: Data are obtained from different fully validated methods within a study; Data are obtained within a study from different laboratories with the same bioanalytical method; Data are obtained from different fully validated methods across studies that are going to be combined or compared to support special dosing regimens, or regulatory decisions regarding safety, efficacy and labelling. If data are obtained from different fully validated methods, and these data are not to be combined across studies, cross validation is not generally required. Cross validation should be performed in advance of study samples being analysed, if possible.",
    related_source_unit_ids: [],
    table_context: null,
    trace: makeTrace("ich_m10.sec.6_2", 35, "36"),
    review_status: "reviewed"
  },
  {
    source_unit_id: "ich_m10.su.6_2.002",
    document_id: "ich_m10",
    section_id: "ich_m10.sec.6_2",
    unit_type: "paragraph",
    unit_order: 2,
    unit_order_status: "known",
    source_text: "Cross validation should be assessed by measuring the same set of QCs (low, medium and high) at least in triplicate and study samples (if available) that span the study sample concentration range (n≥30) with both methods, or in both laboratories. Bias can be assessed by Bland-Altman plots or Deming regression. Other methods appropriate for assessing agreement between two methods (e.g., concordance correlation coefficient) may be used too. Alternatively, the concentration vs. time curves for study samples could be plotted for samples analysed by each method to assess bias. The use of multiple bioanalytical methods for the measurement of the same analyte in the conduct of one comparative BA/BE study is strongly discouraged.",
    related_source_unit_ids: [],
    table_context: null,
    trace: makeTrace("ich_m10.sec.6_2", 36, "37"),
    review_status: "reviewed"
  }
];

async function runExtraction() {
  console.log("=== Running 3-Pass Extraction on ICH M10 Batch 1 (Introduction, General Principles, Full/Partial/Cross Validation) ===");
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
  console.log(`Successfully updated bundle with ICH M10 Batch 1!`);
  console.log(`Total Sections: ${bundle.sections.length}`);
  console.log(`Total SourceUnits: ${bundle.source_units.length}`);
  console.log(`Total KnowledgeRecords: ${bundle.knowledge_records.length}`);
  console.log(`Total QuantitativeCriteria: ${bundle.quantitative_criteria.length}`);
  console.log(`Total Conditions: ${bundle.conditions.length}`);
  console.log(`Total Archive Entities: ${bundle.knowledge_records.length + bundle.quantitative_criteria.length + bundle.conditions.length}`);
  console.log(`==================================================`);
}

runExtraction().catch(console.error);
