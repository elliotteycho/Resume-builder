import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { getClient, MODEL } from "@/lib/anthropic";
import {
  ResumeSchema,
  type ExperienceBank,
  type JobAnalysis,
  type Reframe,
  type ResearchFindings,
  type Resume,
} from "@/lib/types";

export const SYNTHESIS_RULES = `THE OPERATING MODEL — embodiment, not selection:
- The job description is the gravitational center. You are not scoring experiences against it; you are rewriting the candidate's material so the resume becomes an embodiment of what the posting actually wants and how the company actually talks.
- Themes beat keywords. A posting that says "we value skillful prioritization" wants someone who thinks in trade-offs, not someone with the word "prioritization" on the page.
- Voice matters. Absorb the company's tone, altitude, and vocabulary from the reframing map, then write in that register. NEVER paste the company's or posting's phrases — embodiment, not copy. If the posting says "skillful prioritization", a bullet may demonstrate prioritization, but that phrase must not appear.
- Each bullet carries the one or two themes listed in its \`themes\` field — never all of them. Cramming every theme into every bullet reads as performative. The resume as a whole covers the themes; individual bullets pick their spots.

BULLET CRAFT (follow the per-entry directives from the reframing map):
- Lead each bullet with a verb from the entry's assigned verb register. Frame around the strategic question or the listening act, not just the deliverable: "Diagnosed the growth bottleneck by auditing 198 accounts" beats "Owned production audit of 198 accounts".
- Write in Action, Responsibility, Impact order. Anchor with the entry's anchor metric or another verified number from the bank.
- Mix registers across the resume so it is not all one voice; keep doer verbs where the posting genuinely wants execution.
- Aim for 150-200 characters per bullet — substantial but tight; never exceed 210.

HARD RULES (violations will be rejected by an automated verifier):
1. RETRIEVAL DECIDES THE FACTS; YOU DECIDE ONLY SELECTION AND PHRASING. Every number on the resume must be copied CHARACTER-FOR-CHARACTER from the bank's evidence records or its identity facts (education, certifications, awards, dates). Never regenerate, round, combine, or paraphrase a number — writing "over 20%" when the evidence says "23%" is fabrication, and so is promoting "12" to "a dozen major". If no verified metric supports a claim, write the bullet without a number; a strong qualitative bullet beats an invented quantitative one. The marker "[unverified metric removed]" flags numbers you are NOT permitted to use — never reproduce the marker and never guess what it hid. Requirements the bank can't support go in tailoring_notes.gaps — never invented.
2. No two bullets anywhere on the resume start with the same first verb.
3. No em dashes or en dashes anywhere. No smart/curly quotes. Plain ASCII punctuation only.
4. Date ranges use a plain ASCII hyphen: "January 2026 - April 2026".
5. Never reproduce a phrase of 5+ consecutive words from the job description.
6. Follow the industry's conventions from the research: section order, section naming, what to include or omit, summary/no-summary, length norms.`;

export async function synthesizeResume(
  analysis: JobAnalysis,
  research: ResearchFindings,
  reframe: Reframe,
  bank: ExperienceBank,
  guidance?: string
): Promise<Resume> {
  const client = getClient();

  const system = `You are an elite resume writer who tailors resumes to the specific intricacies of each industry and role.
You will receive: (1) a structured analysis of the job posting including its themes, (2) fresh research on the company, market, and this industry's resume conventions, (3) a REFRAMING MAP with per-entry directives — your build brief, and (4) the candidate's complete experience bank.

Build the resume from the reframing map's directives: use its selected entries, carry the assigned themes, lead with the assigned verb registers, anchor on the assigned metrics.

${SYNTHESIS_RULES}`;

  const userContent = `<job_analysis>
${JSON.stringify(analysis, null, 2)}
</job_analysis>

<company_research>
${research.company}
</company_research>

<market_research>
${research.market}
</market_research>

<resume_conventions_research>
${research.conventions}
</resume_conventions_research>

<reframing_map>
${JSON.stringify(reframe, null, 2)}
</reframing_map>

<experience_bank>
${JSON.stringify(bank, null, 2)}
</experience_bank>
${guidance?.trim() ? `\n<user_guidance>\n${guidance.trim()}\n</user_guidance>\n` : ""}
Write the tailored resume now.`;

  const response = await client.messages.parse({
    model: MODEL,
    max_tokens: 16000,
    thinking: { type: "adaptive" },
    output_config: {
      effort: "high",
      format: zodOutputFormat(ResumeSchema),
    },
    system,
    messages: [{ role: "user", content: userContent }],
  });

  if (!response.parsed_output) {
    throw new Error("Failed to generate resume");
  }
  return response.parsed_output;
}
