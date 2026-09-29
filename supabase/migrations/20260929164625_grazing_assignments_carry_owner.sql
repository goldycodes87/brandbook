-- Ownership needs a time dimension, and the assignment already has one.
--
-- Until now the only record of who owned an animal was animals.owner_id — a
-- single present-tense value. So "whose animal-days were these in Q3?" was
-- answered with "whoever owns it today", and a quarterly invoice that bills
-- next quarter's grazing alongside last quarter's expenses needs BOTH
-- answers at once. Transfer before billing and the expenses are wrong;
-- transfer after and the grazing is wrong. There was no order that worked.
--
-- grazing_assignments already says which ground an animal was on and between
-- which dates. Adding the owner makes it say the whole truth, and the
-- allocation engine can then read ownership as of the window it is billing
-- while animals.owner_id goes on meaning "who owns it now" for grazing.

alter table public.grazing_assignments
  add column if not exists owner_id uuid references public.grazing_owners(id);

comment on column public.grazing_assignments.owner_id is
  'Who owned the animal during this assignment. Null means ranch-owned. Set from the animal at insert time by grazing_assignments_stamp_owner; a transfer closes the row and opens a new one under the new owner.';

create index if not exists grazing_assignments_owner_idx
  on public.grazing_assignments (owner_id, start_date, end_date);

-- ── Backfill ────────────────────────────────────────────────────────────────
-- Timing matters and this is the moment: animals.owner_id still says who
-- actually held each animal through Q3, because nothing has been transferred
-- yet. Run after a transfer and every Q3 row would be stamped with the buyer
-- and the history would be gone.
--
-- Rows for ranch-owned animals stay null, which is what null means here.
update public.grazing_assignments ga
set owner_id = a.owner_id
from public.animals a
where a.id = ga.animal_id
  and ga.owner_id is null
  and a.owner_id is not null;

-- ── Keep it filled in ───────────────────────────────────────────────────────
-- Every existing row now carries the truth, and nothing may quietly create a
-- row without it: an assignment with no owner reads as ranch-owned, which
-- would bill an owner's cattle to the ranch. Callers that know better pass
-- owner_id explicitly; everything else inherits the animal's owner as it
-- stands when the assignment is made, which is the right answer at that
-- moment by definition.
--
-- Consequence worth knowing: a caller transferring an animal TO the ranch
-- passes null, which is indistinguishable from "not supplied", so it must
-- update animals.owner_id BEFORE inserting the new assignment. See the
-- comment in app/api/grazing-owners/[id]/transfers/route.ts.
create or replace function public.grazing_assignments_stamp_owner()
returns trigger
language plpgsql
as $$
begin
  if NEW.owner_id is null then
    select a.owner_id into NEW.owner_id from public.animals a where a.id = NEW.animal_id;
  end if;
  return NEW;
end;
$$;

drop trigger if exists grazing_assignments_stamp_owner on public.grazing_assignments;
create trigger grazing_assignments_stamp_owner
  before insert on public.grazing_assignments
  for each row execute function public.grazing_assignments_stamp_owner();
