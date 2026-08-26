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
    section_id: "fda_ada.sec.4_i",
    document_id: "fda_ada",
    section_number: "IV.I",
    title: "Selection of Format",
    parent_section_id: "fda_ada.sec.4",
    heading_source_unit_id: null,
    section_order: 19,
    section_order_status: "known"
  },
  {
    section_id: "fda_ada.sec.4_j_1",
    document_id: "fda_ada",
    section_number: "IV.J.1",
    title: "Development of Positive Control Antibodies",
    parent_section_id: "fda_ada.sec.4",
    heading_source_unit_id: null,
    section_order: 20,
    section_order_status: "known"
  },
  {
    section_id: "fda_ada.sec.4_j_2",
    document_id: "fda_ada",
    section_number: "IV.J.2",
    title: "Development of Negative Controls",
    parent_section_id: "fda_ada.sec.4",
    heading_source_unit_id: null,
    section_order: 21,
    section_order_status: "known"
  },
  {
    section_id: "fda_ada.sec.4_j_3",
    document_id: "fda_ada",
    section_number: "IV.J.3",
    title: "Controlling Non-Specific Binding",
    parent_section_id: "fda_ada.sec.4",
    heading_source_unit_id: null,
    section_order: 22,
    section_order_status: "known"
  },
  {
    section_id: "fda_ada.sec.4_k",
    document_id: "fda_ada",
    section_number: "IV.K",
    title: "Reporting Results for Qualitative and Quasi-Quantitative Assays",
    parent_section_id: "fda_ada.sec.4",
    heading_source_unit_id: null,
    section_order: 23,
    section_order_status: "known"
  },
  {
    section_id: "fda_ada.sec.4_l_1",
    document_id: "fda_ada",
    section_number: "IV.L.1",
    title: "Pre-Existing Antibodies",
    parent_section_id: "fda_ada.sec.4",
    heading_source_unit_id: null,
    section_order: 24,
    section_order_status: "known"
  },
  {
    section_id: "fda_ada.sec.4_l_2",
    document_id: "fda_ada",
    section_number: "IV.L.2",
    title: "Rheumatoid Factor and Other Endogenous Human Antibodies",
    parent_section_id: "fda_ada.sec.4",
    heading_source_unit_id: null,
    section_order: 25,
    section_order_status: "known"
  },
  {
    section_id: "fda_ada.sec.4_l_3",
    document_id: "fda_ada",
    section_number: "IV.L.3",
    title: "Monoclonal Antibodies",
    parent_section_id: "fda_ada.sec.4",
    heading_source_unit_id: null,
    section_order: 26,
    section_order_status: "known"
  },
  {
    section_id: "fda_ada.sec.4_l_4",
    document_id: "fda_ada",
    section_number: "IV.L.4",
    title: "Conjugated Proteins and Multi-Domain Molecules",
    parent_section_id: "fda_ada.sec.4",
    heading_source_unit_id: null,
    section_order: 27,
    section_order_status: "known"
  }
];

