-- Private token for the ICS calendar feed. The feed URL must be fetchable by
-- Google Calendar with no cookies, so this token IS the credential — treat it
-- like a password and rotate by updating this column.
ALTER TABLE ranch_settings
  ADD COLUMN IF NOT EXISTS calendar_feed_token uuid NOT NULL DEFAULT gen_random_uuid();

COMMENT ON COLUMN ranch_settings.calendar_feed_token IS 'Secret token in the ICS calendar feed URL. Anyone holding it can read the feed; update this column to revoke and reissue.';

-- Preg-check reminders for the 12 backfilled AI breedings, dated 2026-08-28
-- as scheduled. due_date is editable and the calendar feed reads from it, so
-- changing it here changes what the calendar shows.
INSERT INTO reminders (animal_id, reminder_type, due_date, title, reproduction_event_id)
SELECT
  re.animal_id,
  'preg_check',
  DATE '2026-08-28',
  'Preg check - #' || a.tag_number || COALESCE(' (' || re.sire_name_text || ')', ''),
  re.id
FROM reproduction_events re
JOIN animals a ON a.id = re.animal_id
WHERE re.event_type = 'bred'
  AND NOT EXISTS (
    SELECT 1 FROM reminders r
    WHERE r.reproduction_event_id = re.id
      AND r.reminder_type = 'preg_check'
  );

GRANT ALL ON ranch_settings TO authenticated, service_role;
GRANT ALL ON reminders TO authenticated, service_role;
NOTIFY pgrst, 'reload schema';
