# AI Breeding System — End-to-End Audit

**Date:** 2026-08-04  
**Scope:** All code paths that record, store, display, or act on AI/natural breeding events.  
**Policy:** Read-only. No app code was changed.

---

## 1. Entry Points

There are four ways a breeding event gets recorded. They share the same API endpoint but differ significantly in how they orchestrate straw deduction, expenses, and reminders.

---

### 1A. Chute Mode

**File:** `app/(dashboard)/chute/page.tsx`

A single-animal, one-cow-at-a-time chute flow with five screens (setup → animal → tasks → confirm → summary). The operator selects a sire/straw in the setup screen, then processes each cow individually.

**Animal list fetch (lines 138–140):**
```typescript
const [cowRes, heiferRes] = await Promise.all([
  apiGet('/api/animals?sex=cow&status=active&limit=200').then(r => r.json()),
  apiGet('/api/animals?sex=heifer&status=active&limit=200').then(r => r.json()),
])
```
No filter for breeding status. All active cows/heifers are listed regardless of pregnancy state.

**Breeding task execution (lines 1736–1828).** Triggered when `applicableTasks.includes('breeding')` and the animal was not marked "not bred":

1. **Straw deduction** (lines 1742–1756): Reads the full tank list, finds the selected row, writes `straw_count - 1` back. Happens *per-animal*, during the save pass for that cow:
   ```typescript
   await fetch('/api/genetics/tank', {
     method: 'PATCH',
     body: JSON.stringify({ id: straw.id, straw_count: straw.straw_count - 1 }),
   })
   strawsUsed = { semen_inventory_id: straw.id, sire_name: straw.sire_name, prev_count: straw.straw_count }
   ```

2. **Reproduction event** (lines 1759–1772): `POST /api/reproduction` with:
   - `event_type: 'bred'`
   - `conception_method: isAi ? 'ai' : 'natural'`
   - `sire_name_text`, `sire_library_id`, `semen_inventory_id`
   - `ai_technician` from setup screen
   - `ai_cost` (tech fee per cow, from ranch settings), `straw_cost` (price_per_straw from inventory row)
   - No `expected_calving_date` — calving date is NOT stored at breeding time in Chute Mode.
   - No `protocol_group_id`, no CIDR protocol steps.

3. **Preg-check reminder** (lines 1774–1784): Created for AI breeds only. Due date = breed date + `aiPregCheckDaysOut` (default 45, from `ranch_settings.ai_preg_check_days_out`):
   ```typescript
   await apiPost('/api/reminders', { animal_id, reminder_type: 'preg_check', due_date: pregCheckDue, title })
   ```

4. **Expenses** (lines 1786–1826): Created only when `currentAnimal.owner_id` is non-null. Two separate `POST /api/expenses` calls — one for AI Technician Fee, one for Semen Straws — each with `expense_type: 'owner_specific'`. Ranch-owned animals (owner_id = null) produce **no expense record**.

5. **Natural service** (line 1758, 1763): Supported. When `taskData.natural_service === true`, `conception_method` is `'natural'`, straw deduction is skipped, preg-check reminder is skipped, expenses are skipped.

**Undo** (lines 1895–1911): Available after each animal's save. Restores straw count to `prev_count` (the value read before the decrement), then DELETE-calls every `savedEvents` URL and `extraDeleteUrls`:
```typescript
if (last.strawsUsed) {
  await fetch('/api/genetics/tank', {
    method: 'PATCH',
    body: JSON.stringify({ id: last.strawsUsed.semen_inventory_id, straw_count: last.strawsUsed.prev_count }),
  })
}
await Promise.allSettled(last.savedEvents.map(e => apiDelete(e.deleteUrl)))
await Promise.allSettled(last.extraDeleteUrls?.map(url => apiDelete(url)))
```
Expense records created during that animal's save are included in `extraDeleteUrls` (line 1823).

---

### 1B. AI Session Wizard

