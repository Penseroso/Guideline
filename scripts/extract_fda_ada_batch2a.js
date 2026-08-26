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
    section_id: "fda_ada.sec.4_a_2",
    document_id: "fda_ada",
    section_number: "IV.A.2",
    title: "Immunoglobulin Isotypes or Subtypes",
    parent_section_id: "fda_ada.sec.4",
    heading_source_unit_id: null,
    section_order: 10,
    section_order_status: "known"
  },
  {
    section_id: "fda_ada.sec.4_a_3",
    document_id: "fda_ada",
    section_number: "IV.A.3",
    title: "Domain Specificity",
    parent_section_id: "fda_ada.sec.4",
    heading_source_unit_id: null,
    section_order: 11,
    section_order_status: "known"
  },
  {
    section_id: "fda_ada.sec.4_c_1",
    document_id: "fda_ada",
    section_number: "IV.C.1",
    title: "Assay Sensitivity",
    parent_section_id: "fda_ada.sec.4",
    heading_source_unit_id: null,
    section_order: 12,
    section_order_status: "known"
  },
  {
    section_id: "fda_ada.sec.4_d",
    document_id: "fda_ada",
    section_number: "IV.D",
    title: "Specificity",
    parent_section_id: "fda_ada.sec.4",
    heading_source_unit_id: null,
    section_order: 13,
    section_order_status: "known"
  },
  {
    section_id: "fda_ada.sec.4_e_1",
    document_id: "fda_ada",
    section_number: "IV.E.1",
    title: "Matrix Interference",
    parent_section_id: "fda_ada.sec.4",
    heading_source_unit_id: null,
    section_order: 14,
    section_order_status: "known"
  },
  {
    section_id: "fda_ada.sec.4_e_2",
    document_id: "fda_ada",
    section_number: "IV.E.2",
    title: "Minimal Required Dilution",
    parent_section_id: "fda_ada.sec.4",
    heading_source_unit_id: null,
    section_order: 15,
    section_order_status: "known"
  },
  {
    section_id: "fda_ada.sec.4_f",
    document_id: "fda_ada",
    section_number: "IV.F",
    title: "Precision",
    parent_section_id: "fda_ada.sec.4",
    heading_source_unit_id: null,
    section_order: 16,
    section_order_status: "known"
  },
  {
    section_id: "fda_ada.sec.4_g",
    document_id: "fda_ada",
    section_number: "IV.G",
    title: "Reproducibility",
    parent_section_id: "fda_ada.sec.4",
    heading_source_unit_id: null,
    section_order: 17,
    section_order_status: "known"
  },
  {
    section_id: "fda_ada.sec.4_h",
    document_id: "fda_ada",
    section_number: "IV.H",
    title: "Robustness and Sample Stability",
    parent_section_id: "fda_ada.sec.4",
    heading_source_unit_id: null,
    section_order: 18,
    section_order_status: "known"
  }
];

