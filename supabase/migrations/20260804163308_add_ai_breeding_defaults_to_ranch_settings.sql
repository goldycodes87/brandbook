ALTER TABLE ranch_settings
  ADD COLUMN IF NOT EXISTS ai_preg_check_days_out integer NOT NULL DEFAULT 45,
  ADD COLUMN IF NOT EXISTS default_ai_technician text,
  ADD COLUMN IF NOT EXISTS ai_tech_fee_per_cow numeric NOT NULL DEFAULT 280;

GRANT ALL ON ranch_settings TO authenticated, service_role;
NOTIFY pgrst, 'reload schema';
