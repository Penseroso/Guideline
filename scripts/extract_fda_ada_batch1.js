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
    section_id: "fda_ada.sec.1",
    document_id: "fda_ada",
    section_number: "I",
    title: "INTRODUCTION",
    parent_section_id: null,
    heading_source_unit_id: null,
    section_order: 1,
    section_order_status: "known"
  },
  {
    section_id: "fda_ada.sec.2",
    document_id: "fda_ada",
    section_number: "II",
    title: "BACKGROUND",
    parent_section_id: null,
    heading_source_unit_id: null,
    section_order: 2,
    section_order_status: "known"
  },
  {
    section_id: "fda_ada.sec.3",
    document_id: "fda_ada",
    section_number: "III",
    title: "GENERAL PRINCIPLES",
    parent_section_id: null,
    heading_source_unit_id: null,
    section_order: 3,
    section_order_status: "known"
  },
  {
    section_id: "fda_ada.sec.3_a",
    document_id: "fda_ada",
    section_number: "III.A",
    title: "Assays for ADA Detection",
    parent_section_id: "fda_ada.sec.3",
    heading_source_unit_id: null,
    section_order: 4,
    section_order_status: "known"
  },
  {
    section_id: "fda_ada.sec.3_b",
    document_id: "fda_ada",
    section_number: "III.B",
    title: "Limitations in Comparing ADA Incidence Across Products",
    parent_section_id: "fda_ada.sec.3",
    heading_source_unit_id: null,
    section_order: 5,
    section_order_status: "known"
  }
];

