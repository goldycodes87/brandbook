-- RancherAI: the conversation it remembers, and the contacts it can look up.
--
-- ranch_contacts exists because a question like "what is Spencer's phone number
-- for AI" had no answer in the schema. ranch_settings.default_ai_technician
-- holds a name and nothing else, and ai_studs is stud companies, not people.

create table if not exists ranch_contacts (
  id           uuid primary key default gen_random_uuid(),
  ranch_id     uuid references ranch_settings(id) on delete cascade,
  name         text not null,
  role         text,                       -- ai_tech, vet, hauler, nutritionist, brand_inspector, auction, other
  company      text,
  phone        text,
  email        text,
  notes        text,
  is_active    boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists ranch_contacts_ranch_idx on ranch_contacts (ranch_id, is_active);
create index if not exists ranch_contacts_name_idx  on ranch_contacts (lower(name));

comment on table ranch_contacts is
  'People the ranch calls: AI technician, vet, hauler, brand inspector, auction barn. Separate from portal_people, who have a login; these are phone numbers, not accounts.';

-- One thread per person. Voice and text share it, so a question asked at the
-- chute and followed up on at the desk is the same conversation.
create table if not exists ai_conversations (
  id            uuid primary key default gen_random_uuid(),
  ranch_id      uuid references ranch_settings(id) on delete cascade,
  auth_user_id  uuid,
  title         text,
  created_at    timestamptz not null default now(),
  last_message_at timestamptz not null default now()
);

create index if not exists ai_conversations_user_idx on ai_conversations (auth_user_id, last_message_at desc);

create table if not exists ai_messages (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references ai_conversations(id) on delete cascade,
  role            text not null check (role in ('user','assistant')),
  content         text not null default '',
  -- What the assistant actually did, kept beside the reply: every tool call and
  -- its result. An answer about money has to be auditable a year later.
  tool_calls      jsonb,
  channel         text not null default 'text' check (channel in ('text','voice')),
  created_at      timestamptz not null default now()
);

create index if not exists ai_messages_conversation_idx on ai_messages (conversation_id, created_at);

comment on column ai_messages.tool_calls is
  'Ordered list of {name, input, result} for the tools this turn ran. The audit trail behind an answer.';
