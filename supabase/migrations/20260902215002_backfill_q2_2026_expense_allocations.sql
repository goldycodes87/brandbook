-- Reconstruct the expense allocations behind invoices 2603001 and 2603002.
--
-- Both were generated on 26 June 2026, six weeks before expense_allocations
-- existed. The invoices are correct and paid, but nothing recorded WHICH
-- expenses they covered, so Andy's and Doug's Q2 shares still read as pending
-- and a re-run would have billed them again.
--
-- The amounts come from the invoices' own line items, not from re-running the
-- allocation engine: the herd has changed since June, so a fresh computation
-- would produce different figures and quietly restate what two people already
-- paid. What was billed is the fact being recorded.
--
-- Idempotent, and it refuses to write unless all three checks hold.
do $$
declare
  v_bad  int;
  v_rows int;
  v_inv  record;
begin
  create temp table _bf on commit drop as
  with lines as (
    select i.id inv_id, i.invoice_number, i.owner_id, i.total_amount inv_total,
           li->>'description' as line_desc,
           (li->>'amount')::numeric as line_amt
    from invoices i, lateral jsonb_array_elements(i.line_items) li
    where i.expense_quarter = 2 and i.expense_year = 26
      and coalesce((li->>'is_header')::boolean, false) = false
      and (li->>'amount')::numeric <> 0
      and li->>'description' not like 'Grazing Per Head/Month%'
  ),
  cand as (
    -- Two identical $35 owner-specific rows exist; they are told apart by the
    -- invoice_id already stamped on them, which is why that ordering is first.
    select l.*, le.id expense_id, le.total_amount pool,
           row_number() over (partition by l.inv_id, l.line_desc
                              order by (le.invoice_id = l.inv_id) desc, le.id) rn
    from lines l
    join lease_expenses le on le.year = 26 and le.quarter = 2
    left join leases lz on lz.id = le.lease_id
    where l.line_desc = coalesce(le.description, le.category_name) || ' (' || lz.property_name || ')'
  )
  select * from cand where rn = 1;

  select count(*) into v_bad from _bf where expense_id is null;
  if v_bad > 0 then raise exception 'ABORT: % line(s) did not match an expense row', v_bad; end if;

  for v_inv in
    select b.invoice_number, b.inv_id, b.inv_total, sum(b.line_amt) matched,
           (select coalesce(sum((li->>'amount')::numeric), 0)
              from invoices i2, lateral jsonb_array_elements(i2.line_items) li
             where i2.id = b.inv_id and li->>'description' like 'Grazing Per Head/Month%') grazing
    from _bf b group by b.invoice_number, b.inv_id, b.inv_total
  loop
    if v_inv.matched <> v_inv.inv_total - v_inv.grazing then
      raise exception 'ABORT: % does not reconcile — matched %, expected %',
        v_inv.invoice_number, v_inv.matched, v_inv.inv_total - v_inv.grazing;
    end if;
  end loop;

  select count(*) into v_bad from (
    select expense_id, pool, sum(line_amt) alloc from _bf group by expense_id, pool
  ) s where s.alloc > s.pool;
  if v_bad > 0 then raise exception 'ABORT: % expense(s) over-allocated', v_bad; end if;

  insert into expense_allocations (expense_id, owner_id, amount, share_note, invoice_id, computed_at)
  select expense_id, owner_id, line_amt,
         to_char(line_amt, 'FM999990.00') || ' of ' || to_char(pool, 'FM999990.00')
           || ' (backfilled from invoice ' || invoice_number || ')',
         inv_id, now()
  from _bf
  on conflict (expense_id, owner_id) do update
    set amount = excluded.amount, share_note = excluded.share_note,
        invoice_id = excluded.invoice_id, computed_at = excluded.computed_at;

  get diagnostics v_rows = row_count;
  raise notice 'Backfilled % allocation rows', v_rows;
end $$;
