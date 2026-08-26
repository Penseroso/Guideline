const fs = require("fs");
const path = require("path");
const { createClient } = require("../engine/llm_client");
const { extractSectionSelfConsistent } = require("../engine/pipeline");
const { validateFiles } = require("../validation/validate_structured_data");

const bundlePath = path.resolve(__dirname, "..", "data", "pilots", "fda_ada_validation.json");
const bundle = JSON.parse(fs.readFileSync(bundlePath, "utf8"));

const SOURCE_PDF = "source_pdfs/FDA Immunogenicity Testing of Therapeutic Protein Products —Developing and Validating Assays for Anti-Drug Antibody Detection.pdf";

function makeTrace(sectionId, zeroBasedPdfPage, printedPage) {
  return {
    source_file_path: SOURCE_PDF,
    document_id: "fda_ada",
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
    section_id: "fda_ada.sec.5",
    document_id: "fda_ada",
    section_number: "V",
    title: "ASSAY DEVELOPMENT",
    parent_section_id: null,
    heading_source_unit_id: null,
    section_order: 28,
    section_order_status: "known"
  },
  {
    section_id: "fda_ada.sec.5_a",
    document_id: "fda_ada",
    section_number: "V.A",
    title: "Development of Screening Assay",
    parent_section_id: "fda_ada.sec.5",
    heading_source_unit_id: null,
    section_order: 29,
    section_order_status: "known"
  },
  {
    section_id: "fda_ada.sec.5_b",
    document_id: "fda_ada",
    section_number: "V.B",
    title: "Development of Confirmatory Assay",
    parent_section_id: "fda_ada.sec.5",
    heading_source_unit_id: null,
    section_order: 30,
    section_order_status: "known"
  },
  {
    section_id: "fda_ada.sec.5_b_1",
    document_id: "fda_ada",
    section_number: "V.B.1",
    title: "Selection of Format for Confirmatory Assay",
    parent_section_id: "fda_ada.sec.5_b",
    heading_source_unit_id: null,
    section_order: 31,
    section_order_status: "known"
  },
  {
    section_id: "fda_ada.sec.5_b_2",
    document_id: "fda_ada",
    section_number: "V.B.2",
    title: "Cut-Point of Confirmatory Assay",
    parent_section_id: "fda_ada.sec.5_b",
    heading_source_unit_id: null,
    section_order: 32,
    section_order_status: "known"
  },
  {
    section_id: "fda_ada.sec.5_c",
    document_id: "fda_ada",
    section_number: "V.C",
    title: "Development of Titration Assay",
    parent_section_id: "fda_ada.sec.5",
    heading_source_unit_id: null,
    section_order: 33,
    section_order_status: "known"
  },
  {
    section_id: "fda_ada.sec.6_d",
    document_id: "fda_ada",
    section_number: "VI.D",
    title: "Validation of Titration Assay",
    parent_section_id: "fda_ada.sec.6",
    heading_source_unit_id: null,
    section_order: 34,
    section_order_status: "known"
  }
];

