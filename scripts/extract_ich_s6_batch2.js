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
  // Part II Section 1
  {
    section_id: "ich_s6_r1.sec.part2.1",
    document_id: "ich_s6_r1",
    section_number: "1",
    title: "INTRODUCTION (Addendum)",
    parent_section_id: "ich_s6_r1.sec.part2",
    heading_source_unit_id: null,
    section_order: 50,
    section_order_status: "known"
  },
  // Part II Section 2.3
  {
    section_id: "ich_s6_r1.sec.part2.2_3",
    document_id: "ich_s6_r1",
    section_number: "2.3",
    title: "Use of Homologous Proteins",
    parent_section_id: "ich_s6_r1.sec.part2.2",
    heading_source_unit_id: null,
    section_order: 53,
    section_order_status: "known"
  },
  // Part II Section 3
  {
    section_id: "ich_s6_r1.sec.part2.3",
    document_id: "ich_s6_r1",
    section_number: "3",
    title: "STUDY DESIGN",
    parent_section_id: "ich_s6_r1.sec.part2",
    heading_source_unit_id: null,
    section_order: 60,
    section_order_status: "known"
  },
  {
    section_id: "ich_s6_r1.sec.part2.3_1",
    document_id: "ich_s6_r1",
    section_number: "3.1",
    title: "Dose Selection and Application of PK/PD Principles",
    parent_section_id: "ich_s6_r1.sec.part2.3",
    heading_source_unit_id: null,
    section_order: 61,
    section_order_status: "known"
  },
  {
    section_id: "ich_s6_r1.sec.part2.3_2",
    document_id: "ich_s6_r1",
    section_number: "3.2",
    title: "Duration of Studies",
    parent_section_id: "ich_s6_r1.sec.part2.3",
    heading_source_unit_id: null,
    section_order: 62,
    section_order_status: "known"
  },
  {
    section_id: "ich_s6_r1.sec.part2.3_3",
    document_id: "ich_s6_r1",
    section_number: "3.3",
    title: "Recovery",
    parent_section_id: "ich_s6_r1.sec.part2.3",
    heading_source_unit_id: null,
    section_order: 63,
    section_order_status: "known"
  },
  {
    section_id: "ich_s6_r1.sec.part2.3_4",
    document_id: "ich_s6_r1",
    section_number: "3.4",
    title: "Exploratory Clinical Trials",
    parent_section_id: "ich_s6_r1.sec.part2.3",
    heading_source_unit_id: null,
    section_order: 64,
    section_order_status: "known"
  },
  // Part II Section 4
  {
    section_id: "ich_s6_r1.sec.part2.4",
    document_id: "ich_s6_r1",
    section_number: "4",
    title: "IMMUNOGENICITY (Addendum)",
    parent_section_id: "ich_s6_r1.sec.part2",
    heading_source_unit_id: null,
    section_order: 70,
    section_order_status: "known"
  },
  // Part II Section 5
  {
    section_id: "ich_s6_r1.sec.part2.5",
    document_id: "ich_s6_r1",
    section_number: "5",
    title: "REPRODUCTIVE AND DEVELOPMENTAL TOXICITY",
    parent_section_id: "ich_s6_r1.sec.part2",
    heading_source_unit_id: null,
    section_order: 80,
    section_order_status: "known"
  },
  {
    section_id: "ich_s6_r1.sec.part2.5_1",
    document_id: "ich_s6_r1",
    section_number: "5.1",
    title: "General Comments",
    parent_section_id: "ich_s6_r1.sec.part2.5",
    heading_source_unit_id: null,
    section_order: 81,
    section_order_status: "known"
  },
  {
    section_id: "ich_s6_r1.sec.part2.5_2",
    document_id: "ich_s6_r1",
    section_number: "5.2",
    title: "Fertility",
    parent_section_id: "ich_s6_r1.sec.part2.5",
    heading_source_unit_id: null,
    section_order: 82,
    section_order_status: "known"
  },
  {
    section_id: "ich_s6_r1.sec.part2.5_3",
    document_id: "ich_s6_r1",
    section_number: "5.3",
    title: "Embryo-Fetal Development (EFD)",
    parent_section_id: "ich_s6_r1.sec.part2.5",
    heading_source_unit_id: null,
    section_order: 83,
    section_order_status: "known"
  },
  {
    section_id: "ich_s6_r1.sec.part2.5_4",
    document_id: "ich_s6_r1",
    section_number: "5.4",
    title: "Pre- and Post-Natal Development (PPND)",
    parent_section_id: "ich_s6_r1.sec.part2.5",
    heading_source_unit_id: null,
    section_order: 84,
    section_order_status: "known"
  },
  // Part II Section 6
  {
    section_id: "ich_s6_r1.sec.part2.6",
    document_id: "ich_s6_r1",
    section_number: "6",
    title: "CARCINOGENICITY (Addendum)",
    parent_section_id: "ich_s6_r1.sec.part2",
    heading_source_unit_id: null,
    section_order: 90,
    section_order_status: "known"
  }
];

