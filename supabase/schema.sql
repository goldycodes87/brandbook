-- Brand Book Schema

create table if not exists profiles (
  id uuid primary key references auth.users on delete cascade,
  role text,
  name text,
  email text,
  phone text,
  invite_token text unique,
  invite_accepted_at timestamptz,
  created_at timestamptz default now()
);

create table if not exists animals (
  id uuid primary key default gen_random_uuid(),
  tag_number text not null,
  name text,
  dob date,
  sex text,
  status text default 'active',
  breed text,
  breed_percentage int,
  birth_weight_lbs numeric,
  purchase_price numeric,
  purchase_date date,
  vendor text,
  owner_id uuid references profiles(id),
  dam_id uuid references animals(id),
  sire_id uuid references animals(id),
  registration_numbers jsonb default '[]',
  photos text[] default '{}',
  brand_photo text,
  notes text,
  created_at timestamptz default now()
);

create table if not exists health_events (
  id uuid primary key default gen_random_uuid(),
  animal_id uuid not null references animals(id) on delete cascade,
  event_type text,
  event_date date,
  drug_name text,
  dose_amount numeric,
  dose_unit text,
  withdrawal_days int,
  withdrawal_clear_date date,
  bcs_score numeric,
  administered_by text,
  notes text,
  created_at timestamptz default now()
);

create table if not exists weights (
  id uuid primary key default gen_random_uuid(),
  animal_id uuid not null references animals(id) on delete cascade,
  weighed_at timestamptz default now(),
  weight_lbs numeric,
  source text default 'manual',
  notes text
);

create table if not exists reproduction_events (
  id uuid primary key default gen_random_uuid(),
  animal_id uuid not null references animals(id) on delete cascade,
  event_type text,
  event_date date,
  sire_id uuid references animals(id),
  breed_method text,
  ai_technician text,
  expected_calving_date date,
  calving_ease_score int,
  preg_check_result text,
  calf_id uuid references animals(id),
  weaning_date date,
  weaning_weight_lbs numeric,
  notes text,
  created_at timestamptz default now()
);

create table if not exists leases (
  id uuid primary key default gen_random_uuid(),
  property_name text,
  landowner_name text,
  landowner_email text,
  landowner_phone text,
  acreage numeric,
  total_aum_capacity numeric,
  legal_description text,
  parcel_id text,
  parcel_ids text[],
  county text,
  state text default 'CO',
  start_date date,
  end_date date,
  rate_per_acre numeric,
  flat_rate numeric,
  rate_type text default 'per_acre',
  payment_frequency text default 'annual',
  renewal_alert_days int default 60,
  auto_renew boolean default false,
  status text default 'active',
  map_coordinates jsonb,
  photos text[] default '{}',
  documents text[] default '{}',
  landowner_portal_token text unique default encode(gen_random_bytes(16), 'hex'),
  landowner_portal_enabled boolean default false,
  notes text,
  created_at timestamptz default now()
);

create table if not exists grazing_assignments (
  id uuid primary key default gen_random_uuid(),
  animal_id uuid not null references animals(id) on delete cascade,
  lease_id uuid not null references leases(id) on delete cascade,
  start_date date,
  end_date date,
  created_at timestamptz default now()
);

create table if not exists grazing_owners (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references profiles(id),
  name text not null default '',
  company_name text,
  owner_name text,
  email text,
  phone text,
  address text,
  city text,
  state text,
  zip text,
  billing_address text,
  billing_type text,
  billing_rate numeric,
  brand_photo_url text,
  brand_drawing_url text,
  default_breed text,
  default_ear_tag_color text,
  default_tag_prefix text,
  stripe_customer_id text,
  notes text,
  created_at timestamptz default now()
);

create table if not exists invoices (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null,
  period_start date,
  period_end date,
  line_items jsonb default '[]',
  expense_splits jsonb default '[]',
  total_amount numeric,
  status text default 'draft',
  stripe_invoice_id text,
  sent_at timestamptz,
  paid_at timestamptz,
  created_at timestamptz default now()
);

create table if not exists semen_inventory (
  id uuid primary key default gen_random_uuid(),
  sire_name text,
  reg_number text,
  straw_count int default 0,
  tank_id text,
  location text,
  price_per_straw numeric,
  source text,
  notes text,
  created_at timestamptz default now()
);

create table if not exists embryo_inventory (
  id uuid primary key default gen_random_uuid(),
  donor_dam_id uuid references animals(id),
  sire_id uuid references animals(id),
  flush_date date,
  grade int,
  is_frozen boolean default true,
  recipient_id uuid references animals(id),
  transferred_at date,
  notes text,
  created_at timestamptz default now()
);

create table if not exists sales (
  id uuid primary key default gen_random_uuid(),
  animal_id uuid not null references animals(id) on delete cascade,
  sale_date date,
  buyer text,
  destination text,
  sale_weight_lbs numeric,
  price_per_lb numeric,
  gross_proceeds numeric,
  notes text,
  created_at timestamptz default now()
);

create table if not exists expense_items (
  id uuid primary key default gen_random_uuid(),
  category text,
  description text,
  amount numeric,
  date date,
  vendor text,
  per_head_allocation jsonb,
  notes text,
  created_at timestamptz default now()
);

create table if not exists portal_tokens (
  id uuid primary key default gen_random_uuid(),
  token text unique not null,
  role text,
  linked_id uuid,
  expires_at timestamptz,
  created_at timestamptz default now()
);

