-- Decoy schema (plan section 10), plus the small additions noted below.
-- Run in the Supabase SQL editor, then run seed.sql.
--
-- Additions to the plan:
--   demo_sessions.decoy_requested_at   for the 8 second "Still connecting" check
--   calls.source 'phone'               calls that arrive on a real phone number (stretch 7)
--   calls.extraction                   last structured capture, used for the fraud report
--   call_entities.confirmed            the structured pass agreed with the instant match
--   timeline kind 'coaching'           coaching check results (stretch 6)
--   coaching_checks                    coaching check results (stretch 6)
--   bump_counters()                    atomic counter updates

create extension if not exists pgcrypto;

create table demo_sessions (
  id                 text primary key,
  state              text not null default 'idle'
                     check (state in ('idle','call_active','verified_genuine','verified_scam',
                                      'decoy_requested','decoy_live','ended')),
  customer_name      text not null default 'Margaret Wilson',
  customer_first     text not null default 'Margaret',
  natwest_calling    boolean not null default false,
  genuine_code       text,
  call_id            uuid,
  conversation_id    text,
  call_started_at    timestamptz,
  decoy_requested_at timestamptz,
  decoy_started_at   timestamptz,
  ended_at           timestamptz,
  replay             boolean not null default false,
  updated_at         timestamptz not null default now()
);

create table campaigns (
  id             text primary key,
  name           text not null,
  scam_type      text not null,
  region         text not null,
  first_seen_at  timestamptz not null default now()
);

create table calls (
  id                 uuid primary key default gen_random_uuid(),
  source             text not null check (source in ('seed','live','replay','phone')),
  status             text not null default 'live' check (status in ('live','ended')),
  started_at         timestamptz not null default now(),
  ended_at           timestamptz,
  duration_seconds   int,
  scam_type          text,
  impersonated_org   text,
  summary            text,
  confidence         numeric,
  campaign_id        text references campaigns(id),
  extraction         jsonb
);

create table transcript_lines (
  id          bigserial primary key,
  call_id     uuid not null references calls(id) on delete cascade,
  speaker     text not null check (speaker in ('caller','decoy')),
  text        text not null,
  created_at  timestamptz not null default now()
);

create table entities (
  id             uuid primary key default gen_random_uuid(),
  kind           text not null check (kind in ('account','phone','url','wallet','alias')),
  value          text not null,
  display        text not null,
  label          text,
  flagged        boolean not null default false,
  flagged_at     timestamptz,
  flag_reason    text,
  first_seen_at  timestamptz not null default now(),
  unique (kind, value)
);

create table call_entities (
  call_id     uuid not null references calls(id) on delete cascade,
  entity_id   uuid not null references entities(id) on delete cascade,
  quote       text,
  found_by    text not null check (found_by in ('pattern','claude','seed')),
  confirmed   boolean not null default false,
  created_at  timestamptz not null default now(),
  primary key (call_id, entity_id)
);

create table payments (
  id              uuid primary key default gen_random_uuid(),
  payee_name      text not null,
  sort_code       text not null,
  account_number  text not null,
  amount_pence    int  not null,
  reference       text,
  status          text not null check (status in ('sent','paused','cancelled','approved')),
  reason          text,
  entity_id       uuid references entities(id),
  created_at      timestamptz not null default now()
);

create table timeline_events (
  id          bigserial primary key,
  call_id     uuid references calls(id) on delete cascade,
  kind        text not null check (kind in ('call','check','decoy','capture','match','flag',
                                            'payment','report','canary','ally','coaching','system')),
  title       text not null,
  detail      text,
  created_at  timestamptz not null default now()
);

create table reports (
  id          uuid primary key default gen_random_uuid(),
  call_id     uuid not null references calls(id) on delete cascade,
  title       text not null,
  body_md     text not null,
  sent_to     text,
  created_at  timestamptz not null default now()
);

create table canary_hits (
  id          uuid primary key default gen_random_uuid(),
  kind        text not null check (kind in ('card','login')),
  call_id     uuid references calls(id) on delete cascade,
  detail      jsonb not null,
  created_at  timestamptz not null default now()
);

create table coaching_checks (
  id                uuid primary key default gen_random_uuid(),
  payment_id        uuid references payments(id) on delete cascade,
  likelihood        text not null check (likelihood in ('low','medium','high')),
  signals           jsonb not null default '[]'::jsonb,
  suggested_action  text not null default '',
  answers           jsonb not null default '[]'::jsonb,
  created_at        timestamptz not null default now()
);

create table counters (
  id                     text primary key,
  calls_taken            int    not null default 0,
  seconds_wasted         int    not null default 0,
  accounts_flagged       int    not null default 0,
  payments_paused        int    not null default 0,
  value_protected_pence  bigint not null default 0,
  updated_at             timestamptz not null default now()
);

create index on transcript_lines (call_id, id);
create index on call_entities (entity_id);
create index on timeline_events (created_at desc);

-- Atomic counter updates, so two actions at once cannot overwrite each other
create or replace function bump_counters(p_calls int, p_seconds int, p_accounts int,
                                         p_payments int, p_value bigint)
returns void language sql security definer as $$
  update counters set
    calls_taken           = calls_taken + p_calls,
    seconds_wasted        = seconds_wasted + p_seconds,
    accounts_flagged      = accounts_flagged + p_accounts,
    payments_paused       = payments_paused + p_payments,
    value_protected_pence = value_protected_pence + p_value,
    updated_at            = now()
  where id = 'demo';
$$;

-- Read-only access for browsers; all writes go through API routes with the service role key
do $$
declare t text;
begin
  foreach t in array array['demo_sessions','campaigns','calls','transcript_lines','entities',
                           'call_entities','payments','timeline_events','reports','canary_hits',
                           'coaching_checks','counters']
  loop
    execute format('alter table %I enable row level security', t);
    execute format('create policy "public read" on %I for select using (true)', t);
    execute format('alter publication supabase_realtime add table %I', t);
  end loop;
end $$;
