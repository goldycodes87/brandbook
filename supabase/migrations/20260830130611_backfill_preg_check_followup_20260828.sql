-- Repair the follow-up for the 2026-08-28 preg checks.
--
-- Chute mode recorded the preg_check event and stopped there: it never closed
-- the reminder that prompted the check, and never created the calving
-- reminder. Only #2 (logged from the dashboard) completed the flow. The code
-- gap is fixed in the same change via lib/preg-check-followup.ts, which both
-- entry points now call.
--
-- Guarded throughout: only cows with a confirmed check, only reminders still
-- open, and NOT EXISTS so re-running creates nothing twice.

-- 1. Close the preg-check reminders that were answered.
update public.reminders r
set    is_dismissed = true,
       dismissed_at = coalesce(r.dismissed_at, pc.created_at)
from   public.reproduction_events pc
where  pc.animal_id = r.animal_id
  and  pc.event_type = 'preg_check'
  and  pc.event_date = '2026-08-28'
  and  r.reminder_type = 'preg_check'
  and  r.is_dismissed = false
  and  r.due_date <= '2026-08-28';

-- 2. Create the calving reminder each confirmed cow should have got:
--    14 days before her bred event's expected calving date.
insert into public.reminders (animal_id, reminder_type, due_date, title, reproduction_event_id)
select a.id,
       'calving',
       (bred.expected_calving_date - interval '14 days')::date,
       'Calving due — ' || trim(coalesce(a.ear_tag_color, '') || ' ' || a.tag_number),
       bred.id
from   public.reproduction_events pc
join   public.animals a on a.id = pc.animal_id
join   lateral (
         select b.* from public.reproduction_events b
         where b.animal_id = a.id and b.event_type = 'bred'
           and b.event_date <= pc.event_date
         order by b.event_date desc limit 1
       ) bred on true
where  pc.event_type = 'preg_check'
  and  pc.event_date = '2026-08-28'
  and  pc.preg_check_result = 'confirmed'
  and  bred.expected_calving_date is not null
  and  not exists (
         select 1 from public.reminders r2
         where r2.animal_id = a.id
           and r2.reminder_type = 'calving'
           and r2.is_dismissed = false
       );

-- 3. Tag 35 was checked open and noted "Decision: cull" in free text, because
--    the cull list did not exist yet. Put her on it properly.
update public.animals
set    cull_flagged_at = coalesce(cull_flagged_at, timestamptz '2026-08-28 20:09:54+00'),
       cull_reason     = coalesce(cull_reason, 'Open')
where  tag_number = '35'
  and  status = 'active'
  and  cull_flagged_at is null
  and  exists (
         select 1 from public.reproduction_events pc
         where pc.animal_id = animals.id
           and pc.event_type = 'preg_check'
           and pc.event_date = '2026-08-28'
           and pc.notes ilike '%cull%'
       );