create table if not exists ranch_settings (
  id uuid primary key default gen_random_uuid(),
  ranch_name text,
  owner_name text,
  address text,
  city text,
  state text,
  zip text,
  phone text,
  email text,
  timezone text not null default 'America/Denver',
  logo_url text,
  brand_photo_url text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists notification_preferences (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references profiles(id) on delete cascade,
  withdrawal_alerts boolean default true,
  lease_renewal_alerts boolean default true,
  calving_reminders boolean default true,
  weight_reminders boolean default false,
  email_notifications boolean default true,
  alert_lead_days int default 7,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Bulk health treatment batches
create table if not exists health_event_batches (
  id uuid primary key default gen_random_uuid(),
  batch_date date not null default current_date,
  group_type text not null, -- whole_herd | cows_only | bulls_only | heifers_only | steers_only | calves_only | by_ear_tag_color | by_lease | by_owner | custom
  group_label text,         -- human-readable description of the group
  animal_count int,
  drug_name text,
  dose_amount numeric,
  dose_unit text,
  withdrawal_days int,
  administered_by text,
  notes text,
  created_at timestamptz default now()
);

-- Vet portal invites
create table if not exists vet_invites (
  id uuid primary key default gen_random_uuid(),
  token text unique not null,
  email text,
  name text,
  practice_name text,
  license_number text,
  accepted_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz default now()
);

-- Vet cases (vet consultation records)
create table if not exists vet_cases (
  id uuid primary key default gen_random_uuid(),
  animal_id uuid references animals(id) on delete cascade,
  vet_invite_id uuid references vet_invites(id),
  title text not null,
  status text default 'open', -- open | in_progress | resolved | closed
  description text,
  resolved_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Case notes (messages/notes on vet cases)
create table if not exists case_notes (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references vet_cases(id) on delete cascade,
  author_role text not null, -- rancher | vet
  body text not null,
  attachments text[] default '{}',
  created_at timestamptz default now()
);

-- Treatment plans (formal vet-issued plans)
create table if not exists treatment_plans (
  id uuid primary key default gen_random_uuid(),
  case_id uuid references vet_cases(id) on delete cascade,
  animal_id uuid references animals(id) on delete cascade,
  drug_name text,
  dose_amount numeric,
  dose_unit text,
  frequency text,
  duration_days int,
  withdrawal_days int,
  instructions text,
  created_at timestamptz default now()
);

-- Rancher <-> vet direct messages (not tied to a specific case)
create table if not exists vet_messages (
  id uuid primary key default gen_random_uuid(),
  vet_invite_id uuid references vet_invites(id),
  animal_id uuid references animals(id) on delete set null,
  direction text not null, -- rancher_to_vet | vet_to_rancher
  body text not null,
  read_at timestamptz,
  created_at timestamptz default now()
);

-- Reproduction module additions
-- Animals: calf birth & identity columns
alter table animals add column if not exists ear_tag_color text;
alter table animals add column if not exists ear_tag_number text;
alter table animals add column if not exists breeds jsonb default '[]';
alter table animals add column if not exists donor_dam_id uuid references animals(id);
alter table animals add column if not exists birth_type text;        -- single | twin_a | twin_b
alter table animals add column if not exists vigor_score int;        -- 1-3
alter table animals add column if not exists conception_method text; -- natural | ai | embryo
alter table animals add column if not exists weaning_date date;
alter table animals add column if not exists weaning_weight_lbs numeric;
alter table animals add column if not exists birth_weight_estimated boolean default false;

-- Reproduction events: additional fields
alter table reproduction_events add column if not exists sire_name_text text;      -- external sire name
alter table reproduction_events add column if not exists conception_method text;   -- natural | ai | embryo
alter table reproduction_events add column if not exists preg_check_method text;   -- ultrasound | manual | blood_test
alter table reproduction_events add column if not exists days_bred int;
alter table reproduction_events add column if not exists donor_dam_id uuid references animals(id);

-- ─── Sire Library ──────────────────────────────────────────────────────────

create table if not exists ai_studs (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  short_name text,
  website    text,
  is_active  boolean default true,
  created_at timestamptz default now()
);

create table if not exists sire_library (
  id                  uuid primary key default gen_random_uuid(),
  bull_name           text not null,
  bull_type           text not null default 'ai_sire', -- owned | leased | ai_sire
  breed               text,
  registration_number text,
  naab_code           text,
  stud                text,
  birth_year          int,
  is_active           boolean default true,
  source              text not null default 'manual',  -- manual | pdf_import
  photo_url           text,
  notes               text,
  -- EPD values
  epd_bw       numeric, epd_ww    numeric, epd_yw     numeric,
  epd_milk     numeric, epd_tm    numeric, epd_cw     numeric,
  epd_rea      numeric, epd_fat   numeric, epd_marbling numeric,
  epd_dollar_w numeric, epd_dollar_f numeric, epd_dollar_g numeric, epd_dollar_b numeric,
  acc_bw       numeric, acc_ww    numeric, acc_yw     numeric,
  epd_source      text,       -- pdf_import | manual
  epd_updated_at  timestamptz,
  import_batch_id uuid,
  use_count       int default 0,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

create table if not exists sire_import_batches (
  id             uuid primary key default gen_random_uuid(),
  stud           text not null,
  pdf_url        text,
  pdf_filename   text,
  status         text default 'processing', -- processing | complete | failed
  bulls_found    int default 0,
  bulls_imported int default 0,
  error_text     text,
  created_at     timestamptz default now()
);

-- Link reproduction events to sire library
alter table reproduction_events add column if not exists sire_library_id uuid references sire_library(id);

-- AUM tracking
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

-- Grazing assignment enhancements
alter table grazing_assignments add column if not exists notes text;
alter table grazing_assignments add column if not exists moved_from_lease_id uuid references leases(id) on delete set null;

notify pgrst, 'reload schema';