**File:** `app/(dashboard)/reproduction/ai-session/page.tsx`

A multi-step batch flow. The operator configures one AI session (date, sire, tech name, protocol options), selects multiple cows at once, then submits a single batch.

**Animal list fetch (lines 136–162):** Fetches same `sex=cow&status=active` + `sex=heifer&status=active`, then filters to animals 14+ months old (`ageDays >= 427`). Then fetches all recent `bred` events and builds a `lastBredDate` map per animal (lines 150–162):
```typescript
const reproRes = await apiGet('/api/reproduction?limit=500').then(r => r.json())
const bredMap: Record<string, string> = {}
for (const ev of (reproRes.data ?? [])) {
  if (ev.event_type === 'bred' && ids.includes(ev.animal?.id)) {
    if (!bredMap[ev.animal.id] || ev.event_date > bredMap[ev.animal.id])
      bredMap[ev.animal.id] = ev.event_date
  }
}
setAnimals(all.map(a => ({ ...a, lastBredDate: bredMap[a.id] ?? null })))
```
**`lastBredDate` is attached to each animal but is never shown in the selection UI and never used to disable or warn about selecting an already-bred animal.**

**Breeding submission (lines 218–293):** Uses `Promise.all` across selected animals. For each animal:

1. `POST /api/reproduction` with:
   - `event_type: 'bred'`
   - `conception_method: 'ai'`
   - `ai_technician`, `sire_library_id`, `semen_inventory_id`
   - `expected_calving_date` — computed and stored (unlike Chute Mode).
   - `ai_cost`, `straw_cost`
   - `protocol_group_id` (a UUID generated once for the session), `protocol_step: 'ai'`

2. Preg-check reminder via `POST /api/reminders`.

3. Owner-specific expenses (AI Tech Fee + Semen Straws), if `animal.owner_id !== null`.

**Straw deduction (lines 275–277):** One batch PATCH after all animals are saved:
```typescript
const newCount = strawsAvailable - strawsNeeded
await apiPatch('/api/genetics/tank', { id: selectedInv.id, straw_count: Math.max(0, newCount) })
```
`strawsAvailable` is read at page load. There is no undo mechanism in AI Session.

**Protocol steps** (lines 279–293): Optional CIDR insert + pull events can be backdated (logged as additional `event_type: 'bred'` rows with `protocol_step: 'cidr_insert'` / `'cidr_pull'`). These fire in parallel alongside the main AI events.

---

### 1C. Standalone ReproEventForm

**File:** `components/reproduction/ReproEventForm.tsx`

A full-featured modal form supporting all event types: `bred`, `preg_check`, `calved`, `weaned`, `flushed`, and for bulls: `bse`, `semen_collection`. Used in at least two places: the Reproduction page's "Log Event" sheet, and the animal detail page's edit modal.

**Write path:** `POST /api/reproduction` (new event) or `PATCH /api/reproduction/[id]` (edit). When editing (`eventId` is set), calf-creation and CIDR/protocol fields are hidden. Does **not** deduct straws, create expenses, or create reminders. This is the most basic entry point — data only.

---

### 1D. Animal Detail — Breeding Status Section

**File:** `app/(dashboard)/animals/[id]/page.tsx` (lines 317–372)

The `BreedingStatusSection` component shows a "LOG PREG CHECK" button when status is `bred`. Clicking it opens `PregCheckSheet`. There is no direct "breed this animal" button on the animal detail page; breeding must go through Chute Mode or AI Session. The edit pencil on `OpenPregnancyCard` opens `ReproEventForm` in edit mode (not a new breeding).

---

### Summary: What Each Entry Point Writes

