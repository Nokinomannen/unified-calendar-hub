## Calendar reset & import

### 1. Reset
Soft-delete (set `deleted_at = now()`) every event whose `calendar_id` is **not** the School calendar (`d2039ae9…`). This wipes Tiger of Sweden, Personal, and A-hub. School events stay untouched. Personal events you'll paste in next will be added after.

A-hub source already exists — no schema changes needed. Days you don't add A-hub shifts to stay free, as requested.

### 2. Tiger of Sweden — Noah Krüeger shifts (2026, full window, break ignored)

**May**
- Mon May 11, 09:45–16:00
- Tue May 12, 09:45–16:00
- Thu May 14, 09:45–17:00
- Mon May 18, 09:45–16:00
- Tue May 19, 14:00–20:10
- Wed May 27, 12:00–20:10
- Thu May 28, 09:45–16:00

**June**
- Sat Jun 6, 11:00–16:00
- Sun Jun 7, 13:00–17:00
- Mon Jun 8, 12:00–17:00
- Sat Jun 13, 12:00–20:10
- Sun Jun 14, 09:45–17:00
- Sun Jun 21, 09:45–17:00
- Sat Jun 27, 09:45–17:00
- Sun Jun 28, 13:30–20:10
- Mon Jun 29, 12:00–20:10
- Tue Jun 30, 09:45–17:00

All Europe/Stockholm timezone.

### 3. DJ Sets → Personal calendar
No-time gigs default to **19:00–23:59** (your "evening to night" rule). Tentative items get `[tentativ]` prefix in title.

- Fri Jun 5, 19:00–23:59 — `[tentativ] Erik Fång student` (note: vill ha mig till 06 ungefär, får höja till ev 4000)
- Fri Jun 5, 19:00–23:59 — `[tentativ] Bruno (istället för Erik Fång)`
- Sat Jun 6, 19:00–23:59 — `Marie Liebich` (tid och detaljer oklara)
- Thu Jun 11, 19:00–23:59 — `Procivitas Lund` (detaljer oklara)
- Fri Jun 12, 19:00–23:59 — `Isak Berglund Student` (kontaktad om det blir)
- Sun Aug 9, 19:00–23:59 — `palladium`
- Sat Aug 29 22:00 → Sun Aug 30 01:00 — `Bistro bro` (kom ihåg att skriva till honom och träffa på öl…)

Bruno + Erik Fång are both same evening — kept as two separate tentative entries so you can delete the one that doesn't pan out.

### 4. Personal events
Waiting on your next message before adding anything to Personal.

### 5. Hours tracker (next step, not in this plan)
After the reset+import lands, we'll design the A-hub + Tiger hours tracker. I'll ask scope questions then (hourly rate? weekly target? export?).

### Technical
- One `supabase--migration` doing the soft-delete + all 24 inserts in a single transaction, using your user_id from auth.users.
- Times stored UTC, converted from Europe/Stockholm (CEST = UTC+2 in May–Aug 2026).
- No frontend changes.
