# Internship HQ

A recruiting CRM for students. Import your resume once, and the app turns it into experience cards, matches those cards against a shared database of real postings, tells you which windows open when, researches each company through the lens of your school and your network, and tracks every application as a task list that computes itself.

The resume builder is still here — it's now the last step of a longer flow rather than the whole product.

## The flow

1. **Import your resume** (`/profile`). PDF, Word, or pasted text. Bullets are copied verbatim; every number becomes an evidence record for you to confirm; each entry gets concept-level *capabilities* derived from what the work actually required.
2. **See your season** (`/`). A shared posting database seeded with a real PM-intern cycle: who opens when, which windows are days rather than weeks, and what has to be ready before each door opens.
3. **Match** — one cheap scored call per posting. Eligibility is checked in code first, so a posting you're categorically barred from costs nothing and never shows up as a maybe. What comes back is a score, the specific cards that answer the posting's themes, and honest gaps.
4. **Research the company and the room** — what they do, how they hire, where your school connects, and 3–5 people worth reaching, warmest first, each with the search that finds them, one clear ask, and a message you could send as written.
5. **Apply, then work the pipeline** — stage changes, notes, contacts, and touch dates feed a "do next" queue that is recomputed on every read.
6. **Generate a tailored resume** (`/generate`) for a specific posting, from the same cards.

## What makes the matching trustworthy

**Eligibility is code, not model judgment.** The enrichment agent extracts a posting's hard criteria once — graduation window, class standing, degree level, GPA floor, work authorization — and every check after that is `lib/hq/eligibility.ts`: pure, deterministic, and free. A hard fail short-circuits before any model call. Blockers are stated plainly; anything conditional becomes a warning rather than a silent pass.

**The evidence layer carries over.** The generator view — low-confidence evidence removed, unbacked numbers redacted — is applied to matching too, so a match reason can never cite a metric the resume itself would refuse to print.

**Match reasons are card-level.** `{card_id, theme, reasoning}` is what makes cards light up on the Profile timeline with an explanation attached, instead of a number with nothing behind it.

**A JD is analyzed once, ever.** The analysis and eligibility criteria live on the shared posting row, so the tenth student to look at a Databricks posting pays nothing for the reading of it.

**The queue is derived state.** "Do next" is computed on every read from posting status, applied dates, and contact touches — never stored. Changing a threshold in `lib/hq/config.ts` changes every queue instantly, and a task disappears the moment its cause does.

### On LinkedIn

There is no LinkedIn API here, and scraping it would violate their terms. What the research agent produces instead is the thinking: the archetypes worth filtering for, the exact filter combination, a `linkedin.com/search` URL that runs it, one concrete ask per person, and a first message. You run the search. Named people appear only when public sources — team pages, engineering blogs, conference talks, published university-recruiting contacts — actually support them, and the brief says plainly when your school has no connection to a company rather than inventing one.

## The resume pipeline

The generator is unchanged in philosophy: the job description is the gravitational center, and the resume is rewritten around it rather than scored against it. Five stages — **analyze** (concept-level themes, not keywords) → **research** (three parallel web-search agents: company intel with a voice scan, role/market, resume conventions for this industry) → **reframe** (belief vector, ranked demand vector, per-entry directives with verb registers and anchor metrics) → **synthesize** → **verify** (deterministic rule checks with one auto-revision pass).

Two things changed: the bank now comes from your experience cards instead of a JSON file, and when you generate against a tracked posting the analyze stage reuses the cached analysis. Research still runs fresh every time — it's time-sensitive by nature.

### The evidence layer

A model told to "formulate bullets" will invent confident numbers — it rounds 23% into "over 20%" and reaches for impressive low-confidence figures because they read well. So facts and phrasing are split architecturally, not by prompt:

- **Evidence records.** Each entry carries the verbatim metric token, the claim it substantiates, its provenance, and a confidence tag (`high` / `medium` / `low`). Resume import creates these automatically; you confirm them.
- **The generator view.** Before any prompt, the bank is filtered: `low`-confidence evidence is removed entirely, and numeric tokens in prose that aren't backed by visible evidence are redacted.
- **The verbatim check.** The verifier extracts every numeric token from the output and requires each to appear verbatim in what the generator was shown. Rounding drift fails by construction.
- **The metric audit.** Every number on the final resume traces back to its evidence record and provenance.

Requirements the bank can't support are reported honestly as gaps — never invented.

## Setup

```bash
npm install
cp .env.example .env.local   # add your ANTHROPIC_API_KEY
npm run dev
```

Open http://localhost:3000. The board is seeded with a Summer 2027 PM-intern season on first run, so there is something real to look at before you've added anything.

Matching, research, resume import, and generation all need the API key. Everything else — the tracker, the queue, contacts, notes — works without one.

## Multi-user mode (the pilot)

With no extra configuration the app is local-first: one user, no login, data in
`data/hq.json`. Setting three env vars switches the same build to Supabase —
real accounts, per-user data, invite gating, and spend controls:

1. Create a Supabase project and run the three files in `supabase/migrations/`
   in order (SQL editor or `supabase db push`). They create the schema with
   RLS, the invite/usage tables, and the seeded season.
2. Set the env vars from `.env.example`: `NEXT_PUBLIC_SUPABASE_URL`,
   `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY`
   (server-only — never expose it to the client).