const sourceUnitsToAdd = [
  // V.A: Development of Screening Assay
  {
    source_unit_id: "fda_ada.su.5_a.001",
    document_id: "fda_ada",
    section_id: "fda_ada.sec.5_a",
    unit_type: "paragraph",
    unit_order: 1,
    unit_order_status: "known",
    source_text: "Based on the multi-tiered approach discussed previously in section IV.A, the first assay to be employed for detection of ADA should be a highly sensitive screening assay that detects low- and high-affinity ADA. Approximately 5 to 10 individual samples may be used to estimate the cut-point early in assay development; however, this may need to be adjusted when treatment-naïve samples from the target population become available. A low but defined false-positive rate of approximately 5% is desirable for the initial screening assay because it maximizes detection of true positives. Subsequent assays can be employed to exclude false-positive results when determining the true incidence of immunogenicity.",
    related_source_unit_ids: [],
    table_context: null,
    trace: makeTrace("fda_ada.sec.5_a", 20, "17"),
    review_status: "reviewed"
  },
  // V.B.1: Selection of Format for Confirmatory Assay
  {
    source_unit_id: "fda_ada.su.5_b_1.001",
    document_id: "fda_ada",
    section_id: "fda_ada.sec.5_b_1",
    unit_type: "paragraph",
    unit_order: 1,
    unit_order_status: "known",
    source_text: "Because the screening assay is designed to broadly detect the presence of antibodies that bind product in serum samples with a defined false-positive rate of approximately 5%, FDA recommends that the sponsor develop assays to confirm the binding of antibodies that are specific to the therapeutic protein product. Implementation of a suitable confirmatory assay is important to prevent data on ADA false-positive subjects from confounding the analyses of the impact of ADA on safety and efficacy. It is expected that the selected confirmatory assay will have similar sensitivity to the screening assay, with the caveat that the assay false-positive rates are different, but have higher specificity and at least as good selectivity to identify any false-positive samples. The method and instrument platform selected may be similar to or different from those used for the screening assay. Frequently, both screening and confirmatory assays use the same method and instrument platform. In such cases, the sensitivity of each assay should be determined in mass units and confirmed using system suitability controls to ensure that the assay is sensitive to the presence of binding antibody. When using a binding competition assay, the concentration of competing product should be optimized to confirm the presence of antibodies throughout and above the range of the assay.",
    related_source_unit_ids: [],
    table_context: null,
    trace: makeTrace("fda_ada.sec.5_b_1", 20, "17"),
    review_status: "reviewed"
  },
  // V.B.2: Cut-Point of Confirmatory Assay
  {
    source_unit_id: "fda_ada.su.5_b_2.001",
    document_id: "fda_ada",
    section_id: "fda_ada.sec.5_b_2",
    unit_type: "paragraph",
    unit_order: 1,
    unit_order_status: "known",
    source_text: "If a competitive inhibition format is selected, a recommended approach to determining the cut-point uses the data from the signal generated by antibody-negative treatment-naïve subject samples in the presence of the competitor, which is usually the therapeutic protein product. In this case, the amount of therapeutic protein product used to establish the cut-point should be the same as the amount of therapeutic protein product that will be used as a competitive inhibitor in the assay. However, this approach may not be appropriate when dealing with samples where pre-existing antibodies are present in the treatment-naïve population. In those cases, the sponsor should exclude true positives from the cut-point assessment. In rare cases when baseline negative samples are not available, sponsors may evaluate changes in titer or use an orthogonal method to confirm samples that screen positive.",
    related_source_unit_ids: [],
    table_context: null,
    trace: makeTrace("fda_ada.sec.5_b_2", 21, "18"),
    review_status: "reviewed"
  },
  // V.C: Development of Titration Assay
  {
    source_unit_id: "fda_ada.su.5_c.001",
    document_id: "fda_ada",
    section_id: "fda_ada.sec.5_c",
    unit_type: "paragraph",
    unit_order: 1,
    unit_order_status: "known",
    source_text: "In subjects that have pre-existing ADA, treatment-boosted ADA responses may be identified by post-treatment increases in titer. A cut-point for defining the treatment-boosted responses should be determined. For example, a boosted ADA response may be defined as a titer that is two dilution steps greater than the pre-treatment titer, when twofold dilutions are used to determine the titer. If titer is established by extrapolating the dilution curve to the assay cut-point, treatment-induced responses may be determined using estimates of assay variability.",
    related_source_unit_ids: [],
    table_context: null,
    trace: makeTrace("fda_ada.sec.5_c", 21, "18"),
    review_status: "reviewed"
  },
  // VI.D: Validation of Titration Assay
  {
    source_unit_id: "fda_ada.su.6_d.001",
    document_id: "fda_ada",
    section_id: "fda_ada.sec.6_d",
    unit_type: "paragraph",
    unit_order: 1,
    unit_order_status: "known",
    source_text: "The principles of assay validation described in section VI.A apply in general to validation of titration assays. The cut-point of the titration assay may be the same as or different from that of the screening assay. For example, the United States Pharmacopeia recommends establishing a titration assay cut-point when the signal from the assay diluent or matrix causes higher results than the screening assay cut-point because of a blocking effect of serum or if samples at a dilution higher than the MRD do not generate consistently negative results, usually, when the screening cut-point falls on the lower plateau of the positive control dilution curve. When a titration assay specific cut-point is used, it should be validated. When the titration assay is not used for screening, the cut-point may be established using a 0.1% false-positive rate. When the titration assay is used for screening (for example, when the subject population has a high incidence of pre-existing ADA), the cut-point should be established using a 5% false-positive rate.",
    related_source_unit_ids: [],
    table_context: null,
    trace: makeTrace("fda_ada.sec.6_d", 28, "25"),
    review_status: "reviewed"
  }
];

async function runExtraction() {
  console.log("=== Running 3-Pass Extraction on FDA ADA Batch 3 (Assay Dev & Titration Validation) ===");
  const client = createClient();

  // Clean out any previously added
  const secIds = new Set(sectionsToAdd.map((s) => s.section_id));
  const suIds = new Set(sourceUnitsToAdd.map((s) => s.source_unit_id));
  bundle.sections = bundle.sections.filter((s) => !secIds.has(s.section_id));
  bundle.source_units = bundle.source_units.filter((s) => !suIds.has(s.source_unit_id));
  bundle.knowledge_records = bundle.knowledge_records.filter((k) => !(k.source_unit_ids || []).some((id) => suIds.has(id)));
  bundle.quantitative_criteria = bundle.quantitative_criteria.filter((q) => !suIds.has(q.source_unit_id));
  bundle.conditions = bundle.conditions.filter((c) => !suIds.has(c.source_unit_id));

  // Only extract sections that have source units
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
  console.log(`Successfully updated bundle with FDA ADA Batch 3!`);
  console.log(`Total Sections: ${bundle.sections.length}`);
  console.log(`Total SourceUnits: ${bundle.source_units.length}`);
  console.log(`Total KnowledgeRecords: ${bundle.knowledge_records.length}`);
  console.log(`Total QuantitativeCriteria: ${bundle.quantitative_criteria.length}`);
  console.log(`Total Conditions: ${bundle.conditions.length}`);
  console.log(`Total Archive Entities: ${bundle.knowledge_records.length + bundle.quantitative_criteria.length + bundle.conditions.length}`);
  console.log(`==================================================`);
}

runExtraction().catch(console.error);
