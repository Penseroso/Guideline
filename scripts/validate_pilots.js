const fs = require("fs");
const path = require("path");

const { validateFiles } = require("./validate_structured_data");

const ROOT = path.resolve(__dirname, "..");
const PILOTS_DIR = path.join(ROOT, "structured_data", "pilots");

function discoverJsonFiles(directory) {
  const entries = fs.readdirSync(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...discoverJsonFiles(fullPath));
    } else if (entry.isFile() && path.extname(entry.name).toLowerCase() === ".json") {
      files.push(fullPath);
    }
  }

  return files.sort((a, b) => a.localeCompare(b));
}

function main() {
  const files = discoverJsonFiles(PILOTS_DIR);
  if (files.length === 0) {
    console.error(`No JSON files found under ${path.relative(ROOT, PILOTS_DIR)}.`);
    process.exit(2);
  }

  const result = validateFiles(files);
  if (!result.ok) {
    console.error(`Validation failed with ${result.errors.length} error(s):`);
    for (const error of result.errors) console.error(`- ${error}`);
    process.exit(1);
  }

  console.log(`Validated ${result.bundleCount} pilot bundle(s).`);
}

if (require.main === module) {
  main();
}

module.exports = {
  discoverJsonFiles
};
