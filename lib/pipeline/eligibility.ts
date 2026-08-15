import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { getClient, MODEL } from "@/lib/anthropic";
import { EligibilitySchema, type Eligibility } from "@/lib/hq/types";

const SYSTEM = `You extract hard screening criteria from a job posting so a program can check eligibility without judgment calls.

Read only the qualifications, requirements, and eligibility language. Your job is extraction, not inference:
- Record a criterion only when the posting states it. An unstated criterion is an empty array or null, never a guess.
- Graduation years: normalize to four-digit years. "Graduating in 2027 or 2028" is ["2027","2028"]. "Rising senior" alone is a class-standing statement, not a graduation year.
- Class years: 1 = first year, 2 = sophomore, 3 = junior, 4 = senior. "Rising senior" means the student is a 3 now, so [3].
- Degree levels: only list a level the posting actually restricts to. A posting open to undergrads and MBAs lists both.
- requires_citizenship is true only for explicit U.S. citizenship or clearance-eligibility language, not for "must be authorized to work".
- requires_sponsorship_free is true when the posting says it will not sponsor a visa.
- min_years_experience: professional years demanded. Internships that say "no experience required" are null, not 0.

Put anything conditional, ambiguous, or worth a human read into notes, in one sentence.`;

/**
 * Derive the deterministic eligibility gate for a posting.
 *
 * This runs once per posting and is cached on the shared row, so the model
 * reads a given JD's qualifications exactly once for all users. Every
 * subsequent eligibility check is `lib/hq/eligibility.ts` — pure code.
 */
export async function extractEligibility(jobDescription: string): Promise<Eligibility> {
  const client = getClient();

  const response = await client.messages.parse({
    model: MODEL,
    max_tokens: 4096,
    thinking: { type: "adaptive" },
    system: SYSTEM,
    messages: [
      {
        role: "user",
        content: `Extract the hard screening criteria from this posting:\n\n<job_description>\n${jobDescription}\n</job_description>`,
      },
    ],
    output_config: {
      format: zodOutputFormat(EligibilitySchema),
      effort: "medium",
    },
  });

  if (!response.parsed_output) {
    throw new Error("Failed to extract eligibility criteria");
  }
  return response.parsed_output;
}
