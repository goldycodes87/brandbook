-- Steer #77 sold to Dan Rieple on 2026-08-14 kept an open grazing assignment.
--
-- Shared expenses are pro-rated by grazing_assignments, not animals.status, so
-- he was still accruing animal-days after he left: 91 of them in Q3 2026,
-- inflating Andy Holloman's share of every shared Q3 expense and shrinking
-- everyone else's. Q3 has not been invoiced, so nothing billed is restated.
--
-- The code paths that let this happen are fixed in the same change: both
-- /api/animals/[id]/sell and PATCH /api/animals/[id] now close open
-- assignments when an animal leaves the herd.
--
-- Guarded: only animals that have actually left, only assignments still open,
-- and never moved earlier than the assignment started.
update public.grazing_assignments ga
set    end_date = greatest(ga.start_date, coalesce(a.disposition_date, current_date))
from   public.animals a
where  a.id = ga.animal_id
  and  ga.end_date is null
  and  a.status in ('sold', 'deceased', 'transferred', 'harvested');
