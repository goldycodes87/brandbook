-- One-off invoices (hauling, a repair, a single load of hay) alongside the
-- quarterly run, and one invariant that keeps the two paths from colliding.
--
-- THE INVARIANT: for any (expense, owner) pair, at most one non-void invoice
-- may carry it. Without this, an expense billed early on a one-off would be
-- billed again by the quarterly run — and because expense_allocations is
-- unique on (expense_id, owner_id), the second write would repoint the first
-- invoice's allocation rather than erroring, destroying its record too.

-- ── Shared guard ────────────────────────────────────────────────────────────
create or replace function public.assert_expenses_not_already_billed(
  p_allocations jsonb,
  p_owner_id    uuid
) returns void
language plpgsql
as $$
declare
  v_clash text;
begin
  if p_allocations is null or jsonb_array_length(p_allocations) = 0 then
    return;
  end if;

  select string_agg(
           coalesce(le.description, le.category_name, 'expense')
             || ' on invoice ' || i.invoice_number, '; ')
    into v_clash
  from jsonb_array_elements(p_allocations) a
  join public.expense_allocations ea
    on ea.expense_id = (a->>'expense_id')::uuid
   and ea.owner_id is not distinct from nullif(a->>'owner_id', '')::uuid
  join public.invoices i on i.id = ea.invoice_id
  left join public.lease_expenses le on le.id = ea.expense_id
  where i.status <> 'void';

  if v_clash is not null then
    raise exception
      'Already billed: %. Void that invoice first, or leave these off this one.', v_clash
      using errcode = 'unique_violation';
  end if;
end;
$$;

comment on function public.assert_expenses_not_already_billed is
  'Raises unique_violation if any (expense, owner) pair is already carried by a non-void invoice. Called by both invoice creation functions.';

-- ── One-off invoice ─────────────────────────────────────────────────────────
-- expense_quarter stays null on purpose: a one-off is not "the quarter's
-- expenses", so invoices_one_per_owner_expense_quarter must not apply to it.
-- It shares the YYQQNNN number series, and picks its own sequence inside the
-- transaction so two invoices cannot race for the same number.
create or replace function public.create_manual_invoice(
  p_owner_id            uuid,
  p_line_items          jsonb,
  p_total               numeric,
  p_period_start        date    default null,
  p_period_end          date    default null,
  p_due_date            date    default null,
  p_notes               text    default null,
  p_expense_splits      jsonb   default null,
  p_allocations         jsonb   default null,
  p_billed_expense_ids  uuid[]  default null
) returns public.invoices
language plpgsql
as $$
declare
  v_invoice public.invoices;
  v_quarter int  := extract(quarter from current_date);
  v_yy      int  := extract(year from current_date)::int % 100;
  v_seq     int;
  v_number  text;
begin
  perform public.assert_expenses_not_already_billed(p_allocations, p_owner_id);

  select coalesce(max(invoice_sequence), 0) + 1
    into v_seq
  from public.invoices
  where invoice_quarter = v_quarter
    and extract(year from created_at)::int % 100 = v_yy;

  v_number := lpad(v_yy::text, 2, '0')
           || lpad(v_quarter::text, 2, '0')
           || lpad(v_seq::text, 3, '0');

  insert into public.invoices (
    owner_id, invoice_number, invoice_quarter, invoice_sequence,
    period_start, period_end, due_date, line_items, expense_splits,
    total_amount, status, notes
  ) values (
    p_owner_id, v_number, v_quarter, v_seq,
    p_period_start, p_period_end, p_due_date, p_line_items, p_expense_splits,
    p_total, 'draft', p_notes
  )
  returning * into v_invoice;

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

  if p_billed_expense_ids is not null and array_length(p_billed_expense_ids, 1) > 0 then
    update public.lease_expenses
      set invoice_id = v_invoice.id
    where id = any(p_billed_expense_ids);
  end if;

  return v_invoice;
end;
$$;

comment on function public.create_manual_invoice is
  'Creates a one-off invoice atomically, sharing the YYQQNNN number series. expense_quarter is left null so the quarterly uniqueness index does not apply. Raises unique_violation if any expense it bills is already on a live invoice.';

-- ── The quarterly path takes the same guard ─────────────────────────────────
create or replace function public.create_quarterly_invoice(
  p_owner_id            uuid,
  p_invoice_number      text,
  p_invoice_quarter     int,
  p_invoice_sequence    int,
  p_period_start        date,
  p_period_end          date,
  p_line_items          jsonb,
  p_total               numeric,
  p_notes               text,
  p_expense_quarter     int,
  p_expense_year        int,
  p_allocations         jsonb,
  p_billed_expense_ids  uuid[],
  p_due_date            date default null
) returns public.invoices
language plpgsql
as $$
declare
  v_invoice public.invoices;
begin
  perform public.assert_expenses_not_already_billed(p_allocations, p_owner_id);

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

  if p_billed_expense_ids is not null and array_length(p_billed_expense_ids, 1) > 0 then
    update public.lease_expenses
      set invoice_id = v_invoice.id
    where id = any(p_billed_expense_ids);
  end if;

  return v_invoice;
end;
$$;
