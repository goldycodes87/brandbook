-- What RancherAI carries between conversations.
--
-- ai_messages is the transcript; this is what was learned from it. Two tables
-- because they age differently: a transcript is evidence and stays as written,
-- while a fact gets corrected, superseded and forgotten.

create table if not exists ai_memory (
  id           uuid primary key default gen_random_uuid(),
  ranch_id     uuid references ranch_settings(id) on delete cascade,
  -- Null for a fact about the operation, which every operator should get.
  -- Set for a preference that belongs to one person.
  auth_user_id uuid,
  fact         text not null,
  -- ranch | preference | correction
  kind         text not null default 'ranch' check (kind in ('ranch','preference','correction')),
  source_conversation_id uuid references ai_conversations(id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists ai_memory_ranch_idx on ai_memory (ranch_id, kind);
create index if not exists ai_memory_user_idx  on ai_memory (auth_user_id);

-- The same fact learned twice is one fact. NULLS NOT DISTINCT so the null
-- auth_user_id on a ranch-wide fact counts as a value rather than as "unknown,
-- therefore never equal to itself" — and so ON CONFLICT can infer this index
-- from a plain column list, which an expression index cannot do.
--
-- Superseded the expression index this file originally created; see
-- 20260831180716_fix_ai_memory_unique_for_upsert.sql, which is what actually
-- ran against the remote.
create unique index if not exists ai_memory_unique
  on ai_memory (ranch_id, auth_user_id, fact) nulls not distinct;

comment on table ai_memory is
  'Durable facts RancherAI learned, distilled from conversations. The transcript in ai_messages is what was said; this is what stuck.';

-- Every record RancherAI created, and how it was asked for.
--
-- A write that arrived by voice was confirmed by a spoken yes, which is a
-- weaker signal than a tapped button. That difference has to survive in the
-- record so a wrong one can be found and undone.
create table if not exists ai_writes (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid references ai_conversations(id) on delete set null,
  auth_user_id    uuid,
  action          text not null,
  summary         text not null,
  channel         text not null default 'text' check (channel in ('text','voice')),
  -- What row it made, so it can be found again.
  table_name      text,
  row_id          uuid,
  undone_at       timestamptz,
  created_at      timestamptz not null default now()
);

create index if not exists ai_writes_recent_idx on ai_writes (created_at desc);

comment on table ai_writes is
  'What RancherAI actually created, and whether it was confirmed by a tap or by a spoken yes.';
