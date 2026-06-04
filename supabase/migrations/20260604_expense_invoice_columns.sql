-- Add expense_type to expense_categories
ALTER TABLE expense_categories
  ADD COLUMN IF NOT EXISTS expense_type text NOT NULL DEFAULT 'shared';

-- Seed categories with correct types
INSERT INTO expense_categories (name, expense_type, sort_order, is_active) VALUES
  ('Hay / Forage',           'shared',          1,  true),
  ('Tubs',                   'shared',          2,  true),
  ('Salt',                   'shared',          3,  true),
  ('Pasture Treatment',      'shared',          4,  true),
  ('Fence Repair',           'shared',          5,  true),
  ('Equipment Rental',       'shared',          6,  true),
  ('Labor',                  'shared',          7,  true),
  ('Water',                  'shared',          8,  true),
  ('Other (Shared)',         'shared',          9,  true),
  ('AI Tech Fee',            'owner_specific',  10, true),
  ('Semen Straws',           'owner_specific',  11, true),
  ('Preg Check',             'owner_specific',  12, true),
  ('Other (Owner Specific)', 'owner_specific',  13, true),
  ('Vet Bill',               'animal_specific', 14, true),
  ('Medication',             'animal_specific', 15, true),
  ('Vet Procedure',          'animal_specific', 16, true),
  ('Other (Animal Specific)','animal_specific', 17, true)
ON CONFLICT (name) DO UPDATE SET expense_type = EXCLUDED.expense_type;

-- Add missing columns to lease_expenses
ALTER TABLE lease_expenses
  ADD COLUMN IF NOT EXISTS expense_type  text    NOT NULL DEFAULT 'shared',
  ADD COLUMN IF NOT EXISTS category_id   uuid    REFERENCES expense_categories(id),
  ADD COLUMN IF NOT EXISTS owner_id      uuid,
  ADD COLUMN IF NOT EXISTS animal_id     uuid,
  ADD COLUMN IF NOT EXISTS quarter       smallint,
  ADD COLUMN IF NOT EXISTS year          smallint,
  ADD COLUMN IF NOT EXISTS notes         text,
  ADD COLUMN IF NOT EXISTS quantity      numeric,
  ADD COLUMN IF NOT EXISTS unit_cost     numeric,
  ADD COLUMN IF NOT EXISTS sire_library_id uuid,
  ADD COLUMN IF NOT EXISTS bull_name     text;

-- Add invoice quarter/sequence for YYQQ### numbering
ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS invoice_quarter   smallint,
  ADD COLUMN IF NOT EXISTS invoice_sequence  integer;

NOTIFY pgrst, 'reload schema';
