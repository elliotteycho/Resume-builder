# Resume Builder

A job-description-driven resume builder. Paste a posting and it:

1. **Analyzes the posting** — identifies the company, role, seniority, industry, market segment, hard/soft skills, and the exact ATS keywords recruiters screen for (structured output, validated against a schema).
2. **Researches in parallel** — three simultaneous web-search agents gather *current* data:
   - **Company intel** — recent news, funding, products, culture signals
   - **Role & market** — what the role demands right now, in-demand skills, trends
   - **Resume conventions** — how resumes are expected to look for *this* role in *this* industry (section order, naming, bullet style, length norms — finance ≠ nursing ≠ software)
3. **Reads your experience bank** — a personal, editable store of your full career history (work, projects, education, skills, certifications, awards).
4. **Synthesizes a tailored resume** — selects and rewrites the most relevant material, follows the industry's conventions, weaves in ATS keywords, and honestly reports any gaps it couldn't cover. It never fabricates anything not in your bank.

Built with Next.js + TypeScript and the [Anthropic API](https://platform.claude.com/) (Claude Opus 4.8, web search server tool, structured outputs, adaptive thinking).

## Setup

```bash
npm install
cp .env.example .env.local   # add your ANTHROPIC_API_KEY
npm run dev
```

Open http://localhost:3000.

## Usage

1. Go to **Experience Bank** and replace the sample data with your own history. Be generous — include metrics, tools, and outcomes. More raw material means better tailoring. Saved to `data/experience-bank.json` (git-ignored; it's personal data).
2. Go to **Generate**, paste a full job description, and click **Generate tailored resume**. You'll see live progress as the analysis completes and the three research agents run.
3. Review the result: the rendered resume, the tailoring strategy, ATS keywords used, honest gaps, and the raw research findings.
4. Export via **Print / Save as PDF** (print stylesheet included) or **Download Markdown**.

## Architecture

```
app/
  page.tsx                 # Generate flow (SSE progress UI + resume preview)
  experience/page.tsx      # Experience bank editor
  api/generate/route.ts    # SSE pipeline: analyze → parallel research → synthesize
  api/experience/route.ts  # Experience bank load/save
lib/
  types.ts                 # Zod schemas: job analysis, experience bank, resume
  anthropic.ts             # Anthropic client (Claude Opus 4.8)
  pipeline/analyze.ts      # Structured job-description analysis (messages.parse)
  pipeline/research.ts     # 3 parallel web_search agents (handles pause_turn)
  pipeline/synthesize.ts   # Resume synthesis (structured output, high effort)
  experienceStore.ts       # JSON file store for the experience bank
components/ResumeView.tsx  # Resume renderer + markdown export
data/experience-bank.sample.json  # Seed data used until you save your own
```

Notes:

- Generation takes a few minutes — the research agents each run several web searches. Progress streams to the UI over server-sent events.
- The experience bank is stored locally as JSON; this app is designed for single-user, local use.
