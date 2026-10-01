-- What an owner wants done with the money from a sale.
--
-- It lands in owner_requests rather than in a table of its own, because it is
-- the same thing the sell request already asks -- "and what shall we do with
-- the proceeds" -- only asked after the cattle have gone rather than before.
-- Putting it here means it shows up on the Requests screen the ranch already
-- watches, instead of in a corner nobody has learned to check.

alter table public.owner_requests
  drop constraint if exists owner_requests_request_type_check;
alter table public.owner_requests
  add constraint owner_requests_request_type_check
  check (request_type = any (array['buy', 'sell', 'access', 'payout']));

-- 'check' and 'invoice_first' join the two that were already here. A man who
-- owes money and has just been paid usually wants the one settled out of the
-- other, and having to ask for that is a poor way to run an account.
alter table public.owner_requests
  drop constraint if exists owner_requests_funds_disposition_check;
alter table public.owner_requests
  add constraint owner_requests_funds_disposition_check
  check (funds_disposition = any (array[
    'send_minus_fee', 'keep_for_purchase', 'other', 'check', 'invoice_first'
  ]));

-- Which sale the instruction is about. Null for the sell request, which is
-- asked before any sale exists.
alter table public.owner_requests
  add column if not exists sale_id uuid references public.sales(id) on delete set null;

create index if not exists owner_requests_sale_id_idx
  on public.owner_requests (sale_id) where sale_id is not null;

comment on column public.owner_requests.sale_id is
  'The sale a payout instruction refers to. Null on buy, sell and access requests.';