| Field | Chute Mode | AI Session | ReproEventForm |
|---|---|---|---|
| `event_type: 'bred'` | ✓ | ✓ | ✓ |
| `conception_method` | ✓ ai or natural | ✓ ai only | ✓ user-selects |
| `expected_calving_date` | ✗ not stored | ✓ | ✓ |
| `ai_cost` / `straw_cost` | ✓ | ✓ | ✗ |
| `semen_inventory_id` | ✓ | ✓ | ✗ |
| `protocol_group_id` | ✗ | ✓ | ✗ |
| `protocol_step: 'ai'` | ✗ | ✓ | ✗ |
| Straw deduction | Per-animal (−1) | Batch (−N) | ✗ |
| Preg-check reminder | AI breeds only | Always | ✗ |
| Owner expenses | AI + owner_id only | AI + owner_id only | ✗ |
| Undo | ✓ (prev_count restore) | ✗ | ✗ |
| Natural service | ✓ | ✗ | ✓ |
| CIDR protocol steps | ✗ | ✓ optional | ✗ |

---

## 2. Data Model

### `reproduction_events` — Fields in Use

**File:** `lib/database.types.ts`

| Column | Type | Notes |
|---|---|---|
| `id` | uuid | PK |
| `animal_id` | uuid | FK → animals |
| `event_type` | enum | see below |
| `event_date` | date string | |
| `conception_method` | text | `'ai'` or `'natural'` |
| `breed_method` | enum | legacy; mostly null |
| `sire_id` | uuid | FK → animals (live bull) |
| `sire_library_id` | uuid | FK → sire_library (AI sire) |
| `sire_name_text` | text | free-text fallback |
| `semen_inventory_id` | uuid | FK → semen_inventory |
| `ai_technician` | text | |
| `ai_cost` | numeric | tech fee snapshot at breed time |
| `straw_cost` | numeric | price_per_straw snapshot at breed time |
| `expected_calving_date` | date | only set by AI Session and ReproEventForm |
| `preg_check_result` | text | `'confirmed'`, `'open'`, `'recheck'` |
| `preg_check_method` | text | `'rectal'`, `'ultrasound'`, `'blood'` |
| `days_bred` | integer | days since breeding at preg check |
| `calving_ease_score` | integer | on calved events |
| `calf_id` | uuid | FK → animals (created calf) |
| `weaning_date` | date | on weaned events |
| `weaning_weight_lbs` | numeric | on weaned events |
| `donor_dam_id` | uuid | embryo transfer source |
| `protocol_group_id` | uuid | groups CIDR + AI events |
| `protocol_step` | text | `'cidr_insert'`, `'cidr_pull'`, `'ai'` |
| `protocol_day` | integer | rarely used |
| `notes` | text | |

### `event_type` Values (Enum)

```
'bred'             — AI or natural service, also CIDR protocol steps
'preg_check'       — result in preg_check_result
'calved'           — birth event; may create calf animal
'weaned'           — weaning record
'flushed'          — embryo flush (donor cow)
'bse'              — Bull Breeding Soundness Exam
'semen_collection' — bull semen collection
```

### `preg_check_result` Values in Use

Three values, set by `PregCheckSheet.tsx`:
- `'confirmed'` — pregnant
- `'open'` — not pregnant
- `'recheck'` — uncertain, schedule again

### How Repro Status Is Derived

There is **no explicit status column** on the `animals` table. Status is inferred from events at every read. There are three separate derivation paths:

**A. Animals list page** (`app/(dashboard)/animals/page.tsx`, lines 62–84):  
Server-side. Queries `reproduction_events` for the current page of cows/heifers, ordered by `event_date DESC`. Takes the first (most recent) event per animal:
```typescript
let breedingStatusMap: Record<string, 'confirmed' | 'bred' | 'open'> = {}
const seen = new Set<string>()
for (const ev of (reproData ?? [])) {
  const aid = ev.animal_id as string
  if (seen.has(aid)) continue
  seen.add(aid)
  if (ev.event_type === 'preg_check') {
    if (ev.preg_check_result === 'confirmed') breedingStatusMap[aid] = 'confirmed'
    else if (ev.preg_check_result === 'open') breedingStatusMap[aid] = 'open'
  } else if (ev.event_type === 'bred') {
    const days = (Date.now() - new Date(ev.event_date).getTime()) / 86400000
    if (days <= 90) breedingStatusMap[aid] = 'bred'
  }
}
```
Displayed via `AnimalTableRow.tsx` (lines 27–29) and `AnimalCard.tsx`: `confirmed` → green "CONFIRMED", `bred` → blue "BRED", `open` → yellow "OPEN".

