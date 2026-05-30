-- Shared expenses logged per lease (split across all owners)
create table if not exists lease_expenses (
  id             uuid primary key default gen_random_uuid(),
  lease_id       uuid references leases(id) on delete cascade not null,
  category_name  text not null,
  description    text,
  total_amount   numeric not null,
  expense_date   date,
  receipt_url    text,
  period_start   date,
  period_end     date,
  created_at     timestamptz default now()
);

alter table lease_expenses enable row level security;

do $$ begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'lease_expenses'
    and policyname = 'service role full access'
  ) then
    execute 'create policy "service role full access" on lease_expenses
      for all to service_role using (true) with check (true)';
  end if;
end $$;

create index if not exists lease_expenses_lease_idx on lease_expenses(lease_id);
create index if not exists lease_expenses_date_idx  on lease_expenses(expense_date);

notify pgrst, 'reload schema';
