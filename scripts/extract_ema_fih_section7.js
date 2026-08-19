const fs = require("fs");
const path = require("path");
const { createClient } = require("../engine/llm_client");
const { extractSectionSelfConsistent } = require("../engine/pipeline");
const { validateGuidelineBundle } = require("../validation/validate_structured_data");

const DOCUMENT = {
  document_id: "ema_fih",
  title: "Guideline on strategies to identify and mitigate risks for first-in-human and early clinical trials with investigational medicinal products",
  guideline_code: "EMA/CHMP/SWP/28367/07 Rev. 1",
  issuing_body: "EMA",
  document_version_label: "Revision 1, adopted 20 July 2017",
  source_file_path: "source_pdfs/EMA guideline-strategies-identify-and-mitigate-risks-first-human-and-early-clinical-trials-investigational-medicinal-products-revision-1_en.pdf",
  source_file_checksum: "6D05CACD3B6DA723F15D608DED724B620D76309E275BC6424A229E804411D719",
  schema_model_version: "0.5.0"
};

const SECTIONS = [
  {
    section_id: "ema_fih.sec.7",
    document_id: "ema_fih",
    section_number: "7",
    title: "Dosing selection for FIH and early clinical trials",
    parent_section_id: null,
    section_order: 7,
    section_order_status: "known",
    heading_source_unit_id: "ema_fih.su.7.001"
  },
  {
    section_id: "ema_fih.sec.7_1",
    document_id: "ema_fih",
    section_number: "7.1",
    title: "General aspects",
    parent_section_id: "ema_fih.sec.7",
    section_order: 71,
    section_order_status: "known",
    heading_source_unit_id: "ema_fih.su.7_1.001"
  },
  {
    section_id: "ema_fih.sec.7_2",
    document_id: "ema_fih",
    section_number: "7.2",
    title: "Starting dose for healthy volunteers",
    parent_section_id: "ema_fih.sec.7",
    section_order: 72,
    section_order_status: "known",
    heading_source_unit_id: "ema_fih.su.7_2.001"
  },
  {
    section_id: "ema_fih.sec.7_3",
    document_id: "ema_fih",
    section_number: "7.3",
    title: "Starting Dose for patients",
    parent_section_id: "ema_fih.sec.7",
    section_order: 73,
    section_order_status: "known",
    heading_source_unit_id: "ema_fih.su.7_3.001"
  },
  {
    section_id: "ema_fih.sec.7_4",
    document_id: "ema_fih",
    section_number: "7.4",
    title: "Dose escalation",
    parent_section_id: "ema_fih.sec.7",
    section_order: 74,
    section_order_status: "known",
    heading_source_unit_id: "ema_fih.su.7_4.001"
  },
  {
    section_id: "ema_fih.sec.7_5",
    document_id: "ema_fih",
    section_number: "7.5",
    title: "Maximum exposure and dose",
    parent_section_id: "ema_fih.sec.7",
    section_order: 75,
    section_order_status: "known",
    heading_source_unit_id: "ema_fih.su.7_5.001"
  },
  {
    section_id: "ema_fih.sec.7_6",
    document_id: "ema_fih",
    section_number: "7.6",
    title: "Moving from single to multiple dosing",
    parent_section_id: "ema_fih.sec.7",
    section_order: 76,
    section_order_status: "known",
    heading_source_unit_id: "ema_fih.su.7_6.001"
  },
  {
    section_id: "ema_fih.sec.7_7",
    document_id: "ema_fih",
    section_number: "7.7",
    title: "Route of administration",
    parent_section_id: "ema_fih.sec.7",
    section_order: 77,
    section_order_status: "known",
    heading_source_unit_id: "ema_fih.su.7_7.001"
  }
];

