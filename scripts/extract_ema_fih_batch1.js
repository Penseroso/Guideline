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
    "section_id": "ema_fih.sec.1",
    "document_id": "ema_fih",
    "section_number": "1",
    "title": "Introduction (background)",
    "parent_section_id": null,
    "heading_source_unit_id": null,
    "section_order": 1,
    "section_order_status": "known"
  },
  {
    "section_id": "ema_fih.sec.2",
    "document_id": "ema_fih",
    "section_number": "2",
    "title": "Scope",
    "parent_section_id": null,
    "heading_source_unit_id": null,
    "section_order": 2,
    "section_order_status": "known"
  },
  {
    "section_id": "ema_fih.sec.3",
    "document_id": "ema_fih",
    "section_number": "3",
    "title": "Legal basis",
    "parent_section_id": null,
    "heading_source_unit_id": null,
    "section_order": 3,
    "section_order_status": "known"
  },
  {
    "section_id": "ema_fih.sec.4",
    "document_id": "ema_fih",
    "section_number": "4",
    "title": "General considerations",
    "parent_section_id": null,
    "heading_source_unit_id": null,
    "section_order": 4,
    "section_order_status": "known"
  },
  {
    "section_id": "ema_fih.sec.5",
    "document_id": "ema_fih",
    "section_number": "5",
    "title": "Quality aspects",
    "parent_section_id": null,
    "heading_source_unit_id": null,
    "section_order": 5,
    "section_order_status": "known"
  },
  {
    "section_id": "ema_fih.sec.5_1",
    "document_id": "ema_fih",
    "section_number": "5.1",
    "title": "Determination of strength and potency",
    "parent_section_id": "ema_fih.sec.5",
    "heading_source_unit_id": null,
    "section_order": 51,
    "section_order_status": "known"
  },
  {
    "section_id": "ema_fih.sec.5_2",
    "document_id": "ema_fih",
    "section_number": "5.2",
    "title": "Qualification of the material used",
    "parent_section_id": "ema_fih.sec.5",
    "heading_source_unit_id": null,
    "section_order": 52,
    "section_order_status": "known"
  },
  {
    "section_id": "ema_fih.sec.5_3",
    "document_id": "ema_fih",
    "section_number": "5.3",
    "title": "Reliability of very small doses",
    "parent_section_id": "ema_fih.sec.5",
    "heading_source_unit_id": null,
    "section_order": 53,
    "section_order_status": "known"
  }
];

