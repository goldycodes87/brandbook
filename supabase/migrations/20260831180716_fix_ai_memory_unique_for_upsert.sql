-- The previous index was over an expression — coalesce(auth_user_id, ...) and
-- lower(fact) — which ON CONFLICT cannot infer from a plain column list, so
-- every upsert through PostgREST would have failed.
--
-- Replaced with a plain index using NULLS NOT DISTINCT (PG 15+), which treats
-- the null auth_user_id on a ranch-wide fact as a value rather than as
-- "unknown, therefore never equal to itself". Case folding is given up with
-- it; the facts are model-written and consistently cased.

drop index if exists ai_memory_unique;

create unique index if not exists ai_memory_unique
  on ai_memory (ranch_id, auth_user_id, fact) nulls not distinct;
