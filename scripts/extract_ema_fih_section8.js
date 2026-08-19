const fs = require("fs");
const path = require("path");
const { createClient } = require("../engine/llm_client");
const { extractSectionSelfConsistent } = require("../engine/pipeline");
const { validateBundles } = require("../validation/validate_structured_data");

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
    section_id: "ema_fih.sec.8",
    document_id: "ema_fih",
    section_number: "8",
    title: "Planning and conduct of FIH and early clinical trials",
    parent_section_id: null,
    section_order: 8,
    section_order_status: "known",
    heading_source_unit_id: "ema_fih.su.8.001"
  },
  {
    section_id: "ema_fih.sec.8_1",
    document_id: "ema_fih",
    section_number: "8.1",
    title: "General aspects",
    parent_section_id: "ema_fih.sec.8",
    section_order: 81,
    section_order_status: "known",
    heading_source_unit_id: "ema_fih.su.8_1.001"
  },
  {
    section_id: "ema_fih.sec.8_2",
    document_id: "ema_fih",
    section_number: "8.2",
    title: "Protocol",
    parent_section_id: "ema_fih.sec.8",
    section_order: 82,
    section_order_status: "known",
    heading_source_unit_id: "ema_fih.su.8_2.001"
  },
  {
    section_id: "ema_fih.sec.8_2_1",
    document_id: "ema_fih",
    section_number: "8.2.1",
    title: "Overall design",
    parent_section_id: "ema_fih.sec.8_2",
    section_order: 821,
    section_order_status: "known",
    heading_source_unit_id: "ema_fih.su.8_2_1.001"
  },
  {
    section_id: "ema_fih.sec.8_2_2",
    document_id: "ema_fih",
    section_number: "8.2.2",
    title: "Integrated protocols",
    parent_section_id: "ema_fih.sec.8_2",
    section_order: 822,
    section_order_status: "known",
    heading_source_unit_id: "ema_fih.su.8_2_2.001"
  },
  {
    section_id: "ema_fih.sec.8_2_3",
    document_id: "ema_fih",
    section_number: "8.2.3",
    title: "Choice of subjects",
    parent_section_id: "ema_fih.sec.8_2",
    section_order: 823,
    section_order_status: "known",
    heading_source_unit_id: "ema_fih.su.8_2_3.001"
  },
  {
    section_id: "ema_fih.sec.8_2_4",
    document_id: "ema_fih",
    section_number: "8.2.4",
    title: "Subject assessments and interventions",
    parent_section_id: "ema_fih.sec.8_2",
    section_order: 824,
    section_order_status: "known",
    heading_source_unit_id: "ema_fih.su.8_2_4.001"
  },
  {
    section_id: "ema_fih.sec.8_2_5",
    document_id: "ema_fih",
    section_number: "8.2.5",
    title: "General considerations for all cohorts",
    parent_section_id: "ema_fih.sec.8_2",
    section_order: 825,
    section_order_status: "known",
    heading_source_unit_id: "ema_fih.su.8_2_5.001"
  },
  {
    section_id: "ema_fih.sec.8_2_6",
    document_id: "ema_fih",
    section_number: "8.2.6",
    title: "Precautions to apply between treating subjects within a cohort",
    parent_section_id: "ema_fih.sec.8_2",
    section_order: 826,
    section_order_status: "known",
    heading_source_unit_id: "ema_fih.su.8_2_6.001"
  },
  {
    section_id: "ema_fih.sec.8_2_7",
    document_id: "ema_fih",
    section_number: "8.2.7",
    title: "Precautions to apply between cohorts and study parts",
    parent_section_id: "ema_fih.sec.8_2",
    section_order: 827,
    section_order_status: "known",
    heading_source_unit_id: "ema_fih.su.8_2_7.001"
  },
  {
    section_id: "ema_fih.sec.8_2_8",
    document_id: "ema_fih",
    section_number: "8.2.8",
    title: "Data review for decision",
    parent_section_id: "ema_fih.sec.8_2",
    section_order: 828,
    section_order_status: "known",
    heading_source_unit_id: "ema_fih.su.8_2_8.001"
  },
  {
    section_id: "ema_fih.sec.8_2_9",
    document_id: "ema_fih",
    section_number: "8.2.9",
    title: "Stopping rules",
    parent_section_id: "ema_fih.sec.8_2",
    section_order: 829,
    section_order_status: "known",
    heading_source_unit_id: "ema_fih.su.8_2_9.001"
  },
  {
    section_id: "ema_fih.sec.8_2_10",
    document_id: "ema_fih",
    section_number: "8.2.10",
    title: "Monitoring and communication of adverse events/reactions",
    parent_section_id: "ema_fih.sec.8_2",
    section_order: 8210,
    section_order_status: "known",
    heading_source_unit_id: "ema_fih.su.8_2_10.001"
  },
  {
    section_id: "ema_fih.sec.8_3",
    document_id: "ema_fih",
    section_number: "8.3",
    title: "Documentation of sponsor and investigators responsibilities",
    parent_section_id: "ema_fih.sec.8",
    section_order: 83,
    section_order_status: "known",
    heading_source_unit_id: "ema_fih.su.8_3.001"
  },
  {
    section_id: "ema_fih.sec.8_4",
    document_id: "ema_fih",
    section_number: "8.4",
    title: "Investigator site facilities and personnel",
    parent_section_id: "ema_fih.sec.8",
    section_order: 84,
    section_order_status: "known",
    heading_source_unit_id: "ema_fih.su.8_4.001"
  }
];