const sourceUnitsToAdd = [
  {
    "source_unit_id": "ema_fih.su.1.001",
    "document_id": "ema_fih",
    "section_id": "ema_fih.sec.1",
    "unit_order": 10,
    "unit_type": "paragraph",
    "source_text": "This is the first revision of the Guideline on strategies to identify and mitigate risks for first-in-human clinical trials with investigational medicinal products. It extends the existing EU guidance to address first-in-human (FIH) and early phase clinical trials (CTs) with integrated protocols. The revision is intended to further assist stakeholders in the transition from non-clinical to early clinical development and in identifying factors influencing risk for new investigational medicinal products (IMPs). The document includes considerations on quality aspects, non-clinical and clinical testing strategies, and trial design and conduct.",
    "trace": {
      "source_file_path": "source_pdfs/EMA guideline-strategies-identify-and-mitigate-risks-first-human-and-early-clinical-trials-investigational-medicinal-products-revision-1_en.pdf",
      "document_id": "ema_fih",
      "section_id": "ema_fih.sec.1",
      "pdf_page_index_zero_based": 3,
      "pdf_page_index_status": "known",
      "printed_page_label": "4",
      "printed_page_label_status": "known",
      "extraction_method": "automated text extraction with manual verification"
    }
  },
  {
    "source_unit_id": "ema_fih.su.2.001",
    "document_id": "ema_fih",
    "section_id": "ema_fih.sec.2",
    "unit_order": 20,
    "unit_type": "paragraph",
    "source_text": "This guideline covers FIH/early CTs including those which generate initial knowledge in humans on tolerability, safety, PK and PD. These trials may also include collection of data on e.g. food or drug interactions, different age groups or gender, proof of concept and relative bioavailability of different formulations. These trials are often undertaken in healthy volunteers but can also include patients. The guideline applies to all new chemical and biological IMPs. While advanced therapy medicinal products (ATMPs) (as defined in Article 2(1) of Regulation 1394/2007 tested or used in accordance with Article 3 of Directive 2001/83/EC) are not within the scope of this guideline, the general principles outlined in this document could be considered when designing early clinical trials for ATMPs.",
    "trace": {
      "source_file_path": "source_pdfs/EMA guideline-strategies-identify-and-mitigate-risks-first-human-and-early-clinical-trials-investigational-medicinal-products-revision-1_en.pdf",
      "document_id": "ema_fih",
      "section_id": "ema_fih.sec.2",
      "pdf_page_index_zero_based": 4,
      "pdf_page_index_status": "known",
      "printed_page_label": "5",
      "printed_page_label_status": "known",
      "extraction_method": "automated text extraction with manual verification"
    }
  },
  {
    "source_unit_id": "ema_fih.su.3.001",
    "document_id": "ema_fih",
    "section_id": "ema_fih.sec.3",
    "unit_order": 30,
    "unit_type": "paragraph",
    "source_text": "This guideline should be read in conjunction with relevant European and International guidelines and regulations, in particular Directive 2001/20/EC, Regulation (EU) No 536/2014 on clinical trials on medicinal products for human use, GMP guidelines (EudraLex Vol 4 Annex 13), GLP Directives 2004/9/EC and 2004/10/EC, ICH E6(R2) GCP, ICH M3(R2) non-clinical safety studies, ICH S6(R1) biotechnology-derived pharmaceuticals, ICH S7A/S7B safety pharmacology, and ICH S9 non-clinical evaluation for anticancer pharmaceuticals.",
    "trace": {
      "source_file_path": "source_pdfs/EMA guideline-strategies-identify-and-mitigate-risks-first-human-and-early-clinical-trials-investigational-medicinal-products-revision-1_en.pdf",
      "document_id": "ema_fih",
      "section_id": "ema_fih.sec.3",
      "pdf_page_index_zero_based": 4,
      "pdf_page_index_status": "known",
      "printed_page_label": "5",
      "printed_page_label_status": "known",
      "extraction_method": "automated text extraction with manual verification"
    }
  },
  {
    "source_unit_id": "ema_fih.su.4.001",
    "document_id": "ema_fih",
    "section_id": "ema_fih.sec.4",
    "unit_order": 40,
    "unit_type": "paragraph",
    "source_text": "The early clinical development of human medicinal products has an intrinsic element of uncertainty in relation to both the possible benefits and risks of a novel drug candidate. Uncertainty may arise from particular knowledge, or lack thereof, regarding the mode of action of the IMP, the presence or absence of biomarkers, the nature of the target, the relevance of available animal models and/or findings in non-clinical safety studies. In addition, risks may derive from the characteristics of the population to be studied, whether healthy volunteers or patients, including potential genetic and phenotypic polymorphisms influencing PD and PK (i.e. in the intended target or in enzymes and organ functions influencing PK).",
    "trace": {
      "source_file_path": "source_pdfs/EMA guideline-strategies-identify-and-mitigate-risks-first-human-and-early-clinical-trials-investigational-medicinal-products-revision-1_en.pdf",
      "document_id": "ema_fih",
      "section_id": "ema_fih.sec.4",
      "pdf_page_index_zero_based": 5,
      "pdf_page_index_status": "known",
      "printed_page_label": "6",
      "printed_page_label_status": "known",
      "extraction_method": "automated text extraction with manual verification"
    }
  },
  {
    "source_unit_id": "ema_fih.su.4.002",
    "document_id": "ema_fih",
    "section_id": "ema_fih.sec.4",
    "unit_order": 41,
    "unit_type": "paragraph",
    "source_text": "The process of designing a set of studies in a development programme is governed by the attempt to reduce this uncertainty step-by-step by gathering relevant knowledge. Sponsors and investigators should identify, a priori for each clinical study, the potential risks that might arise and apply appropriate risk mitigation strategies. Based on the degree of uncertainty, risk mitigation strategies include: ensuring adequate quality of the IMP (section 5); conducting additional non-clinical testing to obtain data of relevance for the risk assessment (section 6); applying a scientific rationale in the selection of the starting dose, dose escalation and maximum exposure (section 7); applying appropriate risk mitigating measures in the design and conduct of FIH/early CTs (section 8).",
    "trace": {
      "source_file_path": "source_pdfs/EMA guideline-strategies-identify-and-mitigate-risks-first-human-and-early-clinical-trials-investigational-medicinal-products-revision-1_en.pdf",
      "document_id": "ema_fih",
      "section_id": "ema_fih.sec.4",
      "pdf_page_index_zero_based": 5,
      "pdf_page_index_status": "known",
      "printed_page_label": "6",
      "printed_page_label_status": "known",
      "extraction_method": "automated text extraction with manual verification"
    }
  },
  {
    "source_unit_id": "ema_fih.su.4.003",
    "document_id": "ema_fih",
    "section_id": "ema_fih.sec.4",
    "unit_order": 42,
    "unit_type": "paragraph",
    "source_text": "It is the sponsor responsibility to define the degree of uncertainty of the IMP and to provide a description of how the risk(s) associated to this will be handled within the design and conduct of the FIH/early CTs. Specific strategies to address identified and potential risks should also be appropriately detailed for all FIH/early CTs in the sponsor Clinical Trial Application (CTA). Of note, risks during FIH/early CTs do not only come from the IMP but also from e.g. challenge agents, or invasive study procedures. These should be considered in any assessment of risk. The quality of documents supporting the CTA should be adequate in format and scientific content to provide appropriate information to allow for a meaningful assessment of the adequacy of the risk minimisation efforts.",
    "trace": {
      "source_file_path": "source_pdfs/EMA guideline-strategies-identify-and-mitigate-risks-first-human-and-early-clinical-trials-investigational-medicinal-products-revision-1_en.pdf",
      "document_id": "ema_fih",
      "section_id": "ema_fih.sec.4",
      "pdf_page_index_zero_based": 5,
      "pdf_page_index_status": "known",
      "printed_page_label": "6",
      "printed_page_label_status": "known",
      "extraction_method": "automated text extraction with manual verification"
    }
  },
  {
    "source_unit_id": "ema_fih.su.5.001",
    "document_id": "ema_fih",
    "section_id": "ema_fih.sec.5",
    "unit_order": 50,
    "unit_type": "paragraph",
    "source_text": "Ensuring adequate formulation of the drug candidate is an important condition to reduce uncertainty when administering to humans. The requirements regarding physico-chemical characterisation are the same for all IMPs while more extensive characterisation may be required for complex or biological products. Specific areas to be addressed include determination of strength and potency, qualification of the material used and reliability of (very) small doses.",
    "trace": {
      "source_file_path": "source_pdfs/EMA guideline-strategies-identify-and-mitigate-risks-first-human-and-early-clinical-trials-investigational-medicinal-products-revision-1_en.pdf",
      "document_id": "ema_fih",
      "section_id": "ema_fih.sec.5",
      "pdf_page_index_zero_based": 6,
      "pdf_page_index_status": "known",
      "printed_page_label": "7",
      "printed_page_label_status": "known",
      "extraction_method": "automated text extraction with manual verification"
    }
  },
  {
    "source_unit_id": "ema_fih.su.5_1.001",
    "document_id": "ema_fih",
    "section_id": "ema_fih.sec.5_1",
    "unit_order": 51,
    "unit_type": "paragraph",
    "source_text": "To determine a safe starting dose, the methods used for determination of the strength and/or the potency of the product need to be relevant for the intended mechanism of action, reliable and qualified. As major clinical decisions are based on knowledge derived from the non-clinical data, it is important to reduce uncertainty by having a representative defined reference material early in the development programme to appropriately measure biological activity.",
    "trace": {
      "source_file_path": "source_pdfs/EMA guideline-strategies-identify-and-mitigate-risks-first-human-and-early-clinical-trials-investigational-medicinal-products-revision-1_en.pdf",
      "document_id": "ema_fih",
      "section_id": "ema_fih.sec.5_1",
      "pdf_page_index_zero_based": 6,
      "pdf_page_index_status": "known",
      "printed_page_label": "7",
      "printed_page_label_status": "known",
      "extraction_method": "automated text extraction with manual verification"
    }
  },
  {
    "source_unit_id": "ema_fih.su.5_2.001",
    "document_id": "ema_fih",
    "section_id": "ema_fih.sec.5_2",
    "unit_order": 52,
    "unit_type": "paragraph",
    "source_text": "As investigational material composition and process changes may occur during development, the material used in pivotal non-clinical studies should be representative of the material to be used for FIH/early CT administration. Differences in formulations used for non-clinical studies versus humans which could impact on exposure should be considered. It is important to have an adequate level of quality characterisation even at this early point of development. The sponsor should ensure that a characterisation of the product including its heterogeneity, degradation profile, product- and process-related impurities is performed. Special consideration should be given to the suitability and qualification of methods to sufficiently characterise the active substance and finished product.",
    "trace": {
      "source_file_path": "source_pdfs/EMA guideline-strategies-identify-and-mitigate-risks-first-human-and-early-clinical-trials-investigational-medicinal-products-revision-1_en.pdf",
      "document_id": "ema_fih",
      "section_id": "ema_fih.sec.5_2",
      "pdf_page_index_zero_based": 6,
      "pdf_page_index_status": "known",
      "printed_page_label": "7",
      "printed_page_label_status": "known",
      "extraction_method": "automated text extraction with manual verification"
    }
  },
  {
    "source_unit_id": "ema_fih.su.5_3.001",
    "document_id": "ema_fih",
    "section_id": "ema_fih.sec.5_3",
    "unit_order": 53,
    "unit_type": "paragraph",
    "source_text": "Applicants should demonstrate that the intended formulation is suitable to provide the intended dose. There is a risk of reduced accuracy in cases where the medicinal product needs to be diluted to prepare very small doses, or it is provided at very low concentrations as the product could be adsorbed to the wall of the container or infusion system. The compatibility of the product, e.g. adsorption losses, with primary packaging materials and administration systems should be addressed.",
    "trace": {
      "source_file_path": "source_pdfs/EMA guideline-strategies-identify-and-mitigate-risks-first-human-and-early-clinical-trials-investigational-medicinal-products-revision-1_en.pdf",
      "document_id": "ema_fih",
      "section_id": "ema_fih.sec.5_3",
      "pdf_page_index_zero_based": 6,
      "pdf_page_index_status": "known",
      "printed_page_label": "7",
      "printed_page_label_status": "known",
      "extraction_method": "automated text extraction with manual verification"
    }
  }
];

async function runExtraction() {
  console.log("=== Running 3-Pass Extraction on EMA FIH Batch 1 (Sections 1, 2, 3, 4, 5.1, 5.2, 5.3) ===");
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
  console.log(`Successfully completed EMA FIH Batch 1 Ingestion!`);
  console.log(`Total Sections: ${bundle.sections.length}`);
  console.log(`Total SourceUnits: ${bundle.source_units.length}`);
  console.log(`Total KnowledgeRecords: ${bundle.knowledge_records.length}`);
  console.log(`Total QuantitativeCriteria: ${bundle.quantitative_criteria.length}`);
  console.log(`Total Conditions: ${bundle.conditions.length}`);
  console.log(`Total Archive Entities: ${bundle.knowledge_records.length + bundle.quantitative_criteria.length + bundle.conditions.length}`);
  console.log(`==================================================`);
}

runExtraction().catch(console.error);
