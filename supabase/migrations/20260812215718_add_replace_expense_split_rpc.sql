-- Replace every row of a multi-animal split in one transaction.
--
-- Editing a split means re-dividing the total across a possibly different set
-- of animals, so rows are replaced wholesale rather than patched. Doing that
-- as a DELETE then an INSERT over two PostgREST calls can leave the split
-- deleted and not re-created if the second call fails -- an expense silently
-- disappearing. Inside a function both statements share one transaction.
create or replace function public.replace_expense_split(p_group_id uuid, p_rows jsonb)
returns setof public.lease_expenses
language plpgsql
as $$
begin
  if p_group_id is null then
    raise exception 'p_group_id is required';
  end if;

  -- An invoiced split has already been billed at those amounts. Re-dividing it
  -- would restate a sent invoice from underneath the customer.
  if exists (
    select 1 from public.lease_expenses
    where split_group_id = p_group_id and invoice_id is not null
  ) then
    raise exception 'split % has already been invoiced', p_group_id
      using errcode = 'check_violation';
  end if;

  delete from public.lease_expenses where split_group_id = p_group_id;

  return query
  insert into public.lease_expenses (
    lease_id, is_lease_specific, category_name, category_id, expense_type,
    description, total_amount, expense_date, receipt_url, period_start, period_end,
    owner_id, animal_id, year, quarter, notes, qty, unit_cost,
    sire_library_id, bull_name, include_calves, reproduction_event_id, split_group_id
  )
  select
    (r->>'lease_id')::uuid,
    coalesce((r->>'is_lease_specific')::boolean, false),
    r->>'category_name',
    (r->>'category_id')::uuid,
    r->>'expense_type',
    r->>'description',
    (r->>'total_amount')::numeric,
    (r->>'expense_date')::date,
    r->>'receipt_url',
    (r->>'period_start')::date,
    (r->>'period_end')::date,
    (r->>'owner_id')::uuid,
    (r->>'animal_id')::uuid,
    (r->>'year')::int,
    (r->>'quarter')::int,
    r->>'notes',
    (r->>'qty')::numeric,
    (r->>'unit_cost')::numeric,
    (r->>'sire_library_id')::uuid,
    r->>'bull_name',
    coalesce((r->>'include_calves')::boolean, false),
    (r->>'reproduction_event_id')::uuid,
    p_group_id
  from jsonb_array_elements(p_rows) as r
  returning *;
end $$;

revoke all on function public.replace_expense_split(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.replace_expense_split(uuid, jsonb) to service_role;