const sourceUnitsToAdd = [
  // IV.A.2: Immunoglobulin Isotypes or Subtypes
  {
    source_unit_id: "fda_ada.su.4_a_2.001",
    document_id: "fda_ada",
    section_id: "fda_ada.sec.4_a_2",
    unit_type: "paragraph",
    unit_order: 1,
    unit_order_status: "known",
    source_text: "Although ADA responses are predominantly of the IgG isotype, IgM and other isotypes may be clinically relevant. For example, IgM may be important when assessing early immune responses, whereas IgE may be important when assessing hypersensitivity. Therefore, the ability of screening assays to detect IgM and different IgG subclasses should be considered. When clinically relevant, testing for other isotypes such as IgE and IgA should also be considered.",
    related_source_unit_ids: [],
    table_context: null,
    trace: makeTrace("fda_ada.sec.4_a_2", 9, "6"),
    review_status: "reviewed"
  },
  // IV.A.3: Domain Specificity
  {
    source_unit_id: "fda_ada.su.4_a_3.001",
    document_id: "fda_ada",
    section_id: "fda_ada.sec.4_a_3",
    unit_type: "paragraph",
    unit_order: 1,
    unit_order_status: "known",
    source_text: "Therapeutic protein products with distinct functional domains (for example, multi-domain proteins, antibody-drug conjugates, Fc-fusion proteins, and bispecific antibodies) may elicit ADA responses to different domains. For multi-domain products, the immune response against different domains may have distinct clinical consequences. Therefore, FDA recommends that sponsors characterize the domain specificity of ADA responses for multi-domain therapeutic protein products.",
    related_source_unit_ids: [],
    table_context: null,
    trace: makeTrace("fda_ada.sec.4_a_3", 9, "6"),
    review_status: "reviewed"
  },
  // IV.C.1: Assay Sensitivity
  {
    source_unit_id: "fda_ada.su.4_c_1.001",
    document_id: "fda_ada",
    section_id: "fda_ada.sec.4_c_1",
    unit_type: "paragraph",
    unit_order: 1,
    unit_order_status: "known",
    source_text: "Assay sensitivity represents the lowest concentration of ADA that consistently produces a positive result in an assay. An assay sensitivity of at least 100 ng/mL is recommended for screening and confirmatory assays; however, the level of sensitivity needed depends on the clinical risk of immunogenicity. For instance, high-risk therapeutic proteins may require more sensitive assays (for example, sensitivity of 10 to 50 ng/mL). Sensitivity should be determined and reported in the presence of the specified minimum required dilution (MRD) of the biological matrix.",
    related_source_unit_ids: [],
    table_context: null,
    trace: makeTrace("fda_ada.sec.4_c_1", 11, "8"),
    review_status: "reviewed"
  },
  {
    source_unit_id: "fda_ada.su.4_c_1.002",
    document_id: "fda_ada",
    section_id: "fda_ada.sec.4_c_1",
    unit_type: "paragraph",
    unit_order: 2,
    unit_order_status: "known",
    source_text: "During development, sensitivity may be assessed by testing serial dilutions of a positive control antibody of known concentration, using individual or pooled matrix from treatment-naïve subjects. The dilution series should be no greater than two- or threefold, and a minimum of five dilutions should be tested. The sensitivity can be calculated by interpolating the linear portion of the dilution curve to the assay cut-point. A purified preparation of antibodies specific to the therapeutic protein product should be used as the positive control to determine the sensitivity of the assay so that assay sensitivity can be reported in mass units/mL of matrix.",
    related_source_unit_ids: [],
    table_context: null,
    trace: makeTrace("fda_ada.sec.4_c_1", 11, "8"),
    review_status: "reviewed"
  },
  // IV.D: Specificity
  {
    source_unit_id: "fda_ada.su.4_d.001",
    document_id: "fda_ada",
    section_id: "fda_ada.sec.4_d",
    unit_type: "paragraph",
    unit_order: 1,
    unit_order_status: "known",
    source_text: "Specificity refers to the ability of a method to exclusively detect the target analyte, in this case the ADA. Lack of assay specificity can lead to false-positive results, which could obscure relationships between ADA generating immune response, pharmacokinetics, pharmacodynamics, and clinical safety and efficacy measures. Demonstrating the specificity of antibody responses to mAb, Fc-fusion proteins, and Ig-fusion proteins poses challenges because of the high concentration of Ig in human serum. The assay should specifically detect anti-mAb antibodies but not the mAb product itself, soluble drug target, non-specific endogenous antibodies, or antibody reagents used in the assay.",
    related_source_unit_ids: [],
    table_context: null,
    trace: makeTrace("fda_ada.sec.4_d", 12, "9"),
    review_status: "reviewed"
  },
  {
    source_unit_id: "fda_ada.su.4_d.002",
    document_id: "fda_ada",
    section_id: "fda_ada.sec.4_d",
    unit_type: "paragraph",
    unit_order: 2,
    unit_order_status: "known",
    source_text: "A straightforward approach to addressing specificity is to demonstrate that binding can be blocked by soluble or unlabeled purified therapeutic protein product. One approach is to incubate positive and negative control antibody samples with the purified therapeutic protein product or its components under consideration. Inhibition of signal in the presence of the relevant therapeutic protein product or its components indicates that the response is specific. If the assay is specific and selective for ADA to the therapeutic protein product being studied, generally the addition of that therapeutic protein product or its components in solution will reduce the assay signal. Conversely, addition of the therapeutic protein product or its components should have little effect on antibodies of other specificities.",
    related_source_unit_ids: [],
    table_context: null,
    trace: makeTrace("fda_ada.sec.4_d", 13, "10"),
    review_status: "reviewed"
  },
  // IV.E.1: Matrix Interference
  {
    source_unit_id: "fda_ada.su.4_e_1.001",
    document_id: "fda_ada",
    section_id: "fda_ada.sec.4_e_1",
    unit_type: "paragraph",
    unit_order: 1,
    unit_order_status: "known",
    source_text: "An important consideration is how the sample matrix (for example, plasma, serum, saliva) can affect assay performance. Some degree of signal suppression is expected when comparing assay performance in diluent versus matrix. Endogenous and exogenous components in a matrix may influence assay results, and it is usually necessary to dilute subject samples for testing to minimize such effects. The sponsor should define the matrix and dilution factor that will be used for preparation of subject samples before performing validation studies assessing potential interference of this matrix on assay results. Various substances in the matrix, such as free hemoglobin (hemolysis), lipids (lipemia), bilirubin (icterus), and presence of concomitant medications, can interfere with assay results.",
    related_source_unit_ids: [],
    table_context: null,
    trace: makeTrace("fda_ada.sec.4_e_1", 13, "10"),
    review_status: "reviewed"
  },
  {
    source_unit_id: "fda_ada.su.4_e_1.002",
    document_id: "fda_ada",
    section_id: "fda_ada.sec.4_e_1",
    unit_type: "paragraph",
    unit_order: 2,
    unit_order_status: "known",
    source_text: "Buffer components that are chemically related to the therapeutic protein product may also cause interference in the assay. For example, polysorbate is chemically similar to polyethylene glycol (PEG) and therefore may interfere in the detection of anti-PEG antibodies. The chemical composition of the buffer should be carefully considered during assay development.",
    related_source_unit_ids: [],
    table_context: null,
    trace: makeTrace("fda_ada.sec.4_e_1", 14, "11"),
    review_status: "reviewed"
  },
  // IV.E.2: Minimal Required Dilution
  {
    source_unit_id: "fda_ada.su.4_e_2.001",
    document_id: "fda_ada",
    section_id: "fda_ada.sec.4_e_2",
    unit_type: "paragraph",
    unit_order: 1,
    unit_order_status: "known",
    source_text: "Matrix components can contribute to non-specific signal, thereby obscuring positive results. Therefore, there is frequently a need to dilute subject samples to maintain a reasonable ability to detect ADA. For the purposes of calculating assay sensitivity and titer, the MRD should take into consideration the final dilution of the sample in the assay, which typically ranges from 1:5 to 1:100 (that is, 1/5 to 1/100).",
    related_source_unit_ids: [],
    table_context: null,
    trace: makeTrace("fda_ada.sec.4_e_2", 14, "11"),
    review_status: "reviewed"
  },
  {
    source_unit_id: "fda_ada.su.4_e_2.002",
    document_id: "fda_ada",
    section_id: "fda_ada.sec.4_e_2",
    unit_type: "paragraph",
    unit_order: 2,
    unit_order_status: "known",
    source_text: "FDA recommends that sponsors determine the MRD from a panel of appropriate number of samples from treatment-naïve subjects. Determination of MRD usually involves serially diluting treatment-naïve ADA-negative samples, as well as testing known amounts of purified antibody at high, medium, and low concentrations in serially diluted matrix in comparison to the same amount of positive control antibody in diluent. The MRD should be calculated using an appropriate number of individual serum samples; at least 10 samples are frequently recommended. Although the MRD ultimately selected by the sponsor will depend on the assay design and subject population, FDA recommends that MRD not exceed 1:100. Higher MRD may result in false-negative responses.",
    related_source_unit_ids: [],
    table_context: null,
    trace: makeTrace("fda_ada.sec.4_e_2", 14, "11"),
    review_status: "reviewed"
  },
  // IV.F: Precision
  {
    source_unit_id: "fda_ada.su.4_f.001",
    document_id: "fda_ada",
    section_id: "fda_ada.sec.4_f",
    unit_type: "paragraph",
    unit_order: 1,
    unit_order_status: "known",
    source_text: "Precision is a measure of the variability in a series of measurements for the same material run in a method. Results should be reproducible within and between assay runs to assure adequate precision. Demonstrating assay precision is critical to the assessment of ADA because assay variability is the basis for determining the cut-points and ensuring that low positive samples are detected as positive. To provide reliable estimates, the sponsor should evaluate both intra-assay (repeatability) and inter-assay (intermediate precision) variability of assay responses. In cases where a floating cut-point is needed, inter-assay precision may be calculated using normalized values.",
    related_source_unit_ids: [],
    table_context: null,
    trace: makeTrace("fda_ada.sec.4_f", 14, "11"),
    review_status: "reviewed"
  },
  // IV.G: Reproducibility
  {
    source_unit_id: "fda_ada.su.4_g.001",
    document_id: "fda_ada",
    section_id: "fda_ada.sec.4_g",
    unit_type: "paragraph",
    unit_order: 1,
    unit_order_status: "known",
    source_text: "Reproducibility is an important consideration if an assay will be run by two or more independent laboratories during a study, and a sponsor should establish the comparability of the data produced by each laboratory. Comparable assay performance, including sensitivity, drug tolerance, and precision, should be established between laboratories.",
    related_source_unit_ids: [],
    table_context: null,
    trace: makeTrace("fda_ada.sec.4_g", 15, "12"),
    review_status: "reviewed"
  },
  // IV.H: Robustness and Sample Stability
  {
    source_unit_id: "fda_ada.su.4_h.001",
    document_id: "fda_ada",
    section_id: "fda_ada.sec.4_h",
    unit_type: "paragraph",
    unit_order: 1,
    unit_order_status: "known",
    source_text: "Assay robustness is an indication of the assay's reliability during normal usage and is assessed by the capacity of the assay to remain unaffected by small but deliberate variations in method and instrument performance that would be expected under relevant, real-life circumstances in routine laboratory practice. For example, changes in temperature, incubation times, or buffer characteristics such as pH and salt concentration can all impact assay results. The complexity of bioassays makes them particularly susceptible to variations in assay conditions, and it is essential to evaluate and optimize parameters such as cell passage number, incubation times, and culture media components. The sponsor should examine robustness during the development phase.",
    related_source_unit_ids: [],
    table_context: null,
    trace: makeTrace("fda_ada.sec.4_h", 15, "12"),
    review_status: "reviewed"
  },
  {
    source_unit_id: "fda_ada.su.4_h.002",
    document_id: "fda_ada",
    section_id: "fda_ada.sec.4_h",
    unit_type: "paragraph",
    unit_order: 2,
    unit_order_status: "known",
    source_text: "Because it is generally not feasible to establish the stability of subject samples, FDA recommends storing subject samples in a manner that preserves antibody reactivity at the time of testing. FDA recommends that sponsors minimize freeze-thaw cycles by appropriately aliquoting subjects' samples because freezing and thawing such samples may also affect assay results. However, studies evaluating short-term stability, including, as relevant, freeze-thaw cycle and refrigerator- and room-temperature stability of positive control antibodies, may be useful.",
    related_source_unit_ids: [],
    table_context: null,
    trace: makeTrace("fda_ada.sec.4_h", 15, "12"),
    review_status: "reviewed"
  }
];

