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
  legal_description text,
  parcel_id text,
  start_date date,
  end_date date,
  rate_per_acre numeric,
  flat_rate numeric,
  renewal_alert_days int default 60,
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
  name text not null,
  email text,
  phone text,
  brand_photo text,
  billing_type text,
  billing_rate numeric,
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

notify pgrst, 'reload schema';
