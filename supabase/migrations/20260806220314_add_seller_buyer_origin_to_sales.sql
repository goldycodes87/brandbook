ALTER TABLE sales
  ADD COLUMN IF NOT EXISTS owner_id uuid REFERENCES grazing_owners(id),
  ADD COLUMN IF NOT EXISTS buyer_owner_id uuid REFERENCES grazing_owners(id),
  ADD COLUMN IF NOT EXISTS origin text;

COMMENT ON COLUMN sales.owner_id IS 'Snapshot of the SELLER (animal owner) at time of sale, for owner Schedule F income. Null = ranch/Legacy.';
COMMENT ON COLUMN sales.buyer_owner_id IS 'Internal buyer (grazing_owner incl Legacy) when this is an internal transfer-sale; null for external sales.';
COMMENT ON COLUMN sales.origin IS 'Snapshot of animal.origin at sale time (home_raised vs purchased) for raised/resale Schedule F split.';

GRANT ALL ON sales TO authenticated, service_role;
NOTIFY pgrst, 'reload schema';
