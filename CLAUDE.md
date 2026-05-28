# Brand Book — Claude Code Instructions

## Project
Cattle ranch OS. Mobile-first PWA.
Stack: Next.js 15, TypeScript, Tailwind,
Supabase, Vercel, next-pwa.

## Rules
- export const dynamic = 'force-dynamic'
  must be LINE 1 of every route.ts
- Supabase init INSIDE functions only
  via createAdminClient()
- Always work on main branch
- npm run build must pass before done
- Never remove working features
- Mobile-first on all UI

## Auth Pattern
- /api/auth/session POST sets httpOnly
  cookie named brandbook_session
- middleware checks cookie only
- No auth checks in layouts ever
- window.location.href not router.push

## Paths
- App: /projects/brandbook
- Deploy: Vercel via GitHub push

## DATABASE RULES — READ FIRST

Supabase MCP is configured in .mcp.json
with PAT auth. TypeScript types are in
lib/database.types.ts (generated from
live DB, authoritative source of truth).

BEFORE writing ANY Supabase query:
1. Check lib/database.types.ts for
   exact column names and types
2. Use MCP execute_sql to verify if
   unsure — never guess
3. Never invent column names

## ANIMALS SELF-JOIN — CRITICAL
animals table has dam_id, sire_id,
donor_dam_id pointing to itself.
PostgREST CANNOT handle nested
animals joins inside animals query.
PGRST201 every time. Broken 4x.

ALWAYS fetch these as SEPARATE queries
AFTER the main animals query:
- dam (via dam_id)
- sire (via sire_id)
- donor_dam (via donor_dam_id)
- calves (.or dam_id.eq/sire_id.eq)

See comment block at top of:
  app/api/animals/[id]/route.ts
  app/api/animals/route.ts

## VERIFIED LIVE DB COLUMNS

### reproduction_events (from lib/database.types.ts)
id, animal_id, event_type, event_date,
sire_id, breed_method, ai_technician,
expected_calving_date, calving_ease_score,
preg_check_result, calf_id,
weaning_date, weaning_weight_lbs,
notes, created_at
NOTE: conception_method, sire_name_text,
preg_check_method, days_bred, donor_dam_id
are in schema.sql ALTER TABLE statements
but were NEVER applied to live DB.
Do NOT select these columns.

### health_events
id, animal_id, event_type, event_date,
drug_name, dose_amount, dose_unit,
withdrawal_days, withdrawal_clear_date,
bcs_score, administered_by, notes, created_at

### weights
id, animal_id, weighed_at, weight_lbs,
source, notes

### grazing_assignments
id, animal_id, lease_id,
start_date, end_date, created_at
