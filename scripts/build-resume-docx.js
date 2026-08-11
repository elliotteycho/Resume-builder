// Canonical resume .docx builder — implements docs/RESUME_LAYOUT_SPEC.md (the "Appian layout").
// Usage: node scripts/build-resume-docx.js <resume.json> <out.docx>
// resume.json shape: { resume: { header: {name, contact[]}, sections: [{title, entries: [{heading, subheading, dates, inline, bullets:[{text}]}]}] } }
const fs = require("fs");
const {
  Document, Packer, Paragraph, TextRun, BorderStyle, TabStopType, AlignmentType, convertInchesToTwip,
} = require("docx");

const FONT = "Times New Roman";
const SZ = 22;            // 11pt body
const SZ_SECTION = 24;    // 12pt section headers + contact line
const SZ_NAME = 56;       // 28pt name
const LINE = 256;         // 12.8pt exact — document default
const RIGHT_TAB = 10800;  // 7.5" right tab for dates

const { resume } = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
const outPath = process.argv[3];

const run = (text, opts = {}) => new TextRun({ text, font: FONT, size: SZ, ...opts });

function sectionHeader(title) {
  return new Paragraph({
    spacing: { before: 100, after: 20, line: LINE, lineRule: "exact" },
    border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: "000000", space: 1 } },
    children: [run(title, { bold: true, allCaps: true, size: SZ_SECTION })],
  });
}

function entryHeader(heading, subheading, dates) {
  const children = [run(heading, { bold: true })];
  if (subheading) {
    children.push(run(" | "));
    children.push(run(subheading, { italics: true }));
  }
  children.push(run("\t" + (dates || ""), { bold: true }));
  return new Paragraph({
    spacing: { before: 60, after: 10, line: LINE, lineRule: "exact" },
    tabStops: [{ type: TabStopType.RIGHT, position: RIGHT_TAB }],
    children,
  });
}

function bullet(text) {
  return new Paragraph({
    spacing: { after: 30, line: LINE, lineRule: "exact" },
    indent: { left: 274, hanging: 187 },
    children: [run("•  " + text)],
  });
}

function inlineLine(text, { labeled = true } = {}) {
  const m = labeled ? text.match(/^([^:]{2,30}):\s*(.*)$/) : null;
  const spacing = { after: m ? 25 : 0, line: LINE, lineRule: "exact" };
  if (m) return new Paragraph({ spacing, children: [run(m[1] + ":", { bold: true }), run(" " + m[2])] });
  return new Paragraph({ spacing, children: [run(text)] });
}

const children = [];
children.push(new Paragraph({
  alignment: AlignmentType.CENTER,
  spacing: { before: 240, after: 40, line: 400, lineRule: "exact" },
  children: [run(resume.header.name, { bold: true, size: SZ_NAME })],
}));
children.push(new Paragraph({
  alignment: AlignmentType.CENTER,
  spacing: { after: 40, line: LINE, lineRule: "exact" },
  children: [run(resume.header.contact.join(" | "), { size: SZ_SECTION })],
}));

for (const section of resume.sections) {
  children.push(sectionHeader(section.title));
  for (const entry of section.entries) {
    if (entry.heading || entry.dates) children.push(entryHeader(entry.heading, entry.subheading, entry.dates));
    if (entry.inline) children.push(inlineLine(entry.inline));
    for (const b of entry.bullets || []) children.push(bullet(b.text ?? b));
  }
}

const doc = new Document({
  creator: resume.header.name,
  title: resume.header.name + " - Resume",
  styles: { default: { document: {
    run: { font: FONT, size: SZ },
    paragraph: { spacing: { line: LINE, lineRule: "exact", before: 0, after: 0 } },
  } } },
  sections: [{
    properties: { page: {
      size: { width: convertInchesToTwip(8.5), height: convertInchesToTwip(11) },
      margin: { top: 576, bottom: 576, left: 720, right: 720 },
    } },
    children,
  }],
});

Packer.toBuffer(doc).then((buf) => { fs.writeFileSync(outPath, buf); console.log("wrote", outPath, buf.length, "bytes"); });
