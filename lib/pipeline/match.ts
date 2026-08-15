import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { getClient, MODEL } from "@/lib/anthropic";
import { MatchResultSchema, type MatchResult } from "@/lib/hq/types";
import type { MatchCardView } from "@/lib/hq/bank";
import type { JobAnalysis } from "@/lib/types";

const SYSTEM = `You score how well a student's experience matches a job posting, for a recruiting tracker.

You are given the posting's cached analysis (themes, requirements, keywords) and the student's experience cards. Each card has an id. Return a score, a headline, per-card reasons, and honest gaps.

Rules:
- Cite cards by their exact id. Never invent an id, and never cite a card that is not in the list.
- One reason per card that genuinely answers a theme. A card that only loosely relates is not a reason — leave it out.
- Score strictly against the pool that actually applies to this posting. 70+ means the student is competitive against typical applicants for this specific program; 45-69 means worth applying but with real gaps; below 45 means the experience does not yet support it.
- Gaps are requirements the cards cannot support. Name them plainly. Do not pad the list, and do not soften a real gap into a strength.
- The headline is one sentence a student can act on: what makes them credible here, or what is missing. No hedging, no encouragement.

Numbers shown to you have already been verified. Numbers that were unverified appear as a redaction marker — treat those as absent, and never restate a redacted figure.`;

/**
 * The cheap path: one structured call per user-posting pair.
 *
 * Deliberately not the full pipeline — no research, no reframe, no synthesis.
 * The posting's analysis is read from cache, so this is the only model call the
 * match costs, and the result is cached until the profile or the posting
 * changes.
 */
export async function scoreMatch(
  analysis: JobAnalysis,
  cards: MatchCardView[],
  profileSummary: string
): Promise<MatchResult> {
  const client = getClient();

  const postingBrief = [
    `Company: ${analysis.company.name} — ${analysis.company.industry}, ${analysis.company.market_segment}`,
    `Role: ${analysis.role.title} (${analysis.role.seniority}, ${analysis.role.family})`,
    "",
    "Themes:",
    ...analysis.themes.map((t) => `- ${t.id}: ${t.name}`),
    "",
    "Non-negotiable requirements:",
    ...analysis.requirements.non_negotiable.map((r) => `- ${r}`),
    "",
    "Hard skills:",
    analysis.requirements.hard_skills.join(", "),
    "",
    "What makes someone succeed here:",
    ...analysis.success_factors.map((s) => `- ${s}`),
  ].join("\n");

  const cardBrief = cards
    .map((c) =>
      [
        `<card id="${c.id}" lane="${c.lane}">`,
        `${c.title}${c.organization ? ` — ${c.organization}` : ""} (${c.period})`,
        c.capabilities.length ? `Capabilities: ${c.capabilities.join(", ")}` : "",
        c.skills.length ? `Skills: ${c.skills.join(", ")}` : "",
        ...c.bullets.map((b) => `- ${b}`),
        c.evidence.length
          ? `Verified metrics: ${c.evidence.map((e) => `${e.metric} (${e.claim})`).join("; ")}`
          : "",
        "</card>",
      ]
        .filter(Boolean)
        .join("\n")
    )
    .join("\n\n");

  const response = await client.messages.parse({
    model: MODEL,
    max_tokens: 4096,
    thinking: { type: "adaptive" },
    system: SYSTEM,
    messages: [
      {
        role: "user",
        content: `<posting>\n${postingBrief}\n</posting>\n\n<candidate>\n${profileSummary}\n</candidate>\n\n<experience_cards>\n${cardBrief}\n</experience_cards>`,
      },
    ],
    output_config: {
      format: zodOutputFormat(MatchResultSchema),
      effort: "medium",
    },
  });

  if (!response.parsed_output) {
    throw new Error("Failed to score the match");
  }

  // The model can still name a card that isn't in the pool. Drop those rather
  // than letting the Profile UI try to highlight a card that doesn't exist.
  const known = new Set(cards.map((c) => c.id));
  return {
    ...response.parsed_output,
    reasons: response.parsed_output.reasons.filter((r) => known.has(r.card_id)),
  };
}
