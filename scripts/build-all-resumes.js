// Batch resume builder — renders every tailored resume JSON into .docx files in one command.
// Usage: node scripts/build-all-resumes.js [inputDir] [outputDir]
//   inputDir  defaults to data/resumes  (git-ignored; personal content never enters the repo)
//   outputDir defaults to resumes       (git-ignored; point it at any folder, e.g. a Drive-synced one)
// Each <name>-resume.json becomes ElliottCho_<Company>_Resume.docx, named from the JSON's "company" field.
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const inputDir = process.argv[2] || path.join(__dirname, "..", "data", "resumes");
const outputDir = process.argv[3] || path.join(__dirname, "..", "resumes");
const builder = path.join(__dirname, "build-resume-docx.js");

if (!fs.existsSync(inputDir)) {
  console.error(`No input folder at ${inputDir} — create it and drop your *-resume.json files in.`);
  process.exit(1);
}
fs.mkdirSync(outputDir, { recursive: true });

const jsons = fs.readdirSync(inputDir).filter((f) => f.endsWith("-resume.json"));
if (jsons.length === 0) {
  console.error(`No *-resume.json files found in ${inputDir}.`);
  process.exit(1);
}

let built = 0;
for (const file of jsons) {
  const src = path.join(inputDir, file);
  let company;
  try {
    company = JSON.parse(fs.readFileSync(src, "utf8")).company;
  } catch (e) {
    console.error(`skip ${file}: ${e.message}`);
    continue;
  }
  const safe = String(company || path.basename(file, "-resume.json")).replace(/[^A-Za-z0-9]/g, "");
  const out = path.join(outputDir, `ElliottCho_${safe}_Resume.docx`);
  const r = spawnSync(process.execPath, [builder, src, out], { stdio: "inherit" });
  if (r.status === 0) built++;
}
console.log(`Built ${built}/${jsons.length} resumes into ${outputDir}`);
