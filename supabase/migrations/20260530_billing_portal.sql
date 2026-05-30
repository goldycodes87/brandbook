-- Billing & Owner Portal enhancements

-- Add portal_token to grazing_owners for owner portal access
ALTER TABLE grazing_owners
  ADD COLUMN IF NOT EXISTS portal_token text unique
  DEFAULT encode(gen_random_bytes(16), 'hex');

-- Backfill portal_token for existing owners that don't have one
UPDATE grazing_owners
  SET portal_token = encode(gen_random_bytes(16), 'hex')
  WHERE portal_token IS NULL;

-- Invoices: all columns already exist via prior migration:
-- invoice_number, due_date, notes, pdf_url, email_sent_at, viewed_at
-- Just ensure invoice_number auto-generation trigger exists:

CREATE SEQUENCE IF NOT EXISTS invoice_number_seq START 1001;

CREATE OR REPLACE FUNCTION generate_invoice_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.invoice_number IS NULL THEN
    NEW.invoice_number := 'INV-' || to_char(now(), 'YYYYMM') || '-' || LPAD(nextval('invoice_number_seq')::text, 4, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS invoice_number_trigger ON invoices;
CREATE TRIGGER invoice_number_trigger
  BEFORE INSERT ON invoices
  FOR EACH ROW EXECUTE FUNCTION generate_invoice_number();

-- Seed default expense categories if empty
INSERT INTO expense_categories (name, description, sort_order) VALUES
  ('Hay', 'Hay and forage', 10),
  ('Mineral/Supplements', 'Mineral and nutritional supplements', 20),
  ('Vet Bills', 'Veterinary services and medications', 30),
  ('Pasture Treatment', 'Herbicide, fertilizer, seeding', 40),
  ('Water', 'Water hauling or tank maintenance', 50),
  ('Salt', 'Salt and trace mineral blocks', 60),
  ('Labor', 'Labor and management fees', 70),
  ('Equipment', 'Equipment use and maintenance', 80),
  ('Other', 'Miscellaneous expenses', 90)
ON CONFLICT DO NOTHING;

NOTIFY pgrst, 'reload schema';