**B. Animal detail page — BreedingStatusSection** (`app/(dashboard)/animals/[id]/page.tsx`, lines 317–372):  
Client-side. Uses the full event list loaded with the animal. Determines which is most recent — the `preg_check` or the `bred` event — and whether the preg check postdates the last bred event:
```typescript
let status: 'confirmed' | 'open' | 'bred' | 'not_bred' = 'not_bred'
if (pregCheckIsNewer && latestPregCheck?.preg_check_result === 'confirmed') status = 'confirmed'
else if (pregCheckIsNewer && latestPregCheck?.preg_check_result === 'open') status = 'open'
else if (latestBred && daysSinceBred != null && daysSinceBred <= 90) status = 'bred'
```
Statuses map to: "CONFIRMED BRED" (green chip), "AI'D [date]" (blue chip), "OPEN" (yellow chip), "NOT BRED" (neutral chip).

**C. ReproTab pregnancy banner** (`app/(dashboard)/animals/[id]/page.tsx`, lines 864–892):  
Client-side. Checks whether the last `bred` event is more recent than the last `calved` event. If so, shows a contextual banner: "CONFIRMED PREGNANT", "OPEN", or "BRED [N days ago]".

**D. groupReproEvents** (lines 785–855): Groups events into completed pregnancies (each calved event claims the nearest preceding bred + any intervening preg checks) and open pregnancies (unclaimed bred events). This is purely for display — no status is stored.

**Inconsistency:** The 90-day cutoff for "bred" status (paths A and B) means an animal bred 91+ days ago with no preg check shows as "NOT BRED" in the UI, even though the event exists. Preg-check `'recheck'` result is not mapped to any status in paths A or B — the animal falls through to `'bred'` (or `'not_bred'` if >90 days), silently.

---

## 3. Breeding Status Display

| Location | Component | Logic |
|---|---|---|
| Animals list card view | `AnimalCard.tsx` | `breeding_status` prop from server |
| Animals list table view | `AnimalTableRow.tsx` lines 27–29 | Same prop |
| Animal detail overview tab | `BreedingStatusSection` in `page.tsx` line 317 | Client-inferred from full event list |
| Animal detail repro tab banner | `ReproTab` `pregnancyBanner` lines 864–892 | Client-inferred |
| Repro tab cards | `CowCalfCard` / `OpenPregnancyCard` | Grouped by `groupReproEvents` |

**"Days bred" and expected calving:**

- `BreedingStatusSection` (line 326): `estCalving = latestBred.expected_calving_date ?? addDays(latestBred.event_date, 283)`  
  Stored calving date takes precedence; falls back to breed date + 283 days.
- `ReproTab` banner (line 874): `daysBred = Math.floor((Date.now() - new Date(lastBred.event_date)) / 86400000)`  
- Preg check due estimate (line 327): `addDays(latestBred.event_date, 45)` — hard-coded, does not use `aiPregCheckDaysOut` from ranch settings.

---

## 4. Eligibility — Who Can Be Bred

### Chute Mode (`app/(dashboard)/chute/page.tsx`, lines 138–140)

All `status=active` cows and heifers. No filter of any kind for breeding history. An already confirmed-pregnant cow, an open-confirmed cow, and a never-bred cow look identical in the selection list.

### AI Session (`app/(dashboard)/reproduction/ai-session/page.tsx`, lines 136–162)

All `status=active` cows and heifers 14+ months old. `lastBredDate` is computed and stored on each animal object, but **it is never shown in the animal selection UI and is never used to disable selection or display a warning**. The selection list renders only: tag number, name, age in months, sex chip (lines 494–517 of ai-session). A cow bred 20 days ago looks identical to one never bred.

