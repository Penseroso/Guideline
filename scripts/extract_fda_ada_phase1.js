const fs = require("fs");
const path = require("path");
const { createClient } = require("../engine/llm_client");
const { extractSectionSelfConsistent, verifyDraft } = require("../engine/pipeline");
const { validateBundles } = require("../validation/validate_structured_data");

const PDF_SOURCE_PATH =
  "source_pdfs/FDA Immunogenicity Testing of Therapeutic Protein Products —Developing and Validating Assays for Anti-Drug Antibody Detection.pdf";

const DOC_ID = "fda_ada";

const DOCUMENT = {
  document_id: DOC_ID,
  title: "Immunogenicity Testing of Therapeutic Protein Products — Developing and Validating Assays for Anti-Drug Antibody Detection",
  guideline_code: "FDA-2019-ADA",
  document_scope: {
    molecule_scope: ["biotechnology", "therapeutic_protein"],
    study_context_scope: ["preclinical", "clinical", "in_study_validation", "method_validation"],
    assay_technology_scope: ["ada_assay", "immunoassay", "cell_based_bioassay", "elisa", "ecl", "clba", "spr"],
    topic_scope: ["immunogenicity", "cut_point", "neutralizing_antibody", "drug_tolerance", "sensitivity", "multi_tiered_testing"],
    explicit_exclusions: []
  },
  source_file_path: PDF_SOURCE_PATH,
  source_file_sha256: "32bd0579b97b01428a2a22eaffe3e6ee2f3c754d92a0953a7a92c30dbfcbdf25",
  publication_date: "2019-01-01"
};

