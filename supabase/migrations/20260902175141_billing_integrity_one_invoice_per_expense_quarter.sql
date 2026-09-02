-- Billing integrity: make it impossible to bill the same owner twice for the
-- same quarter of expenses, and make invoice creation atomic.
--
-- Before this, generate-quarterly wrote the invoice, its allocations and the
-- expense stamps as three separate statements, the last two non-fatal. An
-- invoice could exist with no record of which expenses it covered — exactly
-- the state the June 2026 invoices are in — and nothing stopped a second run
-- billing the same expenses again.

-- ── 1. The invoice records which quarter of expenses it billed ──────────────
-- It lived only in a free-text note ("Q3 2026 grazing + Q2 2026 expenses"),
-- which nothing can constrain.
alter table public.invoices
  add column if not exists expense_quarter smallint,
  add column if not exists expense_year    smallint;

comment on column public.invoices.expense_quarter is
  'Quarter of lease_expenses billed on this invoice (1-4). Distinct from invoice_quarter, which is the grazing period billed in advance.';
comment on column public.invoices.expense_year is
  'Two-digit year matching lease_expenses.year (e.g. 26 = 2026).';

-- Backfill from the note the generator has always written.
update public.invoices
set expense_quarter = (substring(notes from 'Q(\d) \d{4} expenses'))::smallint,
    expense_year    = (substring(notes from 'Q\d (\d{4}) expenses'))::smallint % 100
where notes ~ 'Q\d \d{4} expenses'
  and expense_quarter is null;

-- ── 2. One live invoice per owner per expense quarter ───────────────────────
-- The guarantee, enforced by the database rather than by remembering to check.
-- Escape hatch: set status = 'void' to reissue.
create unique index if not exists invoices_one_per_owner_expense_quarter
  on public.invoices (owner_id, expense_quarter, expense_year)
  where expense_quarter is not null and status <> 'void';

-- ── 3. Atomic creation ──────────────────────────────────────────────────────
-- Invoice, allocations and expense stamps in one transaction. Either all three
-- land or none do, so an invoice can never again exist without the record of
-- what it covered.
create or replace function public.create_quarterly_invoice(
  p_owner_id            uuid,
  p_invoice_number      text,
  p_invoice_quarter     int,
  p_invoice_sequence    int,
  p_period_start        date,
  p_period_end          date,
  p_due_date            date,
  p_line_items          jsonb,
  p_total               numeric,
  p_notes               text,
  p_expense_quarter     int,
  p_expense_year        int,
  p_allocations         jsonb,
  p_billed_expense_ids  uuid[]
) returns public.invoices
language plpgsql
as $$
declare
  v_invoice public.invoices;
begin
  insert into public.invoices (
    owner_id, invoice_number, invoice_quarter, invoice_sequence,
    period_start, period_end, due_date, line_items, total_amount,
    status, notes, expense_quarter, expense_year
  ) values (
    p_owner_id, p_invoice_number, p_invoice_quarter, p_invoice_sequence,
    p_period_start, p_period_end, p_due_date, p_line_items, p_total,
    'draft', p_notes, p_expense_quarter, p_expense_year
  )
  returning * into v_invoice;

  -- This owner's frozen shares. Repointing on conflict is correct: it can only
  -- happen after the previous invoice for this quarter was voided, since the
  -- unique index above blocks a live duplicate.
  if p_allocations is not null and jsonb_array_length(p_allocations) > 0 then
    insert into public.expense_allocations
      (expense_id, owner_id, amount, share_note, invoice_id, computed_at)
    select (a->>'expense_id')::uuid,
           nullif(a->>'owner_id', '')::uuid,
           (a->>'amount')::numeric,
           a->>'share_note',
           v_invoice.id,
           now()
    from jsonb_array_elements(p_allocations) a
    on conflict (expense_id, owner_id) do update
      set amount      = excluded.amount,
          share_note  = excluded.share_note,
          invoice_id  = excluded.invoice_id,
          computed_at = excluded.computed_at;
  end if;

  -- Single-owner rows carry invoice_id directly so an expense list can show
  -- status without joining through allocations.
  if p_billed_expense_ids is not null and array_length(p_billed_expense_ids, 1) > 0 then
    update public.lease_expenses
      set invoice_id = v_invoice.id
    where id = any(p_billed_expense_ids);
  end if;

  return v_invoice;
end;
$$;

comment on function public.create_quarterly_invoice is
  'Creates a quarterly invoice with its expense allocations and expense stamps in one transaction. Raises unique_violation on invoices_one_per_owner_expense_quarter if this owner already has a live invoice for that expense quarter.';