const SOURCE_UNITS = [
  // Sec 7 Heading
  {
    source_unit_id: "ema_fih.su.7.001",
    document_id: "ema_fih",
    section_id: "ema_fih.sec.7",
    unit_type: "heading",
    unit_order: 1,
    unit_order_status: "known",
    source_text: "7. Dosing selection for FIH and early clinical trials",
    related_source_unit_ids: [],
    table_context: null,
    trace: {
      source_file_path: "source_pdfs/EMA guideline-strategies-identify-and-mitigate-risks-first-human-and-early-clinical-trials-investigational-medicinal-products-revision-1_en.pdf",
      document_id: "ema_fih",
      section_id: "ema_fih.sec.7",
      pdf_page_index_zero_based: 10,
      pdf_page_index_status: "known",
      printed_page_label: "11",
      printed_page_label_status: "known",
      extraction_method: "automated text extraction with manual verification"
    },
    review_status: "reviewed"
  },

  // Sec 7.1
  {
    source_unit_id: "ema_fih.su.7_1.001",
    document_id: "ema_fih",
    section_id: "ema_fih.sec.7_1",
    unit_type: "heading",
    unit_order: 1,
    unit_order_status: "known",
    source_text: "7.1. General aspects",
    related_source_unit_ids: [],
    table_context: null,
    trace: {
      source_file_path: "source_pdfs/EMA guideline-strategies-identify-and-mitigate-risks-first-human-and-early-clinical-trials-investigational-medicinal-products-revision-1_en.pdf",
      document_id: "ema_fih",
      section_id: "ema_fih.sec.7_1",
      pdf_page_index_zero_based: 10,
      pdf_page_index_status: "known",
      printed_page_label: "11",
      printed_page_label_status: "known",
      extraction_method: "automated text extraction with manual verification"
    },
    review_status: "reviewed"
  },
  {
    source_unit_id: "ema_fih.su.7_1.002",
    document_id: "ema_fih",
    section_id: "ema_fih.sec.7_1",
    unit_type: "paragraph",
    unit_order: 2,
    unit_order_status: "known",
    source_text: "Careful dosing selection of an IMP is a vital element to safeguard the subjects participating in FIH and early CTs. Special attention should be given to the estimation of the exposure anticipated to be reached at the initial dose to be used in humans and to subsequent dose escalations to a predefined maximum expected exposure. The expected exposure in humans at a dose to be given, in comparison to the exposure at which certain effects were observed in animals or earlier in the study in humans, is considered more relevant than the relative dose levels between animals and humans.",
    related_source_unit_ids: [],
    table_context: null,
    trace: {
      source_file_path: "source_pdfs/EMA guideline-strategies-identify-and-mitigate-risks-first-human-and-early-clinical-trials-investigational-medicinal-products-revision-1_en.pdf",
      document_id: "ema_fih",
      section_id: "ema_fih.sec.7_1",
      pdf_page_index_zero_based: 10,
      pdf_page_index_status: "known",
      printed_page_label: "11",
      printed_page_label_status: "known",
      extraction_method: "automated text extraction with manual verification"
    },
    review_status: "reviewed"
  },
  {
    source_unit_id: "ema_fih.su.7_1.003",
    document_id: "ema_fih",
    section_id: "ema_fih.sec.7_1",
    unit_type: "paragraph",
    unit_order: 3,
    unit_order_status: "known",
    source_text: "All available non-clinical information (PD, PK, TK and toxicological profiles, dose or exposure/effect relationships, etc.) should be taken into consideration for the calculation of the starting dose, dose escalation steps and maximum exposure. Furthermore, clinical data (e.g. PK, PD and reports of adverse events) emerging during the trial from previous dosed cohorts/individuals will also need to be taken into account (see section 8.2.7). Experience, both non-clinical and clinical, with molecules having a similar mode of action can also be useful.",
    related_source_unit_ids: [],
    table_context: null,
    trace: {
      source_file_path: "source_pdfs/EMA guideline-strategies-identify-and-mitigate-risks-first-human-and-early-clinical-trials-investigational-medicinal-products-revision-1_en.pdf",
      document_id: "ema_fih",
      section_id: "ema_fih.sec.7_1",
      pdf_page_index_zero_based: 10,
      pdf_page_index_status: "known",
      printed_page_label: "11",
      printed_page_label_status: "known",
      extraction_method: "automated text extraction with manual verification"
    },
    review_status: "reviewed"
  },
  {
    source_unit_id: "ema_fih.su.7_1.004",
    document_id: "ema_fih",
    section_id: "ema_fih.sec.7_1",
    unit_type: "paragraph",
    unit_order: 4,
    unit_order_status: "known",
    source_text: "The starting dose and a maximum exposure, as well as dose escalation steps during the CT, should be justified and outlined in the protocol. Decision-making criteria for adapting the planned dose escalation steps based on emerging clinical data should also be described in detail. Deviations from the pre-specified dose escalation and decision-making criteria would warrant the submission of (a) substantial amendment(s). Substantial amendments will also be needed where the dose escalation has reached a pre-defined maximum exposure and an integrated analysis of available data leads to the Sponsor’s conclusion that further careful escalation is warranted.",
    related_source_unit_ids: [],
    table_context: null,
    trace: {
      source_file_path: "source_pdfs/EMA guideline-strategies-identify-and-mitigate-risks-first-human-and-early-clinical-trials-investigational-medicinal-products-revision-1_en.pdf",
      document_id: "ema_fih",
      section_id: "ema_fih.sec.7_1",
      pdf_page_index_zero_based: 10,
      pdf_page_index_status: "known",
      printed_page_label: "11",
      printed_page_label_status: "known",
      extraction_method: "automated text extraction with manual verification"
    },
    review_status: "reviewed"
  },
  {
    source_unit_id: "ema_fih.su.7_1.005",
    document_id: "ema_fih",
    section_id: "ema_fih.sec.7_1",
    unit_type: "paragraph",
    unit_order: 5,
    unit_order_status: "known",
    source_text: "The methods used and calculations on how doses and estimated exposure levels were determined, including methods for modelling (e.g. PK/PD and physiologically-based pharmacokinetic (PBPK)) should be included in the protocol and may be summarised in the IB.",
    related_source_unit_ids: [],
    table_context: null,
    trace: {
      source_file_path: "source_pdfs/EMA guideline-strategies-identify-and-mitigate-risks-first-human-and-early-clinical-trials-investigational-medicinal-products-revision-1_en.pdf",
      document_id: "ema_fih",
      section_id: "ema_fih.sec.7_1",
      pdf_page_index_zero_based: 10,
      pdf_page_index_status: "known",
      printed_page_label: "11",
      printed_page_label_status: "known",
      extraction_method: "automated text extraction with manual verification"
    },
    review_status: "reviewed"
  },
  {
    source_unit_id: "ema_fih.su.7_1.006",
    document_id: "ema_fih",
    section_id: "ema_fih.sec.7_1",
    unit_type: "paragraph",
    unit_order: 6,
    unit_order_status: "known",
    source_text: "For starting and maximum doses (exposures) for Exploratory Clinical Trials, reference is made to the ICH M3(R2) guideline. If an IMP has been administered to humans under the paradigm of microdose trials, as outlined in ICH M3(R2), any subsequent study using a non-microdose should be considered within the scope of the present FIH/early CT guideline.",
    related_source_unit_ids: [],
    table_context: null,
    trace: {
      source_file_path: "source_pdfs/EMA guideline-strategies-identify-and-mitigate-risks-first-human-and-early-clinical-trials-investigational-medicinal-products-revision-1_en.pdf",
      document_id: "ema_fih",
      section_id: "ema_fih.sec.7_1",
      pdf_page_index_zero_based: 10,
      pdf_page_index_status: "known",
      printed_page_label: "11",
      printed_page_label_status: "known",
      extraction_method: "automated text extraction with manual verification"
    },
    review_status: "reviewed"
  },

  // Sec 7.2
  {
    source_unit_id: "ema_fih.su.7_2.001",
    document_id: "ema_fih",
    section_id: "ema_fih.sec.7_2",
    unit_type: "heading",
    unit_order: 1,
    unit_order_status: "known",
    source_text: "7.2. Starting dose for healthy volunteers",
    related_source_unit_ids: [],
    table_context: null,
    trace: {
      source_file_path: "source_pdfs/EMA guideline-strategies-identify-and-mitigate-risks-first-human-and-early-clinical-trials-investigational-medicinal-products-revision-1_en.pdf",
      document_id: "ema_fih",
      section_id: "ema_fih.sec.7_2",
      pdf_page_index_zero_based: 10,
      pdf_page_index_status: "known",
      printed_page_label: "11",
      printed_page_label_status: "known",
      extraction_method: "automated text extraction with manual verification"
    },
    review_status: "reviewed"
  },
  {
    source_unit_id: "ema_fih.su.7_2.002",
    document_id: "ema_fih",
    section_id: "ema_fih.sec.7_2",
    unit_type: "paragraph",
    unit_order: 2,
    unit_order_status: "known",
    source_text: "In general, the no observed adverse effect level (NOAEL) should be determined in the non-clinical safety studies performed. The NOAEL is a generally accepted benchmark for safety when derived from appropriate animal studies and can serve as the starting point for determining a reasonably safe starting dose. The exposures achieved at the NOAEL in the most relevant animal species used (which might not necessarily be the most sensitive species) should be used for estimation of an equivalent exposure for humans. Estimation should be based on state-of-the-art modelling (e.g. PK/PD and PBPK) and/or using allometric factors.",
    related_source_unit_ids: [],
    table_context: null,
    trace: {
      source_file_path: "source_pdfs/EMA guideline-strategies-identify-and-mitigate-risks-first-human-and-early-clinical-trials-investigational-medicinal-products-revision-1_en.pdf",
      document_id: "ema_fih",
      section_id: "ema_fih.sec.7_2",
      pdf_page_index_zero_based: 10,
      pdf_page_index_status: "known",
      printed_page_label: "11",
      printed_page_label_status: "known",
      extraction_method: "automated text extraction with manual verification"
    },
    review_status: "reviewed"
  },
  {
    source_unit_id: "ema_fih.su.7_2.003",
    document_id: "ema_fih",
    section_id: "ema_fih.sec.7_2",
    unit_type: "paragraph",
    unit_order: 3,
    unit_order_status: "known",
    source_text: "Exposure showing PD effects in the non-clinical pharmacology studies, including ex vivo and in vitro studies in human tissues if feasible, should also be determined and these data should be used to determine the minimal anticipated biological effect level (MABEL) in humans and an estimation of the pharmacologically active dose (PAD) and/or anticipated therapeutic dose range (ATD) in humans. When using these approaches, potential differences in sensitivity for the mode of action of the IMP between humans and animals need to be taken into consideration. In addition, the calculation of the MABEL, PAD and/or ATD should consider target binding and receptor occupancy studies in vitro in target cells from human and the relevant animal species and exposures at pharmacological doses in the relevant animal species. Whenever possible, all relevant data should be integrated in a suitable modelling approach for the determination of the MABEL, PAD and/or ATD.",
    related_source_unit_ids: [],
    table_context: null,
    trace: {
      source_file_path: "source_pdfs/EMA guideline-strategies-identify-and-mitigate-risks-first-human-and-early-clinical-trials-investigational-medicinal-products-revision-1_en.pdf",
      document_id: "ema_fih",
      section_id: "ema_fih.sec.7_2",
      pdf_page_index_zero_based: 10,
      pdf_page_index_status: "known",
      printed_page_label: "11",
      printed_page_label_status: "known",
      extraction_method: "automated text extraction with manual verification"
    },
    review_status: "reviewed"
  },
  {
    source_unit_id: "ema_fih.su.7_2.004",
    document_id: "ema_fih",
    section_id: "ema_fih.sec.7_2",
    unit_type: "paragraph",
    unit_order: 4,
    unit_order_status: "known",
    source_text: "The starting dose for healthy volunteers should be a dose expected to result in an exposure lower than the PAD, unless a robust scientific rationale can be provided for a higher dose. Depending on the level of uncertainty regarding the human relevance of findings observed in nonclinical studies (see sections 4.1 to 4.4) and the knowledge of the intended target (see sections 6.1 and 6.2), the starting dose should either be related to the MABEL, PAD or NOAEL. A scientific rationale for the starting dose should be included in the protocol and may be included in the IB.",
    related_source_unit_ids: [],
    table_context: null,
    trace: {
      source_file_path: "source_pdfs/EMA guideline-strategies-identify-and-mitigate-risks-first-human-and-early-clinical-trials-investigational-medicinal-products-revision-1_en.pdf",
      document_id: "ema_fih",
      section_id: "ema_fih.sec.7_2",
      pdf_page_index_zero_based: 11,
      pdf_page_index_status: "known",
      printed_page_label: "12",
      printed_page_label_status: "known",
      extraction_method: "automated text extraction with manual verification"
    },
    review_status: "reviewed"
  },
  {
    source_unit_id: "ema_fih.su.7_2.005",
    document_id: "ema_fih",
    section_id: "ema_fih.sec.7_2",
    unit_type: "paragraph",
    unit_order: 5,
    unit_order_status: "known",
    source_text: "In order to further limit the potential for adverse reactions in humans, safety factors are generally applied in the calculation of the starting dose in humans. Safety factors should take into account potential risks related to: the novelty of the active substance; its pharmacodynamic characteristics, including irreversible or long lasting findings and the shape of the dose-response curve; the relevance of the animal models used for safety testing; the characteristics of the safety findings; uncertainties related to the estimation of the MABEL, PAD and the expected exposure in humans.",
    related_source_unit_ids: [],
    table_context: null,
    trace: {
      source_file_path: "source_pdfs/EMA guideline-strategies-identify-and-mitigate-risks-first-human-and-early-clinical-trials-investigational-medicinal-products-revision-1_en.pdf",
      document_id: "ema_fih",
      section_id: "ema_fih.sec.7_2",
      pdf_page_index_zero_based: 11,
      pdf_page_index_status: "known",
      printed_page_label: "12",
      printed_page_label_status: "known",
      extraction_method: "automated text extraction with manual verification"
    },
    review_status: "reviewed"
  },
  {
    source_unit_id: "ema_fih.su.7_2.006",
    document_id: "ema_fih",
    section_id: "ema_fih.sec.7_2",
    unit_type: "paragraph",
    unit_order: 6,
    unit_order_status: "known",
    source_text: "Furthermore, findings in the non-clinical studies and how well potential target organ effects can be monitored in the CT should also be addressed and may influence the safety factors used. The reasoning behind the safety factors used should be detailed in the IB and protocol.",
    related_source_unit_ids: [],
    table_context: null,
    trace: {
      source_file_path: "source_pdfs/EMA guideline-strategies-identify-and-mitigate-risks-first-human-and-early-clinical-trials-investigational-medicinal-products-revision-1_en.pdf",
      document_id: "ema_fih",
      section_id: "ema_fih.sec.7_2",
      pdf_page_index_zero_based: 11,
      pdf_page_index_status: "known",
      printed_page_label: "12",
      printed_page_label_status: "known",
      extraction_method: "automated text extraction with manual verification"
    },
    review_status: "reviewed"
  },

  // Sec 7.3
  {
    source_unit_id: "ema_fih.su.7_3.001",
    document_id: "ema_fih",
    section_id: "ema_fih.sec.7_3",
    unit_type: "heading",
    unit_order: 1,
    unit_order_status: "known",
    source_text: "7.3. Starting Dose for patients",
    related_source_unit_ids: [],
    table_context: null,
    trace: {
      source_file_path: "source_pdfs/EMA guideline-strategies-identify-and-mitigate-risks-first-human-and-early-clinical-trials-investigational-medicinal-products-revision-1_en.pdf",
      document_id: "ema_fih",
      section_id: "ema_fih.sec.7_3",
      pdf_page_index_zero_based: 11,
      pdf_page_index_status: "known",
      printed_page_label: "12",
      printed_page_label_status: "known",
      extraction_method: "automated text extraction with manual verification"
    },
    review_status: "reviewed"
  },
  {
    source_unit_id: "ema_fih.su.7_3.002",
    document_id: "ema_fih",
    section_id: "ema_fih.sec.7_3",
    unit_type: "paragraph",
    unit_order: 2,
    unit_order_status: "known",
    source_text: "Similar considerations as outlined in section 7.2 apply for the identification of a safe starting dose in patients. The goal of selecting the starting dose for FIH/early CTs in patients, i.e. where there are no previous data in healthy volunteers, is to identify a dose that is expected to have a minimal pharmacological effect and is safe to use. The starting dose should also take into account the nature of disease under investigation and its severity in the patient population included in the CT. In some instances, a starting dose that is substantially lower than the human expected pharmacological dose may not be appropriate. In all cases, a rationale should be provided and the subjects included in the CT should be informed.",
    related_source_unit_ids: [],
    table_context: null,
    trace: {
      source_file_path: "source_pdfs/EMA guideline-strategies-identify-and-mitigate-risks-first-human-and-early-clinical-trials-investigational-medicinal-products-revision-1_en.pdf",
      document_id: "ema_fih",
      section_id: "ema_fih.sec.7_3",
      pdf_page_index_zero_based: 11,
      pdf_page_index_status: "known",
      printed_page_label: "12",
      printed_page_label_status: "known",
      extraction_method: "automated text extraction with manual verification"
    },
    review_status: "reviewed"
  },
  {
    source_unit_id: "ema_fih.su.7_3.003",
    document_id: "ema_fih",
    section_id: "ema_fih.sec.7_3",
    unit_type: "paragraph",
    unit_order: 3,
    unit_order_status: "known",
    source_text: "If potential differences in target distribution, pharmacokinetics or safety profile of the IMP between healthy volunteers and patients can be foreseen, consideration should be given to reverting to a SAD design (with dose escalation as appropriate) in the first patient cohort.",
    related_source_unit_ids: [],
    table_context: null,
    trace: {
      source_file_path: "source_pdfs/EMA guideline-strategies-identify-and-mitigate-risks-first-human-and-early-clinical-trials-investigational-medicinal-products-revision-1_en.pdf",
      document_id: "ema_fih",
      section_id: "ema_fih.sec.7_3",
      pdf_page_index_zero_based: 11,
      pdf_page_index_status: "known",
      printed_page_label: "12",
      printed_page_label_status: "known",
      extraction_method: "automated text extraction with manual verification"
    },
    review_status: "reviewed"
  },
  {
    source_unit_id: "ema_fih.su.7_3.004",
    document_id: "ema_fih",
    section_id: "ema_fih.sec.7_3",
    unit_type: "paragraph",
    unit_order: 4,
    unit_order_status: "known",
    source_text: "Other approaches may also be considered in specific situations, e.g. for studies in oncology patients (see ICH S9) or other severe or life-limiting diseases. In general, the highest dose or exposure tested in the non-clinical studies may not limit the dose-escalation or highest dose investigated in a CT in patients with advanced cancer or life-limiting diseases if appropriately justified.",
    related_source_unit_ids: [],
    table_context: null,
    trace: {
      source_file_path: "source_pdfs/EMA guideline-strategies-identify-and-mitigate-risks-first-human-and-early-clinical-trials-investigational-medicinal-products-revision-1_en.pdf",
      document_id: "ema_fih",
      section_id: "ema_fih.sec.7_3",
      pdf_page_index_zero_based: 11,
      pdf_page_index_status: "known",
      printed_page_label: "12",
      printed_page_label_status: "known",
      extraction_method: "automated text extraction with manual verification"
    },
    review_status: "reviewed"
  },
  {
    source_unit_id: "ema_fih.su.7_3.005",
    document_id: "ema_fih",
    section_id: "ema_fih.sec.7_3",
    unit_type: "paragraph",
    unit_order: 5,
    unit_order_status: "known",
    source_text: "Special populations, such as paediatrics (see ICH E11), deserve additional specific considerations.",
    related_source_unit_ids: [],
    table_context: null,
    trace: {
      source_file_path: "source_pdfs/EMA guideline-strategies-identify-and-mitigate-risks-first-human-and-early-clinical-trials-investigational-medicinal-products-revision-1_en.pdf",
      document_id: "ema_fih",
      section_id: "ema_fih.sec.7_3",
      pdf_page_index_zero_based: 11,
      pdf_page_index_status: "known",
      printed_page_label: "12",
      printed_page_label_status: "known",
      extraction_method: "automated text extraction with manual verification"
    },
    review_status: "reviewed"
  },

  // Sec 7.4
  {
    source_unit_id: "ema_fih.su.7_4.001",
    document_id: "ema_fih",
    section_id: "ema_fih.sec.7_4",
    unit_type: "heading",
    unit_order: 1,
    unit_order_status: "known",
    source_text: "7.4. Dose escalation",
    related_source_unit_ids: [],
    table_context: null,
    trace: {
      source_file_path: "source_pdfs/EMA guideline-strategies-identify-and-mitigate-risks-first-human-and-early-clinical-trials-investigational-medicinal-products-revision-1_en.pdf",
      document_id: "ema_fih",
      section_id: "ema_fih.sec.7_4",
      pdf_page_index_zero_based: 12,
      pdf_page_index_status: "known",
      printed_page_label: "13",
      printed_page_label_status: "known",
      extraction_method: "automated text extraction with manual verification"
    },
    review_status: "reviewed"
  },
  {
    source_unit_id: "ema_fih.su.7_4.002",
    document_id: "ema_fih",
    section_id: "ema_fih.sec.7_4",
    unit_type: "paragraph",
    unit_order: 2,
    unit_order_status: "known",
    source_text: "In addition to defining a starting dose and a maximum exposure (see sections 7.5 and 8.2.10), criteria for dose increases during a CT should be outlined in the protocol (see section 8.2.9). The maximum fold increase in dose/exposure from one cohort to the next, as well as a maximum number of cohorts to be evaluated, should be stated. The choice of the dose levels should include an estimate of exposure levels to be achieved, potential adverse effects (if any), and if relevant and feasible, an estimate of potential PD effects. The calculated PAD/ATD should also be taken into account. The dose increment between two dose levels should be guided by the dose/exposure-toxicity or the dose/exposure-effect relationship defined in the non-clinical studies and adapted following review of emerging clinical data from previous cohorts (see sections 8.2.7 and 8.2.9). The size of the dose increments should take into account the steepness of the dose/exposure-toxicity or dose/exposure-effect curves and uncertainties in the estimation of these relationships. Another factor for consideration is the reliability with which potential adverse effects can be monitored in humans before potential serious/irreversible effects develop. Furthermore, if there is evidence of non-linear PK potentially resulting in a supra-proportional increases in exposure, smaller dose increments, particularly in the later parts of SAD/MAD, should be considered. If emerging clinical data reveal substantial differences from non-clinical or modelling and simulation data, adjustment of the planned dose levels may be warranted. A change of the planned dose levels should take aspects such as steepness of dose-response curve or saturation of target into account. If available data indicate a plateauing of exposure, this should be taken into account when deciding on dose escalation steps (and frequency of dosing in MAD parts). Changes in dose levels may require a substantial amendment unless such changes are covered by predefined decision criteria in the protocol.",
    related_source_unit_ids: [],
    table_context: null,
    trace: {
      source_file_path: "source_pdfs/EMA guideline-strategies-identify-and-mitigate-risks-first-human-and-early-clinical-trials-investigational-medicinal-products-revision-1_en.pdf",
      document_id: "ema_fih",
      section_id: "ema_fih.sec.7_4",
      pdf_page_index_zero_based: 12,
      pdf_page_index_status: "known",
      printed_page_label: "13",
      printed_page_label_status: "known",
      extraction_method: "automated text extraction with manual verification"
    },
    review_status: "reviewed"
  },

  // Sec 7.5
  {
    source_unit_id: "ema_fih.su.7_5.001",
    document_id: "ema_fih",
    section_id: "ema_fih.sec.7_5",
    unit_type: "heading",
    unit_order: 1,
    unit_order_status: "known",
    source_text: "7.5. Maximum exposure and dose",
    related_source_unit_ids: [],
    table_context: null,
    trace: {
      source_file_path: "source_pdfs/EMA guideline-strategies-identify-and-mitigate-risks-first-human-and-early-clinical-trials-investigational-medicinal-products-revision-1_en.pdf",
      document_id: "ema_fih",
      section_id: "ema_fih.sec.7_5",
      pdf_page_index_zero_based: 12,
      pdf_page_index_status: "known",
      printed_page_label: "13",
      printed_page_label_status: "known",
      extraction_method: "automated text extraction with manual verification"
    },
    review_status: "reviewed"
  },
  {
    source_unit_id: "ema_fih.su.7_5.002",
    document_id: "ema_fih",
    section_id: "ema_fih.sec.7_5",
    unit_type: "paragraph",
    unit_order: 2,
    unit_order_status: "known",
    source_text: "An expected maximum exposure level, which should not be exceeded in the study without approval of a substantial amendment, should be pre-defined in the protocol for each study part. The maximum exposure should be justified based on all available non-clinical and clinical data, including PD, PK, findings in toxicity studies and exposure at the expected therapeutic dose range. Target saturation should be taken into account when appropriate, then the maximum exposure should consider when complete inhibition or activation of the target is achieved and no further therapeutic effect is to be expected by increasing the dose.",
    related_source_unit_ids: [],
    table_context: null,
    trace: {
      source_file_path: "source_pdfs/EMA guideline-strategies-identify-and-mitigate-risks-first-human-and-early-clinical-trials-investigational-medicinal-products-revision-1_en.pdf",
      document_id: "ema_fih",
      section_id: "ema_fih.sec.7_5",
      pdf_page_index_zero_based: 12,
      pdf_page_index_status: "known",
      printed_page_label: "13",
      printed_page_label_status: "known",
      extraction_method: "automated text extraction with manual verification"
    },
    review_status: "reviewed"
  },
  {
    source_unit_id: "ema_fih.su.7_5.003",
    document_id: "ema_fih",
    section_id: "ema_fih.sec.7_5",
    unit_type: "paragraph",
    unit_order: 3,
    unit_order_status: "known",
    source_text: "The use of a maximum dose can in some instances be warranted, e.g. in studies where exposure cannot be adequately measured.",
    related_source_unit_ids: [],
    table_context: null,
    trace: {
      source_file_path: "source_pdfs/EMA guideline-strategies-identify-and-mitigate-risks-first-human-and-early-clinical-trials-investigational-medicinal-products-revision-1_en.pdf",
      document_id: "ema_fih",
      section_id: "ema_fih.sec.7_5",
      pdf_page_index_zero_based: 12,
      pdf_page_index_status: "known",
      printed_page_label: "13",
      printed_page_label_status: "known",
      extraction_method: "automated text extraction with manual verification"
    },
    review_status: "reviewed"
  },
  {
    source_unit_id: "ema_fih.su.7_5.004",
    document_id: "ema_fih",
    section_id: "ema_fih.sec.7_5",
    unit_type: "paragraph",
    unit_order: 4,
    unit_order_status: "known",
    source_text: "In general, the maximum exposure of healthy volunteers should be within the estimated human pharmacodynamic dose range. However, exposure levels exceeding the pharmacodynamic dose range can, if scientifically justified and considered acceptable from a safety perspective, be carefully explored, taking into consideration the uncertainty as outlined in section 4.",
    related_source_unit_ids: [],
    table_context: null,
    trace: {
      source_file_path: "source_pdfs/EMA guideline-strategies-identify-and-mitigate-risks-first-human-and-early-clinical-trials-investigational-medicinal-products-revision-1_en.pdf",
      document_id: "ema_fih",
      section_id: "ema_fih.sec.7_5",
      pdf_page_index_zero_based: 12,
      pdf_page_index_status: "known",
      printed_page_label: "13",
      printed_page_label_status: "known",
      extraction_method: "automated text extraction with manual verification"
    },
    review_status: "reviewed"
  },
  {
    source_unit_id: "ema_fih.su.7_5.005",
    document_id: "ema_fih",
    section_id: "ema_fih.sec.7_5",
    unit_type: "paragraph",
    unit_order: 5,
    unit_order_status: "known",
    source_text: "For trials or trial parts that include patients, the maximum tolerated dose (MTD) (if applicable) should be clearly defined and not be exceeded once it has been determined. The potential therapeutic/clinically relevant dose (exposure) and the expected benefit/risk balance should always be considered when defining the dose range. A trial design using a MTD approach is considered to be inappropriate for healthy volunteers.",
    related_source_unit_ids: [],
    table_context: null,
    trace: {
      source_file_path: "source_pdfs/EMA guideline-strategies-identify-and-mitigate-risks-first-human-and-early-clinical-trials-investigational-medicinal-products-revision-1_en.pdf",
      document_id: "ema_fih",
      section_id: "ema_fih.sec.7_5",
      pdf_page_index_zero_based: 12,
      pdf_page_index_status: "known",
      printed_page_label: "13",
      printed_page_label_status: "known",
      extraction_method: "automated text extraction with manual verification"
    },
    review_status: "reviewed"
  },

  // Sec 7.6
  {
    source_unit_id: "ema_fih.su.7_6.001",
    document_id: "ema_fih",
    section_id: "ema_fih.sec.7_6",
    unit_type: "heading",
    unit_order: 1,
    unit_order_status: "known",
    source_text: "7.6. Moving from single to multiple dosing",
    related_source_unit_ids: [],
    table_context: null,
    trace: {
      source_file_path: "source_pdfs/EMA guideline-strategies-identify-and-mitigate-risks-first-human-and-early-clinical-trials-investigational-medicinal-products-revision-1_en.pdf",
      document_id: "ema_fih",
      section_id: "ema_fih.sec.7_6",
      pdf_page_index_zero_based: 13,
      pdf_page_index_status: "known",
      printed_page_label: "14",
      printed_page_label_status: "known",
      extraction_method: "automated text extraction with manual verification"
    },
    review_status: "reviewed"
  },
  {
    source_unit_id: "ema_fih.su.7_6.002",
    document_id: "ema_fih",
    section_id: "ema_fih.sec.7_6",
    unit_type: "paragraph",
    unit_order: 2,
    unit_order_status: "known",
    source_text: "The selection of an appropriate dosing interval and duration of dosing for all multiple dosing cohorts and study parts should take into account the specific PK and PD characteristics of the IMP, the available non-clinical safety data, and all data from subjects in previous single dose cohorts. Particular attention should be paid to linear versus non-linear PK in the expected concentration range, the PK half-life versus duration of action, and the potential for accumulation.",
    related_source_unit_ids: [],
    table_context: null,
    trace: {
      source_file_path: "source_pdfs/EMA guideline-strategies-identify-and-mitigate-risks-first-human-and-early-clinical-trials-investigational-medicinal-products-revision-1_en.pdf",
      document_id: "ema_fih",
      section_id: "ema_fih.sec.7_6",
      pdf_page_index_zero_based: 13,
      pdf_page_index_status: "known",
      printed_page_label: "14",
      printed_page_label_status: "known",
      extraction_method: "automated text extraction with manual verification"
    },
    review_status: "reviewed"
  },
  {
    source_unit_id: "ema_fih.su.7_6.003",
    document_id: "ema_fih",
    section_id: "ema_fih.sec.7_6",
    unit_type: "paragraph",
    unit_order: 3,
    unit_order_status: "known",
    source_text: "A maximum duration of dosing should be stated in the protocol for every cohort. The expected exposure after multiple dosing (Cmax and AUC0-tau) should have been covered during preceding SAD parts/trials. If, however, emerging clinical data following multiple dosing suggests tolerance to adverse effects seen in a SAD part of a study, higher exposures in a MAD part can be considered, provided this option is pre-specified and below the set maximum exposure. Multiple dosing parts can also explore different dosing regimens and schedules, such as a move from once daily dosing to twice daily dosing.",
    related_source_unit_ids: [],
    table_context: null,
    trace: {
      source_file_path: "source_pdfs/EMA guideline-strategies-identify-and-mitigate-risks-first-human-and-early-clinical-trials-investigational-medicinal-products-revision-1_en.pdf",
      document_id: "ema_fih",
      section_id: "ema_fih.sec.7_6",
      pdf_page_index_zero_based: 13,
      pdf_page_index_status: "known",
      printed_page_label: "14",
      printed_page_label_status: "known",
      extraction_method: "automated text extraction with manual verification"
    },
    review_status: "reviewed"
  },

  // Sec 7.7
  {
    source_unit_id: "ema_fih.su.7_7.001",
    document_id: "ema_fih",
    section_id: "ema_fih.sec.7_7",
    unit_type: "heading",
    unit_order: 1,
    unit_order_status: "known",
    source_text: "7.7. Route of administration",
    related_source_unit_ids: [],
    table_context: null,
    trace: {
      source_file_path: "source_pdfs/EMA guideline-strategies-identify-and-mitigate-risks-first-human-and-early-clinical-trials-investigational-medicinal-products-revision-1_en.pdf",
      document_id: "ema_fih",
      section_id: "ema_fih.sec.7_7",
      pdf_page_index_zero_based: 13,
      pdf_page_index_status: "known",
      printed_page_label: "14",
      printed_page_label_status: "known",
      extraction_method: "automated text extraction with manual verification"
    },
    review_status: "reviewed"
  },
  {
    source_unit_id: "ema_fih.su.7_7.002",
    document_id: "ema_fih",
    section_id: "ema_fih.sec.7_7",
    unit_type: "paragraph",
    unit_order: 2,
    unit_order_status: "known",
    source_text: "The choice of route of administration for dosing in humans should be based on the non-clinical data, the characteristics of the IMP, and the intended therapeutic use.",
    related_source_unit_ids: [],
    table_context: null,
    trace: {
      source_file_path: "source_pdfs/EMA guideline-strategies-identify-and-mitigate-risks-first-human-and-early-clinical-trials-investigational-medicinal-products-revision-1_en.pdf",
      document_id: "ema_fih",
      section_id: "ema_fih.sec.7_7",
      pdf_page_index_zero_based: 13,
      pdf_page_index_status: "known",
      printed_page_label: "14",
      printed_page_label_status: "known",
      extraction_method: "automated text extraction with manual verification"
    },
    review_status: "reviewed"
  },
  {
    source_unit_id: "ema_fih.su.7_7.003",
    document_id: "ema_fih",
    section_id: "ema_fih.sec.7_7",
    unit_type: "paragraph",
    unit_order: 3,
    unit_order_status: "known",
    source_text: "In the case of an intravenous administration, a slow infusion may be more appropriate than a bolus injection. This would allow for a timely discontinuation of the infusion to mitigate an adverse outcome.",
    related_source_unit_ids: [],
    table_context: null,
    trace: {
      source_file_path: "source_pdfs/EMA guideline-strategies-identify-and-mitigate-risks-first-human-and-early-clinical-trials-investigational-medicinal-products-revision-1_en.pdf",
      document_id: "ema_fih",
      section_id: "ema_fih.sec.7_7",
      pdf_page_index_zero_based: 13,
      pdf_page_index_status: "known",
      printed_page_label: "14",
      printed_page_label_status: "known",
      extraction_method: "automated text extraction with manual verification"
    },
    review_status: "reviewed"
  }
];

