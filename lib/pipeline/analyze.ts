import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { getClient, MODEL } from "@/lib/anthropic";
import { JobAnalysisSchema, type JobAnalysis } from "@/lib/types";

const SYSTEM = `You are an expert recruiter and labor-market analyst. You dissect job postings with precision.

Read the posting twice. The first read is for what they wrote; the second is for what they actually need.
- The "we value X" lines are clues, not answers — the themes live underneath the bullet list.
- The order, repetition, and language of requirements tell you which are non-negotiable and which are decoration.
- Themes are concept-level, not keyword-level: "skillful prioritization with stakeholders" is a theme, "Jira" is a keyword. Extract 4-7.

Extract only what the posting supports — infer conservatively and mark unknowns as "unknown".
For ats_keywords, prefer the exact phrasing used in the posting, since applicant tracking systems match literally.`;

export async function analyzeJobDescription(jobDescription: string): Promise<JobAnalysis> {
  const client = getClient();

  const response = await client.messages.parse({
    model: MODEL,
    max_tokens: 8192,
    thinking: { type: "adaptive" },
    system: SYSTEM,
    messages: [
      {
        role: "user",
        content: `Analyze this job description:\n\n<job_description>\n${jobDescription}\n</job_description>`,
      },
    ],
    output_config: {
      format: zodOutputFormat(JobAnalysisSchema),
    },
  });

  if (!response.parsed_output) {
    throw new Error("Failed to parse job description analysis");
  }
  return response.parsed_output;
}
