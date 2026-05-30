-- Lease enhancements
alter table leases add column if not exists status text default 'active';
alter table leases add column if not exists total_aum_capacity numeric;
alter table leases add column if not exists rate_type text default 'per_acre';
alter table leases add column if not exists payment_frequency text default 'annual';
alter table leases add column if not exists auto_renew boolean default false;
alter table leases add column if not exists map_coordinates jsonb;
alter table leases add column if not exists county text;
alter table leases add column if not exists state text default 'CO';
alter table leases add column if not exists parcel_ids text[];
alter table leases add column if not exists photos text[] default '{}';
alter table leases add column if not exists documents text[] default '{}';
alter table leases add column if not exists landowner_portal_token text unique default encode(gen_random_bytes(16), 'hex');
alter table leases add column if not exists landowner_portal_enabled boolean default false;

create table if not exists aum_records (
  id uuid primary key default gen_random_uuid(),
  lease_id uuid references leases(id) on delete cascade not null,
  animal_id uuid references animals(id) on delete cascade not null,
  assignment_id uuid references grazing_assignments(id) on delete cascade,
  recorded_date date not null default current_date,
  weight_lbs numeric,
  aum_value numeric,
  notes text,
  created_at timestamptz default now()
);

create index if not exists aum_lease_idx on aum_records(lease_id);
create index if not exists aum_animal_idx on aum_records(animal_id);
create index if not exists aum_date_idx on aum_records(recorded_date);

alter table aum_records enable row level security;

create policy if not exists "service role full access" on aum_records
  for all to service_role using (true) with check (true);

alter table grazing_assignments add column if not exists notes text;
alter table grazing_assignments add column if not exists moved_from_lease_id uuid references leases(id) on delete set null;

notify pgrst, 'reload schema';