### Concept of "Open"

"Open" exists as a `preg_check_result` value and is surfaced in status chips. When `PregCheckSheet` records `result === 'open'`, it shows an `OpenCowDecision` panel with three actions: RE-BREED, CULL, MONITOR. The "RE-BREED" action navigates to `/reproduction/ai-session` (line 284) — a fresh AI Session with no animal pre-selected. There is no explicit "Open" flag written to the animals table, no query that returns "all open cows," and no feed-forward that makes an open cow appear eligible while keeping a confirmed cow ineligible.

### Known Gap: Cow 33 Double-Breed

Confirmed gap. Both Chute Mode and AI Session will allow an already-confirmed-pregnant cow to be selected and bred again with no warning. The system writes a second `bred` event, deducts another straw, creates another reminder, and creates another expense. The status derivation logic ("most recent event wins") will then show the cow as "AI'D [today]" rather than "CONFIRMED BRED", erasing visibility of the confirmed pregnancy from the list view.

---

## 5. Tank — Semen Inventory

**File:** `app/api/genetics/tank/route.ts`

**Schema** (`semen_inventory` table): `id`, `sire_name`, `sire_library_id`, `straw_count`, `price_per_straw`, `is_sexed`, `straw_size`, `tank_id`/`tank_name`, `canister`, `cane`, `source`, `purchase_date`, `reg_number`, `notes`.

**Bull selection:** Both Chute Mode and AI Session load the full tank list. Chute shows per-straw inventory cards in the task UI (line 783 shows straw count colored red ≤0, yellow ≤3, green otherwise). AI Session shows the same list with a "straws needed" counter.

**Straw deduction:**

| | Chute Mode | AI Session |
|---|---|---|
| Timing | Per-animal, during save | Batch, after all saves |
| Method | Read full tank → find row → write `count - 1` | Read count at page load → write `count - N` |
| Concurrency protection | None | None |
| Underflow guard | Skips deduction if `straw_count <= 0` at read time (line 1746) | `Math.max(0, newCount)` (line 277) |
| Undo | Yes — restores `prev_count` (the value at read time) | No |

**Race condition:** Both paths read current count and write a derived value. Two concurrent sessions can read the same count and both write incorrect values. For Chute Mode, the undo restores `prev_count` — if another session has since deducted a straw between the original read and the undo, the undo will write a stale count that is one too high.

**Restock:** Handled by the genetics tank management UI (separate from breeding). The `POST /api/genetics/tank` endpoint creates new inventory rows. No audit of restock path was requested.

**Cost fields written at breed time:**  
`ai_cost` and `straw_cost` are stored in `reproduction_events` as snapshots (Chute Mode lines 1768–1769; AI Session similarly). These are **not patchable** — `PATCH /api/reproduction/[id]` does not include them in `allowed` fields (route line 33–38). The `lease_expenses` records (created separately) are the live billing source; the reproduction_events columns are a historical record.

---

## 6. Costs, Expenses, and Reminders

### Expenses

**Route:** `POST /api/expenses` → `lease_expenses` table with `lease_id: null`, `is_lease_specific: false`.

**Created by:** Chute Mode (lines 1792–1825) and AI Session (lines 248–271). Both paths create the same two expense types:
- `category_name: 'AI Technician Fee'`, `expense_type: 'owner_specific'`
- `category_name: 'Semen Straws'`, `expense_type: 'owner_specific'`

**Condition:** `animal.owner_id !== null`. Ranch-owned animals (owner_id null) produce no expense records for AI breeding costs. The tech fee and straw cost are silently swallowed.

**No FK to reproduction_events.** The expense rows have no column linking them to the `reproduction_events` row they were created alongside. If the breeding event is deleted (via Chute Mode undo or via the edit modal DELETE button), the expense records are also deleted — but only if they were saved in the same Chute session (they appear in `extraDeleteUrls`). If expenses from AI Session are deleted manually later, the expense orphans remain.

