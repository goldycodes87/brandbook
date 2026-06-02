-- Biological sex recorded at birth, separate from age-class sex
-- calf_sex: 'heifer_calf' | 'bull_calf' | null (unknown)
-- sex is always 'calf' until weaned, then updated to heifer/bull/steer
alter table animals add column if not exists calf_sex text;

notify pgrst, 'reload schema';
