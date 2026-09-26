-- A change log that cannot be bypassed.
--
-- Deliberately a trigger rather than application code. Animals are edited from
-- the animals API, Chute Mode, the bulk importer, RancherAI, and occasionally
-- by hand in SQL; a logger living in any one of those misses the others, and
-- you find out which one on the day you needed the history. A trigger sees
-- every write to the table by construction.
--
-- Attribution is best effort and the log does not depend on it: what changed
-- and when is recorded whether or not anyone said who they were.

create table if not exists public.record_changes (
  id             uuid primary key default gen_random_uuid(),
  table_name     text        not null,
  row_id         uuid        not null,
  action         text        not null check (action in ('insert', 'update', 'delete')),
  -- {field: {from, to}}. Inserts carry from=null, deletes carry to=null, so a
  -- reader can render every kind of change the same way.
  changed_fields jsonb       not null default '{}'::jsonb,
  actor          text,
  changed_at     timestamptz not null default now()
);

create index if not exists record_changes_row_idx
  on public.record_changes (table_name, row_id, changed_at desc);
create index if not exists record_changes_recent_idx
  on public.record_changes (changed_at desc);

comment on table public.record_changes is
  'Field-level change log written by the log_record_change trigger. Never written by application code directly.';

-- Columns whose churn is noise, not history.
create or replace function public.audit_ignored_columns()
returns text[] language sql immutable as $$
  select array['updated_at', 'created_at']::text[]
$$;

create or replace function public.log_record_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_fields jsonb;
  v_actor  text;
  v_row_id uuid;
begin
  -- Whoever claimed responsibility, in order of how much we trust it:
  -- an explicit setting from a SQL caller, then a header the app attached to
  -- its PostgREST request. Neither present is fine and common.
  v_actor := nullif(current_setting('app.actor', true), '');
  if v_actor is null then
    begin
      v_actor := nullif(
        current_setting('request.headers', true)::json ->> 'x-brandbook-actor', '');
    exception when others then
      v_actor := null;
    end;
  end if;

  if TG_OP = 'INSERT' then
    v_row_id := NEW.id;
    select coalesce(jsonb_object_agg(key, jsonb_build_object('from', null, 'to', value)), '{}'::jsonb)
      into v_fields
    from jsonb_each(to_jsonb(NEW))
    where value <> 'null'::jsonb
      and key <> all (public.audit_ignored_columns());

  elsif TG_OP = 'UPDATE' then
    v_row_id := NEW.id;
    select coalesce(jsonb_object_agg(
             coalesce(o.key, n.key),
             jsonb_build_object('from', o.value, 'to', n.value)), '{}'::jsonb)
      into v_fields
    from jsonb_each(to_jsonb(OLD)) o
    full join jsonb_each(to_jsonb(NEW)) n on n.key = o.key
    where o.value is distinct from n.value
      and coalesce(o.key, n.key) <> all (public.audit_ignored_columns());

    -- An update that only moved updated_at is not a change anybody wants to
    -- read about, and logging it would bury the ones that are.
    if v_fields = '{}'::jsonb then
      return NEW;
    end if;

  else
    v_row_id := OLD.id;
    select coalesce(jsonb_object_agg(key, jsonb_build_object('from', value, 'to', null)), '{}'::jsonb)
      into v_fields
    from jsonb_each(to_jsonb(OLD))
    where value <> 'null'::jsonb
      and key <> all (public.audit_ignored_columns());
  end if;

  insert into public.record_changes (table_name, row_id, action, changed_fields, actor)
  values (TG_TABLE_NAME, v_row_id, lower(TG_OP), v_fields, v_actor);

  return coalesce(NEW, OLD);
end;
$$;

comment on function public.log_record_change is
  'Generic field-level audit trigger. Attach with: create trigger <t>_audit after insert or update or delete on <t> for each row execute function log_record_change().';

-- Animals, because an animal record is the thing people argue about.
drop trigger if exists animals_audit on public.animals;
create trigger animals_audit
  after insert or update or delete on public.animals
  for each row execute function public.log_record_change();

-- The billing tables, because "what happened to that data" has already been
-- asked once about Q2 and the answer took an afternoon to reconstruct.
drop trigger if exists invoices_audit on public.invoices;
create trigger invoices_audit
  after insert or update or delete on public.invoices
  for each row execute function public.log_record_change();

drop trigger if exists lease_expenses_audit on public.lease_expenses;
create trigger lease_expenses_audit
  after insert or update or delete on public.lease_expenses
  for each row execute function public.log_record_change();

drop trigger if exists expense_allocations_audit on public.expense_allocations;
create trigger expense_allocations_audit
  after insert or update or delete on public.expense_allocations
  for each row execute function public.log_record_change();
