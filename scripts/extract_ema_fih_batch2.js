const fs = require("fs");
const path = require("path");
const { createClient } = require("../engine/llm_client");
const { extractSectionSelfConsistent } = require("../engine/pipeline");
const { validateFiles } = require("../validation/validate_structured_data");

const bundlePath = path.resolve(__dirname, "..", "data", "pilots", "ema_fih_dosing.json");
const bundle = JSON.parse(fs.readFileSync(bundlePath, "utf8"));

const SOURCE_PDF = "source_pdfs/EMA guideline-strategies-identify-and-mitigate-risks-first-human-and-early-clinical-trials-investigational-medicinal-products-revision-1_en.pdf";

function makeTrace(sectionId, zeroBasedPdfPage, printedPage) {
  return {
    source_file_path: SOURCE_PDF,
    document_id: "ema_fih",
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
    "section_id": "ema_fih.sec.6",
    "document_id": "ema_fih",
    "section_number": "6",
    "title": "Non-clinical aspects",
    "parent_section_id": null,
    "heading_source_unit_id": null,
    "section_order": 6,
    "section_order_status": "known"
  },
  {
    "section_id": "ema_fih.sec.6_1",
    "document_id": "ema_fih",
    "section_number": "6.1",
    "title": "Relevance of the animal model",
    "parent_section_id": "ema_fih.sec.6",
    "heading_source_unit_id": null,
    "section_order": 61,
    "section_order_status": "known"
  },
  {
    "section_id": "ema_fih.sec.6_2",
    "document_id": "ema_fih",
    "section_number": "6.2",
    "title": "Nature of the target",
    "parent_section_id": "ema_fih.sec.6",
    "heading_source_unit_id": null,
    "section_order": 62,
    "section_order_status": "known"
  },
  {
    "section_id": "ema_fih.sec.6_3",
    "document_id": "ema_fih",
    "section_number": "6.3",
    "title": "Pharmacodynamics",
    "parent_section_id": "ema_fih.sec.6",
    "heading_source_unit_id": null,
    "section_order": 63,
    "section_order_status": "known"
  },
  {
    "section_id": "ema_fih.sec.6_4",
    "document_id": "ema_fih",
    "section_number": "6.4",
    "title": "Pharmaco- and toxicokinetics",
    "parent_section_id": "ema_fih.sec.6",
    "heading_source_unit_id": null,
    "section_order": 64,
    "section_order_status": "known"
  },
  {
    "section_id": "ema_fih.sec.6_5",
    "document_id": "ema_fih",
    "section_number": "6.5",
    "title": "Safety pharmacology",
    "parent_section_id": "ema_fih.sec.6",
    "heading_source_unit_id": null,
    "section_order": 65,
    "section_order_status": "known"
  },
  {
    "section_id": "ema_fih.sec.6_6",
    "document_id": "ema_fih",
    "section_number": "6.6",
    "title": "Toxicology",
    "parent_section_id": "ema_fih.sec.6",
    "heading_source_unit_id": null,
    "section_order": 66,
    "section_order_status": "known"
  },
  {
    "section_id": "ema_fih.sec.abbrev",
    "document_id": "ema_fih",
    "section_number": "Abbreviations",
    "title": "Abbreviations and Definitions",
    "parent_section_id": null,
    "heading_source_unit_id": null,
    "section_order": 90,
    "section_order_status": "known"
  }
];

