-- Add animal_ids array to grazing_periods so individual animals can be tracked per period
ALTER TABLE grazing_periods
  ADD COLUMN IF NOT EXISTS animal_ids uuid[] DEFAULT '{}';

NOTIFY pgrst, 'reload schema';
