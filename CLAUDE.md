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
