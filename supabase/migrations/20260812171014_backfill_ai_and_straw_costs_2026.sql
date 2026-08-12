-- Backfill of the Jul 31 - Aug 2 2026 AI breedings.
-- Those events predate the cost machinery: ai_cost, straw_cost and the tank
-- link were all null, so no AI fee or straw cost reached any owner.
-- Every statement is guarded so re-running changes nothing.

-- 1. Straw price correction: SEO Hot Lava was $25/straw, not $24.
UPDATE semen_inventory SET price_per_straw = 25.00
WHERE sire_name = 'SEO Hot Lava' AND price_per_straw IS DISTINCT FROM 25.00;

-- 2. Two more In God We Trust straws (Cattle Visions) at $100.
UPDATE semen_inventory
SET straw_count = straw_count + 2, price_per_straw = 100.00
WHERE sire_name = 'In God We Trust';

-- 3. This year's AI technician fee is $175/head.
UPDATE ranch_settings SET ai_tech_fee_per_cow = 175;

-- 4. Link each bred event to its tank straw by bull name.
UPDATE reproduction_events re
SET semen_inventory_id = si.id
FROM semen_inventory si
WHERE re.event_type = 'bred'
  AND re.semen_inventory_id IS NULL
  AND re.sire_name_text = si.sire_name;

-- 5. Stamp the fee and the straw price onto the events.
UPDATE reproduction_events re
SET ai_cost = 175, straw_cost = si.price_per_straw
FROM semen_inventory si
WHERE re.event_type = 'bred'
  AND re.semen_inventory_id = si.id
  AND re.ai_cost IS NULL;

-- 6. AI technician fee expense per event, owner routed
--    (ranch-owned animals book to the "Legacy (Me)" owner).
INSERT INTO lease_expenses (
  category_name, category_id, expense_type, description, total_amount,
  expense_date, owner_id, is_lease_specific, quarter, year, reproduction_event_id
)
SELECT
  'AI Technician Fee',
  (SELECT id FROM expense_categories WHERE name = 'AI Technician Fee' LIMIT 1),
  'owner_specific',
  'AI tech fee - ' || COALESCE(re.sire_name_text, 'AI'),
  re.ai_cost,
  re.event_date,
  COALESCE(a.owner_id, (SELECT id FROM grazing_owners WHERE is_self LIMIT 1)),
  false,
  CEIL(EXTRACT(MONTH FROM re.event_date) / 3.0)::int,
  (EXTRACT(YEAR FROM re.event_date)::int % 100),
  re.id
FROM reproduction_events re
JOIN animals a ON a.id = re.animal_id
WHERE re.event_type = 'bred'
  AND re.ai_cost IS NOT NULL AND re.ai_cost > 0
  AND NOT EXISTS (
    SELECT 1 FROM lease_expenses le
    WHERE le.reproduction_event_id = re.id
      AND le.category_name = 'AI Technician Fee'
  );

-- 7. Semen straw expense per event, same owner routing.
INSERT INTO lease_expenses (
  category_name, category_id, expense_type, description, total_amount,
  expense_date, owner_id, is_lease_specific, quarter, year, reproduction_event_id
)
SELECT
  'Semen Straws',
  (SELECT id FROM expense_categories WHERE name = 'Semen Straws' LIMIT 1),
  'owner_specific',
  'Semen straw - ' || COALESCE(re.sire_name_text, 'AI'),
  re.straw_cost,
  re.event_date,
  COALESCE(a.owner_id, (SELECT id FROM grazing_owners WHERE is_self LIMIT 1)),
  false,
  CEIL(EXTRACT(MONTH FROM re.event_date) / 3.0)::int,
  (EXTRACT(YEAR FROM re.event_date)::int % 100),
  re.id
FROM reproduction_events re
JOIN animals a ON a.id = re.animal_id
WHERE re.event_type = 'bred'
  AND re.straw_cost IS NOT NULL AND re.straw_cost > 0
  AND NOT EXISTS (
    SELECT 1 FROM lease_expenses le
    WHERE le.reproduction_event_id = re.id
      AND le.category_name = 'Semen Straws'
  );

NOTIFY pgrst, 'reload schema';
