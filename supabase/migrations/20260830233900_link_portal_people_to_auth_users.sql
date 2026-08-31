-- Bridge the two ways a human gets into BrandBook.
--
-- Operators sign in with a password: brandbook_session holds a Supabase
-- auth.users id, and profiles hangs off that. Portal people sign in with a
-- magic link and have no auth user at all. Both are real, and neither is going
-- away -- a ranch manager wants a password, an owner does not want an account.
--
-- What they should share is the ROLE. Without this link there is no way to ask
-- "what may the person holding this password do?" beyond profiles.role, which
-- is a coarse four-value enum with no notion of co-admin or CPA.
--
-- Nullable on purpose: most portal people will never have a password.
alter table public.portal_people
  add column if not exists auth_user_id uuid references auth.users(id) on delete set null;

create unique index if not exists portal_people_auth_user_key
  on public.portal_people (auth_user_id) where auth_user_id is not null;

comment on column public.portal_people.auth_user_id is
  'Set when this person also signs in with a password. Lets the operator '
  'session resolve to a portal_memberships role instead of profiles.role.';

-- Link anyone who is already both. Matched on email, which is unique on both
-- sides, and only where exactly one candidate exists.
update public.portal_people pp
set    auth_user_id = pr.id
from   public.profiles pr
where  pp.auth_user_id is null
  and  pp.email is not null
  and  pr.email is not null
  and  lower(pp.email) = lower(pr.email)
  and  not exists (
         select 1 from public.portal_people other
         where other.auth_user_id = pr.id and other.id <> pp.id
       );
