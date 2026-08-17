-- Internship HQ — one-paste Supabase setup.
--
-- This file is the three migrations in supabase/migrations/ (0001_init.sql,
-- 0002_invites_usage.sql, 0003_seed.sql) concatenated in order, so you can
-- paste it into the Supabase SQL editor once instead of running three files.
-- Run it ONLY on a FRESH project: it is not idempotent, because 0001 creates
-- tables and will error if they already exist. If you've run any of the
-- migrations already, use the individual files instead.
--
-- Before running: edit the invite-code insert at the very bottom.

-- ============================================================
-- Source: supabase/migrations/0001_init.sql
-- ============================================================

-- Internship HQ — initial schema
--
-- Mirrors lib/hq/types.ts one-for-one. The app ships with a JSON-file store
-- (lib/hq/db/json.ts) so it runs with no infrastructure; this migration is the
-- Postgres shape a `HqStore` implementation would target when the app goes
-- multi-user. Personal tables carry user_id and are owner-scoped by RLS; the
-- shared layer is readable by all authenticated users and written only by
-- server routes holding the service role, so agent output stays trusted.

-- ============================ SHARED LAYER ============================

create table companies (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  careers_url text not null default '',
  tier_default int not null default 2 check (tier_default between 1 and 3),
  created_at timestamptz not null default now()
);

create table postings (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  program text not null,
  url text not null default '',
  portal text not null default '',
  season text not null,
  status text not null default 'watching'
    check (status in ('watching', 'open', 'closed')),
  window_expected text not null default '',
  window_note text not null default '',
  short_window boolean not null default false,
  radar text check (radar in ('now', 'aug', 'sep', 'oct', 'nov', 'dec')),
  opened_at date,
  closed_at date,
  jd_text text not null default '',
  -- JobAnalysisSchema output, cached once and read by every user.
  jd_analysis jsonb,
  -- EligibilitySchema output: the deterministic gate's inputs.
  eligibility jsonb,
  source text not null default 'seed' check (source in ('seed', 'user', 'scan')),
  submitted_by uuid,
  verified boolean not null default false,
  last_verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- One row per program per season per company: a posting contributed twice
  -- must update the shared row rather than fork it.
  unique (company_id, season, program)
);
create index postings_company_season_idx on postings (company_id, season);
create index postings_status_radar_idx on postings (status, radar);

-- =========================== PERSONAL LAYER ===========================

create table profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  name text not null default '',
  email text not null default '',
  phone text not null default '',
  location text not null default '',
  school text not null default '',
  grad_year text not null default '',
  class_year int check (class_year between 1 and 6),
  majors text[] not null default '{}',
  gpa numeric(3, 2),
  degree_level text not null default 'bachelors'
    check (degree_level in ('bachelors', 'masters', 'mba', 'phd')),
  work_authorization text not null default 'unspecified'
    check (work_authorization in
      ('citizen', 'permanent-resident', 'needs-sponsorship', 'unspecified')),
  years_experience numeric not null default 0,
  target_role text not null default '',
  links text[] not null default '{}',
  summary text not null default '',
  resume_file_path text not null default '',
  resume_file_name text not null default '',
  resume_uploaded_at timestamptz,
  resume_text text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table experience_cards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  lane text not null
    check (lane in ('professional', 'projects', 'leadership', 'education')),
  title text not null,
  organization text not null default '',
  location text not null default '',
  -- 'YYYY-MM'; empty end_date means ongoing.
  start_date text not null default '',
  end_date text not null default '',
  bullets text[] not null default '{}',
  skills text[] not null default '{}',
  -- Concept-level signals for matching: 'prioritization under ambiguity'.
  capabilities text[] not null default '{}',
  link text not null default '',
  sort int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index experience_cards_owner_idx on experience_cards (user_id, lane, sort);

