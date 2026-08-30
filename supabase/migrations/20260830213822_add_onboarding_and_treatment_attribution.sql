-- What onboarding collects, and who gave the treatment.

-- ── Owner: the herd's goals, and one brand column instead of three ──────
alter table public.grazing_owners
  add column if not exists goals            text[] not null default '{}',
  add column if not exists brand_image_url  text,
  add column if not exists brand_source     text
    check (brand_source is null or brand_source in ('photo','drawing','none'));

comment on column public.grazing_owners.goals is
  'Why they run cattle: grow_herd, return, family_beef, tax_savings, '
  'ag_valuation, genetics, pass_on. Stored on the herd, not the person -- the '
  'same person can have different aims at two outfits.';

-- brand_photo, brand_photo_url and brand_drawing_url all exist and all three
-- are empty on every row. Left in place so nothing breaks, but nothing should
-- write to them again: a picture of an iron and a finger drawing are the same
-- thing to every screen that shows one, so they share a column and
-- brand_source records which it was.
comment on column public.grazing_owners.brand_photo       is 'DEPRECATED -- use brand_image_url.';
comment on column public.grazing_owners.brand_photo_url   is 'DEPRECATED -- use brand_image_url.';
comment on column public.grazing_owners.brand_drawing_url is 'DEPRECATED -- use brand_image_url + brand_source.';

-- ── Notifications live on the membership ────────────────────────────────
-- Per membership rather than per person: a vet at three outfits does not want
-- the same alerts from all three.
alter table public.portal_memberships
  add column if not exists notify jsonb not null default '{}'::jsonb;

comment on column public.portal_memberships.notify is
  'Which events push. Anything absent or false still appears in the app; this '
  'only decides whether the phone buzzes.';

-- ── Who prescribed it, who gave it ──────────────────────────────────────
-- health_events had one text column, administered_by, holding a name. It
-- cannot answer "did the vet give this, or prescribe it for the ranch to
-- give" -- and those bill differently, so the distinction is money.
alter table public.health_events
  add column if not exists prescribed_by_person_id uuid
    references public.portal_people(id) on delete set null,
  add column if not exists administered_by_role text
    check (administered_by_role is null or administered_by_role in ('vet','ranch')),
  add column if not exists administered_by_person_id uuid
    references public.portal_people(id) on delete set null,
  add column if not exists signed_at     timestamptz,
  add column if not exists signature_url text,
  -- 'label' when it came from drug_library, 'override' when a human changed
  -- it. Without this an override is indistinguishable from a lookup.
  add column if not exists withdrawal_source text
    check (withdrawal_source is null or withdrawal_source in ('label','override','none')),
  -- The labour line raised when the ranch administered a vet's prescription.
  add column if not exists labor_expense_id uuid
    references public.lease_expenses(id) on delete set null;

comment on column public.health_events.administered_by is
  'DEPRECATED free text. Use administered_by_role + administered_by_person_id.';
comment on column public.health_events.administered_by_role is
  'vet = the practice bills direct and BrandBook only records it. '
  'ranch = the ranch did the work and a per-head labour line is raised '
  'against that animal''s owner.';

create index if not exists health_events_administered_role_idx
  on public.health_events (administered_by_role) where administered_by_role is not null;

-- ── The rate that decides that labour line ──────────────────────────────
alter table public.ranch_settings
  add column if not exists treatment_labor_per_head numeric(10,2);

comment on column public.ranch_settings.treatment_labor_per_head is
  'Flat charge per head for administering a vet-prescribed treatment. Derived '
  'from an hourly cost by the operator. Null means do not raise a labour line.';
