-- Per-owner share of every expense: one row per (expense, owner).
--
-- lease_expenses.invoice_id can only describe a row billed to exactly one
-- owner. A shared expense is pro-rated across every owner grazing that
-- quarter, so its status is per-owner, not per-row. This table carries that.
--
-- Rows are written at invoice generation and frozen (invoice_id set). Pending
-- shares are NOT stored -- they are computed live from current herd-days,
-- because a stored pending number goes stale the moment an animal moves.
create table if not exists public.expense_allocations (
  id          uuid primary key default gen_random_uuid(),
  expense_id  uuid not null references public.lease_expenses(id) on delete cascade,
  -- null = ranch-owned with no "self" grazing_owners row configured
  owner_id    uuid references public.grazing_owners(id) on delete cascade,
  amount      numeric(12,2) not null,
  -- how the amount was derived, e.g. '34.2% of $1,850.00'
  share_note  text,
  -- null = not yet invoiced. set null on invoice delete so the share reverts
  -- to pending rather than vanishing.
  invoice_id  uuid references public.invoices(id) on delete set null,
  computed_at timestamptz not null default now()
);

-- One allocation per owner per expense. NULLS NOT DISTINCT so the ranch-owned
-- (null owner) share cannot be duplicated by repeated invoice generation.
create unique index if not exists expense_allocations_expense_owner_key
  on public.expense_allocations (expense_id, owner_id) nulls not distinct;

create index if not exists expense_allocations_owner_idx   on public.expense_allocations (owner_id);
create index if not exists expense_allocations_invoice_idx on public.expense_allocations (invoice_id);

alter table public.expense_allocations enable row level security;

drop policy if exists "service role full access" on public.expense_allocations;
create policy "service role full access" on public.expense_allocations
  for all to service_role using (true) with check (true);