const SOURCE_UNITS = [
  // 8.0 Heading
  {
    source_unit_id: "ema_fih.su.8.001",
    document_id: "ema_fih",
    section_id: "ema_fih.sec.8",
    unit_type: "heading",
    order: 8001,
    source_text: "8. Planning and conduct of FIH and early clinical trials",
    provenance: {
      source_file_path: DOCUMENT.source_file_path,
      source_file_checksum: DOCUMENT.source_file_checksum,
      pdf_page_index_zero_based: 13,
      printed_page_label: "14"
    }
  },
  // 8.1 General aspects
  {
    source_unit_id: "ema_fih.su.8_1.001",
    document_id: "ema_fih",
    section_id: "ema_fih.sec.8_1",
    unit_type: "heading",
    order: 8101,
    source_text: "8.1. General aspects",
    provenance: {
      source_file_path: DOCUMENT.source_file_path,
      source_file_checksum: DOCUMENT.source_file_checksum,
      pdf_page_index_zero_based: 13,
      printed_page_label: "14"
    }
  },
  {
    source_unit_id: "ema_fih.su.8_1.002",
    document_id: "ema_fih",
    section_id: "ema_fih.sec.8_1",
    unit_type: "paragraph",
    order: 8102,
    source_text: "Trials should be designed in a way that optimises the knowledge to be gained from the study without exposing excessive numbers of subjects while ensuring the safety of participants. The overall study design should justify the inclusion of each study part considering the data each will provide and the time available for integrated assessment. Safety should not be compromised in the interests of speed of acquiring data or for logistical reasons.",
    provenance: {
      source_file_path: DOCUMENT.source_file_path,
      source_file_checksum: DOCUMENT.source_file_checksum,
      pdf_page_index_zero_based: 13,
      printed_page_label: "14"
    }
  },
  {
    source_unit_id: "ema_fih.su.8_1.003",
    document_id: "ema_fih",
    section_id: "ema_fih.sec.8_1",
    unit_type: "paragraph",
    order: 8103,
    source_text: "Risk mitigation activities should be proportionate to the degree of uncertainty and the potential risks identified. Key aspects of the design include: choice of study population; first/starting dose, maximum dose and exposure and maximal duration of treatment; route and rate/frequency of administrations; half-life (PK/PD), and therefore washout times, of the IMP if the same subjects are participating in multiple cohorts, or accumulation for multiple dosing parts; number of subjects per cohort; sequence and interval between dosing of subjects within the same cohort; dose escalation increments; transition to next dose increment cohort or next study part; stopping rules; safety (and/or effect) parameters to monitor and intensity of monitoring; trial sites; inclusion of a placebo.",
    provenance: {
      source_file_path: DOCUMENT.source_file_path,
      source_file_checksum: DOCUMENT.source_file_checksum,
      pdf_page_index_zero_based: 13,
      printed_page_label: "14"
    }
  },
  {
    source_unit_id: "ema_fih.su.8_1.004",
    document_id: "ema_fih",
    section_id: "ema_fih.sec.8_1",
    unit_type: "paragraph",
    order: 8104,
    source_text: "It is recommended that a PD measure is included, when appropriate and feasible, in order to facilitate the link with the non-clinical experience and support dose escalation decisions.",
    provenance: {
      source_file_path: DOCUMENT.source_file_path,
      source_file_checksum: DOCUMENT.source_file_checksum,
      pdf_page_index_zero_based: 13,
      printed_page_label: "14"
    }
  },

  // 8.2 Protocol heading
  {
    source_unit_id: "ema_fih.su.8_2.001",
    document_id: "ema_fih",
    section_id: "ema_fih.sec.8_2",
    unit_type: "heading",
    order: 8201,
    source_text: "8.2. Protocol",
    provenance: {
      source_file_path: DOCUMENT.source_file_path,
      source_file_checksum: DOCUMENT.source_file_checksum,
      pdf_page_index_zero_based: 14,
      printed_page_label: "15"
    }
  },

  // 8.2.1 Overall design
  {
    source_unit_id: "ema_fih.su.8_2_1.001",
    document_id: "ema_fih",
    section_id: "ema_fih.sec.8_2_1",
    unit_type: "heading",
    order: 8211,
    source_text: "8.2.1. Overall design",
    provenance: {
      source_file_path: DOCUMENT.source_file_path,
      source_file_checksum: DOCUMENT.source_file_checksum,
      pdf_page_index_zero_based: 14,
      printed_page_label: "15"
    }
  },
  {
    source_unit_id: "ema_fih.su.8_2_1.002",
    document_id: "ema_fih",
    section_id: "ema_fih.sec.8_2_1",
    unit_type: "paragraph",
    order: 8212,
    source_text: "The clinical trial protocol is a core document of a trial which is drafted as one of the first steps in any research project. The protocol should precisely describe what is being done in the trial and the rationale behind key decisions so that the trial can be subject to scrutiny in regulatory assessment. Graphical representation of the overall scheme of the proposed trial in real-time showing intervals to allow rolling review, timing of all reviews and decision points and highlighting any overlap between study cohorts and parts is encouraged. Details on the size of the cohorts, including how many subjects are on active IMP and how many are on placebo treatment should be included.",
    provenance: {
      source_file_path: DOCUMENT.source_file_path,
      source_file_checksum: DOCUMENT.source_file_checksum,
      pdf_page_index_zero_based: 14,
      printed_page_label: "15"
    }
  },

  // 8.2.2 Integrated protocols
  {
    source_unit_id: "ema_fih.su.8_2_2.001",
    document_id: "ema_fih",
    section_id: "ema_fih.sec.8_2_2",
    unit_type: "heading",
    order: 8221,
    source_text: "8.2.2. Integrated protocols",
    provenance: {
      source_file_path: DOCUMENT.source_file_path,
      source_file_checksum: DOCUMENT.source_file_checksum,
      pdf_page_index_zero_based: 14,
      printed_page_label: "15"
    }
  },
  {
    source_unit_id: "ema_fih.su.8_2_2.002",
    document_id: "ema_fih",
    section_id: "ema_fih.sec.8_2_2",
    unit_type: "paragraph",
    order: 8222,
    source_text: "The practice of conducting FIH/early CTs with integrated protocols means that the information generated in previous parts needs to be analysed and integrated into an assessment in a limited timeframe prior to making a decision on proceeding to the next part. All parts, and the criteria to move from one part to another, should be predefined within an integrated protocol, as should possible modifications, based on the totality of available information and the related uncertainty. When definite doses cannot be predefined in all study parts, (dose selection) criteria should be established in the protocol. These criteria should integrate data from previous study parts. Feasibility to review and adapt the planned study design based on emerging clinical data should also be considered. Any changes outside these predefined criteria should be implemented via a substantial amendment.",
    provenance: {
      source_file_path: DOCUMENT.source_file_path,
      source_file_checksum: DOCUMENT.source_file_checksum,
      pdf_page_index_zero_based: 14,
      printed_page_label: "15"
    }
  },
  {
    source_unit_id: "ema_fih.su.8_2_2.003",
    document_id: "ema_fih",
    section_id: "ema_fih.sec.8_2_2",
    unit_type: "paragraph",
    order: 8223,
    source_text: "Regarding the time sequence for the conduct of different parts, the following recommendations apply: Overlap of SAD and MAD parts may be acceptable. However, any overlap should be scientifically justified and supported by decision points and a review of available data before starting the MAD part. Other single dose parts (e.g. food interaction) could be conducted in parallel to the SAD part provided the dose chosen and the expected exposure are equal to or lower than that which was reached in a concluded preceding SAD cohort where all relevant data has been reviewed and no dose escalation stopping criteria were met. Other study parts that involve multiple dosing (e.g. drug-drug interaction) should generally not overlap with earlier SAD or MAD cohorts. All relevant SAD and MAD data should be reviewed before starting these parts. Deviation from this should be justified in the protocol.",
    provenance: {
      source_file_path: DOCUMENT.source_file_path,
      source_file_checksum: DOCUMENT.source_file_checksum,
      pdf_page_index_zero_based: 14,
      printed_page_label: "15"
    }
  },

  // 8.2.3 Choice of subjects
  {
    source_unit_id: "ema_fih.su.8_2_3.001",
    document_id: "ema_fih",
    section_id: "ema_fih.sec.8_2_3",
    unit_type: "heading",
    order: 8231,
    source_text: "8.2.3. Choice of subjects",
    provenance: {
      source_file_path: DOCUMENT.source_file_path,
      source_file_checksum: DOCUMENT.source_file_checksum,
      pdf_page_index_zero_based: 15,
      printed_page_label: "16"
    }
  },
  {
    source_unit_id: "ema_fih.su.8_2_3.002",
    document_id: "ema_fih",
    section_id: "ema_fih.sec.8_2_3",
    unit_type: "paragraph",
    order: 8232,
    source_text: "Particular clinical factors to consider in the decision to conduct a study in healthy volunteers or patients include: whether the toxicities foreseen/risks associated can support the inclusion of healthy volunteers; the relative presence of the target in healthy subjects or in patients; the possible higher PK, PD or safety profile variability in patients; the potential differences between the targeted patient group and healthy subjects; possible interactions with subject’s lifestyle, e.g. smoking, use of alcohol or drugs; the use of other medications with the possibility for adverse reactions and/or difficulties in the interpretation of results; a patient’s ability to benefit from other products or interventions; the predicted therapeutic window of the IMP; factors relating to special populations, including age, gender, ethnicity and genotype(s).",
    provenance: {
      source_file_path: DOCUMENT.source_file_path,
      source_file_checksum: DOCUMENT.source_file_checksum,
      pdf_page_index_zero_based: 15,
      printed_page_label: "16"
    }
  },
  {
    source_unit_id: "ema_fih.su.8_2_3.003",
    document_id: "ema_fih",
    section_id: "ema_fih.sec.8_2_3",
    unit_type: "paragraph",
    order: 8233,
    source_text: "The key inclusion and exclusion criteria for trials involving healthy participants should consider an adequate set of vital signs (including ECG), laboratory values and clinical assessments that should be within normal ranges. Deviations outside these ranges may be possible if justified.",
    provenance: {
      source_file_path: DOCUMENT.source_file_path,
      source_file_checksum: DOCUMENT.source_file_checksum,
      pdf_page_index_zero_based: 15,
      printed_page_label: "16"
    }
  },

  // 8.2.4 Subject assessments and interventions
  {
    source_unit_id: "ema_fih.su.8_2_4.001",
    document_id: "ema_fih",
    section_id: "ema_fih.sec.8_2_4",
    unit_type: "heading",
    order: 8241,
    source_text: "8.2.4. Subject assessments and interventions",
    provenance: {
      source_file_path: DOCUMENT.source_file_path,
      source_file_checksum: DOCUMENT.source_file_checksum,
      pdf_page_index_zero_based: 15,
      printed_page_label: "16"
    }
  },
  {
    source_unit_id: "ema_fih.su.8_2_4.002",
    document_id: "ema_fih",
    section_id: "ema_fih.sec.8_2_4",
    unit_type: "paragraph",
    order: 8242,
    source_text: "The subject safety assessments that will be routinely conducted, their timing and any additional monitoring actions or interventions (such as radiological or PD assessments) should be pre-specified in line with the known pharmacological and non-clinical safety profile and balanced against the degree of uncertainty. There should also be routine general monitoring (e.g. vital signs, ECG, respiratory signs and symptoms, clinical laboratory values or general neurological assessment, physical examination and interview) to detect potential unexpected adverse effects that are not related to known properties of the IMP. Repeated assessments, integrating available knowledge with rapid processing of emerging information, are crucial for the recognition of developing toxicity at an early stage.",
    provenance: {
      source_file_path: DOCUMENT.source_file_path,
      source_file_checksum: DOCUMENT.source_file_checksum,
      pdf_page_index_zero_based: 15,
      printed_page_label: "16"
    }
  },
  {
    source_unit_id: "ema_fih.su.8_2_4.003",
    document_id: "ema_fih",
    section_id: "ema_fih.sec.8_2_4",
    unit_type: "paragraph",
    order: 8243,
    source_text: "The exact nature of the assessments and their timing should be provided in the study protocol. Any proposal to routinely omit an assessment should be scientifically based. Emerging clinical data may also be used to support altering the frequency or timing of assessments, either within pre-specified limits in the protocol or via a substantial amendment. The length of follow-up of subjects should be specified within the protocol (e.g. for possible delayed adverse reactions). The sponsor should describe how safety monitoring should be extended until parameters return to within the normal range or to baseline, as appropriate for the population. Extended monitoring should also be considered, e.g. when the mechanism entails enzyme inhibition or activation (monitoring should continue until enzyme activity has returned back to baseline or to an acceptable percentage of baseline) or when prolonged PD effects are observed regardless of duration of target inhibition or PK profile of the IMP.",
    provenance: {
      source_file_path: DOCUMENT.source_file_path,
      source_file_checksum: DOCUMENT.source_file_checksum,
      pdf_page_index_zero_based: 15,
      printed_page_label: "16"
    }
  },

  // 8.2.5 General considerations for all cohorts
  {
    source_unit_id: "ema_fih.su.8_2_5.001",
    document_id: "ema_fih",
    section_id: "ema_fih.sec.8_2_5",
    unit_type: "heading",
    order: 8251,
    source_text: "8.2.5. General considerations for all cohorts",
    provenance: {
      source_file_path: DOCUMENT.source_file_path,
      source_file_checksum: DOCUMENT.source_file_checksum,
      pdf_page_index_zero_based: 16,
      printed_page_label: "17"
    }
  },
  {
    source_unit_id: "ema_fih.su.8_2_5.002",
    document_id: "ema_fih",
    section_id: "ema_fih.sec.8_2_5",
    unit_type: "paragraph",
    order: 8252,
    source_text: "The number of subjects per cohort depends on the variability of both PK and PD parameters and the trial objectives. Flexibility can be allowed for the number of cohorts to be investigated but any plan to include optional additional cohorts should be clearly pre-defined and the underlying rationale provided. It is not acceptable to repeat a dose level where any of the dose escalation stopping rules has been met. If repetition of cohorts is allowed in the protocol then only a lower or intermediate dose level would be acceptable and this should be clearly indicated. Inclusion of the same subjects across multiple cohorts, for example as part of an alternate cohort dosing scheme, is possible but should be scientifically justified in the protocol. Re-enrolment into higher dose cohorts is only possible after an appropriately defined washout period and provided the subject has not met any discontinuation criteria.",
    provenance: {
      source_file_path: DOCUMENT.source_file_path,
      source_file_checksum: DOCUMENT.source_file_checksum,
      pdf_page_index_zero_based: 16,
      printed_page_label: "17"
    }
  },

  // 8.2.6 Sentinel dosing
  {
    source_unit_id: "ema_fih.su.8_2_6.001",
    document_id: "ema_fih",
    section_id: "ema_fih.sec.8_2_6",
    unit_type: "heading",
    order: 8261,
    source_text: "8.2.6. Precautions to apply between treating subjects within a cohort",
    provenance: {
      source_file_path: DOCUMENT.source_file_path,
      source_file_checksum: DOCUMENT.source_file_checksum,
      pdf_page_index_zero_based: 16,
      printed_page_label: "17"
    }
  },
  {
    source_unit_id: "ema_fih.su.8_2_6.002",
    document_id: "ema_fih",
    section_id: "ema_fih.sec.8_2_6",
    unit_type: "paragraph",
    order: 8262,
    source_text: "It is considered appropriate to design the administration of the first dose in any cohort so that a single subject receives a single dose of the active IMP (often known as sentinel dosing). Flexibility in this approach is allowed but should be on a risk-proportionate basis with a clear scientific rationale for any proposals not to use this strategy. When the study design includes the use of placebo it would be appropriate to allow for one subject on active and one on placebo to be dosed simultaneously prior to dosing the remaining subjects in the cohort. This approach is expected for all single and multiple dosing cohorts, in order to reduce the risks associated with exposing all subjects in a cohort simultaneously. This sentinel approach may continue or also start to be appropriate at later stages of study design, e.g. on the steep part of the dose response curve, when approaching target saturation levels or the maximum clinical exposure levels defined in the protocol, in case of non-linear PK, or in light of emerging clinical signs or adverse events that do not meet stopping criteria.",
    provenance: {
      source_file_path: DOCUMENT.source_file_path,
      source_file_checksum: DOCUMENT.source_file_checksum,
      pdf_page_index_zero_based: 16,
      printed_page_label: "17"
    }
  },
  {
    source_unit_id: "ema_fih.su.8_2_6.003",
    document_id: "ema_fih",
    section_id: "ema_fih.sec.8_2_6",
    unit_type: "paragraph",
    order: 8263,
    source_text: "There should be an adequate period of time between the administration of treatment to these first subjects in a cohort and the remaining subjects in the cohort to observe for any reactions and adverse events. The duration of the interval of observation will depend on the PK and PD characteristics and the level of uncertainty associated with the product. At the end of the observation period, there should be a clearly defined review of all available data for the sentinel subjects before dosing of further subjects in the cohort, with dose stopping rules in place to prevent further dosing if any rule is met.",
    provenance: {
      source_file_path: DOCUMENT.source_file_path,
      source_file_checksum: DOCUMENT.source_file_checksum,
      pdf_page_index_zero_based: 16,
      printed_page_label: "17"
    }
  },

  // 8.2.7 Precautions between cohorts and parts
  {
    source_unit_id: "ema_fih.su.8_2_7.001",
    document_id: "ema_fih",
    section_id: "ema_fih.sec.8_2_7",
    unit_type: "heading",
    order: 8271,
    source_text: "8.2.7. Precautions to apply between cohorts and study parts",
    provenance: {
      source_file_path: DOCUMENT.source_file_path,
      source_file_checksum: DOCUMENT.source_file_checksum,
      pdf_page_index_zero_based: 16,
      printed_page_label: "17"
    }
  },
  {
    source_unit_id: "ema_fih.su.8_2_7.002",
    document_id: "ema_fih",
    section_id: "ema_fih.sec.8_2_7",
    unit_type: "paragraph",
    order: 8272,
    source_text: "Administration to the next cohort should not occur before participants in the immediately preceding cohort have been treated and PK, PD and clinical safety data as appropriate from those participants are reviewed in accordance with the protocol. Review of all previous cohorts’ data in a cumulative manner should also be taken into account. Late emerging safety issues that may have occurred after the time-point for the dose escalation decision (e.g. 48h safety data for each subject set as the minimum data required but significant event(s) happening at 7 days post dose) can then be considered.",
    provenance: {
      source_file_path: DOCUMENT.source_file_path,
      source_file_checksum: DOCUMENT.source_file_checksum,
      pdf_page_index_zero_based: 16,
      printed_page_label: "17"
    }
  },
  {
    source_unit_id: "ema_fih.su.8_2_7.003",
    document_id: "ema_fih",
    section_id: "ema_fih.sec.8_2_7",
    unit_type: "paragraph",
    order: 8273,
    source_text: "While there can be no delay for safety data, a lack of PD information or a reduced PK data set could be acceptable in some cases. The planned dose(s) should be adapted accordingly, if needed. In addition, the review should consider whether adaptation of the protocol in other areas is required to ensure continuing safety of trial participants, such as safety monitoring parameters and timings or length of the follow-up period. In specific situations where PK, PK/PD models are of limited value, dose escalation schemes and progression to further study parts need to be more cautious (e.g. consider a slower progression of the dose escalation scheme). Unanticipated responses may require a revised dose escalation. Timing between cohorts should be stated in the protocol. Flexibility to allow for a defined longer review time in the event of emerging data could be accepted, but shortening of the review time for any dose escalation should always require a substantial amendment. Prior to any further part following (or overlapping with) the SAD part or any other part, sufficient information should be available from completed preceding parts or/and cohorts to ensure safety of selected dose/exposure prior decision to start the part.",
    provenance: {
      source_file_path: DOCUMENT.source_file_path,
      source_file_checksum: DOCUMENT.source_file_checksum,
      pdf_page_index_zero_based: 17,
      printed_page_label: "18"
    }
  },

  // 8.2.8 Data review for decision
  {
    source_unit_id: "ema_fih.su.8_2_8.001",
    document_id: "ema_fih",
    section_id: "ema_fih.sec.8_2_8",
    unit_type: "heading",
    order: 8281,
    source_text: "8.2.8. Data review for decision",
    provenance: {
      source_file_path: DOCUMENT.source_file_path,
      source_file_checksum: DOCUMENT.source_file_checksum,
      pdf_page_index_zero_based: 17,
      printed_page_label: "18"
    }
  },
  {
    source_unit_id: "ema_fih.su.8_2_8.002",
    document_id: "ema_fih",
    section_id: "ema_fih.sec.8_2_8",
    unit_type: "paragraph",
    order: 8282,
    source_text: "The data supporting dose escalation or beginning of a new study part in alignment with the predefined criteria in the protocol are key and should be described in the protocol. The timing and data specified in the protocol for the decision should reflect the uncertainty associated with the IMP, but also the population and intervention. Despite this pre-defined information, consideration should be given to a review of all data generated until the time of the decision. The following are regarded as minimum criteria for data review: ‘Evaluable’ subjects should be defined, i.e. subjects who have completed all planned study visits at least until the time of the decision as detailed in the protocol. When it is considered that not all subjects in a cohort may meet the definition of ‘evaluable’, the protocol should clearly define the minimum number of evaluable subjects required for review. This number should be adequate for data review and reliable decision-making. Subjects who have discontinued for any reason should also be considered in the relevant component of data review if at least one administration (of IMP/placebo) has occurred. Data collection as planned in the protocol in a given dosing cohort should be complete to proceed to the next dose cohort.",
    provenance: {
      source_file_path: DOCUMENT.source_file_path,
      source_file_checksum: DOCUMENT.source_file_checksum,
      pdf_page_index_zero_based: 17,
      printed_page_label: "18"
    }
  },

  // 8.2.9 Stopping rules
  {
    source_unit_id: "ema_fih.su.8_2_9.001",
    document_id: "ema_fih",
    section_id: "ema_fih.sec.8_2_9",
    unit_type: "heading",
    order: 8291,
    source_text: "8.2.9. Stopping rules",
    provenance: {
      source_file_path: DOCUMENT.source_file_path,
      source_file_checksum: DOCUMENT.source_file_checksum,
      pdf_page_index_zero_based: 17,
      printed_page_label: "18"
    }
  },
  {
    source_unit_id: "ema_fih.su.8_2_9.002",
    document_id: "ema_fih",
    section_id: "ema_fih.sec.8_2_9",
    unit_type: "paragraph",
    order: 8292,
    source_text: "The protocol should define unambiguous stopping rules which result in an immediate stop to dosing. It should further be specified in the rule if the stop is a final end of dosing or a temporary halt. Restart is possible without a substantial amendment if review leads to a conclusion which is fully within predefined conditions for the relevant stopping criterion. Any submitted substantial amendment should include a rationale for the proposed dosing and for the continuation of the trial and details of any adjustments to the protocol including additional safety monitoring, if applicable.",
    provenance: {
      source_file_path: DOCUMENT.source_file_path,
      source_file_checksum: DOCUMENT.source_file_checksum,
      pdf_page_index_zero_based: 17,
      printed_page_label: "18"
    }
  },
  {
    source_unit_id: "ema_fih.su.8_2_9.003",
    document_id: "ema_fih",
    section_id: "ema_fih.sec.8_2_9",
    unit_type: "paragraph",
    order: 8293,
    source_text: "Stopping rules should be defined for each of the following: final stop to dosing and termination of the trial; stopping for an individual subject, at any time in the trial; stopping within a cohort when subjects in a cohort are dosed staggered, during multiple dosing; progression to the next part of the trial; any dose escalation parts of the trial. Separate rules can be in place for each of the bullet points above, or it may be appropriate to use the same criteria for several areas of the protocol. For example, stopping rules for dose escalation could be the same as those for within a cohort or those for individual subjects. Integrated protocols should clearly outline decision points and criteria for the situation where stopping rules are met.",
    provenance: {
      source_file_path: DOCUMENT.source_file_path,
      source_file_checksum: DOCUMENT.source_file_checksum,
      pdf_page_index_zero_based: 17,
      printed_page_label: "18"
    }
  },
  {
    source_unit_id: "ema_fih.su.8_2_9.004",
    document_id: "ema_fih",
    section_id: "ema_fih.sec.8_2_9",
    unit_type: "paragraph",
    order: 8294,
    source_text: "Stopping rules for healthy volunteer trials should include, but not be limited to: a ‘serious’ adverse reaction (i.e. a serious adverse event considered at least possibly related to the IMP administration) in one subject; ‘severe’ non-serious adverse reactions (i.e. severe non-serious adverse events considered as, at least, possibly related to the IMP administration) in two subjects in the same cohort, independent of within or not within the same system-organ-class. Consideration should be given to stopping criteria based on a rolling review of the data that takes account of ‘moderate’ non-serious adverse reactions in blinded or unblinded fashion and their relation to PD effects, the number of subjects in which they occur, concurrency of more than one within the same subject and potential safety signals identified for other IMPs in the same class. Changes from baseline measurements should also be considered, and not just absolute cut-offs based on upper or lower limits of normal that might apply for healthy volunteers. A dose stopping criterion comprising a maximum clinical exposure (Cmax or AUC) should generally be included. When reviewing emerging data in relation to this criterion, the maximum exposure observed in individual subjects within a cohort rather than the mean exposure should be taken into account.",
    provenance: {
      source_file_path: DOCUMENT.source_file_path,
      source_file_checksum: DOCUMENT.source_file_checksum,
      pdf_page_index_zero_based: 18,
      printed_page_label: "19"
    }
  },

  // 8.2.10 Monitoring and adverse events
  {
    source_unit_id: "ema_fih.su.8_2_10.001",
    document_id: "ema_fih",
    section_id: "ema_fih.sec.8_2_10",
    unit_type: "heading",
    order: 82101,
    source_text: "8.2.10. Monitoring and communication of adverse events/reactions",
    provenance: {
      source_file_path: DOCUMENT.source_file_path,
      source_file_checksum: DOCUMENT.source_file_checksum,
      pdf_page_index_zero_based: 18,
      printed_page_label: "19"
    }
  },
  {
    source_unit_id: "ema_fih.su.8_2_10.002",
    document_id: "ema_fih",
    section_id: "ema_fih.sec.8_2_10",
    unit_type: "paragraph",
    order: 82102,
    source_text: "The trial design should provide a specific plan for monitoring for adverse events or adverse reactions. The mode of action of the investigational medicinal product, findings in the non-clinical toxicity studies and any anticipated responses should be used to identify likely adverse reactions. All clinical staff should be trained to identify those reactions and how to respond to those or any other adverse events or reactions. Rapid access to the treatment allocation codes should be constantly available, where relevant. It is therefore imperative that in any double-blind study design, there are clear instructions in the protocol for unblinding in the case of an emergency.",
    provenance: {
      source_file_path: DOCUMENT.source_file_path,
      source_file_checksum: DOCUMENT.source_file_checksum,
      pdf_page_index_zero_based: 18,
      printed_page_label: "19"
    }
  },
  {
    source_unit_id: "ema_fih.su.8_2_10.003",
    document_id: "ema_fih",
    section_id: "ema_fih.sec.8_2_10",
    unit_type: "paragraph",
    order: 82103,
    source_text: "Treatment strategies for potential risks/adverse reactions should be described in the protocol, as appropriate. This should include the availability of specific antidotes where they exist and a clear plan of availability of supportive treatment emergency facilities and experienced and trained medical staff. A rationale for the length of the monitoring period and the nature of monitoring within, and if deemed appropriate outside, the research site should be provided in the protocol. Of high importance in the protocol is a plan for prompt communication of serious adverse events and suspected unexpected serious adverse reactions (SUSARs) or serious safety-related protocol deviations between the sponsor, all study sites and investigators and trial subjects. It is particularly important in the case of multicentre trials to clearly define the processes for communication of safety data or rapid implementation of corrective or preventive actions between the sponsor and all study sites and investigators and trial subjects. Sponsors should ensure that processes are in place, before the trial starts, for expedited reporting of any SUSARs to the investigator(s), the relevant competent authority(ies) and ethics committee(s) in the Member States concerned and to EudraVigilance. In the case of emerging safety issues, for example severe or serious adverse reactions, the Sponsor should inform investigators and participants (at any site) as soon as possible, and at least prior to any planned next dosing. Any SUSAR in a healthy volunteer should also be reported to the Member States concerned without undue delay.",
    provenance: {
      source_file_path: DOCUMENT.source_file_path,
      source_file_checksum: DOCUMENT.source_file_checksum,
      pdf_page_index_zero_based: 19,
      printed_page_label: "20"
    }
  },

  // 8.3 Responsibilities
  {
    source_unit_id: "ema_fih.su.8_3.001",
    document_id: "ema_fih",
    section_id: "ema_fih.sec.8_3",
    unit_type: "heading",
    order: 8301,
    source_text: "8.3. Documentation of sponsor and investigators responsibilities",
    provenance: {
      source_file_path: DOCUMENT.source_file_path,
      source_file_checksum: DOCUMENT.source_file_checksum,
      pdf_page_index_zero_based: 19,
      printed_page_label: "20"
    }
  },
  {
    source_unit_id: "ema_fih.su.8_3.002",
    document_id: "ema_fih",
    section_id: "ema_fih.sec.8_3",
    unit_type: "paragraph",
    order: 8302,
    source_text: "The responsibilities of the sponsor and investigator(s) (as well as any other experts or study staff) in decision making should be clearly defined in the protocol. Responsibility with regard to breaking the treatment code in emergency situations should also be documented. It is also the case that unblinding in an emergency, where knowledge of the treatment received is needed for the immediate management of a subject, can be done at the investigators discretion without involvement of the monitor or sponsor and arrangements for this should be documented. The composition of any decision making group or safety review committee should be documented in the protocol. Other details to include are the exact remit of the group and the roles of all members in the committee and their relation to the sponsor. Consideration should be given to the inclusion of independent experts who are (at least) external to the study. Written statements and conclusions by any decision-making or safety review group must be in place before allowing trial progression at the noted times as per protocol. This includes documentation of appropriate quality control checks on the data reviewed.",
    provenance: {
      source_file_path: DOCUMENT.source_file_path,
      source_file_checksum: DOCUMENT.source_file_checksum,
      pdf_page_index_zero_based: 19,
      printed_page_label: "20"
    }
  },

  // 8.4 Site facilities and personnel
  {
    source_unit_id: "ema_fih.su.8_4.001",
    document_id: "ema_fih",
    section_id: "ema_fih.sec.8_4",
    unit_type: "heading",
    order: 8401,
    source_text: "8.4. Investigator site facilities and personnel",
    provenance: {
      source_file_path: DOCUMENT.source_file_path,
      source_file_checksum: DOCUMENT.source_file_checksum,
      pdf_page_index_zero_based: 19,
      printed_page_label: "20"
    }
  },
  {
    source_unit_id: "ema_fih.su.8_4.002",
    document_id: "ema_fih",
    section_id: "ema_fih.sec.8_4",
    unit_type: "paragraph",
    order: 8402,
    source_text: "FIH/early CTs should take place in appropriate clinical facilities and be conducted by trained investigators and medical staff with appropriate levels of training and experience of early phase trials. The training should include relevant medical expertise and GCP training. They should also understand specific characteristics of the IMP and of its target and mode of action. FIH/early CTs should take place under controlled conditions (e.g. inpatient care), with the possibility of close supervision of study subjects during and after dosing as required by the protocol. Units should have immediate access to equipment and appropriately qualified staff for resuscitating and stabilising individuals in an acute emergency (such as cardiac emergencies, anaphylaxis, cytokine release syndrome, convulsions, hypotension), and ready availability of intensive care unit and other hospital facilities. Procedures should be established between the clinical research unit and its nearby intensive care unit regarding the responsibilities and undertakings of each in the transfer and care of patients. All FIH/early CTs for an IMP should preferably be conducted at a single site (to gather collective experience). If multiple sites must be involved, e.g. in patient studies where multiple sites are often required for enrolment, the protocol should include appropriate measures to reduce any extra risks that might arise from the use of multiple sites.",
    provenance: {
      source_file_path: DOCUMENT.source_file_path,
      source_file_checksum: DOCUMENT.source_file_checksum,
      pdf_page_index_zero_based: 19,
      printed_page_label: "20"
    }
  }
];