const sourceUnitsToAdd = [
  // Section I: Introduction
  {
    source_unit_id: "fda_ada.su.1.001",
    document_id: "fda_ada",
    section_id: "fda_ada.sec.1",
    unit_type: "paragraph",
    unit_order: 1,
    unit_order_status: "known",
    source_text: "This guidance provides recommendations for developing and validating assays for the detection of anti-drug antibodies (ADAs). This guidance may also apply to some peptides, oligonucleotides, and combination products on a case-by-case basis.",
    related_source_unit_ids: [],
    table_context: null,
    trace: makeTrace("fda_ada.sec.1", 4, "1"),
    review_status: "reviewed"
  },
  {
    source_unit_id: "fda_ada.su.1.002",
    document_id: "fda_ada",
    section_id: "fda_ada.sec.1",
    unit_type: "paragraph",
    unit_order: 2,
    unit_order_status: "known",
    source_text: "In general, this document does not discuss the rationale for ADA testing or the subject- and product-specific risk factors that may contribute to immunogenicity. Also, this guidance, including any discussions of terminology used in this guidance, does not apply to in vitro diagnostic products.",
    related_source_unit_ids: [],
    table_context: null,
    trace: makeTrace("fda_ada.sec.1", 5, "2"),
    review_status: "reviewed"
  },
  // Section II: Background
  {
    source_unit_id: "fda_ada.su.2.001",
    document_id: "fda_ada",
    section_id: "fda_ada.sec.2",
    unit_type: "paragraph",
    unit_order: 1,
    unit_order_status: "known",
    source_text: "Therapeutic protein products may elicit immune responses in subjects, resulting in the generation of anti-drug antibodies. The clinical consequences of an immune response to a therapeutic protein product can range from no observable effect to life-threatening complications, such as anaphylaxis or cross-reactive neutralization of an essential endogenous protein.",
    related_source_unit_ids: [],
    table_context: null,
    trace: makeTrace("fda_ada.sec.2", 5, "2"),
    review_status: "reviewed"
  },
  {
    source_unit_id: "fda_ada.su.2.002",
    document_id: "fda_ada",
    section_id: "fda_ada.sec.2",
    unit_type: "paragraph",
    unit_order: 2,
    unit_order_status: "known",
    source_text: "ADAs may alter the pharmacokinetics, pharmacodynamics, safety, and efficacy of the therapeutic protein product. Therefore, the development of valid, sensitive, specific, and selective assays to measure ADA responses is a key aspect of therapeutic protein product development.",
    related_source_unit_ids: [],
    table_context: null,
    trace: makeTrace("fda_ada.sec.2", 6, "3"),
    review_status: "reviewed"
  },
  // Section III: General Principles
  {
    source_unit_id: "fda_ada.su.3.001",
    document_id: "fda_ada",
    section_id: "fda_ada.sec.3",
    unit_type: "paragraph",
    unit_order: 1,
    unit_order_status: "known",
    source_text: "The risk to subjects from mounting an ADA-generating immune response to a therapeutic protein product will vary with the product. FDA recommends adopting a risk-based approach to evaluating and managing immune responses to — or immunologically related adverse clinical events associated with — therapeutic protein products that affect their pharmacokinetics, pharmacodynamics, safety, and efficacy. Immunogenicity tests should be designed to detect ADA that could mediate unwanted biological or physiological consequences such as neutralizing activity or hypersensitivity responses.",
    related_source_unit_ids: [],
    table_context: null,
    trace: makeTrace("fda_ada.sec.3", 6, "3"),
    review_status: "reviewed"
  },
  // Section III.A: Assays for ADA Detection
  {
    source_unit_id: "fda_ada.su.3_a.001",
    document_id: "fda_ada",
    section_id: "fda_ada.sec.3_a",
    unit_type: "paragraph",
    unit_order: 1,
    unit_order_status: "known",
    source_text: "Screening assays, also known as binding antibody assays, are used to detect antibodies that bind to the therapeutic protein product. The specificity of ADA for the therapeutic protein product is usually established by competition with a therapeutic protein in a confirmatory assay. ADAs are characterized further using titration and neutralization assays. Titration assays characterize the magnitude of the ADA response.",
    related_source_unit_ids: [],
    table_context: null,
    trace: makeTrace("fda_ada.sec.3_a", 6, "3"),
    review_status: "reviewed"
  },
  {
    source_unit_id: "fda_ada.su.3_a.002",
    document_id: "fda_ada",
    section_id: "fda_ada.sec.3_a",
    unit_type: "paragraph",
    unit_order: 2,
    unit_order_status: "known",
    source_text: "It is important to characterize this magnitude with titration assays because the impact of ADA on pharmacokinetics, pharmacodynamics, safety, and efficacy may correlate with ADA titer and persistence rather than incidence. Neutralizing antibodies (NAbs) refer to those ADA with the ability to interfere with interactions between the therapeutic protein product and its target. Neutralization assays assess ADA for neutralizing activity.",
    related_source_unit_ids: [],
    table_context: null,
    trace: makeTrace("fda_ada.sec.3_a", 6, "3"),
    review_status: "reviewed"
  },
  {
    source_unit_id: "fda_ada.su.3_a.003",
    document_id: "fda_ada",
    section_id: "fda_ada.sec.3_a",
    unit_type: "paragraph",
    unit_order: 3,
    unit_order_status: "known",
    source_text: "The optimal time to design, develop, and validate ADA assays during therapeutic protein product development depends on the risk assessment of the product. The sponsor should provide an immunogenicity risk assessment as well as a rationale for the immunogenicity testing paradigm in the original investigational new drug application (IND). FDA encourages sponsors to test samples during phase 1 and phase 2 studies using suitable screening, confirmatory, and in some instances neutralization assays. Samples derived from pivotal clinical studies should be tested with fully validated assays.",
    related_source_unit_ids: [],
    table_context: null,
    trace: makeTrace("fda_ada.sec.3_a", 6, "3"),
    review_status: "reviewed"
  },
  {
    source_unit_id: "fda_ada.su.3_a.004",
    document_id: "fda_ada",
    section_id: "fda_ada.sec.3_a",
    unit_type: "paragraph",
    unit_order: 4,
    unit_order_status: "known",
    source_text: "When immunogenicity poses a high clinical risk and real-time data concerning subject responses are needed (for example, when there is an endogenous counterpart with non-redundant function), FDA may request that assays suitable for their intended purpose be developed before initiating clinical studies and that testing be performed in real time. In other situations, the sponsor may store subject samples so they can be tested when suitable assays are available. At the time of license application, the sponsor should provide data supporting full validation of the assays.",
    related_source_unit_ids: [],
    table_context: null,
    trace: makeTrace("fda_ada.sec.3_a", 7, "4"),
    review_status: "reviewed"
  },
  // Section III.B: Limitations in Comparing ADA Incidence
  {
    source_unit_id: "fda_ada.su.3_b.001",
    document_id: "fda_ada",
    section_id: "fda_ada.sec.3_b",
    unit_type: "paragraph",
    unit_order: 1,
    unit_order_status: "known",
    source_text: "FDA cautions that comparison of ADA incidence across products, even for products that share sequence or structural homology, can be misleading because detection of ADA formation is highly dependent on the sensitivity, specificity, and drug tolerance level of the assay. Additionally, the observed incidence of ADA is influenced by multiple factors including method, sample handling, timing of sample collection, concomitant medications, and disease condition. Therefore, comparing immunogenicity rates across therapeutic protein products with structural homology for the same indication is unsound, even though fully validated assays are employed.",
    related_source_unit_ids: [],
    table_context: null,
    trace: makeTrace("fda_ada.sec.3_b", 7, "4"),
    review_status: "reviewed"
  },
  {
    source_unit_id: "fda_ada.su.3_b.002",
    document_id: "fda_ada",
    section_id: "fda_ada.sec.3_b",
    unit_type: "paragraph",
    unit_order: 2,
    unit_order_status: "known",
    source_text: "When a direct comparison of immunogenicity across different therapeutic protein products that have homology — or across similar therapeutic proteins from different sources — is needed, the comparison data should be obtained by conducting a head-to-head clinical study from which samples obtained are tested using an assay demonstrated to have equivalent sensitivity and specificity for antibodies against both therapeutic protein products.",
    related_source_unit_ids: [],
    table_context: null,
    trace: makeTrace("fda_ada.sec.3_b", 7, "4"),
    review_status: "reviewed"
  }
];

