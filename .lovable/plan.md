## Goal

Keep the existing **scheduled hours** view (from calendar events) and add a way to log the **actual hours** I was present at work. Show both side by side so I can compare.

## What changes

### 1. New table: `work_logs`
Stores actual time worked per day, per job calendar.

Columns:
- `user_id`, `calendar_id` (links to Tiger of Sweden / A-hub), `work_date` (date), `hours` (numeric), `note` (optional text)
- Unique on `(user_id, calendar_id, work_date)` so editing the same day overwrites
- RLS: own rows only

### 2. Hours tracker UI (`hours-tracker.tsx`)
The existing card gets two columns per job:

```text
Tiger of Sweden        Scheduled  Actual
                         24.5h    22.0h   [Log hours]
A-hub                     0h       6.5h   [Log hours]
─────────────────────────────────────────
Total                    24.5h    28.5h
```

- **Scheduled** = current calculation from events (unchanged)
- **Actual** = sum of `work_logs.hours` in the period
- **[Log hours]** opens a small dialog: pick date → enter hours → optional note → save
- Same week/month period selector applies to both
- Toggle to show only Scheduled, only Actual, or both

### 3. Quick-log from day drawer
When a day with a job shift is open, a "Log actual hours" button pre-fills the date + scheduled hours so I can confirm or adjust in one tap.

### 4. Cloud safety
Same as events — Postgres-backed, RLS, no local-only state.

## Out of scope (next prompt)
- Visual redesign of the tracker card
- Hourly rate / pay calculation

## Files
- migration: `work_logs` table + RLS
- new: `src/components/log-hours-dialog.tsx`
- edit: `src/components/hours-tracker.tsx`, `src/components/day-drawer.tsx`
- new hook: `src/hooks/use-work-logs.ts`

## Question
Should A-hub days where I log actual hours **also auto-create a calendar event** on that day (so the calendar visually fills in)? Or keep logged hours purely as numbers in the tracker, separate from the calendar? My default is **keep separate** — simpler and matches your "those days I'll add manually" rule.
