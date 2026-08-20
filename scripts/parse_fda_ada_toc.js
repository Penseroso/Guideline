const fs = require("fs");
const path = require("path");
const { PDFParse } = require("pdf-parse");

const pdfPath = path.resolve(
  __dirname,
  "..",
  "source_pdfs",
  "FDA Immunogenicity Testing of Therapeutic Protein Products —Developing and Validating Assays for Anti-Drug Antibody Detection.pdf"
);

async function main() {
  const buffer = fs.readFileSync(pdfPath);
  const parser = new PDFParse(new Uint8Array(buffer));
  await parser.load();

  const info = await parser.getInfo();
  console.log("PDF Info:", info);

  const fullText = await parser.getText();
  console.log("Total Text Length:", fullText.length);

  fs.writeFileSync(path.resolve(__dirname, "..", "scratch_fda_ada_text.txt"), fullText, "utf8");
  console.log("Wrote full text to scratch_fda_ada_text.txt");

  // Let's print the Table of Contents or first 4000 characters
  console.log("\n=== First 4000 Characters ===\n");
  console.log(fullText.slice(0, 4000));
}

main().catch(console.error);
