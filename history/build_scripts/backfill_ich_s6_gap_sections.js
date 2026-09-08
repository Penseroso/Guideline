const fs = require("node:fs");
const path = require("node:path");

const { PDFParse } = require("pdf-parse");
const { createClient } = require("../engine/llm_client");
const { extractSection } = require("../engine/extraction_agent");
const { validateFiles } = require("../validation/validate_structured_data");

const ROOT = path.resolve(__dirname, "..");
const BUNDLE_PATH = path.join(ROOT, "data", "guidelines", "ich_s6_r1.json");
const PDF_PATH = path.join(ROOT, "source_pdfs", "ICH S6.pdf");
const SOURCE_PATH = "source_pdfs/ICH S6.pdf";

const TARGETS = [
  { id: "ich_s6_r1.sec.part1.3_2", title: "Biological Activity/Pharmacodynamics", pieces: [[7, "3.2 Biological Activity/Pharmacodynamics", "3.3 Animal Species/Model Selection"]] },
  { id: "ich_s6_r1.sec.part1.3_5", title: "Administration/Dose Selection", pieces: [[8, "3.5 Administration/Dose Selection", null], [9, null, "3.6 Immunogenicity"]] },
  { id: "ich_s6_r1.sec.part1.4_2", title: "Exposure Assessment", pieces: [[10, "4.2 Exposure Assessment", null], [11, null, "4.3 Single Dose Toxicity Studies"]] },
  { id: "ich_s6_r1.sec.part1.4_3", title: "Single Dose Toxicity Studies", pieces: [[11, "4.3 Single Dose Toxicity Studies", "4.4 Repeated Dose Toxicity Studies"]] },
  { id: "ich_s6_r1.sec.part1.4_5", title: "Immunotoxicity Studies", pieces: [[11, "4.5 Immunotoxicity Studies", null], [12, null, "4.6 Reproductive Performance and Developmental Toxicity Studies"]] },
  { id: "ich_s6_r1.sec.part1.4_6", title: "Reproductive Performance and Developmental Toxicity Studies", pieces: [[12, "4.6 Reproductive Performance and Developmental Toxicity Studies", "4.7 Genotoxicity Studies"]] },
  { id: "ich_s6_r1.sec.part1.4_8", title: "Carcinogenicity Studies", pieces: [[12, "4.8 Carcinogenicity Studies", null], [13, null, "4.9 Local Tolerance Studies"]] },
  { id: "ich_s6_r1.sec.part1.4_9", title: "Local Tolerance Studies", pieces: [[13, "4.9 Local Tolerance Studies", "N OTES"]] },
  { id: "ich_s6_r1.sec.part2.3_4", title: "Exploratory Clinical Trials", pieces: [[17, "3.4 Exploratory Clinical Trials", "4. IMMUNOGENICITY"]] },
  { id: "ich_s6_r1.sec.part2.5_1", title: "General Comments", pieces: [[17, "5.1 General Comments", null], [18, null, "5.2 Fertility"]] },
  { id: "ich_s6_r1.sec.part2.5_2", title: "Fertility", pieces: [[18, "5.2 Fertility", "5.3 Embryo-Fetal Development (EFD) and Pre/Post-Natal Development (PPND)"]] },
  { id: "ich_s6_r1.sec.part2.5_3", title: "Embryo-Fetal Development (EFD) and Pre/Post-Natal Development (PPND)", pieces: [[18, "5.3 Embryo-Fetal Development (EFD) and Pre/Post-Natal Development (PPND)", null], [19, null, "5.4 Timing of Studies"]] },
  { id: "ich_s6_r1.sec.part2.5_4", title: "Timing of Studies", pieces: [[19, "5.4 Timing of Studies", null], [20, null, "6. CARCINOGENICITY"]] }
];

function normalizedPageText(text) {
  return String(text)
    .replace(/^Preclinical Safety Evaluation of Biotechnology-Derived Pharmaceuticals\s*/i, "")
    .replace(/\s+\d+\s*$/, "")
    .replace(/\s+/g, " ")
    .trim();
}

function fragment(text, start, end, label) {
  let value = normalizedPageText(text);
  if (start) {
    const index = value.indexOf(start);
    if (index < 0) throw new Error(`${label}: start anchor not found: ${start}`);
    value = value.slice(index + start.length).trim();
  }
  if (end) {
    const index = value.indexOf(end);
    if (index < 0) throw new Error(`${label}: end anchor not found: ${end}`);
    value = value.slice(0, index).trim();
  }
  if (!value) throw new Error(`${label}: extracted empty source text`);
  return value;
}

