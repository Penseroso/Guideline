const fs = require("node:fs");
const path = require("node:path");

const { summarySpecSha256 } = require("../validation/validate_semantic_overlay");

const ROOT = path.resolve(__dirname, "..");
const SEMANTIC_DIR = path.join(ROOT, "data", "derived", "semantic");
const PRESENTATION_DIR = path.join(ROOT, "data", "derived", "presentation", "ko");

function main() {
  for (const name of fs.readdirSync(PRESENTATION_DIR).filter((item) => item.endsWith(".json")).sort()) {
    const presentationFile = path.join(PRESENTATION_DIR, name);
    const semanticFile = path.join(SEMANTIC_DIR, name);
    const presentation = JSON.parse(fs.readFileSync(presentationFile, "utf8"));
    const semantic = JSON.parse(fs.readFileSync(semanticFile, "utf8"));
    const summaries = new Map(semantic.summary_specs.map((summary) => [summary.summary_id, summary]));
    presentation.presentation_overlay_version = "0.2.0";
    for (const entry of presentation.entries) {
      const summary = summaries.get(entry.semantic_id);
      if (!summary) throw new Error(`${entry.semantic_id} is not a summary_spec`);
      entry.summary_spec_sha256 = summarySpecSha256(summary);
      entry.facet_dispositions = summary.facet_ids.map((facetId) => ({
        facet_id: facetId,
        status: "covered",
        gap_reason: null
      }));
    }
    fs.writeFileSync(presentationFile, `${JSON.stringify(presentation, null, 2)}\n`, "utf8");
    console.log(`Migrated ${name}: ${presentation.entries.length} entry(ies)`);
  }
}

if (require.main === module) main();