-- One row per verified metric token. Low-confidence rows are stripped from
-- the generator view, so a number here is a number the resume may print.
create table evidence (
  id uuid primary key default gen_random_uuid(),
  card_id uuid not null references experience_cards(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  metric text not null,
  claim text not null,
  provenance text not null default '',
  confidence text not null check (confidence in ('high', 'medium', 'low'))
);
create index evidence_card_idx on evidence (card_id);

create table applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  posting_id uuid not null references postings(id) on delete cascade,
  stage text not null default 'watching'
    check (stage in
      ('watching', 'open', 'applied', 'interviewing', 'offer', 'closed')),
  tier int not null default 2 check (tier between 1 and 3),
  applied_date date,
  next_action text not null default '',
  resume_version_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, posting_id)
);

-- The audit trail behind the timeline view.
create table stage_events (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references applications(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  from_stage text,
  to_stage text not null,
  note text not null default '',
  at timestamptz not null default now()
);
create index stage_events_application_idx on stage_events (application_id, at);

create table notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  company_id uuid references companies(id) on delete cascade,
  application_id uuid references applications(id) on delete cascade,
  body text not null,
  pinned boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index notes_owner_idx on notes (user_id, company_id);

create table contacts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  company_id uuid references companies(id) on delete set null,
  -- Kept alongside company_id so a contact at a company that isn't on the
  -- board yet still groups correctly.
  company_name text not null default '',
  name text not null,
  role text not null default '',
  channel text not null default 'LinkedIn',
  linkedin_url text not null default '',
  angle text not null default '',
  kind text not null default 'other'
    check (kind in ('alum', 'recruiter', 'team', 'referral', 'other')),
  status text not null default 'to-reach'
    check (status in ('to-reach', 'sent', 'replied', 'call-set', 'met')),
  touches int not null default 0,
  last_touch date,
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index contacts_owner_idx on contacts (user_id, company_id);

-- Cached match output, one row per user × posting.
create table matches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  posting_id uuid not null references postings(id) on delete cascade,
  score int not null check (score between 0 and 100),
  verdict text not null check (verdict in ('apply', 'review', 'skip')),
  eligibility_pass boolean not null,
  blockers text[] not null default '{}',
  warnings text[] not null default '{}',
  headline text not null default '',
  -- [{card_id, theme, reasoning}] — which cards light up in the Profile UI.
  reasons jsonb not null default '[]',
  gaps text[] not null default '{}',
  model text not null default '',
  computed_at timestamptz not null default now(),
  -- Set when the user's cards change or the posting's analysis changes.
  stale boolean not null default false,
  unique (user_id, posting_id)
);

-- Company research + networking plan. Personal, and never shared: the school
-- angle and the outreach drafts are specific to one student.
create table research_briefs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  company_id uuid not null references companies(id) on delete cascade,
  brief jsonb not null,
  model text not null default '',
  created_at timestamptz not null default now(),
  unique (user_id, company_id)
);

create table resume_versions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  posting_id uuid references postings(id) on delete set null,
  label text not null default '',
  resume jsonb not null,
  reframe jsonb,
  verification jsonb,
  metric_audit jsonb,
  created_at timestamptz not null default now()
);
create index resume_versions_owner_idx on resume_versions (user_id, created_at desc);

alter table applications
  add constraint applications_resume_version_fk
  foreign key (resume_version_id) references resume_versions(id) on delete set null;

-- ================================ RLS ================================

alter table profiles          enable row level security;
alter table experience_cards  enable row level security;
alter table evidence          enable row level security;
alter table applications      enable row level security;
alter table stage_events      enable row level security;
alter table notes             enable row level security;
alter table contacts          enable row level security;
alter table matches           enable row level security;
alter table research_briefs   enable row level security;
alter table resume_versions   enable row level security;

create policy owner_all on profiles         for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy owner_all on experience_cards for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy owner_all on evidence         for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy owner_all on applications     for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy owner_all on stage_events     for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy owner_all on notes            for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy owner_all on contacts         for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy owner_all on matches          for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy owner_all on research_briefs  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy owner_all on resume_versions  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- The shared layer: everyone reads, only the service role writes. Enabling RLS
-- with a select-only policy denies client writes by default; the service role
-- bypasses RLS entirely, which is how enrichment and the daily scan write.
alter table companies enable row level security;
alter table postings  enable row level security;

