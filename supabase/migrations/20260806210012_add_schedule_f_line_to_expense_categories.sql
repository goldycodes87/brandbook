ALTER TABLE expense_categories ADD COLUMN IF NOT EXISTS schedule_f_line text;

UPDATE expense_categories SET schedule_f_line = '16'  WHERE name IN ('Hay / Forage','Protein / Mineral Tubs','Salt / Loose Mineral');
UPDATE expense_categories SET schedule_f_line = '31'  WHERE name IN ('AI Technician Fee','Semen Straws','Preg Check','Vet Bill','Medication','Veterinary Procedure','Working Animals');
UPDATE expense_categories SET schedule_f_line = '22'  WHERE name = 'Labor';
UPDATE expense_categories SET schedule_f_line = '24a' WHERE name = 'Equipment Rental';
UPDATE expense_categories SET schedule_f_line = '25'  WHERE name = 'Fence Repair';
UPDATE expense_categories SET schedule_f_line = '30'  WHERE name = 'Water / Utilities';
UPDATE expense_categories SET schedule_f_line = '11'  WHERE name = 'Pasture Treatment';
UPDATE expense_categories SET schedule_f_line = '32'  WHERE name IN ('Other (Shared)','Other (Owner Specific)','Other (Animal Specific)');

GRANT ALL ON expense_categories TO authenticated, service_role;
NOTIFY pgrst, 'reload schema';
