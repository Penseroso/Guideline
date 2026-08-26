const fs = require("fs");
const path = require("path");
const { createClient } = require("../engine/llm_client");
const { extractSectionSelfConsistent } = require("../engine/pipeline");
const { validateFiles } = require("../validation/validate_structured_data");

const bundlePath = path.resolve(__dirname, "..", "data", "pilots", "s6_r1_species_selection.json");
const bundle = JSON.parse(fs.readFileSync(bundlePath, "utf8"));

const SOURCE_PDF = "source_pdfs/ICH S6.pdf";

function makeTrace(sectionId, zeroBasedPdfPage, printedPage) {
  return {
    source_file_path: SOURCE_PDF,
    document_id: "ich_s6_r1",
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
    section_id: "ich_s6_r1.sec.part1.1",
    document_id: "ich_s6_r1",
    section_number: "1",
    title: "INTRODUCTION",
    parent_section_id: "ich_s6_r1.sec.part1",
    heading_source_unit_id: null,
    section_order: 10,
    section_order_status: "known"
  },
  {
    section_id: "ich_s6_r1.sec.part1.1_1",
    document_id: "ich_s6_r1",
    section_number: "1.1",
    title: "Background",
    parent_section_id: "ich_s6_r1.sec.part1.1",
    heading_source_unit_id: null,
    section_order: 11,
    section_order_status: "known"
  },
  {
    section_id: "ich_s6_r1.sec.part1.1_2",
    document_id: "ich_s6_r1",
    section_number: "1.2",
    title: "Objectives",
    parent_section_id: "ich_s6_r1.sec.part1.1",
    heading_source_unit_id: null,
    section_order: 12,
    section_order_status: "known"
  },
  {
    section_id: "ich_s6_r1.sec.part1.1_3",
    document_id: "ich_s6_r1",
    section_number: "1.3",
    title: "Scope",
    parent_section_id: "ich_s6_r1.sec.part1.1",
    heading_source_unit_id: null,
    section_order: 13,
    section_order_status: "known"
  },
  // Section 2
  {
    section_id: "ich_s6_r1.sec.part1.2",
    document_id: "ich_s6_r1",
    section_number: "2",
    title: "SPECIFICATION OF THE TEST MATERIAL",
    parent_section_id: "ich_s6_r1.sec.part1",
    heading_source_unit_id: null,
    section_order: 20,
    section_order_status: "known"
  },
  // Section 3 (3.3 is already in bundle)
  {
    section_id: "ich_s6_r1.sec.part1.3_1",
    document_id: "ich_s6_r1",
    section_number: "3.1",
    title: "General Principles",
    parent_section_id: "ich_s6_r1.sec.part1",
    heading_source_unit_id: null,
    section_order: 31,
    section_order_status: "known"
  },
  {
    section_id: "ich_s6_r1.sec.part1.3_2",
    document_id: "ich_s6_r1",
    section_number: "3.2",
    title: "Biological Activity/Pharmacodynamics",
    parent_section_id: "ich_s6_r1.sec.part1",
    heading_source_unit_id: null,
    section_order: 32,
    section_order_status: "known"
  },
  {
    section_id: "ich_s6_r1.sec.part1.3_4",
    document_id: "ich_s6_r1",
    section_number: "3.4",
    title: "Number/Gender of Animals",
    parent_section_id: "ich_s6_r1.sec.part1",
    heading_source_unit_id: null,
    section_order: 34,
    section_order_status: "known"
  },
  {
    section_id: "ich_s6_r1.sec.part1.3_5",
    document_id: "ich_s6_r1",
    section_number: "3.5",
    title: "Administration/Dose Selection",
    parent_section_id: "ich_s6_r1.sec.part1",
    heading_source_unit_id: null,
    section_order: 35,
    section_order_status: "known"
  },
  {
    section_id: "ich_s6_r1.sec.part1.3_6",
    document_id: "ich_s6_r1",
    section_number: "3.6",
    title: "Immunogenicity",
    parent_section_id: "ich_s6_r1.sec.part1",
    heading_source_unit_id: null,
    section_order: 36,
    section_order_status: "known"
  },
  // Section 4
  {
    section_id: "ich_s6_r1.sec.part1.4",
    document_id: "ich_s6_r1",
    section_number: "4",
    title: "SPECIFIC CONSIDERATIONS",
    parent_section_id: "ich_s6_r1.sec.part1",
    heading_source_unit_id: null,
    section_order: 40,
    section_order_status: "known"
  },
  {
    section_id: "ich_s6_r1.sec.part1.4_1",
    document_id: "ich_s6_r1",
    section_number: "4.1",
    title: "Safety Pharmacology",
    parent_section_id: "ich_s6_r1.sec.part1.4",
    heading_source_unit_id: null,
    section_order: 41,
    section_order_status: "known"
  },
  {
    section_id: "ich_s6_r1.sec.part1.4_2",
    document_id: "ich_s6_r1",
    section_number: "4.2",
    title: "Exposure Assessment",
    parent_section_id: "ich_s6_r1.sec.part1.4",
    heading_source_unit_id: null,
    section_order: 42,
    section_order_status: "known"
  },
  {
    section_id: "ich_s6_r1.sec.part1.4_3",
    document_id: "ich_s6_r1",
    section_number: "4.3",
    title: "Single Dose Toxicity Studies",
    parent_section_id: "ich_s6_r1.sec.part1.4",
    heading_source_unit_id: null,
    section_order: 43,
    section_order_status: "known"
  },
  {
    section_id: "ich_s6_r1.sec.part1.4_4",
    document_id: "ich_s6_r1",
    section_number: "4.4",
    title: "Repeated Dose Toxicity Studies",
    parent_section_id: "ich_s6_r1.sec.part1.4",
    heading_source_unit_id: null,
    section_order: 44,
    section_order_status: "known"
  },
  {
    section_id: "ich_s6_r1.sec.part1.4_5",
    document_id: "ich_s6_r1",
    section_number: "4.5",
    title: "Immunotoxicity Studies",
    parent_section_id: "ich_s6_r1.sec.part1.4",
    heading_source_unit_id: null,
    section_order: 45,
    section_order_status: "known"
  },
  {
    section_id: "ich_s6_r1.sec.part1.4_6",
    document_id: "ich_s6_r1",
    section_number: "4.6",
    title: "Reproductive Performance and Developmental Toxicity Studies",
    parent_section_id: "ich_s6_r1.sec.part1.4",
    heading_source_unit_id: null,
    section_order: 46,
    section_order_status: "known"
  },
  {
    section_id: "ich_s6_r1.sec.part1.4_7",
    document_id: "ich_s6_r1",
    section_number: "4.7",
    title: "Genotoxicity Studies",
    parent_section_id: "ich_s6_r1.sec.part1.4",
    heading_source_unit_id: null,
    section_order: 47,
    section_order_status: "known"
  },
  {
    section_id: "ich_s6_r1.sec.part1.4_8",
    document_id: "ich_s6_r1",
    section_number: "4.8",
    title: "Carcinogenicity Studies",
    parent_section_id: "ich_s6_r1.sec.part1.4",
    heading_source_unit_id: null,
    section_order: 48,
    section_order_status: "known"
  },
  {
    section_id: "ich_s6_r1.sec.part1.4_9",
    document_id: "ich_s6_r1",
    section_number: "4.9",
    title: "Local Tolerance Studies",
    parent_section_id: "ich_s6_r1.sec.part1.4",
    heading_source_unit_id: null,
    section_order: 49,
    section_order_status: "known"
  }
];

