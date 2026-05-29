-- Add company_name and owner_name fields to grazing_owners
-- Run this in the Supabase dashboard SQL editor:
-- https://supabase.com/dashboard/project/mxlbjqebyvayfxeioxph/sql

ALTER TABLE grazing_owners ADD COLUMN IF NOT EXISTS company_name text;
ALTER TABLE grazing_owners ADD COLUMN IF NOT EXISTS owner_name text;

-- Rename old per_acre_month billing type to per_head_month
UPDATE grazing_owners SET billing_type = 'per_head_month' WHERE billing_type = 'per_acre_month';