async function main() {
  console.log("=== Starting EMA FIH Section 7 Self-Consistency Extraction ===");
  const client = createClient();
  console.log(`Using LLM client provider: ${client.provider}`);

  const allKRs = [];
  const allQCs = [];
  const allConditions = [];

  const targetSubsections = SECTIONS.filter((s) => s.section_id !== "ema_fih.sec.7");

  for (const sec of targetSubsections) {
    const secUnits = SOURCE_UNITS.filter((su) => su.section_id === sec.section_id);
    console.log(`\n--- Extracting ${sec.section_number}: ${sec.title} (${secUnits.length} SourceUnits) ---`);

    const result = await extractSectionSelfConsistent({
      section: sec,
      sourceUnits: secUnits,
      client,
      passes: 3
    });

    const krs = result.draft.knowledge_records;
    const qcs = result.draft.quantitative_criteria;
    const conds = result.draft.conditions;

    console.log(`Extracted for ${sec.section_number}:`);
    console.log(`  KnowledgeRecords: ${krs.length} (Reviewed: ${krs.filter(r => r.review_status === "reviewed").length})`);
    console.log(`  QuantitativeCriteria: ${qcs.length} (Reviewed: ${qcs.filter(r => r.review_status === "reviewed").length})`);
    console.log(`  Conditions: ${conds.length} (Reviewed: ${conds.filter(r => r.review_status === "reviewed").length})`);

    allKRs.push(...krs);
    allQCs.push(...qcs);
    allConditions.push(...conds);
  }

  const bundle = {
    documents: [DOCUMENT],
    sections: SECTIONS,
    source_units: SOURCE_UNITS,
    knowledge_records: allKRs,
    quantitative_criteria: allQCs,
    conditions: allConditions,
    cross_references: []
  };

  const outputPath = path.resolve(__dirname, "..", "data", "pilots", "ema_fih_dosing.json");
  fs.writeFileSync(outputPath, JSON.stringify(bundle, null, 2), "utf8");
  console.log(`\nSaved bundle to: ${outputPath}`);

  console.log("\nRunning validation on the generated bundle...");
  const validation = validateGuidelineBundle(bundle);
  console.log("Validation pass:", validation.pass);
  if (!validation.pass) {
    console.error("Validation errors:", JSON.stringify(validation.errors, null, 2));
    process.exit(1);
  }
  console.log("=== Extraction & Verification Complete Successfully ===");
}

main().catch((err) => {
  console.error("Extraction failed:", err);
  process.exit(1);
});
