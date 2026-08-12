ALTER TABLE lease_expenses
  ADD COLUMN IF NOT EXISTS invoice_id uuid REFERENCES invoices(id) ON DELETE SET NULL;

COMMENT ON COLUMN lease_expenses.invoice_id IS 'The invoice that billed this expense, stamped when a quarterly invoice is generated. Null = not yet invoiced. ON DELETE SET NULL so deleting an invoice unlinks its expenses rather than destroying them.';

CREATE INDEX IF NOT EXISTS lease_expenses_invoice_id_idx ON lease_expenses (invoice_id);

GRANT ALL ON lease_expenses TO authenticated, service_role;
NOTIFY pgrst, 'reload schema';
