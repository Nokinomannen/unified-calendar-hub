# Auto-logged hours, DJ Sets, and earnings tracker

## 1. Auto-log Tiger of Sweden & A-hub hours

Every scheduled shift on a `source = 'job'` calendar counts as worked — past and future. Scheduled hours always win over manual entries.

- Add `hourly_rate` (numeric, SEK/hour, nullable) to `calendars`. Seed Tiger of Sweden = 162, A-hub = 160.
- Drop the manual `work_logs` write path from the UI for job calendars; the source of truth becomes the expanded events themselves (minus any skipped overrides).
- In `useWorkLogs` / hours-tracker, replace the "actual" calculation: for any job calendar, `actual = sum of scheduled shift hours in range that aren't skipped`. Manual `work_logs` rows are ignored for job calendars (kept for non-job uses if any, otherwise we can clear them).
- Result: the hours tracker shows `Xh / Xh` automatically. The "Log hours" buttons / dialog get hidden for job calendars since logging is automatic. The day drawer "Log hours" button is removed.

## 2. DJ Sets

New section inside the existing "Work hours" card (below the jobs list), collapsible header "DJ Sets".

- New table `dj_sets`: `user_id`, `set_date`, `venue` (text), `amount_sek` (numeric), `duration_hours` (numeric, nullable), `notes` (text, nullable), timestamps. RLS scoped to `auth.uid()`.
- New hook `use-dj-sets.ts` with list / create / update / delete.
- New component `DjSetsList` showing entries in the current period (week/month, matching the existing toggle), with an "+ Add set" button opening an `AddDjSetDialog`.
- Each row: date · venue · duration · amount. Footer: total SEK for the period.

## 3. Earnings tracker

A new "Earnings" panel below DJ Sets in the same card, summarising the same week/month range:

```
Tiger of Sweden   42.5h × 162 SEK   6 885 SEK
A-hub             12.0h × 160 SEK   1 920 SEK
DJ Sets           3 sets             4 500 SEK
─────────────────────────────────────────────
Total                              13 305 SEK
```

Per-job earnings = (auto-logged hours in range) × `hourly_rate`. DJ earnings = sum of `amount_sek` in range. Currency hard-coded to SEK.

## Files touched

- migration: add `calendars.hourly_rate`, set values for the two jobs; create `dj_sets` table + RLS + grants + updated_at trigger.
- `src/hooks/use-calendar-data.ts` — expose `hourly_rate` on calendar type.
- `src/hooks/use-work-logs.ts` — derive actuals from events for job calendars.
- `src/hooks/use-dj-sets.ts` — new.
- `src/components/hours-tracker.tsx` — use derived actuals, add DJ Sets section, add Earnings panel; hide "Log hours" buttons for jobs.
- `src/components/dj-sets-list.tsx` + `src/components/add-dj-set-dialog.tsx` — new.
- `src/components/day-drawer.tsx` — remove the "Log hours" button.
- `src/components/log-hours-dialog.tsx` — keep but unused by the UI (or delete).

## Open trade-off (FYI, not blocking)

You picked "always use scheduled hours" + "money based on logged hours". With auto-log on, logged = scheduled, so the two settings agree. The side effect: you can't record extra hours (overtime) or shorter days separately from the schedule — if you ever need that, just say so and I'll add an "override" field per day.
