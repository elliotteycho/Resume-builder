import type Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { getClient, MODEL } from "@/lib/anthropic";
import { CompanyBriefSchema, type CompanyBrief, type Profile } from "@/lib/hq/types";

/**
 * Company research and a networking plan, written for one specific student.
 *
 * Two stages: a web-search agent gathers current facts, then a structured pass
 * turns them into a brief plus concrete people to reach.
 *
 * On LinkedIn: there is no LinkedIn API here, and scraping it would violate
 * their terms. What this produces instead is honest and more useful anyway —
 * search URLs with the right filter combination, the archetypes worth
 * filtering for, and a first message for each. The student runs the search;
 * the app does the thinking about who to look for and what to say.
 */

const RESEARCH_SYSTEM = `You are researching one company on behalf of a specific student who is about to apply there and wants a warm introduction.

Search the web for current, factual information. Return concise markdown with these sections:

## What they do
Plainly, in two or three sentences. Their business model and who pays them.

## Recent developments
Launches, funding, reorgs, earnings, leadership changes in roughly the last year. Date each one.

## How product works here
How the product organization is structured, what PMs actually own, and how the internship or early-career program fits.

## Interview process
The known stages for this program, in order, with anything specific candidates report.

## School connection
This company's relationship with the student's school: campus recruiting presence, alumni density, whether it is a target school for them, relevant clubs or programs. If you find no connection, say so plainly — a fabricated alumni network is worse than none.

## Who to reach
Named people where public sources support it (team pages, engineering blogs, conference talks, published university-recruiting contacts). Otherwise archetypes: the role, seniority, and school tie worth filtering for.

Ground every claim in something you found. Under 700 words.`;

const STRUCTURE_SYSTEM = `You turn company research into a networking plan a student can execute today.

For each target, the standard is specificity:
- how_to_find is the actual filter combination, not "search LinkedIn". Name the filters: company, school, title keywords, years of experience.
- linkedin_search_url is a real linkedin.com/search/results/people/ URL with the keywords query built from those filters.
- ask is one concrete thing. Not "pick your brain" or "learn about your journey" — a referral, a specific question only they can answer, or fifteen minutes about one named thing.
- opener is 2-3 sentences the student could send as written. It names something real and specific about the company or that person's work, states the student's actual background in one clause, and makes the ask. No flattery, no "I'm passionate about", no buzzwords, no exclamation marks.

Warmest first: school alumni before strangers, people who publicly write about their work before people who do not, university recruiters last (they are reachable but their yes is worth less than a team referral).

Only claim an alumni connection if the research supports one.`;

const MAX_CONTINUATIONS = 5;

async function research(prompt: string): Promise<string> {
  const client = getClient();
  let messages: Anthropic.MessageParam[] = [{ role: "user", content: prompt }];

  let response = await client.messages
    .stream({
      model: MODEL,
      max_tokens: 16000,
      thinking: { type: "adaptive" },
      system: RESEARCH_SYSTEM,
      messages,
      tools: [{ type: "web_search_20260209", name: "web_search", max_uses: 8 }],
    })
    .finalMessage();

  let continuations = 0;
  while (response.stop_reason === "pause_turn" && continuations < MAX_CONTINUATIONS) {
    messages = [...messages, { role: "assistant", content: response.content }];
    response = await client.messages
      .stream({
        model: MODEL,
        max_tokens: 16000,
        thinking: { type: "adaptive" },
        system: RESEARCH_SYSTEM,
        messages,
        tools: [{ type: "web_search_20260209", name: "web_search", max_uses: 8 }],
      })
      .finalMessage();
    continuations++;
  }

  return response.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .trim();
}

export async function buildCompanyBrief(
  companyName: string,
  program: string,
  profile: Profile
): Promise<CompanyBrief> {
  const who = [
    profile.name || "A student",
    profile.school ? `at ${profile.school}` : "",
    profile.majors.length ? `studying ${profile.majors.join(", ")}` : "",
    profile.grad_year ? `graduating ${profile.grad_year}` : "",
  ]
    .filter(Boolean)
    .join(" ");

  const findings = await research(
    `Company: ${companyName}\nProgram they are applying to: ${program}\nThe student: ${who}\n\nResearch ${companyName} for this student, and pay particular attention to any connection between ${companyName} and ${profile.school || "the student's school"}.`
  );

  const client = getClient();
  const response = await client.messages.parse({
    model: MODEL,
    max_tokens: 8192,
    thinking: { type: "adaptive" },
    system: STRUCTURE_SYSTEM,
    messages: [
      {
        role: "user",
        content: `<student>\n${who}\n${profile.summary}\n</student>\n\n<company>${companyName}</company>\n<program>${program}</program>\n\n<research>\n${findings}\n</research>\n\nProduce the brief and the networking plan.`,
      },
    ],
    output_config: {
      format: zodOutputFormat(CompanyBriefSchema),
      effort: "medium",
    },
  });

  if (!response.parsed_output) {
    throw new Error("Could not build a research brief for this company");
  }
  return response.parsed_output;
}
