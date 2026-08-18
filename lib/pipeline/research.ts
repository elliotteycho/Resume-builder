import type Anthropic from "@anthropic-ai/sdk";
import { getClient, MODEL } from "@/lib/anthropic";
import type { JobAnalysis, ResearchFindings } from "@/lib/types";

const MAX_CONTINUATIONS = 5;

/**
 * Run one research agent: a web-search-enabled request that returns markdown findings.
 * Handles the server-side tool loop's pause_turn stop reason by re-sending until done.
 */
async function runResearchAgent(system: string, brief: string): Promise<string> {
  const client = getClient();

  let messages: Anthropic.MessageParam[] = [{ role: "user", content: brief }];
  let response = await requestOnce(client, system, messages);

  let continuations = 0;
  while (response.stop_reason === "pause_turn" && continuations < MAX_CONTINUATIONS) {
    messages = [...messages, { role: "assistant", content: response.content }];
    response = await requestOnce(client, system, messages);
    continuations++;
  }

  return response.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .trim();
}

async function requestOnce(
  client: Anthropic,
  system: string,
  messages: Anthropic.MessageParam[]
): Promise<Anthropic.Message> {
  const stream = client.messages.stream({
    model: MODEL,
    max_tokens: 16000,
    thinking: { type: "adaptive" },
    system,
    messages,
    tools: [{ type: "web_search_20260209", name: "web_search", max_uses: 6 }],
  });
  return stream.finalMessage();
}

const COMPANY_SYSTEM = `You are a company-intelligence researcher supporting a job applicant.
Search the web for current, factual information — the company's homepage, About page, product pages, careers page, recent launches, founder posts, press. Return concise markdown with these sections:
## Company snapshot (what they do, size, stage, business model, their own one-liner)
## Recent developments (news, funding, launches, leadership changes from the last ~12 months)
## Products & customers
## Company voice (how they talk about themselves: tone — formal vs casual, builder vs operator, technical vs strategic; altitude — vision language vs shipped-feature language; recurring vocabulary — the verbs and adjectives they use about themselves)
## Culture & values (what they publicly emphasize)
## What they likely value in this hire
Keep it under 550 words. Only include facts you found or that were in the brief — no speculation presented as fact.`;

const MARKET_SYSTEM = `You are a labor-market researcher supporting a job applicant.
Search the web for the current state of this role and industry. Return concise markdown with these sections:
## State of the market for this role (demand, trends, what's changed recently)
## Skills currently in highest demand for this role
## What differentiates top candidates right now
## Industry-specific context worth knowing for interviews and positioning
Keep it under 500 words. Ground claims in what you find.`;

const CONVENTIONS_SYSTEM = `You are a resume-writing expert who knows how conventions differ across industries and roles.
Search the web for current best practices for resumes targeting this specific role and industry. Return concise markdown with these sections:
## Format conventions for this role/industry (length, section order, section names, what to include/omit)
## Bullet style (metrics-driven vs duty-driven, verb choices, technical depth expected)
## ATS and screening realities for this role
## Common mistakes for this role/industry
Be specific to the role and industry — e.g. finance resumes differ sharply from design or nursing resumes.
Keep it under 500 words.`;

const KEYNOTES_SYSTEM = `You are a strategy researcher supporting a job applicant. Companies say what they actually care about in their KEYNOTES and ANNUAL RECAPS — not their careers pages. Search the web for this company's most recent primary-voice strategy sources, prioritizing (in order):
1. Flagship conference keynotes and their recaps (e.g. a developer summit, user conference, launch event) from the last ~14 months
2. Annual reports, shareholder letters, or founder/CEO year-in-review letters (public companies: the letter, not the financials)
3. Major product-announcement roundups ("everything announced at ...") and official company blog posts stating strategy
4. Earnings-call themes if the company is public and nothing better exists

Return concise markdown with these sections:
## Sources found (name each source: event/report, date, and what it is)
## Strategic priorities in their own words (their actual phrases and slogans, quoted, with which source each came from)
## What they are betting on next (products/initiatives they are investing in, per these sources)
## What this means for this hire (2-4 bullets: how an applicant should angle toward these priorities)
If you cannot find a keynote or annual report, say so plainly in Sources found and fall back to the best official strategy source available — never invent a source or a quote.
Keep it under 500 words.`;

export type ResearchAgentName = "company" | "market" | "conventions" | "keynotes";

export type AgentCallback = (
  agent: ResearchAgentName,
  status: "running" | "done"
) => void;

/**
 * Run the four research agents simultaneously.
 */
export async function runResearch(
  analysis: JobAnalysis,
  onAgent: AgentCallback
): Promise<ResearchFindings> {
  const themeLines = analysis.themes.map((t) => `${t.id}: ${t.name}`).join("\n");
  const context = `Target role: ${analysis.role.title} (${analysis.role.seniority}, ${analysis.role.family})
Company: ${analysis.company.name} — ${analysis.company.industry}, ${analysis.company.market_segment}, stage: ${analysis.company.stage}
Themes the posting emphasizes:
${themeLines}`;

  const companyBrief = `${context}\n\nResearch brief: ${analysis.research_queries.company_query}`;
  const marketBrief = `${context}\n\nResearch brief: ${analysis.research_queries.market_query}`;
  const conventionsBrief = `${context}\n\nResearch how resumes should be written for a ${analysis.role.seniority} ${analysis.role.title} in the ${analysis.company.industry} industry, right now. Key requirements from the posting: ${analysis.requirements.hard_skills.slice(0, 10).join(", ")}.`;
  const keynotesBrief = `${context}\n\nFind ${analysis.company.name}'s most recent flagship keynote/conference recap and annual report or shareholder/founder letter, and extract the strategic priorities in their own words. Useful query shapes: "${analysis.company.name} keynote announcements", "${analysis.company.name} annual report strategic priorities", "${analysis.company.name} shareholder letter", "everything announced at ${analysis.company.name}".`;

  const track = <T>(agent: ResearchAgentName, p: Promise<T>): Promise<T> => {
    onAgent(agent, "running");
    return p.then((r) => {
      onAgent(agent, "done");
      return r;
    });
  };

  const [company, market, conventions, keynotes] = await Promise.all([
    track("company", runResearchAgent(COMPANY_SYSTEM, companyBrief)),
    track("market", runResearchAgent(MARKET_SYSTEM, marketBrief)),
    track("conventions", runResearchAgent(CONVENTIONS_SYSTEM, conventionsBrief)),
    track("keynotes", runResearchAgent(KEYNOTES_SYSTEM, keynotesBrief)),
  ]);

  return { company, market, conventions, keynotes };
}