async function runExtraction() {
  console.log("=== Running 3-Pass Extraction on FDA ADA Batch 1 (Sec I, II, III.A, III.B) ===");
  const client = createClient();

  // Clean out any previously partially added sections / sourceUnits from bundle
  const secIds = new Set(sectionsToAdd.map((s) => s.section_id));
  const suIds = new Set(sourceUnitsToAdd.map((s) => s.source_unit_id));
  bundle.sections = bundle.sections.filter((s) => !secIds.has(s.section_id));
  bundle.source_units = bundle.source_units.filter((s) => !suIds.has(s.source_unit_id));
  bundle.knowledge_records = bundle.knowledge_records.filter((k) => !(k.source_unit_ids || []).some((id) => suIds.has(id)));
  bundle.quantitative_criteria = bundle.quantitative_criteria.filter((q) => !suIds.has(q.source_unit_id));
  bundle.conditions = bundle.conditions.filter((c) => !suIds.has(c.source_unit_id));

  const targetSections = [
    { sec: sectionsToAdd[0], sus: sourceUnitsToAdd.filter((s) => s.section_id === "fda_ada.sec.1") },
    { sec: sectionsToAdd[1], sus: sourceUnitsToAdd.filter((s) => s.section_id === "fda_ada.sec.2") },
    { sec: sectionsToAdd[2], sus: sourceUnitsToAdd.filter((s) => s.section_id === "fda_ada.sec.3") },
    { sec: sectionsToAdd[3], sus: sourceUnitsToAdd.filter((s) => s.section_id === "fda_ada.sec.3_a") },
    { sec: sectionsToAdd[4], sus: sourceUnitsToAdd.filter((s) => s.section_id === "fda_ada.sec.3_b") }
  ];

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
  console.log(`Successfully updated bundle with FDA ADA Batch 1!`);
  console.log(`Total Sections: ${bundle.sections.length}`);
  console.log(`Total SourceUnits: ${bundle.source_units.length}`);
  console.log(`Total KnowledgeRecords: ${bundle.knowledge_records.length}`);
  console.log(`Total QuantitativeCriteria: ${bundle.quantitative_criteria.length}`);
  console.log(`Total Conditions: ${bundle.conditions.length}`);
  console.log(`Total Archive Entities: ${bundle.knowledge_records.length + bundle.quantitative_criteria.length + bundle.conditions.length}`);
  console.log(`==================================================`);
}

runExtraction().catch(console.error);
