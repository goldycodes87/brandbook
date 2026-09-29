-- Why an owner never got their sign-in link.
--
-- portal/request-link swallowed the send with .catch(() => {}), so a rejected
-- email — wrong from-address, a restricted key, a bounced domain — returned
-- "the link is on its way" and left no trace. The token in the table looked
-- perfectly healthy, which sends every diagnosis to the wrong place. It cost
-- an afternoon working out why Doug Goldberg could not sign in.
--
-- The route still answers identically whether or not an address is on file;
-- what changes is that the ranch can find out afterwards.

alter table public.portal_memberships
  add column if not exists invite_send_error    text,
  add column if not exists invite_send_error_at timestamptz;

comment on column public.portal_memberships.invite_send_error is
  'Last failure from the provider when mailing this person their sign-in link. Cleared on a successful send. A link that was minted but never delivered leaves the token looking healthy, so this is the only evidence it did not arrive.';
