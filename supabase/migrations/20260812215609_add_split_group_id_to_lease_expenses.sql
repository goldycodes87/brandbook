-- Ties the N rows of a multi-animal split back together.
--
-- buildAnimalSplitRows writes one lease_expenses row per animal, which is
-- right for per-animal cost basis but leaves nothing saying the rows are one
-- expense. Editing therefore hit a single row: a $2,100 AI fee split across 12
-- head, edited to $2,400, became one row at $2,400 plus eleven still at $175.
--
-- Null for everything that is not part of a split, which is every row today.
alter table public.lease_expenses
  add column if not exists split_group_id uuid;

create index if not exists lease_expenses_split_group_idx
  on public.lease_expenses (split_group_id)
  where split_group_id is not null;

comment on column public.lease_expenses.split_group_id is
  'Groups the per-animal rows of one multi-animal split. Edit and delete act on the whole group.';
