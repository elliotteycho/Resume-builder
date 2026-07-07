# Resume Builder

A job-description-driven resume builder built on an **embodiment** philosophy: the job description is the gravitational center. The resume isn't scored against it — it's rewritten around it, so the result reads like it was written by someone already inside the company.

Paste a posting and the pipeline runs five stages:

1. **Analyze** — reads the posting twice (what they wrote, then what they need). Extracts the company, role, seniority, industry, and — crucially — 4–7 **concept-level themes** beneath the bullet list ("deciding what matters when everything competes for attention" is a theme; "Jira" is a keyword). Also: success factors, non-negotiable vs decorative requirements, and exact ATS keywords.
2. **Research (3 parallel agents)** — simultaneous web-search agents gather *current* data:
   - **Company intel** — news, funding, products, culture, and a **voice scan** (tone, altitude, recurring vocabulary)
   - **Role & market** — what the role demands right now, in-demand skills, trends
   - **Resume conventions** — how resumes are expected to look for *this* role in *this* industry (finance ≠ nursing ≠ software)
3. **Reframe synthesis** — fuses the posting and the research into a build brief: a company **belief vector** (3–5 statements), a ranked **demand vector** (required / qualification / preference), voice notes, and **per-entry directives** — which experiences carry which themes, what verb register to lead with (diagnostic, listening, weighing, clarity, imagination, building, doer), the framing angle, and the anchor metric.
4. **Synthesize** — writes the resume from the directives. Bullets follow Action–Responsibility–Impact order, each carries one or two themes (never all), verbs embody the themes ("Diagnosed the growth bottleneck by auditing 198 accounts" beats "Owned production audit of 198 accounts"), and the company's voice is absorbed — never pasted.
5. **Verify** — deterministic code checks (not model judgment) enforce the hard rules; violations trigger one automatic revision pass, and the final report is shown:
   - No two bullets start with the same first verb
   - No em/en dashes or smart quotes anywhere
   - No 5+ consecutive words lifted verbatim from the posting
   - Bullet length ceiling and metric-density warnings

## The evidence layer: retrieval decides the facts

A model told to "formulate bullets" will invent confident numbers — it rounds 23% into "over 20%" and reaches for impressive low-confidence figures because they read well. So facts and phrasing are split architecturally, not by prompt:

- **Evidence records.** Each work/project entry carries evidence records: the verbatim metric token, the claim it substantiates, its provenance, and a confidence tag (`high` / `medium` / `low`). The editor has a "Scan bullets for metrics" button to bootstrap these from existing prose.
- **The generator view.** Before any prompt, the bank is filtered: `low`-confidence evidence is removed entirely (invisible to the generator), and numeric tokens in prose that aren't backed by visible evidence are redacted. The generator chooses *which* evidence to feature and writes the surrounding context — it never decides what a number is.
- **The verbatim check.** The verifier extracts every numeric token from the output and requires each to appear verbatim in what the generator was shown (bare years and dates exempt). Rounding drift fails by construction; violations trigger the automatic revision pass, which receives the list of permitted metrics.
- **The metric audit.** The results page traces every number on the final resume back to its evidence record and provenance.

Requirements the bank can't support are reported honestly as gaps — never invented.

Built with Next.js + TypeScript and the [Anthropic API](https://platform.claude.com/) (Claude Opus 4.8, web search server tool, structured outputs, adaptive thinking).

## Setup

```bash
npm install
cp .env.example .env.local   # add your ANTHROPIC_API_KEY
npm run dev
```

Open http://localhost:3000.

## Usage

1. Go to **Experience Bank** and replace the sample data with your own history. Be generous — include metrics, tools, and outcomes; every number in a tailored bullet must trace back here. Saved to `data/experience-bank.json` (git-ignored; it's personal data).
2. Go to **Generate**, paste a full job description, optionally add guidance ("lead with the data projects", "skip the retail job"), and generate. You'll watch live progress through all five stages.
3. Review the result: the rendered resume, the verification report, the tailoring strategy, the reframing map (beliefs, demands, entry directives, bullet-by-bullet theme map), ATS keywords used, honest gaps, and the raw research.
4. Export as **.docx** (ATS-clean: Times New Roman, 0.5" margins, bordered ALL-CAPS section headers, right-aligned dates), **PDF** (via print stylesheet), or **Markdown**.

## Architecture

```
app/
  page.tsx                    # Generate flow (SSE progress UI, tailoring table, exports)
  experience/page.tsx         # Experience bank editor
  api/generate/route.ts       # SSE pipeline: analyze → research ×3 → reframe → synthesize → verify
  api/experience/route.ts     # Experience bank load/save
  api/export/docx/route.ts    # ATS-clean .docx export
lib/
  types.ts                    # Zod schemas: analysis (themes), reframe map, bank + evidence, resume, verification
  evidence.ts                 # Metric-token semantics, generator view (redaction + confidence filter), metric audit
  anthropic.ts                # Anthropic client (Claude Opus 4.8)
  pipeline/analyze.ts         # Two-read JD analysis with theme extraction
  pipeline/research.ts        # 3 parallel web_search agents incl. company voice scan
  pipeline/reframe.ts         # Belief vector + demand vector + per-entry directives
  pipeline/synthesize.ts      # Embodiment writing rules + hard constraints
  pipeline/verify.ts          # Deterministic rule checks + one auto-revision pass
  docx.ts                     # Yale-style .docx template (docx package)
  experienceStore.ts          # JSON file store for the experience bank
components/ResumeView.tsx     # Resume renderer + markdown export
data/experience-bank.sample.json  # Seed data used until you save your own
```

Notes:

- Generation takes a few minutes — the research agents each run several web searches. Progress streams to the UI over server-sent events.
- The experience bank is stored locally as JSON; this app is designed for single-user, local use.