function makeSourceUnit(target, piece, pieceIndex, pagesByNumber) {
  const [pageNumber, start, end] = piece;
  const page = pagesByNumber.get(pageNumber);
  if (!page) throw new Error(`${target.id}: PDF page ${pageNumber} not found`);
  const sectionSlug = target.id.slice("ich_s6_r1.sec.".length);
  return {
    source_unit_id: `ich_s6_r1.su.${sectionSlug}.${String(pieceIndex + 1).padStart(3, "0")}`,
    document_id: "ich_s6_r1",
    section_id: target.id,
    unit_type: "paragraph",
    unit_order: pieceIndex + 1,
    unit_order_status: "known",
    source_text: fragment(page.text, start, end, `${target.id}/page-${pageNumber}`),
    related_source_unit_ids: [],
    table_context: null,
    trace: {
      source_file_path: SOURCE_PATH,
      document_id: "ich_s6_r1",
      section_id: target.id,
      pdf_page_index_zero_based: pageNumber - 1,
      pdf_page_index_status: "known",
      printed_page_label: String(pageNumber - 4),
      printed_page_label_status: "known",
      extraction_method: "automated text-layer extraction with independent agent verification"
    },
    review_status: "reviewed"
  };
}

function verificationSchema(entityIds) {
  return {
    type: "object",
    additionalProperties: false,
    required: ["verdicts"],
    properties: {
      verdicts: {
        type: "array",
        minItems: entityIds.length,
        maxItems: entityIds.length,
        items: {
          type: "object",
          additionalProperties: false,
          required: ["entity_id", "entailed", "classification_correct", "modality_preserved", "conditions_preserved", "korean_faithful", "reason"],
          properties: {
            entity_id: { type: "string", enum: entityIds },
            entailed: { type: "boolean" },
            classification_correct: { type: "boolean" },
            modality_preserved: { type: "boolean" },
            conditions_preserved: { type: "boolean" },
            korean_faithful: { type: "boolean" },
            reason: { type: "string" }
          }
        }
      }
    }
  };
}

function entitiesOf(draft) {
  return [
    ...draft.knowledge_records.map((record) => ({ entity_id: record.knowledge_record_id, entity_type: "KnowledgeRecord", record })),
    ...draft.quantitative_criteria.map((record) => ({ entity_id: record.criterion_id, entity_type: "QuantitativeCriterion", record })),
    ...draft.conditions.map((record) => ({ entity_id: record.condition_id, entity_type: "Condition", record }))
  ];
}

async function verifySection({ section, sourceUnits, draft, verifier }) {
  const entities = entitiesOf(draft);
  if (entities.length === 0) throw new Error(`${section.section_id}: extractor returned no entities`);
  const result = await verifier.complete({
    system: [
      "Independently verify structured regulatory records against only the supplied source text.",
      "Approve entailment only when every assertion is supported. Check record type, original modal strength and negation, applicability/exception linkage, quantitative comparator/unit/status, and whether normalized_ko adds or removes meaning.",
      "For Condition records, korean_faithful is true because no Korean normalization is present; still verify the condition is an exact minimal source-supported qualifier.",
      "Reject compound records that propagate a modifier or condition to an unrelated clause, omit a material exception, turn descriptive language into a duty, or overgeneralize an example.",
      "Return exactly one verdict for every entity and do not rewrite records."
    ].join(" "),
    messages: [{ role: "user", content: JSON.stringify({ section, source_units: sourceUnits, entities }) }],
    schema: verificationSchema(entities.map((entity) => entity.entity_id)),
    maxTokens: 8000
  });
  const verdicts = new Map((result.verdicts || []).map((verdict) => [verdict.entity_id, verdict]));
  const failures = [];
  for (const entity of entities) {
    const verdict = verdicts.get(entity.entity_id);
    const approved = verdict && verdict.entailed && verdict.classification_correct && verdict.modality_preserved && verdict.conditions_preserved && verdict.korean_faithful;
    if (!approved) failures.push(`${entity.entity_id}: ${verdict?.reason || "missing verdict"}`);
  }
  const reviewStatus = failures.length === 0 ? "reviewed" : "needs_review";
  for (const collection of [draft.knowledge_records, draft.quantitative_criteria, draft.conditions]) {
    for (const record of collection) record.review_status = reviewStatus;
  }
  return { failures, reviewStatus };
}

