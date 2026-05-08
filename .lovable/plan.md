
## Goal

1. Bulk-import the events from your 4 screenshots (Tiger of Sweden shifts via SameSystem + Teams school calendar) into the right calendars.
2. Redesign the month view so overlapping events, conflicts, and free days are immediately readable — so you can see at a glance where there's room for the second job (a-hub).

---

## Part 1 — Import the screenshots

I'll feed each screenshot through the existing `parse-schedule` edge function (already supports image input via Gemini 2.5 Pro) and route them to the correct calendar:

- **Screenshot 1 + 2** (SameSystem "Acceptera schema" tables) → **Tiger of Sweden** calendar. Each row = one shift, e.g. `11-05-2026 09:45–16:00 (30 min break)`. I'll subtract the break from the end time and title them "Tiger of Sweden – shift".
- **Screenshot 3** (school month view: Theme Week, HakkertDukker, Retreat, Public Holiday, Hosts) → **School** calendar. Multi-day banners (Host:…, Theme Week, Retreat) become all-day spanning events; timed ones (9:30, 13:00 etc.) become normal events.
- **Screenshot 4** (Teams June 2026: Adaptive Lead, Indy Johar Lecture, Prep Translocation, Hugs and farewell, Future Days Festival, etc.) → **School** calendar.

After parsing each screenshot you'll get a review screen on `/sources` to fix titles/times before saving. I'll add a "target calendar" dropdown so you set it once per batch instead of per event.

If a parsed event already exists (same title + start within ±15 min), it's marked as duplicate and skipped by default.

---

## Part 2 — Redesign the month view for conflicts & density

The current grid shows max 3 events stacked as flat pills. With school + 2 jobs that's unreadable. New design:

### Day cell layout

```text
┌─────────────────────┐
│ 14   ●●●  6h booked │  ← date, calendar dots, total busy hours
├─────────────────────┤
│ 09:00 ▌School       │  ← left bar = calendar color
│ 13:00 ▌Tiger shift  │  ← if overlaps another → red left border
│ ⚠ 2 conflicts       │  ← shown only when events overlap
│ +3 more             │
└─────────────────────┘
```

- **Calendar dots** in the header give a 1-glance summary of which calendars have events that day (school + tiger + personal).
- **Busy-hours badge** shows total committed time (e.g. "6h"). Days with `0h` get a subtle "Free" label — those are your candidates for a-hub shifts.
- **Conflict highlighting**: when two events' time ranges overlap, both get a red left border + a small ⚠ icon. Hover shows "Conflicts with: Tiger shift 13:00–17:00".
- **Calendar color stays as a 3px left bar** instead of a full pill background → easier to read titles, less visual noise when there are 4+ events.
- **Free-day shading**: empty weekdays get a very faint green tint so empty space pops visually.

### Day detail drawer

Click any day → side drawer opens with a vertical timeline (08:00–22:00). Overlapping events render side-by-side as columns (Google-Calendar-style), so a school lecture 13:00–15:00 and a Tiger shift 13:30–17:00 are both fully visible. Each event has a "Skip this" toggle (e.g. "I'm working, won't attend school") — this doesn't delete the event, just marks it dimmed/struck-through and excludes it from the busy-hours total.

### New "Week density" strip (top of calendar page)

A horizontal bar above the month showing each day of the current week with a stacked-bar of hours per calendar. Instantly shows: "Wed has 9h Tiger + 2h school = full. Thu has 0h = open."

---

## Technical bits (skip if you don't care)

- New table `event_overrides` (event_id, occurrence_date, status: 'skipped' | 'attending') to track per-occurrence skips without deleting recurring events.
- `useEvents` hook returns overlap groups computed client-side (interval tree on occurrence_start/end).
- New `<DayCell>` component replaces the inline rendering in `calendar.tsx`. New `<DayDrawer>` for the detail view. New `<WeekDensity>` strip.
- Sources page gets: target-calendar selector, batch image upload (drop all 4 screenshots at once), and a per-batch "title prefix" (e.g. "Tiger of Sweden – ").
- Conflict detection is pure UI — no DB changes needed for that part.

---

## Build order

1. Sources: multi-image upload + target-calendar selector + batch parse.
2. Parse your 4 screenshots, you review and save.
3. New day cell + conflict styling + busy-hours badge.
4. Day drawer with side-by-side overlap timeline + skip toggle.
5. Week density strip.

Want me to proceed with all 5, or trim (e.g. skip the week-density strip for v1)?
