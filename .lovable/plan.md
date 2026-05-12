## 1. Add events directly from the day view

When you click a day in the month grid, the day drawer opens. Right now it only shows existing events — no way to add. I'll add:

- An **"+ Add event"** button at the top of the day drawer (next to the date header).
- Clicking it opens the existing `AddEventDialog` with the date pre-filled to that day at 09:00 (and the calendar selector defaulting to your last-used calendar).
- Same in the day-view route (the "Open day details" button area gets an add button too).

This means: tap a day → tap "+ Add event" → just type the title/time. The date is already chosen.

I'll also keep the small `+` that appears on hover in each month cell (already works) — useful for desktop.

## 2. Hours tracker for Tiger of Sweden + A-hub

A new section on the calendar page (above the month grid, collapsible) showing worked hours from your two job calendars.

```
┌─ Hours this week ────────────────────────┐
│  Tiger of Sweden    12.5h   ███████░░░  │
│  A-hub               8.0h   ████░░░░░░  │
│  ─────────────────────────────────────   │
│  Total              20.5h                │
│                                          │
│  [ This week ▾ ]   May 11 – May 17       │
└──────────────────────────────────────────┘
```

- Period selector: **This week / This month / Custom range**.
- Counts only events from the **Tiger of Sweden** and **A-hub** source calendars (`source = 'job'`).
- Skipped occurrences (via the existing override system) are excluded from totals.
- Pure calculation from existing event data — no schema changes, no new tables.

Open question: do you want **hourly rate × hours = pay** displayed too? If yes, I'll add a small "rates" settings popover (rates stored locally per calendar, only visible to you). If no, I'll skip it for now and you can ask later.

## 3. Cloud / data-safety verification

Quick audit of what's already in place:

- ✅ All events live in **Lovable Cloud** (Postgres). Nothing is stored only in the browser.
- ✅ Soft-delete: deleting an event sets `deleted_at` instead of wiping the row. The audit log (`agent_actions`) records every delete with the full pre-delete row — recoverable.
- ✅ Row-level security: only your account can read/write your events.
- ✅ Auth session persists across browser restarts.

What I'll add for extra safety:
- A **"Recently deleted"** view (small link in the source/calendar settings page) showing soft-deleted events from the last 30 days with a one-click **Restore**. So if something disappears by accident — chatbot, you, anything — it's recoverable from the UI, not just the database.

## Technical (skim if not interested)

- `DayDrawer` gets a new `onAdd?: (date: Date) => void` prop wired from `routes/index.tsx` to the existing `openAdd(date)`.
- New `src/components/hours-tracker.tsx` — pure client component, reads `useEvents(rangeStart, rangeEnd)` for the selected period, filters by `calendar.source === 'job'`, aggregates by calendar.
- New `src/components/recently-deleted.tsx` — queries events with `deleted_at IS NOT NULL` in the last 30 days, "Restore" sets `deleted_at = null`. Mounted from the existing `/sources` route.
- No DB migration. No new tables. Recurring-event hour math handled the same way as existing event expansion.