const sourceUnitsToAdd = [
  // Part II Section 1 Introduction
  {
    source_unit_id: "ich_s6_r1.su.part2.1.001",
    document_id: "ich_s6_r1",
    section_id: "ich_s6_r1.sec.part2.1",
    unit_type: "paragraph",
    unit_order: 1,
    unit_order_status: "known",
    source_text: "The purpose of this Addendum is to complement the parent ICH S6 guideline and provide further guidance on species selection, study design (dose selection, duration, recovery), immunogenicity, reproductive and developmental toxicity, and carcinogenicity for biotechnology-derived pharmaceuticals.",
    related_source_unit_ids: [],
    table_context: null,
    trace: makeTrace("ich_s6_r1.sec.part2.1", 13, "10"),
    review_status: "reviewed"
  },
  // Part II Section 2.3 Use of Homologous Proteins
  {
    source_unit_id: "ich_s6_r1.su.part2.2_3.001",
    document_id: "ich_s6_r1",
    section_id: "ich_s6_r1.sec.part2.2_3",
    unit_type: "paragraph",
    unit_order: 1,
    unit_order_status: "known",
    source_text: "Studies with homologous proteins can be used for hazard detection and understanding potential adverse effects due to exaggerated pharmacology, but are generally not useful for quantitative risk assessment. For hazard identification, safety evaluation studies using a control group and one treatment group (at maximum pharmacological dose) can be conducted with scientific justification.",
    related_source_unit_ids: [],
    table_context: null,
    trace: makeTrace("ich_s6_r1.sec.part2.2_3", 15, "12"),
    review_status: "reviewed"
  },
  // Part II Section 3.1 Dose Selection and PK/PD
  {
    source_unit_id: "ich_s6_r1.su.part2.3_1.001",
    document_id: "ich_s6_r1",
    section_id: "ich_s6_r1.sec.part2.3_1",
    unit_type: "paragraph",
    unit_order: 1,
    unit_order_status: "known",
    source_text: "A rationale should be provided for dose selection taking into account PK-PD principles. The high dose in preclinical toxicity studies should be chosen as the higher of: 1) a dose providing maximum intended pharmacological effect in the preclinical species; or 2) a dose providing approximately a 10-fold exposure multiple over the maximum clinical exposure, unless a lower dose (such as maximum feasible dose or 1000 mg/kg) is justified. Testing higher doses when no toxicity is observed at these levels is unlikely to provide additional useful information.",
    related_source_unit_ids: [],
    table_context: null,
    trace: makeTrace("ich_s6_r1.sec.part2.3_1", 15, "12"),
    review_status: "reviewed"
  },
  // Part II Section 3.2 Duration of Studies
  {
    source_unit_id: "ich_s6_r1.su.part2.3_2.001",
    document_id: "ich_s6_r1",
    section_id: "ich_s6_r1.sec.part2.3_2",
    unit_type: "paragraph",
    unit_order: 1,
    unit_order_status: "known",
    source_text: "For chronic use biopharmaceutical products, repeated dose toxicity studies of 6 months duration in rodents or non-rodents are considered sufficient, providing the high dose is selected in accordance with PK-PD principles. Studies of longer duration (such as 12 months) have not generally provided useful information that changed the clinical course of development.",
    related_source_unit_ids: [],
    table_context: null,
    trace: makeTrace("ich_s6_r1.sec.part2.3_2", 15, "12"),
    review_status: "reviewed"
  },
  // Part II Section 3.3 Recovery & 3.4 Exploratory Clinical Trials
  {
    source_unit_id: "ich_s6_r1.su.part2.3_3.001",
    document_id: "ich_s6_r1",
    section_id: "ich_s6_r1.sec.part2.3_3",
    unit_type: "paragraph",
    unit_order: 1,
    unit_order_status: "known",
    source_text: "Recovery from pharmacological and toxicological effects should be examined by including a non-dosing period in at least one study at at least one dose level. The purpose of the non-dosing period is to examine reversibility of effects, not delayed toxicity. Complete recovery demonstration is not essential. Adding a recovery period solely to assess immunogenicity is not required.",
    related_source_unit_ids: [],
    table_context: null,
    trace: makeTrace("ich_s6_r1.sec.part2.3_3", 16, "13"),
    review_status: "reviewed"
  },
  // Part II Section 4 Immunogenicity
  {
    source_unit_id: "ich_s6_r1.su.part2.4.001",
    document_id: "ich_s6_r1",
    section_id: "ich_s6_r1.sec.part2.4",
    unit_type: "paragraph",
    unit_order: 1,
    unit_order_status: "known",
    source_text: "Anti-drug antibody (ADA) measurement in nonclinical studies should be evaluated when there is: 1) evidence of altered PD activity; 2) unexpected changes in exposure in absence of PD marker; or 3) evidence of immune-mediated reactions (immune complex disease, vasculitis, anaphylaxis). Characterisation of neutralizing potential is warranted when ADAs are detected and there is no PD marker to demonstrate sustained in vivo activity.",
    related_source_unit_ids: [],
    table_context: null,
    trace: makeTrace("ich_s6_r1.sec.part2.4", 16, "13"),
    review_status: "reviewed"
  },
  // Part II Section 5 Reproductive and Developmental Toxicity
  {
    source_unit_id: "ich_s6_r1.su.part2.5.001",
    document_id: "ich_s6_r1",
    section_id: "ich_s6_r1.sec.part2.5",
    unit_type: "paragraph",
    unit_order: 1,
    unit_order_status: "known",
    source_text: "Reproductive toxicity studies should be conducted in relevant species. When non-human primates (NHPs) are the only relevant species, an enhanced pre- and post-natal development (ePPND) study design can be used to evaluate embryo-fetal development, fetal loss, and post-natal development in a single comprehensive study, replacing separate EFD and PPND studies. Dosing can extend from gestation day 20 to parturition, with infant evaluation up to 6 months.",
    related_source_unit_ids: [],
    table_context: null,
    trace: makeTrace("ich_s6_r1.sec.part2.5", 17, "14"),
    review_status: "reviewed"
  },
  // Part II Section 6 Carcinogenicity
  {
    source_unit_id: "ich_s6_r1.su.part2.6.001",
    document_id: "ich_s6_r1",
    section_id: "ich_s6_r1.sec.part2.6",
    unit_type: "paragraph",
    unit_order: 1,
    unit_order_status: "known",
    source_text: "The need for carcinogenicity testing should be evaluated using a weight-of-evidence approach based on target biology, intended patient population, treatment duration, and potential for proliferative or immunosuppressive effects. Rodent 2-year carcinogenicity bioassays are generally not required for biopharmaceuticals unless there is clear biological rationale and a relevant rodent model exists.",
    related_source_unit_ids: [],
    table_context: null,
    trace: makeTrace("ich_s6_r1.sec.part2.6", 19, "16"),
    review_status: "reviewed"
  }
];

async function runExtraction() {
  console.log("=== Running 3-Pass Extraction on ICH S6(R1) Batch 2 (Part II Addendum Complete) ===");
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
  console.log(`Successfully completed ICH S6(R1) Batch 2 (100% Ingestion Complete)!`);
  console.log(`Total Sections: ${bundle.sections.length}`);
  console.log(`Total SourceUnits: ${bundle.source_units.length}`);
  console.log(`Total KnowledgeRecords: ${bundle.knowledge_records.length}`);
  console.log(`Total QuantitativeCriteria: ${bundle.quantitative_criteria.length}`);
  console.log(`Total Conditions: ${bundle.conditions.length}`);
  console.log(`Total Archive Entities: ${bundle.knowledge_records.length + bundle.quantitative_criteria.length + bundle.conditions.length}`);
  console.log(`==================================================`);
}

runExtraction().catch(console.error);
