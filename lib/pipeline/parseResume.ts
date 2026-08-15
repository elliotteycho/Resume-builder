import type Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import { getClient, MODEL } from "@/lib/anthropic";
import { EvidenceSchema } from "@/lib/types";
import { LANES } from "@/lib/hq/config";

/**
 * Resume import: a PDF, Word doc, or pasted text becomes experience cards.
 *
 * PDFs go to the model as native document blocks — no text-extraction library,
 * and layout survives, which matters because resumes carry meaning in columns
 * and date alignment. Word documents are unzipped to text first.
 */

const ParsedCardSchema = z.object({
  lane: z
    .enum(LANES)
    .describe(
      "professional = jobs and internships; projects = personal, academic, or research work; leadership = clubs, orgs, volunteering; education = degrees"
    ),
  title: z.string().describe("Role title, project name, or degree"),
  organization: z.string().describe("Employer, school, or org; empty string if none"),
  location: z.string().default(""),
  start_date: z.string().describe("YYYY-MM. Empty string if the resume gives no start"),
  end_date: z.string().describe("YYYY-MM, or empty string for present/ongoing"),
  bullets: z
    .array(z.string())
    .describe("Every bullet, copied verbatim from the resume. Do not rewrite, merge, or shorten."),
  skills: z.array(z.string()).default([]).describe("Tools and technologies named in this entry"),
  capabilities: z
    .array(z.string())
    .default([])
    .describe(
      "Concept-level signals this entry demonstrates, e.g. 'prioritization under ambiguity', 'user research'. 3-6 per entry."
    ),
  link: z.string().default(""),
  evidence: z
    .array(EvidenceSchema)
    .default([])
    .describe(
      "One record per number that appears in this entry's bullets. Copy the metric token verbatim."
    ),
});

const ParsedResumeSchema = z.object({
  profile: z.object({
    name: z.string(),
    email: z.string().default(""),
    phone: z.string().default(""),
    location: z.string().default(""),
    school: z.string().default("").describe("Most recent institution"),
    grad_year: z.string().default("").describe("Four-digit expected graduation year"),
    majors: z.array(z.string()).default([]),
    gpa: z.number().nullable().default(null),
    links: z.array(z.string()).default([]),
  }),
  cards: z.array(ParsedCardSchema),
});

export type ParsedResume = z.infer<typeof ParsedResumeSchema>;

const SYSTEM = `You convert a resume into structured experience cards. You are a transcriber, not a writer.

Hard rules:
- Copy bullets verbatim. Do not rewrite, improve, condense, merge, or split them. If a bullet wraps across lines, join it into one string exactly as written.
- Never invent an entry, a date, a number, or a bullet that is not on the page.
- Dates: normalize to YYYY-MM. "Summer 2025" with no month is 2025-06. An ongoing role has an empty end_date.

Two fields are yours to derive, and only these two:
- capabilities: concept-level signals the entry demonstrates, phrased as capabilities rather than keywords ("deciding what to build with incomplete data", not "Jira"). Read what the work actually required.
- evidence: one record per number in the entry's bullets. Copy the metric token exactly as written ("40%", "$1.8M", "198 charities"). The claim is what that number substantiates. Provenance is empty — the person will fill it in. Confidence is your read of how checkable the number is from the resume alone: high if it is specific and attributable, medium if it is plausible but unverifiable here, low if it is vague or rounded.

Order cards newest first within each lane.`;

/** Turn the raw bytes of an upload into the content block the model reads. */
async function toContent(
  file: { name: string; type: string; bytes: Buffer } | { text: string }
): Promise<Anthropic.ContentBlockParam[]> {
  if ("text" in file) {
    return [{ type: "text", text: `<resume>\n${file.text}\n</resume>` }];
  }

  const lower = file.name.toLowerCase();

  if (lower.endsWith(".pdf") || file.type === "application/pdf") {
    return [
      {
        type: "document",
        source: {
          type: "base64",
          media_type: "application/pdf",
          data: file.bytes.toString("base64"),
        },
      },
    ];
  }

  if (lower.endsWith(".docx")) {
    // Imported lazily so a text-only import never pays for the dependency.
    const mammoth = await import("mammoth");
    const { value } = await mammoth.extractRawText({ buffer: file.bytes });
    return [{ type: "text", text: `<resume>\n${value}\n</resume>` }];
  }

  if (lower.endsWith(".txt") || lower.endsWith(".md")) {
    return [{ type: "text", text: `<resume>\n${file.bytes.toString("utf-8")}\n</resume>` }];
  }

  throw new Error(
    `Unsupported resume format: ${file.name}. Upload a PDF, .docx, .txt, or .md, or paste the text.`
  );
}

export async function parseResume(
  input: { name: string; type: string; bytes: Buffer } | { text: string }
): Promise<ParsedResume> {
  const client = getClient();
  const content = await toContent(input);

  const response = await client.messages.parse({
    model: MODEL,
    max_tokens: 16000,
    thinking: { type: "adaptive" },
    system: SYSTEM,
    messages: [
      {
        role: "user",
        content: [
          ...content,
          { type: "text", text: "Convert this resume into experience cards." },
        ],
      },
    ],
    output_config: {
      format: zodOutputFormat(ParsedResumeSchema),
      effort: "high",
    },
  });

  if (!response.parsed_output) {
    throw new Error("Could not read that resume. Try pasting the text instead.");
  }
  return response.parsed_output;
}

/** The plain text of the resume, kept on the profile for later reference. */
export async function resumeToText(
  input: { name: string; type: string; bytes: Buffer } | { text: string }
): Promise<string> {
  if ("text" in input) return input.text;
  const lower = input.name.toLowerCase();
  if (lower.endsWith(".docx")) {
    const mammoth = await import("mammoth");
    const { value } = await mammoth.extractRawText({ buffer: input.bytes });
    return value;
  }
  if (lower.endsWith(".txt") || lower.endsWith(".md")) {
    return input.bytes.toString("utf-8");
  }
  // PDFs are read by the model directly; there is no local text to keep.
  return "";
}