create policy read_all on companies for select to authenticated using (true);
create policy read_all on postings  for select to authenticated using (true);

-- ============================================================
-- Source: supabase/migrations/0002_invites_usage.sql
-- ============================================================

-- Invite gating and the spend ledger.
--
-- The pilot is invite-only: anyone can authenticate (Supabase auth is open by
-- nature), but the app serves data only to users with a profiles row, and
-- profiles rows are created exclusively by redeeming an invite code through
-- the server (`/api/invite`, service role). "Has a profile" is membership.

create table invite_codes (
  code text primary key,
  max_uses int not null default 1 check (max_uses > 0),
  used_count int not null default 0 check (used_count >= 0),
  note text not null default '',
  created_at timestamptz not null default now(),
  check (used_count <= max_uses)
);

-- Who redeemed what, for the pilot postmortem.
create table invite_redemptions (
  id uuid primary key default gen_random_uuid(),
  code text not null references invite_codes(code),
  user_id uuid not null references auth.users(id) on delete cascade,
  redeemed_at timestamptz not null default now(),
  unique (user_id)
);

-- Redeem atomically: burn a use and record who, or do nothing if the code is
-- unknown or exhausted. Server-side function so the check-and-increment can't
-- race two concurrent redemptions past max_uses.
create or replace function redeem_invite(p_code text, p_user_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  claimed int;
begin
  -- Already a member: succeed idempotently without burning another use.
  if exists (select 1 from profiles where user_id = p_user_id) then
    return true;
  end if;

  update invite_codes
     set used_count = used_count + 1
   where code = p_code
     and used_count < max_uses
  returning 1 into claimed;

  if claimed is null then
    return false;
  end if;

  insert into invite_redemptions (code, user_id) values (p_code, p_user_id);
  insert into profiles (user_id) values (p_user_id);
  return true;
end;
$$;

-- The action-level spend ledger. One row per metered model action, written by
-- server routes before the call is made.
create table usage_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('import', 'match', 'brief', 'generate')),
  est_cost_cents int not null,
  created_at timestamptz not null default now()
);
create index usage_log_month_idx on usage_log (created_at);
create index usage_log_user_idx on usage_log (user_id, kind, created_at);

-- RLS: invite tables are server-only (no client policies at all); users may
-- read their own usage, never write it.
alter table invite_codes       enable row level security;
alter table invite_redemptions enable row level security;
alter table usage_log          enable row level security;

create policy own_usage on usage_log for select using (auth.uid() = user_id);

-- ============================================================
-- Source: supabase/migrations/0003_seed.sql
-- ============================================================

-- Shared-layer seed: the Summer 2027 PM-intern season.
--
-- GENERATED from lib/hq/seed.ts by scripts/generate-seed-sql.mjs — edit the
-- TS file and regenerate rather than editing here. Idempotent: reruns are
-- no-ops thanks to the unique keys on companies.slug and
-- postings (company_id, season, program).

insert into companies (slug, name, careers_url, tier_default)
values ('microsoft', 'Microsoft', 'https://careers.microsoft.com', 1)
on conflict (slug) do nothing;

insert into postings (company_id, program, url, portal, season, status,
                      window_expected, window_note, short_window, radar, source)
select c.id, 'PM Intern, Summer 2027', 'https://careers.microsoft.com/v2/global/en/universityinternship', 'Microsoft Careers', 'summer-2027', 'closed',
       'Opened and closed early August', 'Short early-August window. Next cycle is a year out.', false, null, 'seed'
from companies c where c.slug = 'microsoft'
on conflict (company_id, season, program) do nothing;

insert into companies (slug, name, careers_url, tier_default)
values ('capitalone', 'Capital One', 'https://www.capitalonecareers.com', 2)
on conflict (slug) do nothing;

