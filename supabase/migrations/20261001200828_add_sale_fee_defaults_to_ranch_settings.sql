-- What the sale fee checklist starts out ticked at.
--
-- The catalogue lives in lib/sale-fees.ts and the rates were constants in it,
-- so changing what the barn charges meant a deploy. This holds the overrides:
-- which fees start on, and at what rate.
--
-- Null means "whatever the code says", so the checklist works before anybody
-- has been near this screen, and a fee added to the catalogue later shows up
-- without needing a row written for it.

alter table public.ranch_settings
  add column if not exists sale_fee_defaults jsonb;

comment on column public.ranch_settings.sale_fee_defaults is
  'Overrides for the sale fee checklist: [{key, rate, on, covers, perHeadOver}]. Null falls back to the catalogue in lib/sale-fees.ts.';