const SECTIONS = [
  {
    section_id: "fda_ada.sec.4",
    document_id: DOC_ID,
    section_number: "IV",
    section_title: "ASSAY DESIGN ELEMENTS",
    parent_section_id: null,
    heading_source_unit_id: "fda_ada.su.4.001",
    scope: {
      molecule_scope: ["biotechnology", "therapeutic_protein"],
      study_context_scope: ["method_validation"],
      assay_technology_scope: ["ada_assay"],
      topic_scope: ["immunogenicity"],
      explicit_exclusions: []
    }
  },
  {
    section_id: "fda_ada.sec.4_a_1",
    document_id: DOC_ID,
    section_number: "IV.A.1",
    section_title: "Multi-Tiered Testing Approach",
    parent_section_id: "fda_ada.sec.4",
    heading_source_unit_id: "fda_ada.su.4_a_1.001",
    scope: {
      molecule_scope: ["biotechnology", "therapeutic_protein"],
      study_context_scope: ["method_validation", "clinical"],
      assay_technology_scope: ["ada_assay", "screening_assay", "confirmatory_assay", "titration_assay", "neutralization_assay"],
      topic_scope: ["multi_tiered_testing", "screening", "confirmatory", "neutralizing_antibody"],
      explicit_exclusions: []
    }
  },
  {
    section_id: "fda_ada.sec.4_b",
    document_id: DOC_ID,
    section_number: "IV.B",
    section_title: "Assay Cut-Point",
    parent_section_id: "fda_ada.sec.4",
    heading_source_unit_id: "fda_ada.su.4_b.001",
    scope: {
      molecule_scope: ["biotechnology", "therapeutic_protein"],
      study_context_scope: ["method_validation"],
      assay_technology_scope: ["ada_assay"],
      topic_scope: ["cut_point", "pre_existing_antibodies", "outliers"],
      explicit_exclusions: []
    }
  },
  {
    section_id: "fda_ada.sec.4_c_2",
    document_id: DOC_ID,
    section_number: "IV.C.2",
    section_title: "Drug Tolerance, Sensitivity, and Assay Suitability",
    parent_section_id: "fda_ada.sec.4",
    heading_source_unit_id: "fda_ada.su.4_c_2.001",
    scope: {
      molecule_scope: ["biotechnology", "therapeutic_protein"],
      study_context_scope: ["method_validation", "clinical"],
      assay_technology_scope: ["ada_assay"],
      topic_scope: ["drug_tolerance", "sensitivity", "acid_dissociation", "trough_levels"],
      explicit_exclusions: []
    }
  },
  {
    section_id: "fda_ada.sec.5",
    document_id: DOC_ID,
    section_number: "V",
    section_title: "ASSAY DEVELOPMENT",
    parent_section_id: null,
    heading_source_unit_id: "fda_ada.su.5.001",
    scope: {
      molecule_scope: ["biotechnology", "therapeutic_protein"],
      study_context_scope: ["method_validation"],
      assay_technology_scope: ["ada_assay"],
      topic_scope: ["immunogenicity"],
      explicit_exclusions: []
    }
  },
  {
    section_id: "fda_ada.sec.5_d",
    document_id: DOC_ID,
    section_number: "V.D",
    section_title: "Development of Neutralization Assay",
    parent_section_id: "fda_ada.sec.5",
    heading_source_unit_id: "fda_ada.su.5_d.001",
    scope: {
      molecule_scope: ["biotechnology", "therapeutic_protein"],
      study_context_scope: ["method_validation"],
      assay_technology_scope: ["cell_based_bioassay", "clba", "neutralization_assay"],
      topic_scope: ["neutralizing_antibody", "cell_based_vs_non_cell_based", "cut_point"],
      explicit_exclusions: []
    }
  },
  {
    section_id: "fda_ada.sec.6",
    document_id: DOC_ID,
    section_number: "VI",
    section_title: "ASSAY VALIDATION",
    parent_section_id: null,
    heading_source_unit_id: "fda_ada.su.6.001",
    scope: {
      molecule_scope: ["biotechnology", "therapeutic_protein"],
      study_context_scope: ["method_validation"],
      assay_technology_scope: ["ada_assay"],
      topic_scope: ["bioanalytical_validation"],
      explicit_exclusions: []
    }
  },
  {
    section_id: "fda_ada.sec.6_a",
    document_id: DOC_ID,
    section_number: "VI.A",
    section_title: "General Considerations for Assay Validation",
    parent_section_id: "fda_ada.sec.6",
    heading_source_unit_id: "fda_ada.su.6_a.001",
    scope: {
      molecule_scope: ["biotechnology", "therapeutic_protein"],
      study_context_scope: ["method_validation"],
      assay_technology_scope: ["ada_assay"],
      topic_scope: ["bioanalytical_validation", "analysts", "runs", "treatment_naive_samples"],
      explicit_exclusions: []
    }
  },
  {
    section_id: "fda_ada.sec.6_b",
    document_id: DOC_ID,
    section_number: "VI.B",
    section_title: "Validation of Screening Assay",
    parent_section_id: "fda_ada.sec.6",
    heading_source_unit_id: "fda_ada.su.6_b.001",
    scope: {
      molecule_scope: ["biotechnology", "therapeutic_protein"],
      study_context_scope: ["method_validation"],
      assay_technology_scope: ["screening_assay"],
      topic_scope: ["screening_cut_point", "false_positive_rate", "sensitivity", "floating_cut_point"],
      explicit_exclusions: []
    }
  },
  {
    section_id: "fda_ada.sec.6_c",
    document_id: DOC_ID,
    section_number: "VI.C",
    section_title: "Validation of Confirmatory Assay",
    parent_section_id: "fda_ada.sec.6",
    heading_source_unit_id: "fda_ada.su.6_c.001",
    scope: {
      molecule_scope: ["biotechnology", "therapeutic_protein"],
      study_context_scope: ["method_validation"],
      assay_technology_scope: ["confirmatory_assay", "competition_assay"],
      topic_scope: ["confirmatory_cut_point", "false_positive_rate", "percent_inhibition"],
      explicit_exclusions: []
    }
  },
  {
    section_id: "fda_ada.sec.6_e",
    document_id: DOC_ID,
    section_number: "VI.E",
    section_title: "Validation of Neutralization Assay",
    parent_section_id: "fda_ada.sec.6",
    heading_source_unit_id: "fda_ada.su.6_e.001",
    scope: {
      molecule_scope: ["biotechnology", "therapeutic_protein"],
      study_context_scope: ["method_validation"],
      assay_technology_scope: ["cell_based_bioassay", "neutralization_assay"],
      topic_scope: ["neutralizing_antibody", "cut_point", "specificity", "precision"],
      explicit_exclusions: []
    }
  }
];