**Quarter/year:** Both paths compute quarter from the breed date's month, but year is stored as 2-digit `new Date(date).getFullYear() % 100`. This will be ambiguous after 2099.

### Preg-Check Reminders

**Route:** `POST /api/reminders` → `reminders` table.

| | Chute Mode | AI Session |
|---|---|---|
| Triggered | AI breeds only (`isAi` flag, line 1774) | Always (line 236) |
| Days out | `aiPregCheckDaysOut` from ranch settings (default 45) | Same setting |
| `protocol_group_id` | Not included | Included (groups with CIDR events) |

Natural service in Chute Mode creates **no** reminder. If you naturally breed a cow, there is no automatic follow-up.

### Reminder Lifecycle

- Preg check dismissal: `PATCH /api/reminders` with `{ id, is_dismissed: true }` (PregCheckSheet line 136).
- On `confirmed`: dismisses preg-check reminder, creates calving reminder (14 days before expected calving).
- On `recheck`: creates new preg-check reminder 14 days out. Original reminder is dismissed (line 136 runs before the branch). So both the dismiss and the new recheck reminder are always written.
- On `open`: dismisses preg-check reminder, shows OpenCowDecision. "Monitor" creates a 30-day follow-up reminder. "Re-breed" and "Cull" create no reminder.

---

## 7. Preg Check Flow

**File:** `components/reproduction/PregCheckSheet.tsx`

**Entry points:** Animal detail page "LOG PREG CHECK" button (shown when status is `bred`). Also surfaced through the reminders widget (separate code path not audited here).

**Fields captured:** date, method (rectal/ultrasound/blood), result (confirmed/open/recheck), tech name, notes.

**Result: `confirmed`** (lines 139–152)  
→ `POST /api/reproduction` with `event_type: 'preg_check'`, `preg_check_result: 'confirmed'`  
→ Dismiss original reminder  
→ `POST /api/reminders` with `reminder_type: 'calving'`, due = `expectedCalvingDate - 14 days`  
→ Shows "✓ Confirmed pregnant!" with expected calving date

**Result: `open`** (lines 154–156)  
→ `POST /api/reproduction` with `event_type: 'preg_check'`, `preg_check_result: 'open'`  
→ Dismiss original reminder  
→ Shows `OpenCowDecision` panel with three options:
  - **RE-BREED** → `router.push('/reproduction/ai-session')` (no animal pre-selected)
  - **CULL** → closes sheet, no action
  - **MONITOR** → creates 30-day preg-check reminder

**Result: `recheck`** (lines 157–167)  
→ `POST /api/reproduction` with `preg_check_result: 'recheck'`  
→ Dismiss original reminder  
→ Creates new preg-check reminder 14 days out

**Feedback into eligibility:** None. Marking a cow "open" writes the event and updates the display status, but does not flag the cow in any selection list as eligible-for-rebreeding or ineligible-for-a-different-reason. The two states — "open, actively trying to re-breed" and "never bred" — are visually distinct in the status chip but procedurally identical in both Chute Mode and AI Session selection screens.

---

## 8. Gaps and Risks

### G1 — No Re-Breed Guard (Critical)

Neither Chute Mode nor AI Session prevents selecting an already-bred or confirmed-pregnant animal. There is no UI warning, no disabled state, no backend check. Breeding an already-confirmed cow:
- Creates a duplicate `bred` event
- Deducts another straw
- Creates another preg-check reminder (duplicate)
- Creates another expense record (owner animals only)
- **Overwrites the status display** — the list and detail page now show "AI'D [today]" instead of "CONFIRMED BRED", making the previous pregnancy invisible in the overview

This is the documented Cow 33 issue and is unmitigated.

### G2 — `lastBredDate` Collected but Invisible (AI Session)