insert into postings (company_id, program, url, portal, season, status,
                      window_expected, window_note, short_window, radar, source)
select c.id, 'Product Development Intern, Summer 2027', 'https://www.capitalonecareers.com/students', 'Capital One Careers', 'summer-2027', 'closed',
       'Opened mid July, now closed', '', false, null, 'seed'
from companies c where c.slug = 'capitalone'
on conflict (company_id, season, program) do nothing;

insert into companies (slug, name, careers_url, tier_default)
values ('appian', 'Appian', 'https://careers.appian.com', 2)
on conflict (slug) do nothing;

insert into postings (company_id, program, url, portal, season, status,
                      window_expected, window_note, short_window, radar, source)
select c.id, 'PM Intern, Summer 2027', 'https://careers.appian.com/jobs/8041243-product-manager-intern-', 'Greenhouse', 'summer-2027', 'open',
       'Open since early August', '', false, null, 'seed'
from companies c where c.slug = 'appian'
on conflict (company_id, season, program) do nothing;

insert into companies (slug, name, careers_url, tier_default)
values ('amex', 'Amex Digital Labs', 'https://www.americanexpress.com/en-us/careers/', 2)
on conflict (slug) do nothing;

insert into postings (company_id, program, url, portal, season, status,
                      window_expected, window_note, short_window, radar, source)
select c.id, 'Digital Product Analyst Intern, Summer 2027', 'https://www.americanexpress.com/en-us/careers/students/', 'Amex Careers', 'summer-2027', 'open',
       'Open since early August', '', false, null, 'seed'
from companies c where c.slug = 'amex'
on conflict (company_id, season, program) do nothing;

insert into companies (slug, name, careers_url, tier_default)
values ('vertiv', 'Vertiv', 'https://careers.vertiv.com', 2)
on conflict (slug) do nothing;

insert into postings (company_id, program, url, portal, season, status,
                      window_expected, window_note, short_window, radar, source)
select c.id, 'PM Intern, Summer 2027', 'https://careers.vertiv.com', 'Vertiv Careers', 'summer-2027', 'open',
       'Open since August', '', false, null, 'seed'
from companies c where c.slug = 'vertiv'
on conflict (company_id, season, program) do nothing;

insert into companies (slug, name, careers_url, tier_default)
values ('salesforce', 'Salesforce', 'https://www.salesforce.com/company/careers/', 1)
on conflict (slug) do nothing;

insert into postings (company_id, program, url, portal, season, status,
                      window_expected, window_note, short_window, radar, source)
select c.id, 'APM Intern, Summer 2027 (Futureforce)', 'https://www.salesforce.com/company/careers/jobs/JR348039/', 'Workday', 'summer-2027', 'open',
       'Open since mid July, rolling', '', false, null, 'seed'
from companies c where c.slug = 'salesforce'
on conflict (company_id, season, program) do nothing;

insert into companies (slug, name, careers_url, tier_default)
values ('databricks', 'Databricks', 'https://www.databricks.com/company/careers', 1)
on conflict (slug) do nothing;

insert into postings (company_id, program, url, portal, season, status,
                      window_expected, window_note, short_window, radar, source)
select c.id, 'Product Management Intern, Summer 2027', 'https://www.databricks.com/company/careers/product/product-management-intern-summer-2027-6883068002', 'Greenhouse', 'summer-2027', 'open',
       'Open now, rolling', 'Rolling review. Every day of delay costs odds.', false, 'now', 'seed'
from companies c where c.slug = 'databricks'
on conflict (company_id, season, program) do nothing;

insert into companies (slug, name, careers_url, tier_default)
values ('duolingo', 'Duolingo', 'https://careers.duolingo.com', 1)
on conflict (slug) do nothing;

insert into postings (company_id, program, url, portal, season, status,
                      window_expected, window_note, short_window, radar, source)
