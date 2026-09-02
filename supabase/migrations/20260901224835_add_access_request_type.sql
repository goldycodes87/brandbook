-- An owner asking for somebody else to be let in.
--
-- A partner in the LLC, a spouse, a farm manager. The schema already lets two
-- people share one herd — portal_memberships is per person and points at the
-- herd — so this is not a new capability, only a way to ask for it without
-- phoning the ranch. The ranch still decides; nothing here grants access.

alter table owner_requests
  drop constraint if exists owner_requests_request_type_check;

alter table owner_requests
  add constraint owner_requests_request_type_check
  check (request_type = any (array['buy'::text, 'sell'::text, 'access'::text]));

-- Who they are asking for. Kept as their own columns rather than buried in
-- `notes`, because an operator approving this needs to hand the name and
-- address straight to the invite form, and parsing them back out of prose is
-- how the wrong person gets invited.
alter table owner_requests add column if not exists access_name  text;
alter table owner_requests add column if not exists access_email text;

-- What was done about it. Set when an operator turns the request into a real
-- membership, so the request stops asking and points at what it became.
alter table owner_requests add column if not exists resolved_membership_id uuid
  references portal_memberships(id) on delete set null;

comment on column owner_requests.access_email is
  'For request_type=access: the address to invite. The ranch approves; submitting this grants nothing.';
