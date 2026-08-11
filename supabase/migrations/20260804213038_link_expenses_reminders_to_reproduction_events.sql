ALTER TABLE lease_expenses
  ADD COLUMN IF NOT EXISTS reproduction_event_id uuid REFERENCES reproduction_events(id) ON DELETE CASCADE;

ALTER TABLE reminders
  ADD COLUMN IF NOT EXISTS reproduction_event_id uuid REFERENCES reproduction_events(id) ON DELETE CASCADE;

GRANT ALL ON lease_expenses TO authenticated, service_role;
GRANT ALL ON reminders TO authenticated, service_role;
NOTIFY pgrst, 'reload schema';