3. Create an invite code:
   ```sql
   insert into invite_codes (code, max_uses, note)
   values ('VANDY-PM-2027', 15, 'fall pilot');
   ```
4. Deploy (Vercel works; set the same env vars there). Sign-in is a magic
   link; after first sign-in, new users enter an invite code once.

How multi-user mode behaves differently:

- **Membership is invite-only.** Anyone can authenticate, but the app serves
  data only to users who redeemed a code — redemption is a single atomic
  Postgres function (`redeem_invite`), so a code can't be raced past its
  `max_uses`.
- **Spend is bounded twice.** Each metered action (import / match / brief /
  generate) has a per-user monthly quota, and `HQ_SPEND_CAP_USD` (default $50)
  is a global monthly ceiling across all users. When either trips, AI features
  pause with a clear message and the tracker keeps working. Charges are
  action-level estimates recorded to `usage_log` *before* each call — matches
  served from cache or blocked by the eligibility gate cost nothing.
- **The shared layer is genuinely shared.** One user pasting a JD analyzes it
  for everyone; one user flipping a posting to "open" puts it in everyone's
  queue. At pilot scale, the cohort is the daily scan.

The storage seam is `lib/hq/repo/` — the same `HqRepo` interface has a JSON
implementation (local) and a Supabase implementation (multi-user), chosen per
call by environment. `supabase/migrations/0003_seed.sql` is generated from
`lib/hq/seed.ts` by `scripts/generate-seed-sql.mjs`; edit the TS and
regenerate rather than editing the SQL.

**Privacy note for pilot users:** resumes and experience data are sent to
Anthropic's API to power parsing, matching, and generation. Don't import
anything you wouldn't put in a job application.

## Architecture

```
app/
  page.tsx                       # Tracker (Today / Timeline / Companies / People)
  profile/page.tsx               # Living portfolio: cards, resume import, paste-a-JD match
  generate/page.tsx              # Resume generation flow (SSE progress, exports)
  experience/page.tsx            # Evidence editor (provenance + confidence)
  api/profile/…                  # Profile CRUD + resume import
  api/cards/…                    # Experience card CRUD
  api/postings/…                 # Shared posting database; POST enriches a contributed JD
  api/applications/…             # The board + derived queue; stage changes write stage_events
  api/contacts/… api/notes/…     # Referral CRM
  api/match/[postingId]          # Cheap scored match (eligibility-gated, cached)
  api/match/all                  # Batch scoring with SSE progress
  api/research/[companyId]       # Company brief + networking plan
  api/generate                   # Full 5-stage pipeline, posting-aware
lib/hq/
  config.ts                      # Every threshold, stage, lane, and label
  types.ts                       # Zod schemas mirroring the SQL schema
  eligibility.ts                 # The deterministic gate
  queue.ts                       # Derived "do next" queue + board summary
  matching.ts                    # Cache → analyze-once → gate → score
  bank.ts                        # Cards ↔ ExperienceBank bridge, evidence-filtered
  repo.ts                        # Every read and write; cache invalidation lives here
  db/                            # HqStore interface + JSON-file adapter + seed
lib/pipeline/
  analyze · research · reframe · synthesize · verify     # the resume pipeline
  eligibility.ts                 # JD → hard screening criteria (once per posting)
  match.ts                       # The cheap-path scorer
  parseResume.ts                 # PDF/DOCX/text → cards + evidence
  companyBrief.ts                # Web research → brief + networking plan
supabase/migrations/0001_init.sql  # The Postgres shape, for when this goes multi-user
```

### Storage

The app is local-first: the whole database is one JSON document at `data/hq.json` (git-ignored — it's personal). `HqStore` in `lib/hq/db/types.ts` is the seam — two methods, `read` and `write`. Moving to Postgres means implementing that interface against `supabase/migrations/0001_init.sql` and branching in `lib/hq/db/index.ts`; nothing else changes, because every row already carries a `user_id` and every query already filters on it. `currentUserId()` in `lib/hq/auth.ts` returns a constant today and becomes a session lookup then.

### Nothing here is locked

Thresholds, tiers, stages, lanes, and season strings live in `lib/hq/config.ts`, not inlined. Each agent's prompt, output schema, and model choice live together in one file under `lib/pipeline/`, so swapping a model or rewriting a prompt never touches a route. Route handlers parse, call one repo function, and return JSON. Derived state — the queue, match staleness, eligibility — is computed, never stored as an editable copy, so changing a rule updates everything at once.

## Not built yet

- **The daily scan.** Detecting when a watched posting actually opens is a scheduled job (pg_cron → edge function). At pilot scale the cohort substitutes: any user flipping a posting to "open" updates everyone. Window months are last-cycle patterns, and the UI says so rather than implying they're verified.
- **Live posting verification.** `postings.verified` and `last_verified_at` exist and are always false — nothing re-checks a live page yet.
- **Job-splitting for Vercel Hobby.** Four routes declare `maxDuration` of 300–600s. That fits Vercel Pro (800s with Fluid compute) but not Hobby (300s); running free on Hobby means splitting `/api/generate` and `/api/match/all` into staged jobs with polling, per the pattern in the original handoff's AGENTS.md.
- **Token-level usage metering.** The ledger records action-level estimates; real per-call `usage` capture would sharpen the cost data.