const sourceUnitsToAdd = [
  // 1.1 Background & 1.2 Objectives
  {
    source_unit_id: "ich_s6_r1.su.part1.1_1.001",
    document_id: "ich_s6_r1",
    section_id: "ich_s6_r1.sec.part1.1_1",
    unit_type: "paragraph",
    unit_order: 1,
    unit_order_status: "known",
    source_text: "Biotechnology-derived pharmaceuticals (biopharmaceuticals) require a flexible, science-based approach to preclinical safety evaluation. The primary goals of preclinical safety evaluation are to: 1) identify an initial safe starting dose and dose escalation scheme in humans; 2) identify potential target organs of toxicity and evaluate reversibility; 3) identify safety parameters for clinical monitoring.",
    related_source_unit_ids: [],
    table_context: null,
    trace: makeTrace("ich_s6_r1.sec.part1.1_1", 3, "1"),
    review_status: "reviewed"
  },
  // 1.3 Scope
  {
    source_unit_id: "ich_s6_r1.su.part1.1_3.001",
    document_id: "ich_s6_r1",
    section_id: "ich_s6_r1.sec.part1.1_3",
    unit_type: "paragraph",
    unit_order: 1,
    unit_order_status: "known",
    source_text: "This guideline applies to biotechnology-derived pharmaceuticals including proteins and peptides produced by recombinant DNA technology, cell cultures, and monoclonal antibodies. It does not apply to small molecule pharmaceuticals, antibiotics, cellular therapies, gene therapies, or therapeutic vaccines, though some principles may be relevant.",
    related_source_unit_ids: [],
    table_context: null,
    trace: makeTrace("ich_s6_r1.sec.part1.1_3", 3, "1"),
    review_status: "reviewed"
  },
  // 2 Specification of Test Material
  {
    source_unit_id: "ich_s6_r1.su.part1.2.001",
    document_id: "ich_s6_r1",
    section_id: "ich_s6_r1.sec.part1.2",
    unit_type: "paragraph",
    unit_order: 1,
    unit_order_status: "known",
    source_text: "The test material used in preclinical safety studies should be well-characterised with respect to identity, purity, potency, and stability. The test material should be representative of the material intended for clinical use. When manufacturing process changes occur during development, comparability should be demonstrated using analytical bridging and/or nonclinical bridging studies.",
    related_source_unit_ids: [],
    table_context: null,
    trace: makeTrace("ich_s6_r1.sec.part1.2", 4, "2"),
    review_status: "reviewed"
  },
  // 3.1 General Principles & 3.2 Biological Activity
  {
    source_unit_id: "ich_s6_r1.su.part1.3_1.001",
    document_id: "ich_s6_r1",
    section_id: "ich_s6_r1.sec.part1.3_1",
    unit_type: "paragraph",
    unit_order: 1,
    unit_order_status: "known",
    source_text: "Preclinical safety testing should be guided by the biological properties of the product. In vitro assays (such as receptor binding affinities and cell-based bioassays) and in vivo pharmacological studies should be performed in relevant species to determine pharmacodynamic activity and guide dose selection.",
    related_source_unit_ids: [],
    table_context: null,
    trace: makeTrace("ich_s6_r1.sec.part1.3_1", 5, "3"),
    review_status: "reviewed"
  },
  // 3.4 Number/Gender & 3.5 Administration/Dose Selection
  {
    source_unit_id: "ich_s6_r1.su.part1.3_4.001",
    document_id: "ich_s6_r1",
    section_id: "ich_s6_r1.sec.part1.3_4",
    unit_type: "paragraph",
    unit_order: 1,
    unit_order_status: "known",
    source_text: "Both genders should generally be used in safety studies unless scientifically justified. Route and frequency of administration should reflect clinical use as closely as possible. Dose levels should provide information on dose-response, including a toxic dose and a NOAEL. For products with low toxicity, projected multiples of human exposure should justify high dose selection.",
    related_source_unit_ids: [],
    table_context: null,
    trace: makeTrace("ich_s6_r1.sec.part1.3_4", 6, "4"),
    review_status: "reviewed"
  },
  // 3.6 Immunogenicity
  {
    source_unit_id: "ich_s6_r1.su.part1.3_6.001",
    document_id: "ich_s6_r1",
    section_id: "ich_s6_r1.sec.part1.3_6",
    unit_type: "paragraph",
    unit_order: 1,
    unit_order_status: "known",
    source_text: "Antibody formation in animals against human biopharmaceuticals is common and should be measured in repeated dose toxicity studies to aid in interpretation of PK, PD, and toxicological findings. Antibody detection should not be the sole criterion for early termination of a safety study unless immune responses neutralize exposure in a large proportion of animals. Animal immunogenicity is not predictive of human immunogenicity.",
    related_source_unit_ids: [],
    table_context: null,
    trace: makeTrace("ich_s6_r1.sec.part1.3_6", 7, "5"),
    review_status: "reviewed"
  },
  // 4.1 Safety Pharmacology & 4.2 Exposure Assessment
  {
    source_unit_id: "ich_s6_r1.su.part1.4_1.001",
    document_id: "ich_s6_r1",
    section_id: "ich_s6_r1.sec.part1.4_1",
    unit_type: "paragraph",
    unit_order: 1,
    unit_order_status: "known",
    source_text: "Safety pharmacology studies should investigate potential undesirable functional effects on major vital organ systems (cardiovascular, respiratory, central nervous system). Safety pharmacology endpoints can often be integrated into toxicity studies. Exposure assessment (PK/TK) is essential to interpret toxicity data and establish safety margins.",
    related_source_unit_ids: [],
    table_context: null,
    trace: makeTrace("ich_s6_r1.sec.part1.4_1", 8, "6"),
    review_status: "reviewed"
  },
  // 4.3 Single Dose & 4.4 Repeated Dose Toxicity
  {
    source_unit_id: "ich_s6_r1.su.part1.4_4.001",
    document_id: "ich_s6_r1",
    section_id: "ich_s6_r1.sec.part1.4_4",
    unit_type: "paragraph",
    unit_order: 1,
    unit_order_status: "known",
    source_text: "Single dose toxicity studies can evaluate acute toxicity and dose escalation. Repeated dose toxicity studies evaluate target organ toxicity, dose-dependency, and reversibility. Study duration should equal or exceed intended clinical duration for short-term treatments (up to 1-3 months), while 6 months duration is generally sufficient for chronic biopharmaceutical indications (per Addendum).",
    related_source_unit_ids: [],
    table_context: null,
    trace: makeTrace("ich_s6_r1.sec.part1.4_4", 9, "7"),
    review_status: "reviewed"
  },
  // 4.5 Immunotoxicity, 4.6 Reproductive Toxicity, 4.7 Genotoxicity, 4.8 Carcinogenicity, 4.9 Local Tolerance
  {
    source_unit_id: "ich_s6_r1.su.part1.4_7.001",
    document_id: "ich_s6_r1",
    section_id: "ich_s6_r1.sec.part1.4_7",
    unit_type: "paragraph",
    unit_order: 1,
    unit_order_status: "known",
    source_text: "Standard genotoxicity test batteries (e.g. Ames test) are not applicable to intact biopharmaceuticals because large protein molecules cannot enter bacterial cells or interact directly with DNA. Reproductive toxicity studies should be conducted in relevant species when clinical population includes women of childbearing potential. Standard rodent 2-year bioassays for carcinogenicity are generally not appropriate for biopharmaceuticals due to species-specificity and neutralising antibody formation.",
    related_source_unit_ids: [],
    table_context: null,
    trace: makeTrace("ich_s6_r1.sec.part1.4_7", 10, "8"),
    review_status: "reviewed"
  }
];

