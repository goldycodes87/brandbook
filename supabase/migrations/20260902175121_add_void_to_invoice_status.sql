-- 'void' is the escape hatch for the one-invoice-per-expense-quarter index
-- that follows: a wrong invoice is voided and reissued, never silently
-- replaced. Added in its own migration because Postgres will not let a new
-- enum value be used in the same transaction that creates it.
alter type public.invoice_status add value if not exists 'void';
