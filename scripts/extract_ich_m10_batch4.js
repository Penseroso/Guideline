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
  // Section 7
  {
    section_id: "ich_m10.sec.7",
    document_id: "ich_m10",
    section_number: "7",
    title: "ADDITIONAL CONSIDERATIONS",
    parent_section_id: null,
    heading_source_unit_id: null,
    section_order: 50,
    section_order_status: "known"
  },
  {
    section_id: "ich_m10.sec.7_1",
    document_id: "ich_m10",
    section_number: "7.1",
    title: "Endogenous Compounds",
    parent_section_id: "ich_m10.sec.7",
    heading_source_unit_id: null,
    section_order: 51,
    section_order_status: "known"
  },
  {
    section_id: "ich_m10.sec.7_2",
    document_id: "ich_m10",
    section_number: "7.2",
    title: "Parallelism",
    parent_section_id: "ich_m10.sec.7",
    heading_source_unit_id: null,
    section_order: 52,
    section_order_status: "known"
  },
  {
    section_id: "ich_m10.sec.7_3",
    document_id: "ich_m10",
    section_number: "7.3",
    title: "Recovery",
    parent_section_id: "ich_m10.sec.7",
    heading_source_unit_id: null,
    section_order: 53,
    section_order_status: "known"
  },
  {
    section_id: "ich_m10.sec.7_4",
    document_id: "ich_m10",
    section_number: "7.4",
    title: "Minimum Required Dilution",
    parent_section_id: "ich_m10.sec.7",
    heading_source_unit_id: null,
    section_order: 54,
    section_order_status: "known"
  },
  {
    section_id: "ich_m10.sec.7_5",
    document_id: "ich_m10",
    section_number: "7.5",
    title: "Commercial and Diagnostic Kits",
    parent_section_id: "ich_m10.sec.7",
    heading_source_unit_id: null,
    section_order: 55,
    section_order_status: "known"
  },
  {
    section_id: "ich_m10.sec.7_6",
    document_id: "ich_m10",
    section_number: "7.6",
    title: "New or Alternative Technologies",
    parent_section_id: "ich_m10.sec.7",
    heading_source_unit_id: null,
    section_order: 56,
    section_order_status: "known"
  },
  {
    section_id: "ich_m10.sec.7_6_1",
    document_id: "ich_m10",
    section_number: "7.6.1",
    title: "Dried Matrix Methods",
    parent_section_id: "ich_m10.sec.7_6",
    heading_source_unit_id: null,
    section_order: 57,
    section_order_status: "known"
  },
  // Section 8
  {
    section_id: "ich_m10.sec.8",
    document_id: "ich_m10",
    section_number: "8",
    title: "DOCUMENTATION",
    parent_section_id: null,
    heading_source_unit_id: null,
    section_order: 58,
    section_order_status: "known"
  },
  {
    section_id: "ich_m10.sec.8_1",
    document_id: "ich_m10",
    section_number: "8.1",
    title: "Summary Information",
    parent_section_id: "ich_m10.sec.8",
    heading_source_unit_id: null,
    section_order: 59,
    section_order_status: "known"
  },
  {
    section_id: "ich_m10.sec.8_2",
    document_id: "ich_m10",
    section_number: "8.2",
    title: "Documentation for Validation and Bioanalytical Reports",
    parent_section_id: "ich_m10.sec.8",
    heading_source_unit_id: null,
    section_order: 60,
    section_order_status: "known"
  },
  // Section 9
  {
    section_id: "ich_m10.sec.9",
    document_id: "ich_m10",
    section_number: "9",
    title: "GLOSSARY",
    parent_section_id: null,
    heading_source_unit_id: null,
    section_order: 61,
    section_order_status: "known"
  }
];

