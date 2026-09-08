/**
 * One-way, idempotent Stage E0 migration for committed semantic overlays.
 *
 * Version 0.3.0 adds review_status to salience_profiles, which previously had
 * no gate distinguishing authored-but-unreviewed profiles from ones safe to
 * serve. None of the existing profiles have ever been through review, so
 * every one starts at needs_review regardless of how long it has existed.
 */
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const OVERLAY_DIR = path.join(ROOT, "data", "derived", "semantic");

function main() {
  const files = fs.readdirSync(OVERLAY_DIR).filter((name) => name.endsWith(".json")).sort();
  for (const name of files) {
    const file = path.join(OVERLAY_DIR, name);
    const overlay = JSON.parse(fs.readFileSync(file, "utf8"));
    overlay.semantic_overlay_version = "0.3.0";
    overlay.salience_profiles = (overlay.salience_profiles || []).map((profile) => ({
      ...profile,
      review_status: profile.review_status || "needs_review"
    }));
    fs.writeFileSync(file, `${JSON.stringify(overlay, null, 2)}\n`, "utf8");
    console.log(`Migrated ${path.relative(ROOT, file)}`);
  }
}

if (require.main === module) main();

module.exports = { main };
