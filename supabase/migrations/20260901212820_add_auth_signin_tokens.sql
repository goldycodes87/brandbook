-- One-time sign-in links for operators who cannot remember their password.
--
-- A table of its own rather than reusing portal_memberships.invite_token, on
-- purpose. That column is a PORTAL credential: redeeming it gives an owner a
-- read-only view of their own cattle. This one gives a full operator session.
-- Two credentials of very different weight sharing a column is how a portal
-- invite ends up being redeemable for an admin cookie.
--
-- The token grants nothing by itself: redemption requires the row to name an
-- auth user who already exists, so this can hand back a login but can never
-- create one.

create table if not exists auth_signin_tokens (
  token        text primary key,
  auth_user_id uuid not null,
  -- Kept for the audit trail; the email is what somebody typed, which is not
  -- necessarily the address on the account.
  requested_for text,
  expires_at   timestamptz not null,
  used_at      timestamptz,
  created_at   timestamptz not null default now()
);

create index if not exists auth_signin_tokens_user_idx on auth_signin_tokens (auth_user_id, created_at desc);
create index if not exists auth_signin_tokens_expiry_idx on auth_signin_tokens (expires_at);

comment on table auth_signin_tokens is
  'Short-lived one-time links that return an operator to their own account. Single use: used_at is stamped on redemption and a stamped row is refused.';
