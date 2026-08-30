-- The cull list: cows decided against, still in the herd.
--
-- Deliberately NOT animals.status. A cull decision and a disposition are
-- different events months apart -- she is flagged at the chute and leaves when
-- she is actually sold. Marking her status early would drop her out of head
-- counts, grazing billing and the herd report while she is still eating grass.
--
-- Also NOT breeding_eligible, which already means "heifer not yet cleared to
-- breed". Same effect on breedability, opposite reason, and conflating them
-- would make the two indistinguishable on screen.
--
-- She leaves the list by being disposed of (status stops being 'active') or by
-- being un-flagged. The timestamp is kept either way so the decision stays on
-- the record after she is gone.
alter table public.animals
  add column if not exists cull_flagged_at timestamptz,
  add column if not exists cull_reason     text;

create index if not exists animals_cull_list_idx
  on public.animals (cull_flagged_at)
  where cull_flagged_at is not null;

comment on column public.animals.cull_flagged_at is
  'Marked for culling at this time. Still in the herd until disposed of.';
comment on column public.animals.cull_reason is
  'Why she was flagged — open, age, temperament, feet/udder, performance.';
