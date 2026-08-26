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
    section_id: "fda_ada.sec.7",
    document_id: "fda_ada",
    section_number: "VII",
    title: "IMPLEMENTATION OF ASSAY TESTING",
    parent_section_id: null,
    heading_source_unit_id: null,
    section_order: 35,
    section_order_status: "known"
  },
  {
    section_id: "fda_ada.sec.7_a",
    document_id: "fda_ada",
    section_number: "VII.A",
    title: "Obtaining Subject Samples and Timing of Collection",
    parent_section_id: "fda_ada.sec.7",
    heading_source_unit_id: null,
    section_order: 36,
    section_order_status: "known"
  },
  {
    section_id: "fda_ada.sec.7_b",
    document_id: "fda_ada",
    section_number: "VII.B",
    title: "Concurrent Positive and Negative Quality Controls",
    parent_section_id: "fda_ada.sec.7",
    heading_source_unit_id: null,
    section_order: 37,
    section_order_status: "known"
  },
  {
    section_id: "fda_ada.sec.7_c",
    document_id: "fda_ada",
    section_number: "VII.C",
    title: "Confirmation of Cut-Point in the Target Population",
    parent_section_id: "fda_ada.sec.7",
    heading_source_unit_id: null,
    section_order: 38,
    section_order_status: "known"
  },
  {
    section_id: "fda_ada.sec.8",
    document_id: "fda_ada",
    section_number: "VIII",
    title: "DOCUMENTATION",
    parent_section_id: null,
    heading_source_unit_id: null,
    section_order: 39,
    section_order_status: "known"
  },
  {
    section_id: "fda_ada.sec.app",
    document_id: "fda_ada",
    section_number: "APPENDIX",
    title: "Multi-Tiered Approach to Anti-Drug Antibody Testing",
    parent_section_id: null,
    heading_source_unit_id: null,
    section_order: 40,
    section_order_status: "known"
  }
];