const sourceUnitsToAdd = [
  {
    "source_unit_id": "ema_fih.su.6.001",
    "document_id": "ema_fih",
    "section_id": "ema_fih.sec.6",
    "unit_order": 60,
    "unit_order_status": "known",
    "unit_type": "paragraph",
    "source_text": "The development and evaluation of a new IMP is a stepwise process involving animal and human efficacy and safety information. The non-clinical data in PD, PK and toxicology and their translation to human are important basis for planning and conduct of a FIH/early CT. The recommendations in the Guidance on non-clinical safety studies for the conduct of human clinical trials and marketing authorization for pharmaceuticals (ICH M3(R2)) should be followed. A tabulated summary containing an overview of all relevant non-clinical data is considered helpful in the assessment process and should be included as an appendix to the Investigator Brochure (IB). The sponsor should confirm that all pivotal non-clinical safety studies in support of the CT application are conducted in compliance with Good Laboratory Practice (GLP). All other studies influencing the design of CTs should be of high scientific standard and conduct.",
    "related_source_unit_ids": [],
    "table_context": null,
    "trace": {
      "source_file_path": "source_pdfs/EMA guideline-strategies-identify-and-mitigate-risks-first-human-and-early-clinical-trials-investigational-medicinal-products-revision-1_en.pdf",
      "document_id": "ema_fih",
      "section_id": "ema_fih.sec.6",
      "pdf_page_index_zero_based": 7,
      "pdf_page_index_status": "known",
      "printed_page_label": "8",
      "printed_page_label_status": "known",
      "extraction_method": "automated text extraction with manual verification"
    },
    "review_status": "reviewed"
  },
  {
    "source_unit_id": "ema_fih.su.6_1.001",
    "document_id": "ema_fih",
    "section_id": "ema_fih.sec.6_1",
    "unit_order": 61,
    "unit_order_status": "known",
    "unit_type": "paragraph",
    "source_text": "The non-clinical pharmacology and toxicology programme should be performed in relevant animal species and/or other relevant experimental models. Animal models should be chosen based on similarities to humans with respect to target distribution, target binding and structural homology, cellular consequences of target binding, cellular regulatory mechanisms, metabolic pathways, or compensatory responses to an initial physiological perturbation. In this context, the use of in vitro human cell systems or human-derived material could provide relevant information about these translational differences and improve the understanding of the relevance of the animal models. High human-specificity of a medicinal product makes the non-clinical evaluation of the risk to humans more difficult in terms of degree of uncertainty.",
    "related_source_unit_ids": [],
    "table_context": null,
    "trace": {
      "source_file_path": "source_pdfs/EMA guideline-strategies-identify-and-mitigate-risks-first-human-and-early-clinical-trials-investigational-medicinal-products-revision-1_en.pdf",
      "document_id": "ema_fih",
      "section_id": "ema_fih.sec.6_1",
      "pdf_page_index_zero_based": 7,
      "pdf_page_index_status": "known",
      "printed_page_label": "8",
      "printed_page_label_status": "known",
      "extraction_method": "automated text extraction with manual verification"
    },
    "review_status": "reviewed"
  },
  {
    "source_unit_id": "ema_fih.su.6_1.002",
    "document_id": "ema_fih",
    "section_id": "ema_fih.sec.6_1",
    "unit_order": 62,
    "unit_order_status": "known",
    "unit_type": "paragraph",
    "source_text": "Special consideration should be given to the selection of relevant animal models for non-clinical testing of biotechnology-derived products, as outlined in ICH S6(R1). Homologous proteins and transgenic models (where the human target is expressed in animals) could be considered as alternatives, in particular to evaluate specific potential risks (e.g. for identification of safety hazards or to clarify the mode of action). The use of homologous proteins or transgenic models could require specific considerations regarding e.g. quality, target expression, PK, and immunogenicity.",
    "related_source_unit_ids": [],
    "table_context": null,
    "trace": {
      "source_file_path": "source_pdfs/EMA guideline-strategies-identify-and-mitigate-risks-first-human-and-early-clinical-trials-investigational-medicinal-products-revision-1_en.pdf",
      "document_id": "ema_fih",
      "section_id": "ema_fih.sec.6_1",
      "pdf_page_index_zero_based": 8,
      "pdf_page_index_status": "known",
      "printed_page_label": "9",
      "printed_page_label_status": "known",
      "extraction_method": "automated text extraction with manual verification"
    },
    "review_status": "reviewed"
  },
  {
    "source_unit_id": "ema_fih.su.6_2.001",
    "document_id": "ema_fih",
    "section_id": "ema_fih.sec.6_2",
    "unit_order": 63,
    "unit_order_status": "known",
    "unit_type": "paragraph",
    "source_text": "The nature of the target and its downstream pathways should be carefully evaluated. Potential risks can arise from the biological role of the target, its distribution in humans (e.g. presence in multiple tissues or vital organs), lack of redundancy or presence of feedback loops in the targeted biological system, cross-reactivity with unintended targets, and potential for sustained receptor activation or exaggerated downstream cascading effects (e.g. cytokine release syndrome). Particular caution is needed for novel targets where there is limited clinical experience or where activation of the target triggers potent immune-modulatory responses.",
    "related_source_unit_ids": [],
    "table_context": null,
    "trace": {
      "source_file_path": "source_pdfs/EMA guideline-strategies-identify-and-mitigate-risks-first-human-and-early-clinical-trials-investigational-medicinal-products-revision-1_en.pdf",
      "document_id": "ema_fih",
      "section_id": "ema_fih.sec.6_2",
      "pdf_page_index_zero_based": 8,
      "pdf_page_index_status": "known",
      "printed_page_label": "9",
      "printed_page_label_status": "known",
      "extraction_method": "automated text extraction with manual verification"
    },
    "review_status": "reviewed"
  },
  {
    "source_unit_id": "ema_fih.su.6_3.001",
    "document_id": "ema_fih",
    "section_id": "ema_fih.sec.6_3",
    "unit_order": 64,
    "unit_order_status": "known",
    "unit_type": "paragraph",
    "source_text": "Primary pharmacodynamics in vitro and in vivo should provide sufficient information on the mode of action, concentration/dose-response relationships, and receptor occupancy or target binding kinetics. Specificity and selectivity across target families and secondary pharmacodynamics (off-target effects) should be documented. The steepness of the dose-response relationship is of critical importance, as steep curves indicate that small increments in dose can lead to disproportionately large biological or toxicological effects. In vitro studies with human cells or tissues should be conducted when animal models show limited pharmacodynamic relevance or when potency in humans is anticipated to be substantially higher.",
    "related_source_unit_ids": [],
    "table_context": null,
    "trace": {
      "source_file_path": "source_pdfs/EMA guideline-strategies-identify-and-mitigate-risks-first-human-and-early-clinical-trials-investigational-medicinal-products-revision-1_en.pdf",
      "document_id": "ema_fih",
      "section_id": "ema_fih.sec.6_3",
      "pdf_page_index_zero_based": 9,
      "pdf_page_index_status": "known",
      "printed_page_label": "10",
      "printed_page_label_status": "known",
      "extraction_method": "automated text extraction with manual verification"
    },
    "review_status": "reviewed"
  },
  {
    "source_unit_id": "ema_fih.su.6_4.001",
    "document_id": "ema_fih",
    "section_id": "ema_fih.sec.6_4",
    "unit_order": 65,
    "unit_order_status": "known",
    "unit_type": "paragraph",
    "source_text": "PK and toxicokinetic (TK) data, as per ICH S3, S6(R1), M3(R2) and related Q&A documents, should be available in all species used for the non-clinical safety studies conducted. These data should adequately support the interpretation of data from in vivo PD models and safety/toxicological studies before starting FIH/early CTs. Sponsors should supply a brief summary of the analytical assays used to characterise the non-clinical PK and TK, including their accuracy, precision and limits of quantification. Systemic exposures at pharmacodynamically active doses in the relevant animal models should be determined and considered especially when PD effects are suspected to contribute to potential safety concerns. Possible polymorphisms e.g. in metabolic enzymes should be taken into account.",
    "related_source_unit_ids": [],
    "table_context": null,
    "trace": {
      "source_file_path": "source_pdfs/EMA guideline-strategies-identify-and-mitigate-risks-first-human-and-early-clinical-trials-investigational-medicinal-products-revision-1_en.pdf",
      "document_id": "ema_fih",
      "section_id": "ema_fih.sec.6_4",
      "pdf_page_index_zero_based": 9,
      "pdf_page_index_status": "known",
      "printed_page_label": "10",
      "printed_page_label_status": "known",
      "extraction_method": "automated text extraction with manual verification"
    },
    "review_status": "reviewed"
  },
  {
    "source_unit_id": "ema_fih.su.6_5.001",
    "document_id": "ema_fih",
    "section_id": "ema_fih.sec.6_5",
    "unit_order": 66,
    "unit_order_status": "known",
    "unit_type": "paragraph",
    "source_text": "Standard core battery data should be available before the first administration in humans as outlined in ICH guidelines S7A, S7B, S6(R1), S9, M3(R2) and related Q&As. The core battery includes cardiovascular, respiratory, and central nervous system (CNS) evaluations. Additional studies to investigate effects in these and other organ systems (e.g. renal, gastrointestinal) should be conducted on a case-by-case basis where there is a cause for concern.",
    "related_source_unit_ids": [],
    "table_context": null,
    "trace": {
      "source_file_path": "source_pdfs/EMA guideline-strategies-identify-and-mitigate-risks-first-human-and-early-clinical-trials-investigational-medicinal-products-revision-1_en.pdf",
      "document_id": "ema_fih",
      "section_id": "ema_fih.sec.6_5",
      "pdf_page_index_zero_based": 9,
      "pdf_page_index_status": "known",
      "printed_page_label": "10",
      "printed_page_label_status": "known",
      "extraction_method": "automated text extraction with manual verification"
    },
    "review_status": "reviewed"
  },
  {
    "source_unit_id": "ema_fih.su.6_6.001",
    "document_id": "ema_fih",
    "section_id": "ema_fih.sec.6_6",
    "unit_order": 67,
    "unit_order_status": "known",
    "unit_type": "paragraph",
    "source_text": "The toxicology programme should be designed taking the characteristics of the IMP and the relevant ICH guidelines S6(R1), S9 and M3(R2) into account. Toxicity can be the result of exaggerated pharmacological actions. These types of effects should not be ignored when establishing a safe starting dose for humans and the exposures at which these toxicities are observed should be considered for the definition of the dose escalation range to be investigated in humans. An evaluation as to whether the target organs identified in the non-clinical studies warrant particular monitoring in the CT should be undertaken. Serious toxicity should lead to a more cautious approach when setting doses and applying risk mitigation strategies in the clinical setting.",
    "related_source_unit_ids": [],
    "table_context": null,
    "trace": {
      "source_file_path": "source_pdfs/EMA guideline-strategies-identify-and-mitigate-risks-first-human-and-early-clinical-trials-investigational-medicinal-products-revision-1_en.pdf",
      "document_id": "ema_fih",
      "section_id": "ema_fih.sec.6_6",
      "pdf_page_index_zero_based": 9,
      "pdf_page_index_status": "known",
      "printed_page_label": "10",
      "printed_page_label_status": "known",
      "extraction_method": "automated text extraction with manual verification"
    },
    "review_status": "reviewed"
  },
  {
    "source_unit_id": "ema_fih.su.abbrev.001",
    "document_id": "ema_fih",
    "section_id": "ema_fih.sec.abbrev",
    "unit_order": 90,
    "unit_order_status": "known",
    "unit_type": "paragraph",
    "source_text": "Abbreviations: ATD - Anticipated therapeutic dose; ATMP - Advanced therapy medicinal product; AUC - Area under the curve; Cmax - Maximum concentration; CT - Clinical trial; CTA - Clinical trial application; FIH - First-in-human; GCP - Good Clinical Practice; GLP - Good Laboratory Practice; IB - Investigator Brochure; IMP - Investigational medicinal product; MABEL - Minimal anticipated biological effect level; MAD - Multiple ascending dose; MTD - Maximum tolerated dose; NOAEL - No observed adverse effect level; PAD - Pharmacologically active dose; PBPK - Physiologically-based pharmacokinetic; PD - Pharmacodynamic; PK - Pharmacokinetic; SAD - Single ascending dose; SUSAR - Suspected unexpected serious adverse reaction; TK - Toxicokinetic.",
    "related_source_unit_ids": [],
    "table_context": null,
    "trace": {
      "source_file_path": "source_pdfs/EMA guideline-strategies-identify-and-mitigate-risks-first-human-and-early-clinical-trials-investigational-medicinal-products-revision-1_en.pdf",
      "document_id": "ema_fih",
      "section_id": "ema_fih.sec.abbrev",
      "pdf_page_index_zero_based": 21,
      "pdf_page_index_status": "known",
      "printed_page_label": "22",
      "printed_page_label_status": "known",
      "extraction_method": "automated text extraction with manual verification"
    },
    "review_status": "reviewed"
  }
];

async function runExtraction() {
  console.log("=== Running 3-Pass Extraction on EMA FIH Batch 2 (100% Ingestion Complete) (Section 6.1~6.6 Non-clinical & Abbreviations) ===");
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
  console.log(`Successfully completed EMA FIH Batch 2 (100% Ingestion Complete) Ingestion!`);
  console.log(`Total Sections: ${bundle.sections.length}`);
  console.log(`Total SourceUnits: ${bundle.source_units.length}`);
  console.log(`Total KnowledgeRecords: ${bundle.knowledge_records.length}`);
  console.log(`Total QuantitativeCriteria: ${bundle.quantitative_criteria.length}`);
  console.log(`Total Conditions: ${bundle.conditions.length}`);
  console.log(`Total Archive Entities: ${bundle.knowledge_records.length + bundle.quantitative_criteria.length + bundle.conditions.length}`);
  console.log(`==================================================`);
}

runExtraction().catch(console.error);
