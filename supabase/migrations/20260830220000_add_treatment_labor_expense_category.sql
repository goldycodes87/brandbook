-- The category a ranch-administered treatment bills under.
--
-- The existing "Labor" category is expense_type 'shared', which pro-rates
-- across the whole herd by animal-days. This charge is the opposite: one head,
-- one owner, the owner of the animal that got the needle. Filed under the same
-- Schedule F line (22, Labor hired) because that is what it is at tax time.
insert into public.expense_categories (name, expense_type, calculation_type, schedule_f_line, is_active, sort_order)
select 'Treatment Labor', 'animal_specific', 'one_time', '22', true,
       coalesce((select max(sort_order) from public.expense_categories), 0) + 1
where not exists (
  select 1 from public.expense_categories where name = 'Treatment Labor'
);
