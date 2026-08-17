# Go-live runbook

Deploying the pilot: Supabase for auth + data, Vercel for hosting. About 25
minutes end to end. Local-first mode needs none of this — these steps are only
for multi-user mode.

## Part A — Supabase (~10 min)

1. Create a free project at [supabase.com](https://supabase.com). Any region;
   pick a strong database password and forget it (you won't need it again).
2. Open `supabase/setup.sql` from this repo and **edit the invite code at the
   bottom** — replace `CHANGE-ME` with the code you'll hand to pilot users.
3. In the Supabase dashboard, go to **SQL Editor**, paste the whole file, and
   run it. It's the three migrations in `supabase/migrations/` concatenated,
   so run it once, on a fresh project only. You should see it finish without
   errors and the Table Editor fill with seeded companies and postings.
4. Collect the three values the app needs, under **Project Settings → API**:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **anon (publishable) key** → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **service_role (secret) key** → `SUPABASE_SERVICE_ROLE_KEY`. This one
     bypasses RLS entirely. Server-only — never expose it client-side, never
     prefix it `NEXT_PUBLIC_`, never paste it anywhere but Vercel's env vars.
5. Point auth at your deployed domain, under **Authentication → URL
   Configuration**:
   - Set **Site URL** to the deployed domain (e.g. `https://your-app.vercel.app`).
   - Add `https://<domain>/auth/confirm` to the redirect allowlist — magic
     links land there.

   The built-in email sender is fine for ~15 pilot users, but its rate limits
   are low — don't have everyone request magic links in the same minute.

## Part B — Vercel (~10 min)

1. At [vercel.com](https://vercel.com), **Add New → Project** and import the
   GitHub repo. Framework auto-detects Next.js; leave build settings alone.
2. Set the environment variables before the first deploy:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `ANTHROPIC_API_KEY`
   - `HQ_SPEND_CAP_USD` (optional; defaults to 50)
3. Deploy. Note the production deploy builds the repo's **default branch**,
   and in this repo the default branch is still the old resume-builder work —
   the app lives on `claude/student-recruitment-app-pjbpyt`. Two fixes,
   either works:
   - merge that branch into the default branch, or
   - in Vercel, **Settings → Git → Production Branch**, set it to
     `claude/student-recruitment-app-pjbpyt` — no merge needed.
4. Plan check: four long routes declare `maxDuration` of 300–600s, which
   needs Vercel Pro (Hobby caps at 300s with Fluid compute). On Hobby,
   `/api/generate` and `/api/match/all` may time out; everything else —
   tracker, single-posting matches, briefs, imports — works.

## Part C — Smoke test (5 min)

Do this yourself before anyone else touches it:

1. Open the deployed URL and sign in with your own email. The magic link
   should arrive within a minute and land you back in the app.
2. Redeem the invite code you set in Part A.
3. Import your resume on `/profile` and confirm cards appear.
4. Score one open posting (Databricks is seeded as open) and check the match
   comes back with a score and reasons.
5. In the Supabase **Table Editor**, confirm rows exist in `profiles`,
   `experience_cards`, and `usage_log`.

Only then send invites.

## Costs

Infra is $0 — Supabase and Vercel free tiers both fit the pilot. Model spend
is bounded twice: per-user monthly quotas (import 3 / match 40 / brief 6 /
generate 4) and the global `HQ_SPEND_CAP_USD` ceiling (default $50) across
all users. When either trips, AI features pause with a clear message and the
tracker keeps working.