select c.id, 'APM Intern, Summer 2027', 'https://careers.duolingo.com', '', 'summer-2027', 'watching',
       'Expected late September to mid October, hard deadline', 'Hard cutoff. Miss it, wait a year.', true, 'sep', 'seed'
from companies c where c.slug = 'duolingo'
on conflict (company_id, season, program) do nothing;

insert into companies (slug, name, careers_url, tier_default)
values ('meta', 'Meta', 'https://www.metacareers.com', 1)
on conflict (slug) do nothing;

insert into postings (company_id, program, url, portal, season, status,
                      window_expected, window_note, short_window, radar, source)
select c.id, 'RPM Intern, Summer 2027', 'https://www.metacareers.com/rpm', '', 'summer-2027', 'watching',
       'Expected late August per last cycle, unverified', 'Could open any day.', true, 'aug', 'seed'
from companies c where c.slug = 'meta'
on conflict (company_id, season, program) do nothing;

insert into companies (slug, name, careers_url, tier_default)
values ('amazon', 'Amazon', 'https://www.amazon.jobs', 2)
on conflict (slug) do nothing;

insert into postings (company_id, program, url, portal, season, status,
                      window_expected, window_note, short_window, radar, source)
select c.id, 'PM Intern, Summer 2027 (multiple orgs)', 'https://www.amazon.jobs/en/teams/internships-for-students', '', 'summer-2027', 'watching',
       'Expected August to September, rolling', '', false, 'aug', 'seed'
from companies c where c.slug = 'amazon'
on conflict (company_id, season, program) do nothing;

insert into companies (slug, name, careers_url, tier_default)
values ('google', 'Google', 'https://www.google.com/about/careers/', 1)
on conflict (slug) do nothing;

insert into postings (company_id, program, url, portal, season, status,
                      window_expected, window_note, short_window, radar, source)
select c.id, 'APM Intern, Summer 2027', 'https://www.google.com/about/careers/applications/students', '', 'summer-2027', 'watching',
       'Expected October, 2 to 4 week window', 'Very short window. Recruits non-CS majors.', true, 'oct', 'seed'
from companies c where c.slug = 'google'
on conflict (company_id, season, program) do nothing;

insert into companies (slug, name, careers_url, tier_default)
values ('linkedin', 'LinkedIn', 'https://careers.linkedin.com', 1)
on conflict (slug) do nothing;

insert into postings (company_id, program, url, portal, season, status,
                      window_expected, window_note, short_window, radar, source)
select c.id, 'APM Intern, Summer 2027', 'https://careers.linkedin.com/students', '', 'summer-2027', 'watching',
       'Expected early October, about 11 days', 'Very short window.', true, 'oct', 'seed'
from companies c where c.slug = 'linkedin'
on conflict (company_id, season, program) do nothing;

insert into companies (slug, name, careers_url, tier_default)
values ('atlassian', 'Atlassian', 'https://www.atlassian.com/company/careers', 1)
on conflict (slug) do nothing;

insert into postings (company_id, program, url, portal, season, status,
                      window_expected, window_note, short_window, radar, source)
select c.id, 'APM Intern, Summer 2027', 'https://www.atlassian.com/company/careers/students', '', 'summer-2027', 'watching',
       'Expected fall, about a 4 day window', 'Extremely short window. Speed is everything.', true, 'oct', 'seed'
from companies c where c.slug = 'atlassian'
on conflict (company_id, season, program) do nothing;

insert into companies (slug, name, careers_url, tier_default)
values ('uber', 'Uber', 'https://www.uber.com/us/en/careers/', 1)
on conflict (slug) do nothing;

insert into postings (company_id, program, url, portal, season, status,
                      window_expected, window_note, short_window, radar, source)
select c.id, 'PM Intern, Summer 2027', 'https://www.uber.com/us/en/careers/teams/university/', '', 'summer-2027', 'watching',
       'Expected August to October', '', false, 'sep', 'seed'
from companies c where c.slug = 'uber'
on conflict (company_id, season, program) do nothing;