function removeExistingTargetData(bundle, sectionIds) {
  const removedSourceIds = new Set(bundle.source_units.filter((unit) => sectionIds.has(unit.section_id)).map((unit) => unit.source_unit_id));
  const removedKrIds = new Set(bundle.knowledge_records.filter((record) => record.source_unit_ids.some((id) => removedSourceIds.has(id))).map((record) => record.knowledge_record_id));
  const removedQcIds = new Set(bundle.quantitative_criteria.filter((record) => removedSourceIds.has(record.source_unit_id)).map((record) => record.criterion_id));
  bundle.source_units = bundle.source_units.filter((unit) => !removedSourceIds.has(unit.source_unit_id));
  bundle.knowledge_records = bundle.knowledge_records.filter((record) => !removedKrIds.has(record.knowledge_record_id));
  bundle.quantitative_criteria = bundle.quantitative_criteria.filter((record) => !removedQcIds.has(record.criterion_id));
  bundle.conditions = bundle.conditions.filter((record) => !removedSourceIds.has(record.source_unit_id));
  for (const condition of bundle.conditions) condition.applies_to_ids = condition.applies_to_ids.filter((id) => !removedKrIds.has(id) && !removedQcIds.has(id));
  for (const criterion of bundle.quantitative_criteria) {
    criterion.condition_ids = criterion.condition_ids.filter((id) => bundle.conditions.some((condition) => condition.condition_id === id));
    criterion.joint_with_ids = criterion.joint_with_ids.filter((id) => !removedQcIds.has(id));
  }
}

async function main() {
  const bundle = JSON.parse(fs.readFileSync(BUNDLE_PATH, "utf8"));
  const parser = new PDFParse(new Uint8Array(fs.readFileSync(PDF_PATH)));
  await parser.load();
  const parsed = await parser.getText();
  await parser.destroy();
  const pagesByNumber = new Map(parsed.pages.map((page) => [page.num, page]));
  const sectionIds = new Set(TARGETS.map((target) => target.id));
  removeExistingTargetData(bundle, sectionIds);

  const generator = createClient("openai", { model: process.env.GUIDELINE_S6_EXTRACTION_MODEL || "gpt-5.6-terra" });
  const verifier = createClient("openai", { model: process.env.GUIDELINE_S6_VERIFICATION_MODEL || "gpt-5.6-sol" });
  if (generator.model === verifier.model) throw new Error("Extraction and verification models must be distinct");

  const report = [];
  for (const target of TARGETS) {
    const section = bundle.sections.find((item) => item.section_id === target.id);
    if (!section) throw new Error(`${target.id}: section not found`);
    section.title = target.title;
    const sourceUnits = target.pieces.map((piece, index) => makeSourceUnit(target, piece, index, pagesByNumber));
    const draft = await extractSection({ section, sourceUnits, client: generator });
    const verification = await verifySection({ section, sourceUnits, draft, verifier });
    bundle.source_units.push(...sourceUnits);
    bundle.knowledge_records.push(...draft.knowledge_records);
    bundle.quantitative_criteria.push(...draft.quantitative_criteria);
    bundle.conditions.push(...draft.conditions);
    report.push({ section_id: target.id, source_units: sourceUnits.length, knowledge_records: draft.knowledge_records.length, quantitative_criteria: draft.quantitative_criteria.length, conditions: draft.conditions.length, review_status: verification.reviewStatus, failures: verification.failures });
    console.log(JSON.stringify(report.at(-1)));
  }

  bundle.source_units.sort((a, b) => a.section_id.localeCompare(b.section_id) || a.unit_order - b.unit_order);
  fs.writeFileSync(BUNDLE_PATH, `${JSON.stringify(bundle, null, 2)}\n`, "utf8");
  const validation = validateFiles([BUNDLE_PATH]);
  if (!validation.ok) {
    console.error(validation.errors.join("\n"));
    process.exitCode = 1;
  }
  const unresolved = report.filter((item) => item.review_status !== "reviewed");
  console.log(`S6 gap-section backfill: ${report.length - unresolved.length}/${report.length} sections independently verified; ${unresolved.length} unresolved.`);
  if (unresolved.length) process.exitCode = 2;
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}

module.exports = { entitiesOf, verificationSchema, verifySection, BUNDLE_PATH };
