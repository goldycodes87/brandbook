ALTER TABLE grazing_owners ADD COLUMN IF NOT EXISTS is_self boolean NOT NULL DEFAULT false;
COMMENT ON COLUMN grazing_owners.is_self IS 'True for the ranch''s own "Legacy (Me)" owner. Selectable for expense allocation (own cost -> P&L/Schedule F) but must be EXCLUDED from customer invoice generation.';
GRANT ALL ON grazing_owners TO authenticated, service_role;
NOTIFY pgrst, 'reload schema';
