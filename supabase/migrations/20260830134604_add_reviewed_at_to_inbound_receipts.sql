-- A receipt stays in the queue until the operator submits its decisions.
--
-- Derived state ("does every line have a decision?") is not enough: the line
-- decisions are PRE-FILLED by the matcher, so on arrival every line already
-- reads create/attach/skip. Without a stamp for the moment a human agreed,
-- a freshly parsed receipt is indistinguishable from a reviewed one.
alter table public.inbound_receipts
  add column if not exists reviewed_at timestamptz;

create index if not exists inbound_receipts_pending_idx
  on public.inbound_receipts (created_at desc)
  where reviewed_at is null;