const SOURCE_UNITS = [
  // IV Headings
  {
    source_unit_id: "fda_ada.su.4.001",
    section_id: "fda_ada.sec.4",
    unit_type: "heading",
    source_text: "IV. ASSAY DESIGN ELEMENTS",
    pdf_page_index_zero_based: 7,
    printed_page_label: "5"
  },
  // IV.A.1
  {
    source_unit_id: "fda_ada.su.4_a_1.001",
    section_id: "fda_ada.sec.4_a_1",
    unit_type: "heading",
    source_text: "1. Multi-Tiered Testing Approach",
    pdf_page_index_zero_based: 7,
    printed_page_label: "5"
  },
  {
    source_unit_id: "fda_ada.su.4_a_1.002",
    section_id: "fda_ada.sec.4_a_1",
    unit_type: "paragraph",
    source_text:
      "FDA recommends a multi-tiered ADA testing approach. In this paradigm, a sensitive screening assay is initially used to assess clinical samples. To gain a more accurate understanding of the natural history of the ADA response, the screening assay should be sensitive and designed to detect low levels of low- and high-affinity ADA; for example, by minimizing wash steps. However, in most cases it is not necessary to empirically determine the affinity of antibodies that are detected by the initial screening assay. Samples testing positive in the screening assay are then subjected to a confirmatory assay to demonstrate that ADAs are specific for the therapeutic protein product. For example, a competition assay could confirm that an antibody is specifically binding to the therapeutic protein product and that the positive finding in the screening assay is not a result of non-specific interactions of the test serum or detection reagent with other materials in the assay milieu such as plastic or other proteins.",
    pdf_page_index_zero_based: 7,
    printed_page_label: "5"
  },
  {
    source_unit_id: "fda_ada.su.4_a_1.003",
    section_id: "fda_ada.sec.4_a_1",
    unit_type: "paragraph",
    source_text:
      "Samples identified as positive in the confirmatory assay should be further characterized in other assays, such as titration and neutralization assays. In some cases, assays to detect cross-reactivity to other proteins, such as the corresponding endogenous protein, may be needed. For example, assessment of cross-reactivity may be needed when the therapeutic protein product belongs to a family of proteins with high homology and it is important to know whether other family members are affected by ADA. Further, in some cases tests to assess the isotype of the antibodies or their epitope specificity may also be recommended once samples containing antibodies are confirmed as positive. Epitope specificity determination of the ADA response is not frequently performed, although it is common to perform a more general assessment of domain specificity for multi-domain products such as pegylated proteins, antibody-drug conjugates, and bispecific antibodies.",
    pdf_page_index_zero_based: 7,
    printed_page_label: "5-6"
  },
  // IV.B
  {
    source_unit_id: "fda_ada.su.4_b.001",
    section_id: "fda_ada.sec.4_b",
    unit_type: "heading",
    source_text: "B. Assay Cut-Point",
    pdf_page_index_zero_based: 9,
    printed_page_label: "7"
  },
  {
    source_unit_id: "fda_ada.su.4_b.002",
    section_id: "fda_ada.sec.4_b",
    unit_type: "paragraph",
    source_text:
      "The cut-point of the assay is the level of response of the assay that defines the sample response as positive or negative. Information specific to establishing the cut-point for the respective assay types is provided in sections V and VI. Establishing the appropriate cut-point is critical to minimizing the risk of false-negative results. The cut-point of the assay can be influenced by a myriad of interfering product or matrix components. These components should be considered early on in assay development when defining the cut-point. Because samples from different target populations and disease states may have components that can cause the background signal from the assay to vary, different cut-points may be needed for discrete populations.",
    pdf_page_index_zero_based: 9,
    printed_page_label: "7"
  },
  {
    source_unit_id: "fda_ada.su.4_b.003",
    section_id: "fda_ada.sec.4_b",
    unit_type: "paragraph",
    source_text:
      "Where feasible, the cut-point should be statistically determined using samples from treatment-naïve subjects. By performing replicate assay runs with these samples, the variability of the assay can be estimated. The statistical approach employed to determine the cut-point may entail various processes, such as removing statistical outliers from analyses, and using an approach to account for pre-existing antibodies. The sponsor should consider the impact of statistically determined outlier values and true-positive samples when establishing the cut-point. The sponsor should provide justification for the removal of any data points, along with the respective method used to determine their status as outliers.",
    pdf_page_index_zero_based: 9,
    printed_page_label: "7"
  },
  {
    source_unit_id: "fda_ada.su.4_b.004",
    section_id: "fda_ada.sec.4_b",
    unit_type: "paragraph",
    source_text:
      "Apparent positive values and samples may derive from the presence of pre-existing antibodies or other serum factors in subject samples. Although pre-existing antibodies to a variety of endogenous proteins are present in healthy individuals, these can be much higher in some disease states. The sponsor should identify those samples with pre-existing antibodies (for example, through competition with drug) and remove them from the cut-point analysis. If subjects in the study have pre-existing antibodies, it may be necessary to assign positive responses using a cut-point based on the difference between individual subject results before and after exposure to identify subjects in whom ADA increases following treatment, also known as treatment-boosted ADA. A common approach to evaluating treatment-boosted ADA responses is to assess changes in antibody titers.",
    pdf_page_index_zero_based: 9,
    printed_page_label: "7-8"
  },
  // IV.C.2
  {
    source_unit_id: "fda_ada.su.4_c_2.001",
    section_id: "fda_ada.sec.4_c_2",
    unit_type: "heading",
    source_text: "2. Drug Tolerance, Sensitivity, and Assay Suitability",
    pdf_page_index_zero_based: 11,
    printed_page_label: "9"
  },
  {
    source_unit_id: "fda_ada.su.4_c_2.002",
    section_id: "fda_ada.sec.4_c_2",
    unit_type: "paragraph",
    source_text:
      "The therapeutic protein product or its endogenous counterpart present in the serum may interfere with the sensitivity of the assay. The assessment of assay sensitivity in the presence of the expected levels of interfering therapeutic protein product, also known as the assay’s drug tolerance, is critical to understanding the sensitivity and suitability of the method for detecting ADA in dosed subjects. FDA recommends that sponsors examine assay drug tolerance early in assay development. The sponsor may examine drug tolerance by deliberately adding different known amounts of positive control antibody into ADA-negative control samples in the absence or presence of different quantities of the therapeutic protein product to determine whether the therapeutic protein product interferes with ADA detection. Results obtained in the absence and presence of different quantities of the therapeutic protein product under consideration should be compared.",
    pdf_page_index_zero_based: 11,
    printed_page_label: "9"
  },
  {
    source_unit_id: "fda_ada.su.4_c_2.003",
    section_id: "fda_ada.sec.4_c_2",
    unit_type: "paragraph",
    source_text:
      "Drug tolerance may be improved using approaches such as acid dissociation that disrupt circulating ADA-drug complexes. The selectivity of the assay, the nature of the target, and the type of positive control should be taken into consideration when developing the assay because these factors impact the assessment of drug tolerance. For example, acid dissociation may not be appropriate when antibodies are acid labile or the drug target is soluble. Interference from the therapeutic protein product can be minimized by collecting subject samples at trough drug levels.",
    pdf_page_index_zero_based: 11,
    printed_page_label: "9"
  },
  // V Headings & V.D
  {
    source_unit_id: "fda_ada.su.5.001",
    section_id: "fda_ada.sec.5",
    unit_type: "heading",
    source_text: "V. ASSAY DEVELOPMENT",
    pdf_page_index_zero_based: 19,
    printed_page_label: "17"
  },
  {
    source_unit_id: "fda_ada.su.5_d.001",
    section_id: "fda_ada.sec.5_d",
    unit_type: "heading",
    source_text: "D. Development of Neutralization Assay",
    pdf_page_index_zero_based: 20,
    printed_page_label: "18"
  },
  {
    source_unit_id: "fda_ada.su.5_d.002",
    section_id: "fda_ada.sec.5_d",
    unit_type: "paragraph",
    source_text:
      "NAb are antibodies that inhibit the specific pharmacologic effect of the therapeutic protein product. Neutralization assays assess the neutralizing potential of antibodies that bind the therapeutic protein product. The neutralizing capacity of antibodies can be assessed using a cell-based bioassay or a non-cell-based competitive ligand-binding assay. Cell-based bioassays are generally preferred over competitive ligand-binding assays for assessing NAb because cell-based bioassays are more likely to reflect the in vivo mechanism of action of the therapeutic protein product. However, non-cell-based competitive ligand-binding assays may be acceptable if cell-based bioassays are not feasible, such as when therapeutic protein products function solely by binding soluble ligands or when a cell-based assay lacks adequate sensitivity or is subject to insurmountable matrix interference.",
    pdf_page_index_zero_based: 20,
    printed_page_label: "18-19"
  },
  {
    source_unit_id: "fda_ada.su.5_d.003",
    section_id: "fda_ada.sec.5_d",
    unit_type: "paragraph",
    source_text:
      "For neutralization assays, an activity curve should be generated to establish the concentration of therapeutic protein product to use in the assay. The selected concentration should fall on the linear portion of the concentration-response curve (for example, EC50 to EC80) to maximize assay sensitivity to detecting neutralizing antibodies. A cut-point for the neutralization assay should be established using statistical methods similar to those for screening and confirmatory assays. Because neutralization assays are used after screening and confirmatory tiers, a 1% false-positive rate is generally recommended for calculating the neutralization cut-point.",
    pdf_page_index_zero_based: 21,
    printed_page_label: "19-21"
  },
  // VI Headings & VI.A
  {
    source_unit_id: "fda_ada.su.6.001",
    section_id: "fda_ada.sec.6",
    unit_type: "heading",
    source_text: "VI. ASSAY VALIDATION",
    pdf_page_index_zero_based: 24,
    printed_page_label: "22"
  },
  {
    source_unit_id: "fda_ada.su.6_a.001",
    section_id: "fda_ada.sec.6_a",
    unit_type: "heading",
    source_text: "A. General Considerations for Assay Validation",
    pdf_page_index_zero_based: 24,
    printed_page_label: "22"
  },
  {
    source_unit_id: "fda_ada.su.6_a.002",
    section_id: "fda_ada.sec.6_a",
    unit_type: "paragraph",
    source_text:
      "Validation of an ADA assay is the process of demonstrating through scientific studies that the performance characteristics of the assay are suitable for its intended purpose. Assay validation should be performed using standard operating procedures that detail assay procedures, reagent specifications, and acceptance criteria. Assay validation typically assesses cut-point, sensitivity, specificity, selectivity, precision, reproducibility, drug tolerance, robustness, and stability. Validation should be conducted with samples from the appropriate target population. For cut-point determination, FDA recommends evaluating at least 50 individual treatment-naïve subject samples across at least 3 different days by at least two analysts, generating at least six independent assay runs.",
    pdf_page_index_zero_based: 24,
    printed_page_label: "22-23"
  },
  // VI.B
  {
    source_unit_id: "fda_ada.su.6_b.001",
    section_id: "fda_ada.sec.6_b",
    unit_type: "heading",
    source_text: "B. Validation of Screening Assay",
    pdf_page_index_zero_based: 26,
    printed_page_label: "24"
  },
  {
    source_unit_id: "fda_ada.su.6_b.002",
    section_id: "fda_ada.sec.6_b",
    unit_type: "paragraph",
    source_text:
      "FDA recommends that screening assays have a sensitivity of at least 100 ng/mL. In some cases, higher sensitivity may be needed (for example, for high-risk products). Assay sensitivity should be determined using a positive control antibody. The screening cut-point should be determined statistically with an appropriate number of treatment-naïve samples, generally around 50, from the subject population. Each sample should be tested by at least two analysts on at least three different days for a total of at least six individual measurements. One approach that allows for high assurance of a 5% false-positive rate is to apply a 90% one-sided lower confidence interval for the 95th percentile of the negative control population. This will assure at least a 5% false-positive rate with a 90% confidence level. For normally distributed data, the 95th percentile is estimated by the mean plus 1.645 standard deviations.",
    pdf_page_index_zero_based: 26,
    printed_page_label: "24"
  },
  {
    source_unit_id: "fda_ada.su.6_b.003",
    section_id: "fda_ada.sec.6_b",
    unit_type: "paragraph",
    source_text:
      "When the mean varies between assays, plates, or analysts but the variance around the mean is constant, a normalization factor can be statistically determined and applied in-study. This is known as a floating cut-point and is the most common type of cut-point used. When the mean is constant, a cut-point established during validation may be applied in-study (known as a fixed cut-point), but the use of a fixed cut-point is discouraged because it does not allow for in-study negative control variation. When both the mean and variance vary, a dynamic cut-point may be needed, although further assay development is recommended instead.",
    pdf_page_index_zero_based: 26,
    printed_page_label: "24"
  },
  // VI.C
  {
    source_unit_id: "fda_ada.su.6_c.001",
    section_id: "fda_ada.sec.6_c",
    unit_type: "heading",
    source_text: "C. Validation of Confirmatory Assay",
    pdf_page_index_zero_based: 26,
    printed_page_label: "24"
  },
  {
    source_unit_id: "fda_ada.su.6_c.002",
    section_id: "fda_ada.sec.6_c",
    unit_type: "paragraph",
    source_text:
      "Confirmatory assays should be fully validated in a manner similar to screening and neutralization assays. If these assays are based on competition for antigen binding by the antibodies in subject samples and the measurement is loss of response, it is critical to identify the degree of inhibition or depletion that will be used to ascribe positivity to a sample. FDA recommends establishing a cut-point based on the assessment of the binding changes observed in negative control samples that are known to lack the antibodies when competing antigen is added. FDA also recommends that the sensitivity of the confirmatory assay be demonstrated using a low concentration of the positive control antibody.",
    pdf_page_index_zero_based: 26,
    printed_page_label: "24-25"
  },
  {
    source_unit_id: "fda_ada.su.6_c.003",
    section_id: "fda_ada.sec.6_c",
    unit_type: "paragraph",
    source_text:
      "One approach for the estimation of the confirmatory assay cut-point is to use an 80% to 90% one-sided lower confidence interval for the 99th percentile. Because the purpose of this assay is to eliminate false-positive samples arising as a result of non-specific binding, it is adequate to use a 1% false-positive rate for the calculation of the confirmatory cut-point. The use of tighter false-positive rates such as 0.1% is not recommended, but may be acceptable for larger studies. The confirmatory assay format is frequently a competition assay in which a competitor, usually an unlabeled therapeutic protein product, is added to the reaction mixture to inhibit ADA binding to the capture reagent. For this assay format, the same concentration of unlabeled therapeutic protein product should be added to the negative control samples when determining the confirmatory cut-point.",
    pdf_page_index_zero_based: 27,
    printed_page_label: "25"
  },
  // VI.E
  {
    source_unit_id: "fda_ada.su.6_e.001",
    section_id: "fda_ada.sec.6_e",
    unit_type: "heading",
    source_text: "E. Validation of Neutralization Assay",
    pdf_page_index_zero_based: 27,
    printed_page_label: "25"
  },
  {
    source_unit_id: "fda_ada.su.6_e.002",
    section_id: "fda_ada.sec.6_e",
    unit_type: "paragraph",
    source_text:
      "A minimum of 30 samples tested on at least 3 different days by at least two analysts should be used to determine the cut-point, using suitable statistical methods. The positive control for neutralization assays can be either monoclonal or affinity purified polyclonal antibodies. Sponsors should validate assay specificity for cell-based neutralization bioassays to demonstrate that NAb only inhibit the response to the therapeutic protein product and not the response to other stimuli. Cell-based neutralization bioassays frequently have reduced precision when compared to ligand binding assays because biologic responses can be inherently more variable. When assay precision is poor, the sponsor may consider performing more replicates for assessment of precision and subject responses.",
    pdf_page_index_zero_based: 27,
    printed_page_label: "25-26"
  }
];