`app/(dashboard)/reproduction/ai-session/page.tsx` lines 150–162 fetch and compute `lastBredDate` per animal but never render it in the animal selection list (lines 490–517). The data is there; it just goes nowhere.

### G3 — Non-Atomic Straw Deduction

`PATCH /api/genetics/tank` (`app/api/genetics/tank/route.ts`) is a blind overwrite:
```typescript
await supabase.from('semen_inventory').update({ straw_count: Number(straw_count) }).eq('id', id)
```
No optimistic lock, no check that current DB value matches client expectation. Two concurrent sessions — one Chute, one AI Session — can both read `count = 10`, both write `9` (or `10 - N`), and end up with an incorrect count. Supabase does support `rpc` with row-level locking; this endpoint does not use it.

### G4 — Undo Straw Restore Uses Stale Count

Chute Mode undo (line 1904) restores `prev_count` — the value read at the start of that animal's save. If another concurrent session deducted a straw between that read and the undo, the undo writes back a value that is one too high. Example: Tank starts at 5. Session A reads 5, deducts to 4. Session B concurrently reads 4, deducts to 3. Session A undoes and writes 5 (its `prev_count`). Tank is now 5 but only 3 straws remain in reality.

### G5 — No Expense Tracking for Ranch-Owned Animals

Both Chute Mode (line 1787: `if (currentAnimal.owner_id)`) and AI Session (line 248: similar guard) skip expense creation entirely for animals with `owner_id = null`. AI tech fees and semen costs for ranch-owned cattle are never recorded in `lease_expenses`. The `ai_cost` and `straw_cost` snapshots stored in the `reproduction_events` row exist but are not aggregated anywhere in the billing UI.

### G6 — Expected Calving Date Absent from Chute Mode

Chute Mode does not write `expected_calving_date` to the `reproduction_events` row (line 1759–1770 — field absent). AI Session does (it computes `breed_date + 283 days`). This means cows bred through Chute Mode have their expected calving date estimated at display time (`addDays(event_date, 283)`) rather than stored. The displayed date is the same formula, but it cannot be overridden per-animal, and there is no stored calving reminder date until a preg check is logged.

### G7 — Chute Mode Creates No Calving Reminder

AI Session creates a preg-check reminder at breed time. After a confirmed preg check, `PregCheckSheet` creates a calving reminder. But for Chute Mode natural-service animals, no preg-check reminder is created at all, so the preg-check → calving-reminder chain never starts unless the operator manually logs a preg check.

### G8 — AI Session Has No Undo

If a batch AI Session save goes wrong mid-flight (e.g., network failure after 3 of 10 animals are saved), there is no recovery UI. The operator must manually identify which events were created and delete them through the animal detail page.

### G9 — Expense Orphan Risk on Manual Event Deletion

Expenses created by AI Session are not tracked in any delete-URL list. If an operator later deletes a breeding event through the animal detail edit modal, the corresponding `lease_expenses` records remain. The `lease_expenses` table has no FK to `reproduction_events`. This is a data hygiene issue, not a data-loss issue, but it means billing reports can include charges for events that no longer exist.

### G10 — `recheck` Status Not Mapped in List View

The animals list status derivation (`app/(dashboard)/animals/page.tsx` lines 77–83) maps only `confirmed` and `open` preg-check results. A `recheck` result falls through to the `bred` branch (if the bred event is within 90 days) or disappears entirely. The list shows "BRED" for a cow that has had an inconclusive preg check — potentially misleading.

### G11 — Chute vs AI Session Structural Divergence

The two flows share the same API endpoint and produce similar data, but differ in ways that complicate future maintenance:

| Concern | Chute | AI Session |
|---|---|---|
| `expected_calving_date` | Not written | Written |
| `protocol_group_id` | Not written | Written |
| `protocol_step` | Not written | Written (`'ai'`) |
| CIDR protocol | Not supported | Optional |
| Natural service | Supported | Not supported |
| Straw deduction | Per-animal, sequential | Batch, parallel |
| Undo | Yes | No |
| Expense creation | In same async block as event | In same `Promise.all` |
| Preg-check reminder for natural | No | N/A |