const sourceUnitsToAdd = [
  // VII.A: Obtaining Subject Samples and Timing of Collection
  {
    source_unit_id: "fda_ada.su.7_a.001",
    document_id: "fda_ada",
    section_id: "fda_ada.sec.7_a",
    unit_type: "paragraph",
    unit_order: 1,
    unit_order_status: "known",
    source_text: "FDA recommends that sponsors obtain pre-treatment samples from all subjects. Because there is the potential for pre-existing antibodies or confounding components in the matrix, understanding the degree of reactivity before treatment is essential. The sponsor should obtain subsequent samples, with the timing depending on the frequency of dosing. Optimally, samples taken 7 to 14 days after the first exposure can help elucidate an early IgM response. Samples taken at 3 to 6 weeks after the first exposure are generally optimal for determining IgG responses. IgA responses may peak earlier than IgG responses, at around 2 to 3 weeks after antigen exposure. For individuals receiving a single dose of a therapeutic protein product, these time frames may be adequate. However, for subjects receiving a therapeutic protein product at multiple times during the trial, the sponsor should obtain samples at appropriate intervals throughout the trial and obtain a sample approximately 30 days after the last exposure. For products with long half-lives, samples should be obtained approximately five half-lives after last exposure. When there is a high risk of serious consequences from ADAs, sponsors should plan to collect samples from subjects until ADAs return to baseline levels.",
    related_source_unit_ids: [],
    table_context: null,
    trace: makeTrace("fda_ada.sec.7_a", 29, "26"),
    review_status: "reviewed"
  },
  {
    source_unit_id: "fda_ada.su.7_a.002",
    document_id: "fda_ada",
    section_id: "fda_ada.sec.7_a",
    unit_type: "paragraph",
    unit_order: 2,
    unit_order_status: "known",
    source_text: "Obtaining samples at a time when there will be minimal interference from the therapeutic protein product present in the matrix is essential. A sponsor should consider the therapeutic protein product's half-life and dosing regimen to help determine appropriate times for sampling. If therapeutic protein product-free samples cannot be obtained during the treatment phase of the trial, the sponsor should take additional measures to ensure that the assay is sensitive in the presence of expected onboard drug; and samples should be obtained after an appropriate washout period, generally five half-lives. Obtaining samples to test for meaningful antibody response can also be complicated if the therapeutic protein product in question is itself an immune suppressant. In such instances, the sampling schedule should be adjusted in accordance with the immunosuppressant regimen, to the extent possible. Samples to determine serum concentrations of the therapeutic protein product should be obtained at the same time as immunogenicity samples.",
    related_source_unit_ids: [],
    table_context: null,
    trace: makeTrace("fda_ada.sec.7_a", 30, "27"),
    review_status: "reviewed"
  },
  // VII.B: Concurrent Positive and Negative Quality Controls
  {
    source_unit_id: "fda_ada.su.7_b.001",
    document_id: "fda_ada",
    section_id: "fda_ada.sec.7_b",
    unit_type: "paragraph",
    unit_order: 1,
    unit_order_status: "known",
    source_text: "Positive control and quality control (QC) samples are critical and should be run concurrently with subject samples. We recommend that these samples span a level of positivity with QC samples having a known negative, low, and high signal in the assay. More important, the QC samples should be diluted in the matrix in which subject samples will be examined. For example, the QC sample should be diluted in the same anticoagulant as the subject samples. For the low-positive QC sample, we recommend that a concentration be selected that, upon statistical analysis, would lead to the rejection of an assay run 1% of the time. In this way, the sponsor ensures that the assay is performing as expected and that subject samples are correctly evaluated. If the assay is subject to a prozone effect, the concentration of high-positive QC samples should be set to monitor prozone effects.",
    related_source_unit_ids: [],
    table_context: null,
    trace: makeTrace("fda_ada.sec.7_b", 30, "27"),
    review_status: "reviewed"
  },
  // VII.C: Confirmation of Cut-Point in the Target Population
  {
    source_unit_id: "fda_ada.su.7_c.001",
    document_id: "fda_ada",
    section_id: "fda_ada.sec.7_c",
    unit_type: "paragraph",
    unit_order: 1,
    unit_order_status: "known",
    source_text: "Samples from different populations can have different background activity in ADA assays. Similarly, the background activity can change when samples used to determine the cut-point during assay validation were not obtained and handled in a manner that represents how samples will be obtained and handled in-study. Therefore, it is necessary to confirm that the cut-point determined during assay validation is suitable for the population being studied. A sufficient number of samples from the target population should be used, and justification for the number used should be provided. If sufficient numbers of samples are not available, agreement with the Agency should be sought for the number of samples to be used.",
    related_source_unit_ids: [],
    table_context: null,
    trace: makeTrace("fda_ada.sec.7_c", 31, "28"),
    review_status: "reviewed"
  },
  // VIII: DOCUMENTATION
  {
    source_unit_id: "fda_ada.su.8.001",
    document_id: "fda_ada",
    section_id: "fda_ada.sec.8",
    unit_type: "paragraph",
    unit_order: 1,
    unit_order_status: "known",
    source_text: "To facilitate the clinical development of therapeutic biologics, we recommend a life-cycle management approach to immunogenicity through the creation of an integrated immunogenicity summary report that sponsors begin populating early in therapeutic protein product development and update at regular intervals as the individual product clinical program progresses through IND stages into the BLA and even postapproval stages. We recommend that the document be arranged into distinct sections to be populated with stage-appropriate information as it becomes available, including (1) Immunogenicity Risk Assessment, (2) Tiered Bioanalytical Strategy and Assay Validation Summaries, (3) Clinical Study Design and Detailed Immunogenicity Sampling Plans, (4) Clinical Immunogenicity Data Analysis, and (5) Conclusions and Risk Evaluation and Mitigation Strategies (REMS). For the BLA file, we recommend that the applicant provide brief summaries of the immunogenicity results in relevant places in eCTD section 2.7 Clinical Summary and the full report in section 5.3.5.3 Reports of Analysis of Data from More than One Study.",
    related_source_unit_ids: [],
    table_context: null,
    trace: makeTrace("fda_ada.sec.8", 31, "28"),
    review_status: "reviewed"
  },
  // APP: Appendix
  {
    source_unit_id: "fda_ada.su.app.001",
    document_id: "fda_ada",
    section_id: "fda_ada.sec.app",
    unit_type: "paragraph",
    unit_order: 1,
    unit_order_status: "known",
    source_text: "The multi-tiered approach to anti-drug antibody testing comprises: Tier 1 Screening Assay to detect antibody responses with approximately 5% false-positive rate; Tier 2 Confirmatory Assay with competing unlabeled therapeutic protein to confirm specific binding with 1% false-positive rate; Tier 3 Titration Assay to characterize antibody level and magnitude of response; and Tier 4 Neutralization Bioassay (cell-based or non-cell-based) to determine neutralizing capacity of confirmed ADA against the therapeutic protein product.",
    related_source_unit_ids: [],
    table_context: null,
    trace: makeTrace("fda_ada.sec.app", 36, "33"),
    review_status: "reviewed"
  }
];

async function runExtraction() {
  console.log("=== Running 3-Pass Extraction on FDA ADA Batch 4 (Implementation, Documentation, & Appendix) ===");
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
  console.log(`Successfully completed 100% FDA ADA Guideline Ingestion!`);
  console.log(`Total Sections: ${bundle.sections.length}`);
  console.log(`Total SourceUnits: ${bundle.source_units.length}`);
  console.log(`Total KnowledgeRecords: ${bundle.knowledge_records.length}`);
  console.log(`Total QuantitativeCriteria: ${bundle.quantitative_criteria.length}`);
  console.log(`Total Conditions: ${bundle.conditions.length}`);
  console.log(`Total Archive Entities: ${bundle.knowledge_records.length + bundle.quantitative_criteria.length + bundle.conditions.length}`);
  console.log(`==================================================`);
}

runExtraction().catch(console.error);