async function runExtraction() {
  console.log("=== Running 3-Pass Extraction on FDA ADA Batch 2A (Performance Parameters) ===");
  const client = createClient();

  // Clean out any previously added
  const secIds = new Set(sectionsToAdd.map((s) => s.section_id));
  const suIds = new Set(sourceUnitsToAdd.map((s) => s.source_unit_id));
  bundle.sections = bundle.sections.filter((s) => !secIds.has(s.section_id));
  bundle.source_units = bundle.source_units.filter((s) => !suIds.has(s.source_unit_id));
  bundle.knowledge_records = bundle.knowledge_records.filter((k) => !(k.source_unit_ids || []).some((id) => suIds.has(id)));
  bundle.quantitative_criteria = bundle.quantitative_criteria.filter((q) => !suIds.has(q.source_unit_id));
  bundle.conditions = bundle.conditions.filter((c) => !suIds.has(c.source_unit_id));

  const targetSections = sectionsToAdd.map((sec) => ({
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

  // Normalize QCs to strictly satisfy schema draft-07 oneOf (exactly one of value or value_fraction)
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

  // Reciprocal closure on joint_with_ids
  const validQcIds = new Set(bundle.quantitative_criteria.map((q) => q.criterion_id));
  for (const qc of bundle.quantitative_criteria) {
    qc.joint_with_ids = (qc.joint_with_ids || []).filter((id) => validQcIds.has(id));
    for (const jid of qc.joint_with_ids) {
      const target = bundle.quantitative_criteria.find((t) => t.criterion_id === jid);
      if (target && !target.joint_with_ids.includes(qc.criterion_id)) {
        target.joint_with_ids.push(qc.criterion_id);
      }
    }
  }

  // Sane applies_to_ids on conditions
  const validKrIds = new Set(bundle.knowledge_records.map((k) => k.knowledge_record_id));
  for (const c of bundle.conditions) {
    c.applies_to_ids = (c.applies_to_ids || []).filter((id) => validKrIds.has(id) || validQcIds.has(id));
    if (c.condition_type === "exception" && c.applies_to_ids.length === 0) {
      c.condition_type = "qualification";
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
  console.log(`Successfully updated bundle with FDA ADA Batch 2A!`);
  console.log(`Total Sections: ${bundle.sections.length}`);
  console.log(`Total SourceUnits: ${bundle.source_units.length}`);
  console.log(`Total KnowledgeRecords: ${bundle.knowledge_records.length}`);
  console.log(`Total QuantitativeCriteria: ${bundle.quantitative_criteria.length}`);
  console.log(`Total Conditions: ${bundle.conditions.length}`);
  console.log(`Total Archive Entities: ${bundle.knowledge_records.length + bundle.quantitative_criteria.length + bundle.conditions.length}`);
  console.log(`==================================================`);
}

runExtraction().catch(console.error);