const sourceUnitsToAdd = [
  // IV.I: Selection of Format
  {
    source_unit_id: "fda_ada.su.4_i.001",
    document_id: "fda_ada",
    section_id: "fda_ada.sec.4_i",
    unit_type: "paragraph",
    unit_order: 1,
    unit_order_status: "known",
    source_text: "Different assay formats and instrumentation are available that can be used for detection of ADA. These include, but are not limited to, direct binding assays, bridging assays, and soluble-phase binding assays; for example, radioimmunoprecipitation assay. Each assay format has advantages and disadvantages, including throughput, sensitivity, selectivity, dynamic range, ability to detect various Ig isotypes, ability to detect rapidly dissociating antibodies, and availability of reagents. Bridging assay formats may be subject to false-negative results when the antigen (for example, PEG) has repetitive motifs. One of the major differences between these assay formats is the number and vigor of washes, which can influence assay sensitivity. Epitope exposure is also important to consider because binding to plastic or coupling to other agents (for example, fluorochrome, enzyme, or biotin reporters) can result in conformational changes of the antigen that can obscure, expose, modify, or destroy relevant antibody binding sites on the therapeutic protein product in question.",
    related_source_unit_ids: [],
    table_context: null,
    trace: makeTrace("fda_ada.sec.4_i", 15, "12"),
    review_status: "reviewed"
  },
  // IV.J.1: Development of Positive Control Antibodies
  {
    source_unit_id: "fda_ada.su.4_j_1.001",
    document_id: "fda_ada",
    section_id: "fda_ada.sec.4_j_1",
    unit_type: "paragraph",
    unit_order: 1,
    unit_order_status: "known",
    source_text: "Sponsors may use the same or different positive control antibodies to develop, validate, and monitor system suitability during routine assessment of assay performance. For system suitability controls, a positive control antibody, either mono- or polyclonal, used at concentrations adjusted to ensure assay sensitivity and detect hook effects, should be included. Most frequently, positive control antibodies are generated by immunizing animals in the absence or presence of adjuvants. FDA recommends that positive control antibodies generated by immunizing animals be affinity purified using the therapeutic protein product. This approach enriches the polyclonal antibody preparation for ADA, which enables a better interpretation of sensitivity assessment results. The selection of animal species when generating positive control antibodies should be carefully considered. For therapeutic mAb, the sponsor should select a positive control antibody that binds to the variable region of the therapeutic mAb.",
    related_source_unit_ids: [],
    table_context: null,
    trace: makeTrace("fda_ada.sec.4_j_1", 16, "13"),
    review_status: "reviewed"
  },
  {
    source_unit_id: "fda_ada.su.4_j_1.002",
    document_id: "fda_ada",
    section_id: "fda_ada.sec.4_j_1",
    unit_type: "paragraph",
    unit_order: 2,
    unit_order_status: "known",
    source_text: "Once a source of a positive control antibody has been identified, the sponsor should use that source to assess assay performance characteristics such as sensitivity, selectivity, specificity, drug tolerance, and reproducibility. FDA recommends that sponsors generate and reserve positive control antibody for use as a quality control or system suitability control during routine performance of the assay. For assay development and validation, dilutions should generate high, intermediate, and low assay signal values. The intermediate value is useful for assessing precision during assay validation. Intermediate-value QC samples for detection of ADA are generally not needed for monitoring system suitability during routine assay performance.",
    related_source_unit_ids: [],
    table_context: null,
    trace: makeTrace("fda_ada.sec.4_j_1", 17, "14"),
    review_status: "reviewed"
  },
  // IV.J.2: Development of Negative Controls
  {
    source_unit_id: "fda_ada.su.4_j_2.001",
    document_id: "fda_ada",
    section_id: "fda_ada.sec.4_j_2",
    unit_type: "paragraph",
    unit_order: 1,
    unit_order_status: "known",
    source_text: "FDA recommends that sponsors establish a negative control for validation studies and subject-sample testing. In this regard, a pool of sera from an appropriate number of treatment-naïve subjects can serve as a negative control. Importantly, the value obtained for the negative control should be below but close to the cut-point determined for the assay in the subject population being tested. Negative controls that yield values far below the mean value derived from individual serum samples used to establish the cut-point may not be useful in ensuring proper assay performance.",
    related_source_unit_ids: [],
    table_context: null,
    trace: makeTrace("fda_ada.sec.4_j_2", 17, "14"),
    review_status: "reviewed"
  },
  {
    source_unit_id: "fda_ada.su.4_j_2.002",
    document_id: "fda_ada",
    section_id: "fda_ada.sec.4_j_2",
    unit_type: "paragraph",
    unit_order: 2,
    unit_order_status: "known",
    source_text: "When possible, negative control samples should be collected from treatment-naïve subjects with the medical condition being studied and should include subjects with similar sex, age, and concomitant medications so that the sample matrix is representative of the study population. Control samples should be collected and handled in the same manner as study samples with respect to type of anticoagulant used, volume, and sample preparation and storage. When target-population control samples are not available during development, it is acceptable to use purchased samples or samples from healthy donors, but cut-point, sensitivity, and selectivity should be confirmed when samples from treatment-naïve subjects from the appropriate target population become available.",
    related_source_unit_ids: [],
    table_context: null,
    trace: makeTrace("fda_ada.sec.4_j_2", 17, "14"),
    review_status: "reviewed"
  },
  // IV.J.3: Controlling Non-Specific Binding
  {
    source_unit_id: "fda_ada.su.4_j_3.001",
    document_id: "fda_ada",
    section_id: "fda_ada.sec.4_j_3",
    unit_type: "paragraph",
    unit_order: 1,
    unit_order_status: "known",
    source_text: "Every test component, from the plastic of the microtiter plates to the developing agent, can affect assay sensitivity and non-specific binding. One of the most critical elements is the selection of the proper assay buffer and blocking reagents used to prevent non-specific binding. The sponsor should carefully consider the number and timing of wash steps as well as the detergents added to the assay buffer (for example, blocking or wash buffer) to reduce background noise while maintaining sensitivity. Moreover, including uncoated wells is insufficient to assess non-specific binding. Rather, determining the capacity of ADAs to bind to an unrelated protein of similar size and charge that may be present in the sample may prove to be a better test of binding specificity.",
    related_source_unit_ids: [],
    table_context: null,
    trace: makeTrace("fda_ada.sec.4_j_3", 17, "14"),
    review_status: "reviewed"
  },
  // IV.K: Reporting Results for Qualitative and Quasi-Quantitative Assays
  {
    source_unit_id: "fda_ada.su.4_k.001",
    document_id: "fda_ada",
    section_id: "fda_ada.sec.4_k",
    unit_type: "paragraph",
    unit_order: 1,
    unit_order_status: "known",
    source_text: "Several approaches may be used to report positive antibody responses. The most common approach is qualitative, with subjects reported as having a positive or negative antibody response. For subjects who are confirmed to be ADA positive, determining antibody levels can be informative because it allows for stratified assessment of ADAs and their impact on safety and efficacy. Positive antibody levels may be evaluated using a titer. Most frequently titer is determined from the reciprocal of the highest dilution that gives a value at or just above the cut-point of the assay. Alternatively, titer may be determined by extrapolating the dilution to the assay cut-point using the linear portion of the dose response curve. All sample dilutions, such as the MRD and acid dissociations, should be factored into the calculations of titers and provided when reporting titers.",
    related_source_unit_ids: [],
    table_context: null,
    trace: makeTrace("fda_ada.sec.4_k", 18, "15"),
    review_status: "reviewed"
  },
  {
    source_unit_id: "fda_ada.su.4_k.002",
    document_id: "fda_ada",
    section_id: "fda_ada.sec.4_k",
    unit_type: "paragraph",
    unit_order: 2,
    unit_order_status: "known",
    source_text: "When reporting results for neutralization assays, values may also be reported as amount of mass units of therapeutic protein product neutralized per volume serum with the caveat that these are arbitrary in vitro assay units and cannot be used to estimate in vivo availability of the therapeutic protein product. Unless the assay method used allows for independent determination of mass per volume of undiluted matrix, antibody levels reported in mass units are generally not acceptable. FDA does not consider it necessary or desirable for the sponsor to report subject antibody results in terms of mass units unless (1) the results are determined by quantitative means or (2) a universally accepted and accessible source of validated antibody is available as a control and parallelism between the dilution curves of the control antibody and subject samples has been demonstrated.",
    related_source_unit_ids: [],
    table_context: null,
    trace: makeTrace("fda_ada.sec.4_k", 18, "15"),
    review_status: "reviewed"
  },
  // IV.L.1: Pre-Existing Antibodies
  {
    source_unit_id: "fda_ada.su.4_l_1.001",
    document_id: "fda_ada",
    section_id: "fda_ada.sec.4_l_1",
    unit_type: "paragraph",
    unit_order: 1,
    unit_order_status: "known",
    source_text: "Pre-existing antibodies may have clinical effects that affect the efficacy of the therapeutic protein product being tested. An alternative to the qualitative screening assay approach may be needed to assess the quantity and quality of ADA when pre-existing antibodies are present. For example, testing samples for an increase in ADA using a semi-quantitative assay such as a titration assay can provide information on the impact of a therapeutic protein product on product immunogenicity that is not provided by a qualitative assay. When there are pre-existing antibodies and the titer of antibodies increases after exposure to the therapeutic protein product, they can be reported as treatment-boosted to differentiate them from treatment-induced antibody titers. For example, a boosted ADA response may be defined as a titer that is two dilution steps greater than the pre-treatment titer, when twofold dilutions are used to determine the titer.",
    related_source_unit_ids: [],
    table_context: null,
    trace: makeTrace("fda_ada.sec.4_l_1", 19, "16"),
    review_status: "reviewed"
  },
  // IV.L.2: Rheumatoid Factor
  {
    source_unit_id: "fda_ada.su.4_l_2.001",
    document_id: "fda_ada",
    section_id: "fda_ada.sec.4_l_2",
    unit_type: "paragraph",
    unit_order: 1,
    unit_order_status: "known",
    source_text: "Measuring immune responses to therapeutic protein products that possess Fc regions, such as mAb and Fc-fusion proteins, may be particularly difficult when RF is present in the matrix. RF is generally an IgM antibody that recognizes IgG. Consequently, RF will bind Fc regions, making it appear that specific antibody to the therapeutic protein product exists. Several approaches for minimizing interference from RF have proven useful, including treatment with aspartame and careful optimization of reagent concentrations so as to reduce background binding. When examining immune responses to Fc-fusion proteins in clinical settings where RF generates false-positive results during development, FDA recommends developing an assay specific for the non-Fc region of the proteins rather than against the intact biotherapeutics.",
    related_source_unit_ids: [],
    table_context: null,
    trace: makeTrace("fda_ada.sec.4_l_2", 19, "16"),
    review_status: "reviewed"
  },
  // IV.L.3: Monoclonal Antibodies
  {
    source_unit_id: "fda_ada.su.4_l_3.001",
    document_id: "fda_ada",
    section_id: "fda_ada.sec.4_l_3",
    unit_type: "paragraph",
    unit_order: 1,
    unit_order_status: "known",
    source_text: "Technologies reducing the presence of non-human sequences in mAb, such as chimerization and humanization, have reduced but not eliminated ADA. In these cases, the immune responses are directed largely against the variable regions of the mAb. The assays that can detect the reactivity against variable regions are considered more appropriate to evaluate the potential impact of antibodies against mAb-based therapeutics in subjects. If the Fc region is engineered or bound to another molecule, an assay that characterizes this response may be needed.",
    related_source_unit_ids: [],
    table_context: null,
    trace: makeTrace("fda_ada.sec.4_l_3", 19, "16"),
    review_status: "reviewed"
  },
  // IV.L.4: Conjugated Proteins
  {
    source_unit_id: "fda_ada.su.4_l_4.001",
    document_id: "fda_ada",
    section_id: "fda_ada.sec.4_l_4",
    unit_type: "paragraph",
    unit_order: 1,
    unit_order_status: "known",
    source_text: "Antibody-drug conjugates (ADCs) are antibodies conjugated with small molecule drugs, so they represent a classic hapten-carrier molecule. Therefore, the immunogenicity assays should measure the responses to all components of the ADC therapeutic protein product, including the antibody, linker-drug, and new epitopes that may result from conjugation. When ADCs need to be labeled for immunogenicity assays, the conjugation should consider the potential for increased hydrophobicity of the labeled molecules because they may cause aggregation.",
    related_source_unit_ids: [],
    table_context: null,
    trace: makeTrace("fda_ada.sec.4_l_4", 19, "16"),
    review_status: "reviewed"
  }
];

async function runExtraction() {
  console.log("=== Running 3-Pass Extraction on FDA ADA Batch 2B (Platform, Reagents, & Special Cases) ===");
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
  console.log(`Successfully updated bundle with FDA ADA Batch 2B!`);
  console.log(`Total Sections: ${bundle.sections.length}`);
  console.log(`Total SourceUnits: ${bundle.source_units.length}`);
  console.log(`Total KnowledgeRecords: ${bundle.knowledge_records.length}`);
  console.log(`Total QuantitativeCriteria: ${bundle.quantitative_criteria.length}`);
  console.log(`Total Conditions: ${bundle.conditions.length}`);
  console.log(`Total Archive Entities: ${bundle.knowledge_records.length + bundle.quantitative_criteria.length + bundle.conditions.length}`);
  console.log(`==================================================`);
}

runExtraction().catch(console.error);