// Enrich SourceUnits with full Trace schema
SOURCE_UNITS.forEach((su, index) => {
  su.unit_order = index + 1;
  su.unit_order_status = "known";
  su.related_source_unit_ids = [];
  su.table_context = null;
  su.review_status = "reviewed";
  su.trace = {
    source_file_path: PDF_SOURCE_PATH,
    document_id: DOC_ID,
    section_id: su.section_id,
    pdf_page_index_zero_based: su.pdf_page_index_zero_based,
    pdf_page_index_status: "known",
    printed_page_label: su.printed_page_label,
    printed_page_label_status: "known",
    extraction_method: "automated text extraction with manual verification"
  };
  delete su.pdf_page_index_zero_based;
  delete su.printed_page_label;
});

async function main() {
  console.log("=== Starting FDA ADA Guidance (2019) Phase 1 Extraction ===");
  const client = createClient();

  const allKrs = [];
  const allQcs = [];
  const allConds = [];

  const targetSectionIds = [
    "fda_ada.sec.4_a_1",
    "fda_ada.sec.4_b",
    "fda_ada.sec.4_c_2",
    "fda_ada.sec.5_d",
    "fda_ada.sec.6_a",
    "fda_ada.sec.6_b",
    "fda_ada.sec.6_c",
    "fda_ada.sec.6_e"
  ];

  for (const secId of targetSectionIds) {
    const secObj = SECTIONS.find((s) => s.section_id === secId);
    const sus = SOURCE_UNITS.filter((su) => su.section_id === secId);
    console.log(`\n--- Extracting ${secObj.section_number}: ${secObj.section_title} (${sus.length} SourceUnits) ---`);

    const result = await extractSectionSelfConsistent({
      section: secObj,
      sourceUnits: sus,
      client,
      passes: 3
    });

    const krs = result.draft.knowledge_records || [];
    const qcs = result.draft.quantitative_criteria || [];
    const conds = result.draft.conditions || [];

    console.log(`Extracted for ${secObj.section_number}:`);
    console.log(`  KnowledgeRecords: ${krs.length} (Reviewed: ${krs.filter((k) => k.review_status === "reviewed").length})`);
    console.log(`  QuantitativeCriteria: ${qcs.length} (Reviewed: ${qcs.filter((q) => q.review_status === "reviewed").length})`);
    console.log(`  Conditions: ${conds.length} (Reviewed: ${conds.filter((c) => c.review_status === "reviewed").length})`);

    allKrs.push(...krs);
    allQcs.push(...qcs);
    allConds.push(...conds);
  }

  // Sanitize KR, QC, Conditions for schema compliance
  for (const kr of allKrs) {
    if (kr.modality === "none") kr.original_modal_text = null;
  }
  const krIdSet = new Set(allKrs.map((k) => k.knowledge_record_id));
  const qcIdSet = new Set(allQcs.map((q) => q.criterion_id));
  for (const c of allConds) {
    c.applies_to_ids = (c.applies_to_ids || []).filter((id) => krIdSet.has(id) || qcIdSet.has(id));
    if (c.condition_type === "exception" && c.applies_to_ids.length === 0) {
      const relKrs = allKrs.filter((kr) => (kr.source_unit_ids || []).includes(c.source_unit_id));
      if (relKrs.length > 0) c.applies_to_ids = [relKrs[0].knowledge_record_id];
      else c.condition_type = "qualification";
    }
  }
  for (const qc of allQcs) {
    if (qc.is_default_with_exception && (!qc.condition_ids || qc.condition_ids.length === 0)) {
      qc.is_default_with_exception = false;
    }
    qc.condition_ids = (qc.condition_ids || []).filter((id) => allConds.some((c) => c.condition_id === id));
    for (const jid of qc.joint_with_ids || []) {
      const target = allQcs.find((t) => t.criterion_id === jid);
      if (target && !target.joint_with_ids.includes(qc.criterion_id)) {
        target.joint_with_ids.push(qc.criterion_id);
      }
    }
  }

  const finalBundle = {
    documents: [DOCUMENT],
    sections: SECTIONS,
    source_units: SOURCE_UNITS,
    knowledge_records: allKrs,
    quantitative_criteria: allQcs,
    conditions: allConds,
    cross_references: []
  };

  const outputPath = path.resolve(__dirname, "..", "data", "pilots", "fda_ada_validation.json");
  fs.writeFileSync(outputPath, JSON.stringify(finalBundle, null, 2), "utf8");
  console.log(`\nSaved FDA ADA pilot bundle to: ${outputPath}`);
}

main().catch((err) => {
  console.error("Extraction failed:", err);
  process.exit(1);
});
