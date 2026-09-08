/**
 * One-way, idempotent Stage D0 migration for committed semantic overlays.
 *
 * Version 0.2.0 makes the denominator used for served coverage explicit.
 * Precision-oriented, cross-section criteria keep their curated member set;
 * structural document/section facets use the live core section census.
 */
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const OVERLAY_DIR = path.join(ROOT, "data", "derived", "semantic");

function basisForFacet(facet) {
  const id = facet.facet_id || "";
  if (id.startsWith("ich_m10.sem.facet.run_acceptance")) return "declared_members";
  if (id.startsWith("fda_ada.sem.facet.screening_performance.") && facet.member_record_ids.length > 0) {
    return "declared_members";
  }
  return "section_census";
}

function main() {
  const files = fs.readdirSync(OVERLAY_DIR).filter((name) => name.endsWith(".json")).sort();
  for (const name of files) {
    const file = path.join(OVERLAY_DIR, name);
    const overlay = JSON.parse(fs.readFileSync(file, "utf8"));
    overlay.semantic_overlay_version = "0.2.0";
    overlay.facets = overlay.facets.map((facet) => ({
      ...facet,
      coverage_basis: basisForFacet(facet)
    }));
    fs.writeFileSync(file, `${JSON.stringify(overlay, null, 2)}\n`, "utf8");
    console.log(`Migrated ${path.relative(ROOT, file)}`);
  }
}

if (require.main === module) main();

module.exports = { basisForFacet };
