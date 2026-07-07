import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { getClient, MODEL } from "@/lib/anthropic";
import {
  ReframeSchema,
  type ExperienceBank,
  type JobAnalysis,
  type Reframe,
  type ResearchFindings,
} from "@/lib/types";

const SYSTEM = `You are a reframe engine. Two input lanes have already run: (1) a structured parse of the job description, and (2) fresh research on the company and its market. Your job is to FUSE them into a reframing map that a resume writer will build from.

The job description is not a scoring input — it is the gravitational center. The resume will be rewritten around it, not graded against it.

Produce:
1. A belief vector: 3-5 statements compressing what this company believes — about itself, its customers, how work gets done. Draw from the research (mission, values, voice), not the JD alone.
2. A demand vector: 4-7 ranked demands from the posting, tagged required / qualification / preference. Most load-bearing first.
3. Voice notes: tone, altitude, recurring vocabulary, one-liner — absorbed from the research so the writer can write IN the company's voice without ever pasting its phrases.
4. An embodiment matrix, expressed as per-entry directives: cross the demands and themes against the candidate's actual experiences. For each theme, ask: which experiences GENUINELY demonstrate this? Select the entries with highest theme density — the resume as a whole must cover all themes; each entry picks its one to three spots. For each selected entry emit: themes carried, verb register, framing angle, anchor metric (a verified number from the bank — never invented), and a one-line rationale.

Verb registers (choose per entry, matched to its themes):
- diagnostic: Diagnosed, Surfaced, Reframed, Identified, Untangled, Pressure-tested
- listening: Listened, Read, Mapped, Observed, Interviewed, Audited
- weighing: Negotiated, Weighed, Balanced, Sequenced, Prioritized, Ranked
- clarity: Translated, Distilled, Brokered, Synthesized, Bridged
- imagination: Reimagined, Redesigned, Pivoted, Challenged, Reshaped
- building: Shipped, Architected, Engineered, Designed, Built, Prototyped
- doer: Drove, Led, Owned, Delivered, Coordinated (when the posting genuinely wants execution rather than thinking)

Select enough entries for a strong one-page resume for this seniority (typically 5-8 across work, projects, and leadership/activities; more experienced candidates may need fewer, deeper entries). Use the exact entry names from the bank. If the industry conventions research implies a different mix (e.g. projects matter more for this role), follow it.`;

export async function reframeSynthesis(
  analysis: JobAnalysis,
  research: ResearchFindings,
  bank: ExperienceBank,
  guidance?: string
): Promise<Reframe> {
  const client = getClient();

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

<experience_bank>
${JSON.stringify(bank, null, 2)}
</experience_bank>
${guidance?.trim() ? `\n<user_guidance>\n${guidance.trim()}\n</user_guidance>\n` : ""}
Produce the reframing map now.`;

  const response = await client.messages.parse({
    model: MODEL,
    max_tokens: 8192,
    thinking: { type: "adaptive" },
    output_config: {
      effort: "high",
      format: zodOutputFormat(ReframeSchema),
    },
    system: SYSTEM,
    messages: [{ role: "user", content: userContent }],
  });

  if (!response.parsed_output) {
    throw new Error("Failed to produce reframing map");
  }
  return response.parsed_output;
}
