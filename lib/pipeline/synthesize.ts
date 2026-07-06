import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { getClient, MODEL } from "@/lib/anthropic";
import {
  ResumeSchema,
  type ExperienceBank,
  type JobAnalysis,
  type ResearchFindings,
  type Resume,
} from "@/lib/types";

const SYSTEM = `You are an elite resume writer who tailors resumes to the specific intricacies of each industry and role.
You will receive: (1) a structured analysis of a job posting, (2) fresh research on the company, the role's market, and this industry's resume conventions, and (3) the candidate's complete experience bank.

Rules:
- NEVER fabricate. Every claim must be supported by the experience bank. If the posting demands something the bank can't support, list it in tailoring_notes.gaps instead of inventing it.
- Follow the industry's resume conventions from the research: section order, section naming, bullet style, what to include or omit, length norms.
- Select and reorder — do not dump the whole bank. Choose the experiences and bullets most relevant to this role; rewrite bullets to lead with impact and mirror the posting's language.
- Weave in the ATS keywords naturally where the candidate's experience genuinely supports them.
- Match technical depth and vocabulary to the role's seniority and the industry's expectations (e.g. quantified deal metrics for finance, patient outcomes for healthcare, scale/latency numbers for software).
- Use research insights about the company to sharpen positioning (e.g. emphasize regulated-industry experience for a compliance-heavy company), but keep the resume about the candidate, not the company.`;

export async function synthesizeResume(
  analysis: JobAnalysis,
  research: ResearchFindings,
  bank: ExperienceBank
): Promise<Resume> {
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

Write the tailored resume now.`;

  const response = await client.messages.parse({
    model: MODEL,
    max_tokens: 16000,
    thinking: { type: "adaptive" },
    output_config: {
      effort: "high",
      format: zodOutputFormat(ResumeSchema),
    },
    system: SYSTEM,
    messages: [{ role: "user", content: userContent }],
  });

  if (!response.parsed_output) {
    throw new Error("Failed to generate resume");
  }
  return response.parsed_output;
}
