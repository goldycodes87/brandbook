-- Emailed receipts: forward one in, confirm it later.
--
-- Three tables rather than one because the three things have different
-- lifetimes and different failure modes. The email is the evidence and is kept
-- verbatim; the receipt is a file plus what the parser made of it, and parsing
-- can fail without losing the email; the line items are what actually become
-- expenses, and each one is decided separately -- hay is a herd split, fly
-- bags are pasture maintenance, dog food is personal and never recorded.

-- ── The envelope ────────────────────────────────────────────────────────────
create table if not exists public.inbound_emails (
  id             uuid primary key default gen_random_uuid(),
  -- RFC message id. Unique so a webhook retry cannot ingest the same mail
  -- twice; Resend retries when our endpoint is down.
  message_id     text not null unique,
  from_address   text not null,
  subject        text,
  received_at    timestamptz not null,
  -- R2 key for the original .eml. The "in case anyone asks" copy.
  raw_key        text,
  status         text not null default 'pending',   -- pending | processed | rejected | failed
  error          text,
  -- One calendar year, then the nightly cleanup removes the row and its files.
  expires_on     date not null,
  created_at     timestamptz not null default now()
);

create index if not exists inbound_emails_status_idx  on public.inbound_emails (status, received_at desc);
create index if not exists inbound_emails_expires_idx on public.inbound_emails (expires_on);

-- ── One attachment, and what the parser read off it ─────────────────────────
create table if not exists public.inbound_receipts (
  id            uuid primary key default gen_random_uuid(),
  email_id      uuid not null references public.inbound_emails(id) on delete cascade,
  r2_key        text not null,
  filename      text,
  content_type  text,
  size_bytes    bigint,
  -- Parsed header. vendor is stamped onto every expense created from this
  -- receipt, which is how lease_expenses.vendor finally starts getting values.
  vendor        text,
  receipt_date  date,
  receipt_total numeric(12,2),
  parse_status  text not null default 'pending',    -- pending | parsed | failed
  parse_error   text,
  created_at    timestamptz not null default now()
);

create index if not exists inbound_receipts_email_idx on public.inbound_receipts (email_id);

-- ── One line, one decision ──────────────────────────────────────────────────
create table if not exists public.receipt_line_items (
  id                     uuid primary key default gen_random_uuid(),
  receipt_id             uuid not null references public.inbound_receipts(id) on delete cascade,
  line_no                integer not null default 0,
  description            text,
  amount                 numeric(12,2),
  suggested_category_id  uuid references public.expense_categories(id) on delete set null,
  suggested_category_name text,

  -- Match against something already entered. A split expense is matched by its
  -- group, never by one of its per-animal rows -- comparing a receipt total to
  -- a twelfth of it would never hit.
  matched_expense_id     uuid references public.lease_expenses(id) on delete set null,
  matched_split_group_id uuid,
  match_score            integer,
  match_reason           text,

  -- pending -> what the operator decides.
  --   create   = make a new expense from this line
  --   attach   = this line is already recorded; attach the receipt to it
  --   skip     = personal or otherwise not a ranch expense; never recorded
  decision               text not null default 'pending',
  created_expense_id     uuid references public.lease_expenses(id) on delete set null,
  decided_at             timestamptz,
  created_at             timestamptz not null default now()
);

create index if not exists receipt_line_items_receipt_idx  on public.receipt_line_items (receipt_id);
create index if not exists receipt_line_items_decision_idx on public.receipt_line_items (decision);

alter table public.inbound_emails    enable row level security;
alter table public.inbound_receipts  enable row level security;
alter table public.receipt_line_items enable row level security;

drop policy if exists "service role full access" on public.inbound_emails;
create policy "service role full access" on public.inbound_emails
  for all to service_role using (true) with check (true);
drop policy if exists "service role full access" on public.inbound_receipts;
create policy "service role full access" on public.inbound_receipts
  for all to service_role using (true) with check (true);
drop policy if exists "service role full access" on public.receipt_line_items;
create policy "service role full access" on public.receipt_line_items
  for all to service_role using (true) with check (true);
