import {
  BorderStyle,
  Document,
  LineRuleType,
  Packer,
  Paragraph,
  Tab,
  TabStopType,
  TextRun,
  convertInchesToTwip,
} from "docx";
import type { Resume } from "@/lib/types";

// ATS-clean template modeled on the Yale College technical resume:
// Times New Roman throughout, 0.5" margins, ALL-CAPS bordered section
// headers, dates right-aligned via a tab stop at the content edge.
const FONT = "Times New Roman";
const BODY_HALF_PT = 22; // 11pt
const NAME_HALF_PT = 42; // 21pt
const CONTENT_WIDTH_IN = 7.5;
const MARGIN = convertInchesToTwip(0.5);
const RIGHT_TAB = convertInchesToTwip(CONTENT_WIDTH_IN);

function run(text: string, opts: { bold?: boolean; italics?: boolean; size?: number } = {}): TextRun {
  return new TextRun({
    text,
    font: FONT,
    size: opts.size ?? BODY_HALF_PT,
    bold: opts.bold,
    italics: opts.italics,
  });
}

function body(children: TextRun[], opts: { before?: number; after?: number } = {}): Paragraph {
  return new Paragraph({
    children,
    spacing: {
      before: opts.before ?? 0,
      after: opts.after ?? 0,
      line: 240,
      lineRule: LineRuleType.EXACT,
    },
  });
}

function sectionHeader(title: string): Paragraph {
  return new Paragraph({
    children: [run(title.toUpperCase(), { bold: true })],
    spacing: { before: 100, after: 20, line: 240, lineRule: LineRuleType.EXACT },
    border: {
      bottom: { style: BorderStyle.SINGLE, size: 6, space: 1, color: "000000" },
    },
  });
}

function entryHeader(heading: string, subheading: string, dates: string): Paragraph {
  const children: (TextRun | Tab)[] = [];
  if (heading) children.push(run(heading, { bold: true }));
  if (subheading) {
    if (children.length > 0) children.push(run(" | "));
    children.push(run(subheading, { italics: true }));
  }
  if (dates) {
    children.push(new TextRun({ children: [new Tab()], font: FONT, size: BODY_HALF_PT }));
    children.push(run(dates));
  }
  return new Paragraph({
    children,
    tabStops: [{ type: TabStopType.RIGHT, position: RIGHT_TAB }],
    spacing: { before: 90, after: 0, line: 240, lineRule: LineRuleType.EXACT },
  });
}

export async function resumeToDocx(resume: Resume): Promise<Buffer> {
  const children: Paragraph[] = [];

  // Header: name (auto line height so the large font isn't clipped) + tagline + contact
  children.push(
    new Paragraph({
      children: [run(resume.header.name, { bold: true, size: NAME_HALF_PT })],
      spacing: { before: 0, after: 0, line: 420, lineRule: LineRuleType.AUTO },
    })
  );
  if (resume.header.tagline) {
    children.push(body([run(resume.header.tagline, { italics: true })]));
  }
  if (resume.header.contact.length > 0) {
    children.push(body([run(resume.header.contact.join(" | "))], { after: 60 }));
  }

  if (resume.summary) {
    children.push(body([run(resume.summary)], { after: 40 }));
  }

  for (const section of resume.sections) {
    children.push(sectionHeader(section.title));
    for (const entry of section.entries) {
      if (entry.heading || entry.subheading || entry.dates) {
        children.push(entryHeader(entry.heading, entry.subheading, entry.dates));
      }
      if (entry.inline) {
        children.push(body([run(entry.inline)]));
      }
      for (const bullet of entry.bullets) {
        children.push(body([run(`•  ${bullet.text}`)]));
      }
    }
  }

  const doc = new Document({
    styles: {
      default: {
        document: { run: { font: FONT, size: BODY_HALF_PT } },
      },
    },
    sections: [
      {
        properties: {
          page: {
            margin: { top: MARGIN, bottom: MARGIN, left: MARGIN, right: MARGIN },
          },
        },
        children,
      },
    ],
  });

  return Packer.toBuffer(doc);
}
