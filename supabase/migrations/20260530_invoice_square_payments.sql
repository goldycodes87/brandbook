-- Square payment columns and payment tracking
alter table invoices add column if not exists square_payment_link text;
alter table invoices add column if not exists payment_method text;      -- cash | check | square_terminal | square_online
alter table invoices add column if not exists payment_reference text;   -- check number, terminal receipt, etc.

notify pgrst, 'reload schema';