Any logic change (e.g., adding `expected_calving_date` to Chute, or adding natural service to AI Session) must be made independently in both 900+ line page components.

### G12 — Open Cow Re-Breed Has No Pre-Selection

When `OpenCowDecision` routes to re-breed (`router.push('/reproduction/ai-session')`), the AI Session page opens fresh with no animal pre-selected. The operator must find and manually re-select the open cow. This is error-prone at pace: the wrong cow could be selected.

---

## 9. Recommendations

### R1 — Add a Re-Breed Guard Immediately (Critical)

The minimum viable fix is to show a visual warning in both selection UIs when a cow's most recent event is `bred` (within 90 days) or `preg_check: confirmed`. This does not require a schema change.

**AI Session** already has `lastBredDate` per animal; it just needs to be shown. Add a "BRED [N days ago]" chip or subdued warning text in the animal row.

**Chute Mode** would need to load breeding status (same logic as `breedingStatusMap` in the animals list page) during setup. Show a "⚠ Already bred" line under the tag number in the selection list.

A hard block (disabling selection) is more protective but may frustrate legitimate use cases (e.g., a confirmed-open cow that needs re-breeding). A soft warning with a confirmation tap is a reasonable compromise for one-handed chute use.

### R2 — Add a Single Derived Repro Status Helper

Create a shared function (e.g., `lib/repro-status.ts`) that accepts an array of `reproduction_events` and returns a typed status:

```typescript
type ReproStatus = 'confirmed' | 'bred' | 'open' | 'recheck' | 'not_bred' | 'calved_open'
```

Currently this derivation is reimplemented three times (`animals/page.tsx`, `animals/[id]/page.tsx` × 2). A shared helper eliminates the `recheck` gap (G10) and the 90-day cutoff inconsistency in one place.

### R3 — Atomic Straw Deduction via RPC

Replace the blind PATCH with a Supabase RPC function:
```sql
create function decrement_straws(inv_id uuid, expected_count int)
returns semen_inventory as $$
  update semen_inventory
  set straw_count = straw_count - 1
  where id = inv_id and straw_count = expected_count and straw_count > 0
  returning *;
$$ language sql;
```
The client checks if a row was returned; if not, re-reads and retries. This eliminates G3 and G4.

### R4 — Store `expected_calving_date` in Chute Mode

Pass `expected_calving_date: addDays(date, 283)` in the Chute Mode `POST /api/reproduction` payload. One line change. Eliminates G6 and makes Chute-bred cows consistent with AI Session cows.

### R5 — Add Preg-Check Reminder for Natural Service

In Chute Mode, move the reminder creation outside the `if (isAi)` guard, or add a separate natural-service reminder with a longer interval (e.g., 45 days). Eliminates G7.

### R6 — Consolidate or Extract Shared Breeding Logic

The two 900-line page components both implement the same breed → straw → reminder → expense pipeline. The divergences are largely accidental. Extracting this into a single `recordBreeding(animal, options)` async function (shared module) would:
- Eliminate G11
- Make future changes (e.g., owner-null expense handling, calving date storage) apply everywhere
- Make the undo pattern in Chute Mode applicable to AI Session

This is a refactor, not a minimum-viable fix. Do it after adding the re-breed guard.

### R7 — Explicit "Open" Eligibility Queue

The cleanest long-term model: add a lightweight view or a materialized status to the animals query that exposes `repro_status` as a first-class field. This enables:
- Filtering the animal list to "show only open/never-bred cows" before a session
- Pre-selecting a specific open cow when routing from `OpenCowDecision`
- Chute Mode task list defaulting to only eligible animals

This does not require a new column. A Postgres view over `reproduction_events` (ordered by date, one row per animal) produces the same result without denormalization.

---

*Audit complete. No application code was modified.*
