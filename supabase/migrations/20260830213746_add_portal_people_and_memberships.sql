-- One person, many ranches, a role in each.
--
-- Today identity is three unrelated things: an owner is a grazing_owners row
-- with a portal_token, a vet is a vet_invites row, and the operator is a
-- profiles row. The vet's answer -- she works for a lot of outfits -- breaks
-- all three, because none can say "this person, at that ranch, in this role".
--
-- profiles looked like the right home and is not: profiles.id is a foreign key
-- to auth.users, so a row cannot exist without a Supabase Auth account. Portal
-- people sign in with a magic-link token and have no auth user, and the
-- operator's own login is a custom signed cookie rather than Supabase Auth
-- either. So portal identity gets its own table and profiles is left alone.

comment on table public.profiles is
  'Supabase Auth users only -- profiles.id is FK to auth.users. Portal owners '
  'and vets authenticate by magic link and live in portal_people instead.';

-- ── The person ──────────────────────────────────────────────────────────
create table if not exists public.portal_people (
  id             uuid primary key default gen_random_uuid(),
  first_name     text,
  last_name      text,
  -- What we greet them with. The legal name goes on invoices; this does not.
  preferred_name text,
  email          text,
  phone          text,
  contact_email  boolean not null default true,
  contact_text   boolean not null default false,

  -- Vets only.
  practice_name   text,
  license_state   text,
  license_number  text,
  license_expires date,
  -- Drawn once, applied on an explicit Sign, never auto-attached.
  signature_url   text,

  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

-- One person per email address, case-insensitively. Partial so several people
-- may legitimately have no email at all.
create unique index if not exists portal_people_email_key
  on public.portal_people (lower(email)) where email is not null;

comment on column public.portal_people.preferred_name is
  'What the app calls them. Legal name for documents is first_name/last_name.';

-- ── The membership ──────────────────────────────────────────────────────
create table if not exists public.portal_memberships (
  id            uuid primary key default gen_random_uuid(),
  person_id     uuid not null references public.portal_people(id) on delete cascade,
  ranch_id      uuid not null references public.ranch_settings(id) on delete cascade,
  -- Authoritative for what this login can do. A person can be an owner at one
  -- ranch and a CPA at another.
  role          text not null check (role in ('admin','co_admin','owner','cpa','vet')),

  -- Set only for role='owner': which herd this membership can see. An owner
  -- membership without one would be a login with nothing behind it.
  owner_id      uuid references public.grazing_owners(id) on delete cascade,

  status        text not null default 'invited'
                  check (status in ('invited','active','revoked')),

  -- The magic link. Single-purpose, and the accepted session is what persists
  -- afterwards rather than the token itself.
  invite_token      text unique,
  invite_expires_at timestamptz,
  invited_at        timestamptz not null default now(),
  accepted_at       timestamptz,
  -- Per membership, not per person: the same vet joining a second ranch
  -- confirms her details there without redoing her licence.
  onboarded_at      timestamptz,
  created_at        timestamptz not null default now(),

  constraint owner_role_needs_owner_id
    check (role <> 'owner' or owner_id is not null)
);

create unique index if not exists portal_memberships_unique
  on public.portal_memberships (person_id, ranch_id, role);
create index if not exists portal_memberships_ranch_idx on public.portal_memberships (ranch_id, role);
create index if not exists portal_memberships_owner_idx on public.portal_memberships (owner_id);
create index if not exists portal_memberships_token_idx on public.portal_memberships (invite_token)
  where invite_token is not null;

alter table public.portal_people      enable row level security;
alter table public.portal_memberships enable row level security;
drop policy if exists "service role full access" on public.portal_people;
create policy "service role full access" on public.portal_people
  for all to service_role using (true) with check (true);
drop policy if exists "service role full access" on public.portal_memberships;
create policy "service role full access" on public.portal_memberships
  for all to service_role using (true) with check (true);

-- ── Backfill: everyone who can already get in ───────────────────────────
do $$
declare
  v_ranch uuid;
  r       record;
  v_pid   uuid;
begin
  select id into v_ranch from public.ranch_settings limit 1;
  if v_ranch is null then
    raise notice 'no ranch_settings row; skipping backfill';
    return;
  end if;

  -- Owners keep the portal token they already hold, so links already sent go
  -- on working. is_self is the ranch itself, not a customer, and is skipped.
  --
  -- Looped rather than a set-based INSERT...RETURNING because the new person
  -- id has to be tied back to the specific owner row it came from, and there
  -- is no column on portal_people to carry that through a RETURNING.
  for r in
    select o.id, o.email, o.phone, o.portal_token,
           coalesce(o.owner_name, o.name) as person_name
    from public.grazing_owners o
    where not coalesce(o.is_self, false)
  loop
    select p.id into v_pid
    from public.portal_people p
    where r.email is not null and lower(p.email) = lower(r.email)
    limit 1;

    if v_pid is null then
      insert into public.portal_people (first_name, last_name, email, phone)
      values (
        nullif(split_part(r.person_name, ' ', 1), ''),
        nullif(substr(r.person_name, length(split_part(r.person_name, ' ', 1)) + 2), ''),
        r.email, r.phone
      )
      returning id into v_pid;
    end if;

    insert into public.portal_memberships
      (person_id, ranch_id, role, owner_id, status, invite_token, accepted_at)
    values (v_pid, v_ranch, 'owner', r.id, 'active', r.portal_token, now())
    on conflict (person_id, ranch_id, role) do nothing;
  end loop;

  -- The operator, from whatever the ranch record already knows about them.
  -- Left un-onboarded on purpose: the admin setup interview is the next build,
  -- and this row is what it will fill in.
  select p.id into v_pid
  from public.portal_people p
  join public.ranch_settings rs on lower(p.email) = lower(rs.email)
  where rs.id = v_ranch and rs.email is not null
  limit 1;

  if v_pid is null then
    insert into public.portal_people (first_name, email, phone)
    select nullif(split_part(coalesce(rs.owner_name, 'Operator'), ' ', 1), ''),
           rs.email, rs.phone
    from public.ranch_settings rs where rs.id = v_ranch
    returning id into v_pid;
  end if;

  insert into public.portal_memberships
    (person_id, ranch_id, role, status, accepted_at)
  values (v_pid, v_ranch, 'admin', 'active', now())
  on conflict (person_id, ranch_id, role) do nothing;
end $$;
