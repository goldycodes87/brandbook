ALTER TABLE lease_expenses
  ADD COLUMN IF NOT EXISTS include_calves boolean DEFAULT false;

NOTIFY pgrst, 'reload schema';
