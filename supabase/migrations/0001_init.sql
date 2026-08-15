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
