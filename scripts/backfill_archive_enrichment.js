const fs = require("fs");
const path = require("path");
const { createClient } = require("../engine/llm_client");
const { validateFiles } = require("../validation/validate_structured_data");

const pilots = [
  path.resolve(__dirname, "..", "data", "pilots", "ich_m10_validation.json"),
  path.resolve(__dirname, "..", "data", "pilots", "fda_ada_validation.json"),
  path.resolve(__dirname, "..", "data", "pilots", "ema_fih_dosing.json"),
  path.resolve(__dirname, "..", "data", "pilots", "s6_r1_species_selection.json")
];

function linkConditionsInBundle(bundle) {
  const krsBySu = new Map();
  const qcsBySu = new Map();

  for (const k of bundle.knowledge_records) {
    for (const suId of k.source_unit_ids || []) {
      if (!krsBySu.has(suId)) krsBySu.set(suId, []);
      krsBySu.get(suId).push(k.knowledge_record_id);
    }
  }

  for (const q of bundle.quantitative_criteria) {
    if (q.source_unit_id) {
      if (!qcsBySu.has(q.source_unit_id)) qcsBySu.set(q.source_unit_id, []);
      qcsBySu.get(q.source_unit_id).push(q);
    }
  }

  let linkedCount = 0;
  for (const c of bundle.conditions) {
    const validKrIds = new Set(bundle.knowledge_records.map((k) => k.knowledge_record_id));
    const validQcIds = new Set(bundle.quantitative_criteria.map((q) => q.criterion_id));

    c.applies_to_ids = (c.applies_to_ids || []).filter((id) => validKrIds.has(id) || validQcIds.has(id));

    if (c.applies_to_ids.length === 0 && c.source_unit_id) {
      const suKrs = krsBySu.get(c.source_unit_id) || [];
      const suQcs = qcsBySu.get(c.source_unit_id) || [];
      const targets = [...suKrs, ...suQcs.map((q) => q.criterion_id)];
      if (targets.length > 0) {
        c.applies_to_ids = targets;
        linkedCount++;
      }
    }

    // Reciprocal check on QCs
    for (const qcId of c.applies_to_ids) {
      const qc = bundle.quantitative_criteria.find((q) => q.criterion_id === qcId);
      if (qc) {
        if (!qc.condition_ids) qc.condition_ids = [];
        if (!qc.condition_ids.includes(c.condition_id)) {
          qc.condition_ids.push(c.condition_id);
        }
      }
    }
  }

  return linkedCount;
}

async function backfillNormalizedKo(bundle, client, docName) {
  const missingKrs = bundle.knowledge_records.filter((k) => !k.normalized_ko || !/[\uac00-\ud7af]/.test(k.normalized_ko));
  if (missingKrs.length === 0) {
    console.log(`[${docName}] All KnowledgeRecords already have Korean normalized text.`);
    return;
  }

  console.log(`[${docName}] Backfilling normalized_ko for ${missingKrs.length} KnowledgeRecords...`);
  const batchSize = 20;

  for (let i = 0; i < missingKrs.length; i += batchSize) {
    const batch = missingKrs.slice(i, i + batchSize);
    const prompt = `You are an expert regulatory affairs AI. Translate and normalize the following English regulatory KnowledgeRecord statements into precise, faithful Korean (normalized_ko).
Rules:
1. Preserve the exact regulatory modality (must = ~해야 한다/필수이다, should = ~해야 한다/권장된다, may = ~할 수 있다, is recommended = ~이 권장된다).
2. Do NOT add extra interpretations, background advice, or inferred rules.
3. Return ONLY a valid JSON array of objects with "knowledge_record_id" and "normalized_ko".

Input items:
${JSON.stringify(
  batch.map((k) => ({
    knowledge_record_id: k.knowledge_record_id,
    record_type: k.record_type,
    modality: k.modality,
    action: k.action,
    object: k.object,
    scope_context: k.scope_context
  })),
  null,
  2
)}`;

    try {
      const response = await client.complete({
        system: "You are an expert regulatory affairs AI specializing in faithful Korean regulatory normalization.",
        messages: [{ role: "user", content: prompt }],
        maxTokens: 4096
      });
      const res = response.text || "";
      let parsed = [];
      const match = res.match(/\[\s*\{[\s\S]*\}\s*\]/);
      if (match) {
        parsed = JSON.parse(match[0]);
      } else {
        parsed = JSON.parse(res);
      }

      for (const item of parsed) {
        const kr = missingKrs.find((k) => k.knowledge_record_id === item.knowledge_record_id);
        if (kr && item.normalized_ko) {
          kr.normalized_ko = item.normalized_ko;
        }
      }
      console.log(`  ➔ Processed batch ${Math.floor(i / batchSize) + 1} / ${Math.ceil(missingKrs.length / batchSize)} (${batch.length} items)`);
    } catch (err) {
      console.error(`  ✖ Batch ${Math.floor(i / batchSize) + 1} error:`, err.message);
      for (const kr of batch) {
        if (!kr.normalized_ko) kr.normalized_ko = `${kr.action || ""} (${kr.modality || ""})`;
      }
    }
  }
}

async function main() {
  console.log("=== Starting Archive Backfill & Condition Enrichment ===");
  const client = createClient();

  for (const p of pilots) {
    const docName = path.basename(p);
    console.log(`\nProcessing ${docName}...`);
    const bundle = JSON.parse(fs.readFileSync(p, "utf8"));

    const newlyLinked = linkConditionsInBundle(bundle);
    console.log(`[${docName}] Linked ${newlyLinked} unlinked conditions.`);

    await backfillNormalizedKo(bundle, client, docName);

    fs.writeFileSync(p, JSON.stringify(bundle, null, 2), "utf8");
  }

  console.log("\n=== Validating All Bundles Post-Backfill ===");
  const valRes = validateFiles(pilots);
  if (!valRes.ok) {
    console.error("Validation failed:", valRes.errors);
    process.exit(1);
  }

  console.log("All 4 pilot bundles validated successfully (0 errors)!");
  console.log("Archive Backfill and Enrichment complete!");
}

main().catch(console.error);