insert into companies (slug, name, careers_url, tier_default)
values ('intuit', 'Intuit', 'https://www.intuit.com/careers/', 1)
on conflict (slug) do nothing;

insert into postings (company_id, program, url, portal, season, status,
                      window_expected, window_note, short_window, radar, source)
select c.id, 'RPM Intern, Summer 2027', 'https://www.intuit.com/careers/students/', '', 'summer-2027', 'watching',
       'Expected September', '', false, 'sep', 'seed'
from companies c where c.slug = 'intuit'
on conflict (company_id, season, program) do nothing;

insert into companies (slug, name, careers_url, tier_default)
values ('servicenow', 'ServiceNow', 'https://careers.servicenow.com', 2)
on conflict (slug) do nothing;

insert into postings (company_id, program, url, portal, season, status,
                      window_expected, window_note, short_window, radar, source)
select c.id, 'APM Intern, Summer 2027', 'https://careers.servicenow.com/careers/students/', '', 'summer-2027', 'watching',
       'Expected September to October', '', false, 'sep', 'seed'
from companies c where c.slug = 'servicenow'
on conflict (company_id, season, program) do nothing;

insert into companies (slug, name, careers_url, tier_default)
values ('stripe', 'Stripe', 'https://stripe.com/jobs', 2)
on conflict (slug) do nothing;

insert into postings (company_id, program, url, portal, season, status,
                      window_expected, window_note, short_window, radar, source)
select c.id, 'PM Intern, Summer 2027', 'https://stripe.com/jobs/university', '', 'summer-2027', 'watching',
       'Expected August to October', '', false, 'sep', 'seed'
from companies c where c.slug = 'stripe'
on conflict (company_id, season, program) do nothing;

insert into companies (slug, name, careers_url, tier_default)
values ('palantir', 'Palantir', 'https://www.palantir.com/careers/', 2)
on conflict (slug) do nothing;

insert into postings (company_id, program, url, portal, season, status,
                      window_expected, window_note, short_window, radar, source)
select c.id, 'PM Intern, Summer 2027 (PD)', 'https://www.palantir.com/careers/', '', 'summer-2027', 'watching',
       'Expected August to October, fills before November', '', false, 'sep', 'seed'
from companies c where c.slug = 'palantir'
on conflict (company_id, season, program) do nothing;

insert into companies (slug, name, careers_url, tier_default)
values ('tiktok', 'TikTok', 'https://lifeattiktok.com', 2)
on conflict (slug) do nothing;

insert into postings (company_id, program, url, portal, season, status,
                      window_expected, window_note, short_window, radar, source)
select c.id, 'PM Intern, Summer 2027', 'https://lifeattiktok.com/campus', '', 'summer-2027', 'watching',
       'Expected August to October', '', false, 'sep', 'seed'
from companies c where c.slug = 'tiktok'
on conflict (company_id, season, program) do nothing;

insert into companies (slug, name, careers_url, tier_default)
values ('block', 'Block (Square)', 'https://block.xyz/careers', 2)
on conflict (slug) do nothing;

insert into postings (company_id, program, url, portal, season, status,
                      window_expected, window_note, short_window, radar, source)
select c.id, 'PM Intern, Summer 2027', 'https://block.xyz/careers', '', 'summer-2027', 'watching',
       'Expected August to October', '', false, 'sep', 'seed'
from companies c where c.slug = 'block'
on conflict (company_id, season, program) do nothing;

insert into companies (slug, name, careers_url, tier_default)
values ('bloomberg', 'Bloomberg', 'https://www.bloomberg.com/careers/', 2)
on conflict (slug) do nothing;

insert into postings (company_id, program, url, portal, season, status,
                      window_expected, window_note, short_window, radar, source)
select c.id, 'PM Intern, Summer 2027', 'https://www.bloomberg.com/careers/early-career/', '', 'summer-2027', 'watching',
       'Expected August to October', '', false, 'sep', 'seed'
