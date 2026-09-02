-- due_date is genuinely optional on an invoice; the original signature made it
-- required, which forced callers to pass an explicit null and fought the
-- generated types.
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

-- The 14-argument form with a required p_due_date is now shadowed; drop it so
-- there is exactly one create_quarterly_invoice and no overload ambiguity.
drop function if exists public.create_quarterly_invoice(
  uuid, text, int, int, date, date, date, jsonb, numeric, text, int, int, jsonb, uuid[]
);

comment on function public.create_quarterly_invoice is
  'Creates a quarterly invoice with its expense allocations and expense stamps in one transaction. Raises unique_violation on invoices_one_per_owner_expense_quarter if this owner already has a live invoice for that expense quarter.';