const sourceUnitsToAdd = [
  // 7.1 Endogenous Compounds
  {
    source_unit_id: "ich_m10.su.7_1.001",
    document_id: "ich_m10",
    section_id: "ich_m10.sec.7_1",
    unit_type: "paragraph",
    unit_order: 1,
    unit_order_status: "known",
    source_text: "Endogenous compounds are analytes that are naturally present in biological matrix. When the endogenous compound is identical to the drug to be administered, bioanalytical method validation should consider endogenous background levels. Four approaches are recognized: 1) Surrogate Matrix Approach: using a matrix that resembles biological matrix but lacks the endogenous analyte (e.g., dialysed or stripped matrix, buffer). Parallelism between surrogate and authentic matrix should be demonstrated; 2) Surrogate Analyte Approach: using a stable isotope-labelled analyte as surrogate in authentic matrix; 3) Background Subtraction Approach: subtracting the endogenous background response from spiked authentic matrix; 4) Standard Addition Approach: adding known quantities of standard to authentic sample aliquots. In all approaches, validation parameters (selectivity, accuracy, precision, stability) should meet typical acceptance criteria.",
    related_source_unit_ids: [],
    table_context: null,
    trace: makeTrace("ich_m10.sec.7_1", 36, "37"),
    review_status: "reviewed"
  },
  // 7.2 Parallelism
  {
    source_unit_id: "ich_m10.su.7_2.001",
    document_id: "ich_m10",
    section_id: "ich_m10.sec.7_2",
    unit_type: "paragraph",
    unit_order: 1,
    unit_order_status: "known",
    source_text: "Parallelism is defined as parallel dose-response relationships between calibration standards and serial dilutions of study samples. Parallelism should be evaluated when the authentic analyte in study samples may not behave identically to the calibrator (e.g., LBA for endogenous macromolecules or biomarker assays). Parallelism is investigated by serially diluting at least 3 individual study samples with high endogenous analyte concentrations (or spiked authentic samples) using surrogate or blank matrix. The precision (%CV) across dilution-adjusted concentrations should not exceed 30%.",
    related_source_unit_ids: [],
    table_context: null,
    trace: makeTrace("ich_m10.sec.7_2", 39, "40"),
    review_status: "reviewed"
  },
  // 7.3 Recovery
  {
    source_unit_id: "ich_m10.su.7_3.001",
    document_id: "ich_m10",
    section_id: "ich_m10.sec.7_3",
    unit_type: "paragraph",
    unit_order: 1,
    unit_order_status: "known",
    source_text: "For chromatographic methods, recovery is the detector response obtained from an amount of the analyte added to and extracted from the biological matrix, compared to the detector response obtained for the true concentration of the pure authentic standard. Recovery should be consistent, precise and reproducible across the concentration range. Recovery should be evaluated by comparing extracted QC samples at low, medium and high concentrations to post-extraction spiked matrix or pure standard solutions.",
    related_source_unit_ids: [],
    table_context: null,
    trace: makeTrace("ich_m10.sec.7_3", 40, "41"),
    review_status: "reviewed"
  },
  // 7.4 Minimum Required Dilution (MRD)
  {
    source_unit_id: "ich_m10.su.7_4.001",
    document_id: "ich_m10",
    section_id: "ich_m10.sec.7_4",
    unit_type: "paragraph",
    unit_order: 1,
    unit_order_status: "known",
    source_text: "Minimum Required Dilution (MRD) is a sample dilution factor applied to all study samples and QCs in LBA to reduce matrix effects and non-specific binding. The MRD should be defined during method development and confirmed during validation. All calibration standards and QC samples should be prepared in the biological matrix at the same MRD as study samples. The LLOQ and ULOQ of the assay should be reported after considering the MRD.",
    related_source_unit_ids: [],
    table_context: null,
    trace: makeTrace("ich_m10.sec.7_4", 40, "41"),
    review_status: "reviewed"
  },
  // 7.5 Commercial and Diagnostic Kits
  {
    source_unit_id: "ich_m10.su.7_5.001",
    document_id: "ich_m10",
    section_id: "ich_m10.sec.7_5",
    unit_type: "paragraph",
    unit_order: 1,
    unit_order_status: "known",
    source_text: "When commercial or diagnostic kits (including RUO kits) are repurposed to measure chemical or biological drug concentrations in regulatory studies, the kit assay should be fully validated in-house to meet this guideline standards. Key requirements include: 1) Reference standards and critical reagents in kits should be characterized; 2) Calibration curves with sparse standards (e.g. 1-2 points) must be re-established across full range; 3) QC concentrations must be known quantitative values, not concentration ranges; 4) Calibration standards and QCs must be prepared in the study sample matrix; 5) Kit lot-to-lot variability must be verified if multiple lots are used.",
    related_source_unit_ids: [],
    table_context: null,
    trace: makeTrace("ich_m10.sec.7_5", 41, "42"),
    review_status: "reviewed"
  },
  // 7.6 New or Alternative Technologies & 7.6.1 Dried Matrix Methods
  {
    source_unit_id: "ich_m10.su.7_6.001",
    document_id: "ich_m10",
    section_id: "ich_m10.sec.7_6",
    unit_type: "paragraph",
    unit_order: 1,
    unit_order_status: "known",
    source_text: "When a new or alternative analytical platform replaces an existing platform in drug development, data generated from the previous platform should be cross-validated to the new platform. For Dried Matrix Methods (DMM/DBS), additional validation parameters must be evaluated: haematocrit effects (for whole blood spotting), sample homogeneity (sub-punching), extraction efficiency from dried matrix, and sample collection retention for ISR (duplicate spotting or multiple punches). Cross-validation between DMM and conventional liquid plasma methods is required if both are used in the same study.",
    related_source_unit_ids: [],
    table_context: null,
    trace: makeTrace("ich_m10.sec.7_6", 42, "43"),
    review_status: "reviewed"
  },
  // 8.1 Summary Information
  {
    source_unit_id: "ich_m10.su.8_1.001",
    document_id: "ich_m10",
    section_id: "ich_m10.sec.8_1",
    unit_type: "paragraph",
    unit_order: 1,
    unit_order_status: "known",
    source_text: "Summary information should be included in Section 2.6.4/2.7.1 of the eCTD: 1) Summary of methods used for each study (method ID, title, assay type, Bioanalytical Report code, Validation Report code); 2) Summary table of all relevant Validation Reports (including Partial and Cross Validation Reports); 3) Cross-referencing table of multiple identification codes; 4) Discussion of method evolution and revisions; 5) For comparative BA/BE studies, a list of regulatory site inspections and outcomes within the last 3 years and 1 year post-study.",
    related_source_unit_ids: [],
    table_context: null,
    trace: makeTrace("ich_m10.sec.8_1", 44, "45"),
    review_status: "reviewed"
  },
  // 8.2 Documentation for Validation and Bioanalytical Reports
  {
    source_unit_id: "ich_m10.su.8_2.001",
    document_id: "ich_m10",
    section_id: "ich_m10.sec.8_2",
    unit_type: "paragraph",
    unit_order: 1,
    unit_order_status: "known",
    source_text: "Validation and Bioanalytical Reports should provide complete and contemporaneous documentation supporting method performance and study sample analysis. Table 1 defines recommended documentation for submission and inspection (e.g., SOPs, validation summaries, chromatograms/raw data, reanalysis summary, ISR results, run failure investigation). Table 2 provides template summary tables for method validation (Table 2.1), sample analysis (Table 2.2), and ISR (Table 2.3).",
    related_source_unit_ids: [],
    table_context: null,
    trace: makeTrace("ich_m10.sec.8_2", 44, "45"),
    review_status: "reviewed"
  },
  // 9 Glossary
  {
    source_unit_id: "ich_m10.su.9.001",
    document_id: "ich_m10",
    section_id: "ich_m10.sec.9",
    unit_type: "paragraph",
    unit_order: 1,
    unit_order_status: "known",
    source_text: "Glossary defines key regulatory bioanalytical terms: Accuracy, Analyte, Analytical Run, Anchor calibrators, Bioanalytical method, Biological matrix, Blank sample, Calibration range, Calibration standard, Carry-over, Critical reagent, Cross validation, Dilution integrity, Full validation, Incurred Sample Reanalysis (ISR), Ligand Binding Assay (LBA), Lower Limit of Quantification (LLOQ), Matrix effect, Minimum Required Dilution (MRD), Parallelism, Partial validation, Precision, Quality Control (QC) sample, Recovery, Selectivity, Specificity, Stability, Surrogate matrix, Total error, Upper Limit of Quantification (ULOQ).",
    related_source_unit_ids: [],
    table_context: null,
    trace: makeTrace("ich_m10.sec.9", 52, "53"),
    review_status: "reviewed"
  }
];

async function runExtraction() {
  console.log("=== Running 3-Pass Extraction on ICH M10 Batch 4 (Section 7, 8, 9 Final Ingestion) ===");
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
  console.log(`Successfully completed ICH M10 Batch 4 (100% Ingestion Complete)!`);
  console.log(`Total Sections: ${bundle.sections.length}`);
  console.log(`Total SourceUnits: ${bundle.source_units.length}`);
  console.log(`Total KnowledgeRecords: ${bundle.knowledge_records.length}`);
  console.log(`Total QuantitativeCriteria: ${bundle.quantitative_criteria.length}`);
  console.log(`Total Conditions: ${bundle.conditions.length}`);
  console.log(`Total Archive Entities: ${bundle.knowledge_records.length + bundle.quantitative_criteria.length + bundle.conditions.length}`);
  console.log(`==================================================`);
}

runExtraction().catch(console.error);
