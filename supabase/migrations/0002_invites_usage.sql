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
