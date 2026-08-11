ALTER TABLE animals ADD COLUMN IF NOT EXISTS breeding_eligible boolean;
COMMENT ON COLUMN animals.breeding_eligible IS 'Set Yes/No when a heifer is marked weaned. false = explicitly held back from breeding. null = not yet decided (treated as eligible subject to age gate).';
GRANT ALL ON animals TO authenticated, service_role;
NOTIFY pgrst, 'reload schema';