from companies c where c.slug = 'bloomberg'
on conflict (company_id, season, program) do nothing;

insert into companies (slug, name, careers_url, tier_default)
values ('adobe', 'Adobe', 'https://www.adobe.com/careers.html', 2)
on conflict (slug) do nothing;

insert into postings (company_id, program, url, portal, season, status,
                      window_expected, window_note, short_window, radar, source)
select c.id, 'PM Intern, Summer 2027', 'https://www.adobe.com/careers/university.html', '', 'summer-2027', 'watching',
       'Expected after Labor Day', '', false, 'sep', 'seed'
from companies c where c.slug = 'adobe'
on conflict (company_id, season, program) do nothing;

insert into companies (slug, name, careers_url, tier_default)
values ('apple', 'Apple', 'https://www.apple.com/careers/us/', 2)
on conflict (slug) do nothing;

insert into postings (company_id, program, url, portal, season, status,
                      window_expected, window_note, short_window, radar, source)
select c.id, 'PM Intern, Summer 2027', 'https://www.apple.com/careers/us/students.html', '', 'summer-2027', 'watching',
       'Expected September to November', '', false, 'sep', 'seed'
from companies c where c.slug = 'apple'
on conflict (company_id, season, program) do nothing;

insert into companies (slug, name, careers_url, tier_default)
values ('spotify', 'Spotify', 'https://www.lifeatspotify.com', 2)
on conflict (slug) do nothing;

insert into postings (company_id, program, url, portal, season, status,
                      window_expected, window_note, short_window, radar, source)
select c.id, 'PM Intern, Summer 2027', 'https://www.lifeatspotify.com/students', '', 'summer-2027', 'watching',
       'Expected September to October', '', false, 'sep', 'seed'
from companies c where c.slug = 'spotify'
on conflict (company_id, season, program) do nothing;

insert into companies (slug, name, careers_url, tier_default)
values ('hubspot', 'HubSpot', 'https://www.hubspot.com/careers', 2)
on conflict (slug) do nothing;

insert into postings (company_id, program, url, portal, season, status,
                      window_expected, window_note, short_window, radar, source)
select c.id, 'PM Intern, Summer 2027', 'https://www.hubspot.com/careers/students', '', 'summer-2027', 'watching',
       'Expected September to November', '', false, 'sep', 'seed'
from companies c where c.slug = 'hubspot'
on conflict (company_id, season, program) do nothing;

insert into companies (slug, name, careers_url, tier_default)
values ('cloudflare', 'Cloudflare', 'https://www.cloudflare.com/careers/', 2)
on conflict (slug) do nothing;

insert into postings (company_id, program, url, portal, season, status,
                      window_expected, window_note, short_window, radar, source)
select c.id, 'PM Intern, Summer 2027', 'https://www.cloudflare.com/careers/early-talent/', '', 'summer-2027', 'watching',
       'Expected December to January', 'Late window. Good backstop.', false, 'dec', 'seed'
from companies c where c.slug = 'cloudflare'
on conflict (company_id, season, program) do nothing;

insert into companies (slug, name, careers_url, tier_default)
values ('ycombinator', 'YC startups', 'https://www.workatastartup.com', 3)
on conflict (slug) do nothing;

insert into postings (company_id, program, url, portal, season, status,
                      window_expected, window_note, short_window, radar, source)
select c.id, 'PM roles via Work at a Startup', 'https://www.workatastartup.com', '', 'summer-2027', 'watching',
       'Rolling, year round', 'Sweep monthly for PM intern posts.', false, 'now', 'seed'
from companies c where c.slug = 'ycombinator'
on conflict (company_id, season, program) do nothing;

-- ============================================================
-- EDIT ME — your invite code
-- ============================================================
-- Change 'CHANGE-ME' to the code you'll hand to pilot users (and adjust
-- max_uses / note if you like) BEFORE running this file.

insert into invite_codes (code, max_uses, note) values ('CHANGE-ME', 15, 'fall pilot');
