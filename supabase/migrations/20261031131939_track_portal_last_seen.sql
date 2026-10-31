-- Whether an owner is actually using his portal.
--
-- invoices.viewed_at has existed all along and nothing ever wrote to it. The
-- billing screen shows a "Viewed" row in the timeline that could never fill
-- in, and an empty column meant nothing -- it could not tell "he has not
-- looked" from "we never recorded it". That is the worst kind of field.
--
-- last_seen_at answers the broader question the invoice column cannot: has
-- this person opened the portal at all, and when. It is per PERSON, not per
-- owner, because an LLC can have a spouse and a manager on it and "did
-- anybody look" is a different question from "did Doug look".

alter table public.portal_people
  add column if not exists last_seen_at timestamptz;

comment on column public.portal_people.last_seen_at is
  'Last time this person loaded their portal. Written by /api/portals/owner/me.';
