# Brand Book — Claude Code Instructions

## Project
Cattle ranch OS. Mobile-first PWA.
Stack: Next.js 15, TypeScript, Tailwind,
Supabase, Vercel, next-pwa.

## Rules
- export const dynamic = 'force-dynamic'
  must be LINE 1 of every route.ts
- Supabase init INSIDE functions only
  via getSupabaseAdmin()
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

## DATABASE — CRITICAL RULES

Supabase MCP is configured (.mcp.json).
Before writing ANY query or selecting
ANY columns:
1. Use MCP list_tables and execute_sql
   to verify exact column names
2. NEVER guess column names
3. TypeScript types in lib/database.types.ts
   — import and use them always

## ANIMALS SELF-JOIN RULE — READ THIS

The animals table references itself via
dam_id, sire_id, donor_dam_id.
PostgREST CANNOT handle nested animals
joins inside the animals query.
PGRST201 error EVERY TIME.

ALWAYS fetch dam, sire, calves, and
donor_dam as SEPARATE queries AFTER
the main animals query.

This has broken 4 times. It cannot
break again.

The comment block at the top of
app/api/animals/[id]/route.ts and
app/api/animals/route.ts enforces this.
Do not remove those comments.

## VERIFIED COLUMN LISTS (from schema.sql)

### reproduction_events
id, animal_id, event_type, event_date,
sire_id, breed_method, ai_technician,
expected_calving_date, calving_ease_score,
preg_check_result, calf_id,
weaning_date, weaning_weight_lbs,
notes, created_at
(+ ALTER TABLE additions: sire_name_text,
conception_method, preg_check_method,
days_bred, donor_dam_id — only use
these if MCP confirms they exist in
the live database)

### health_events
id, animal_id, event_type, event_date,
drug_name, dose_amount, dose_unit,
withdrawal_days, withdrawal_clear_date,
bcs_score, administered_by, notes, created_at

### weights
id, animal_id, weighed_at, weight_lbs,
source, notes
