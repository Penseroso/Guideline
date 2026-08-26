const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const { parseArgs, runEvaluate } = require("../engine/applicability_cli");

test("parseArgs reads --flag value pairs", () => {
  assert.deepEqual(parseArgs(["--context", "ctx.json", "--rules", "a,b,c"]), { context: "ctx.json", rules: "a,b,c" });
});

test("parseArgs returns an empty object for no flags", () => {
  assert.deepEqual(parseArgs([]), {});
});

test("runEvaluate against the real S6(R1) archive: a species-selection rule reads applicable with a real context", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "applicability_cli_e2e_"));
  try {
    const file = path.join(dir, "ctx.json");
    fs.writeFileSync(file, JSON.stringify({ product_modality: "monoclonal_antibody" }));

    let output = "";
    const originalLog = console.log;
    console.log = (msg) => { output += msg + "\n"; };
    try {
      await runEvaluate({ contextFile: file, ruleIds: ["ich_s6_r1.kr.part1.3_3.002"] });
    } finally {
      console.log = originalLog;
    }
    assert.match(output, /Verdict: applicable/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("runEvaluate exits with an error message (not a crash) for an unknown rule_id", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "applicability_cli_e2e_"));
  try {
    const file = path.join(dir, "ctx.json");
    fs.writeFileSync(file, JSON.stringify({}));

    let errorOutput = "";
    const originalError = console.error;
    const originalLog = console.log;
    console.error = (msg) => { errorOutput += msg + "\n"; };
    console.log = () => {};
    try {
      await runEvaluate({ contextFile: file, ruleIds: ["not.a.real.rule"] });
    } finally {
      console.error = originalError;
      console.log = originalLog;
    }
    assert.match(errorOutput, /unknown rule_id/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("runEvaluate with --question discovers candidates and evaluates them, printing the discovery list before the findings", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "applicability_cli_e2e_"));
  try {
    const file = path.join(dir, "ctx.json");
    fs.writeFileSync(file, JSON.stringify({ product_modality: "monoclonal_antibody" }));

    let output = "";
    const originalLog = console.log;
    console.log = (msg) => { output += msg + "\n"; };
    try {
      await runEvaluate({ contextFile: file, question: "species selection monoclonal antibody", topK: 3 });
    } finally {
      console.log = originalLog;
    }
    assert.match(output, /Found \d+ candidate rule/);
    assert.match(output, /Verdict:/, "must go on to actually evaluate the discovered candidates, not just list them");
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("runEvaluate reports no candidates found rather than crashing when nothing matches", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "applicability_cli_e2e_"));
  try {
    const file = path.join(dir, "ctx.json");
    fs.writeFileSync(file, JSON.stringify({}));

    let output = "";
    const originalLog = console.log;
    console.log = (msg) => { output += msg + "\n"; };
    try {
      await runEvaluate({ contextFile: file, question: "completely unrelated gibberish xyzzy plugh" });
    } finally {
      console.log = originalLog;
    }
    assert.match(output, /No candidate rules found/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