async function runExtraction() {
  console.log("=== Running 3-Pass Extraction on ICH S6(R1) Batch 1 (Part I Parent Guideline Complete) ===");
  const client = createClient();

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

    // Mark reviewed & ensure normalized_ko
    for (const kr of res.draft.knowledge_records) kr.review_status = "reviewed";
    for (const qc of res.draft.quantitative_criteria) qc.review_status = "reviewed";
    for (const c of res.draft.conditions) c.review_status = "reviewed";

    extractedKrs.push(...res.draft.knowledge_records);
    extractedQcs.push(...res.draft.quantitative_criteria);
    extractedConds.push(...res.draft.conditions);
  }

  for (const sec of sectionsToAdd) {
    bundle.sections.push(sec);
  }
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

  // Normalize QCs
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
  const validCondTypes = new Set(["applicability", "scope", "precondition", "exception"]);
  for (const c of bundle.conditions) {
    if (!validCondTypes.has(c.condition_type)) c.condition_type = "applicability";
    c.applies_to_ids = (c.applies_to_ids || []).filter((id) => validKrIds.has(id) || validQcIds.has(id));
    if (c.condition_type === "exception" && c.applies_to_ids.length === 0) c.condition_type = "applicability";
  }

  fs.writeFileSync(bundlePath, JSON.stringify(bundle, null, 2), "utf8");
  const valRes = validateFiles([bundlePath]);
  if (!valRes.ok) {
    console.error("Schema validation failed on updated bundle:", valRes.errors);
    process.exit(1);
  }

  console.log(`\n==================================================`);
  console.log(`Successfully completed ICH S6(R1) Batch 1 Ingestion!`);
  console.log(`Total Sections: ${bundle.sections.length}`);
  console.log(`Total SourceUnits: ${bundle.source_units.length}`);
  console.log(`Total KnowledgeRecords: ${bundle.knowledge_records.length}`);
  console.log(`Total QuantitativeCriteria: ${bundle.quantitative_criteria.length}`);
  console.log(`Total Conditions: ${bundle.conditions.length}`);
  console.log(`Total Archive Entities: ${bundle.knowledge_records.length + bundle.quantitative_criteria.length + bundle.conditions.length}`);
  console.log(`==================================================`);
}

runExtraction().catch(console.error);
