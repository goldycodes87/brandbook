ALTER TABLE animals
  ADD COLUMN IF NOT EXISTS ai_fee_per_head numeric;

COMMENT ON COLUMN animals.ai_fee_per_head IS 'Per-animal AI technician fee override, set on the animal detail page. Null = use ranch_settings.ai_tech_fee_per_cow. Resolution order when recording a breeding: explicit payload value, then this column, then the ranch default.';

GRANT ALL ON animals TO authenticated, service_role;
NOTIFY pgrst, 'reload schema';
