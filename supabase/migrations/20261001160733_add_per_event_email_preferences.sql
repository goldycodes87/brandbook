-- Per-event email preferences for portal people.
--
-- contact_email was a single switch: everything, or nothing. An owner who did
-- not want to hear every time a weight was recorded had to turn off the one
-- thing that also carries his invoices. That is not a preference, it is a
-- choice between noise and silence, and silence wins -- which is how a ranch
-- ends up unable to reach an owner about money.
--
-- contact_email stays as the master switch. These narrow it.
--
-- Defaults say what is worth an interruption. Money moving, in either
-- direction, is. The running record of the herd is what the portal is for, so
-- it stays off unless somebody asks for it.

alter table public.portal_people
  add column if not exists notify_purchases    boolean not null default true,
  add column if not exists notify_sales        boolean not null default true,
  add column if not exists notify_invoices     boolean not null default true,
  add column if not exists notify_herd_updates boolean not null default false;

comment on column public.portal_people.notify_purchases    is 'Email when cattle are bought into this person''s herd.';
comment on column public.portal_people.notify_sales        is 'Email when cattle of this person''s are sold.';
comment on column public.portal_people.notify_invoices     is 'Email when an invoice is sent to this person.';
comment on column public.portal_people.notify_herd_updates is 'Email for routine herd activity: weights, health, calving. Off by default.';