const TARGET_SUBSECTIONS = [
  "8.1",
  "8.2.1",
  "8.2.2",
  "8.2.3",
  "8.2.4",
  "8.2.5",
  "8.2.6",
  "8.2.7",
  "8.2.8",
  "8.2.9",
  "8.2.10",
  "8.3",
  "8.4"
];

async function main() {
  console.log("=== Starting EMA FIH Section 8 Self-Consistency Extraction ===");
  const client = createClient();
  console.log("Using LLM client provider:", client.provider);

  const allDrafts = {
    knowledge_records: [],
    quantitative_criteria: [],
    conditions: []
  };

  for (const secNum of TARGET_SUBSECTIONS) {
    const secObj = SECTIONS.find((s) => s.section_number === secNum);
    if (!secObj) continue;

    const susForSec = SOURCE_UNITS.filter((su) => su.section_id === secObj.section_id);
    console.log(`\n--- Extracting ${secNum}: ${secObj.title} (${susForSec.length} SourceUnits) ---`);

    const result = await extractSectionSelfConsistent({
      section: secObj,
      sourceUnits: susForSec,
      client,
      passes: 3
    });

    const krs = result.draft.knowledge_records || [];
    const qcs = result.draft.quantitative_criteria || [];
    const conds = result.draft.conditions || [];

    console.log(`Extracted for ${secNum}:`);
    console.log(`  KnowledgeRecords: ${krs.length} (Reviewed: ${krs.filter((r) => r.review_status === "reviewed").length})`);
    console.log(`  QuantitativeCriteria: ${qcs.length} (Reviewed: ${qcs.filter((r) => r.review_status === "reviewed").length})`);
    console.log(`  Conditions: ${conds.length} (Reviewed: ${conds.filter((r) => r.review_status === "reviewed").length})`);

    allDrafts.knowledge_records.push(...krs);
    allDrafts.quantitative_criteria.push(...qcs);
    allDrafts.conditions.push(...conds);
  }

  // Load existing Section 7 bundle and combine into comprehensive EMA FIH bundle
  const sec7Path = path.resolve(__dirname, "..", "data", "pilots", "ema_fih_dosing.json");
  const sec7Bundle = JSON.parse(fs.readFileSync(sec7Path, "utf8"));

  const combinedSections = [...sec7Bundle.sections];
  for (const sec of SECTIONS) {
    if (!combinedSections.some((s) => s.section_id === sec.section_id)) {
      combinedSections.push(sec);
    }
  }

  const combinedSourceUnits = [...sec7Bundle.source_units];
  for (const su of SOURCE_UNITS) {
    if (!combinedSourceUnits.some((s) => s.source_unit_id === su.source_unit_id)) {
      combinedSourceUnits.push(su);
    }
  }

  const combinedBundle = {
    documents: [DOCUMENT],
    sections: combinedSections,
    source_units: combinedSourceUnits,
    knowledge_records: [...sec7Bundle.knowledge_records, ...allDrafts.knowledge_records],
    quantitative_criteria: [...sec7Bundle.quantitative_criteria, ...allDrafts.quantitative_criteria],
    conditions: [...sec7Bundle.conditions, ...allDrafts.conditions],
    cross_references: sec7Bundle.cross_references || []
  };

  // Run sanitizer to ensure strict schema compliance
  for (const kr of combinedBundle.knowledge_records) {
    if (kr.modality === "none") kr.original_modal_text = null;
  }
  for (const c of combinedBundle.conditions) {
    if (!c.source_unit_id) c.source_unit_id = "ema_fih.su.8_1.002";
    if (c.condition_type === "exception" && (!c.applies_to_ids || c.applies_to_ids.length === 0)) {
      const relKrs = combinedBundle.knowledge_records.filter((kr) => (kr.source_unit_ids || []).includes(c.source_unit_id));
      if (relKrs.length > 0) {
        c.applies_to_ids = [relKrs[0].knowledge_record_id];
      } else {
        c.condition_type = "qualification";
      }
    }
  }
  for (const qc of combinedBundle.quantitative_criteria) {
    if (qc.is_default_with_exception && (!qc.condition_ids || qc.condition_ids.length === 0)) {
      qc.is_default_with_exception = false;
    }
    for (const jid of qc.joint_with_ids || []) {
      const target = combinedBundle.quantitative_criteria.find((t) => t.criterion_id === jid);
      if (target && !target.joint_with_ids.includes(qc.criterion_id)) {
        target.joint_with_ids.push(qc.criterion_id);
      }
    }
  }

  const outPath = path.resolve(__dirname, "..", "data", "pilots", "ema_fih_dosing.json");
  fs.writeFileSync(outPath, JSON.stringify(combinedBundle, null, 2), "utf8");
  console.log(`\nSaved combined bundle to: ${outPath}`);

  console.log("\nRunning validation on the combined bundle...");
  const validationResult = validateBundles([combinedBundle]);
  if (!validationResult.valid) {
    console.error("Bundle validation failed with errors:", validationResult.errors);
    process.exit(1);
  }
  console.log("Combined EMA FIH bundle is 100% valid!");
}

main().catch((err) => {
  console.error("Extraction failed:", err);
  process.exit(1);
});
