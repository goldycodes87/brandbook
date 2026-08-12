-- 1. In God We Trust: the two straws already in the tank WERE the Cattle
--    Visions purchase, so the +2 added in the previous backfill was a
--    double count. Set the true count explicitly rather than subtracting,
--    so this is idempotent.
UPDATE semen_inventory
SET straw_count = 2
WHERE sire_name = 'In God We Trust';

-- 2. Link owner-specific expenses to the invoice that already billed them.
--
--    Invoices 2603001 / 2603002 were generated before lease_expenses.invoice_id
--    existed, so two $35 expenses that were billed AND PAID were still
--    reporting as PENDING.
--
--    Matched on: same owner, same amount, the invoice's line_items containing
--    a matching owner_specific description, and the expense predating the
--    invoice. Only owner_specific rows are linked — shared expenses are
--    pro-rated across several invoices and cannot be represented by a single
--    invoice_id.
UPDATE lease_expenses le
SET invoice_id = i.id
FROM invoices i
WHERE le.invoice_id IS NULL
  AND le.expense_type = 'owner_specific'
  AND le.description IS NOT NULL
  AND le.owner_id = i.owner_id
  AND i.status IN ('sent', 'approved', 'paid')
  AND le.expense_date <= i.created_at::date
  AND EXISTS (
    SELECT 1
    FROM jsonb_array_elements(i.line_items) li
    WHERE li->>'expense_type' = 'owner_specific'
      AND (li->>'amount')::numeric = le.total_amount
      AND li->>'description' LIKE le.description || '%'
  );

NOTIFY pgrst, 'reload schema';
