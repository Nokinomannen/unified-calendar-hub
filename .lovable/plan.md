## What's wrong today

I tested the chatbot and traced the bug. The system prompt sends each event to the AI like `[ca4bd8e4] Host: Caro...` — only the first 8 characters of the real UUID. So when you said "delete Host: Caro", the AI confidently called `delete_event` with `id: "ca4bd8e4"` and Postgres rejected it as `invalid_id`. That single line is why every edit/delete attempt fails. Same thing will happen for `update_event`.

Other issues I confirmed:
- No way to switch between Month / Week / Day in the calendar.
- No way to edit an existing event (only add new ones and "skip" an occurrence).
- School events were imported from a Teams **monthly** screenshot where blocks just show start time, so the AI guessed 1-hour durations.

## The plan

### 1. Fix the chatbot (the priority)

- Send **full UUIDs** to the AI, not 8-char prefixes. Add a "How to reference events" rule to the system prompt so it always uses the exact id.
- Add a `find_events` tool that searches by title fragment + optional date and returns full ids — so when you say "delete Host Caro" the AI looks it up first, then deletes.
- Improve the system prompt so it:
  - Treats clear edits as direct actions, but **confirms before delete or any change touching >3 events** (your "Both depending on risk" choice).
  - Knows it can do bulk pattern fixes (e.g. "all my school events on Mondays end at 15:00, not 10:30") via a new `bulk_update_events` tool.
- Add a `bulk_update_events` tool that takes a filter (calendar + title pattern + date range + weekday) and a patch (new start time, end time, duration, location, etc.) so you can just say _"all Theme Week and HakkertDukke events end at 15:00 not 08:30"_ and it fixes them all in one shot.
- Surface the actual error to you in chat instead of "tool error" — show what the AI tried and what the DB said, so debugging future hiccups is obvious.
- Stream replies token-by-token so it feels fast.

### 2. Editing events directly in the calendar (your "Both" choice)

- **Quick inline edit** in the day drawer: click an event → popover with title, start, end, calendar dropdown, location, all-day toggle, "Edit fully" button, and Delete.
- **Full edit modal**: reuse the existing AddEventDialog, pre-filled with the event. Add fields you mentioned: time / all-day, source calendar, location, notes, recurrence rule, reminder.
- Both call a new `useUpdateEvent` hook (PATCH to `events`).

### 3. Month / Week / Day view switcher

- Add a segmented control in the calendar header: `Month · Week · Day`. Default Month (current behavior).
- **Week view**: 7-column timeline, hours 7–23 down the side, events laid out with the same overlap algorithm the day drawer already uses. Conflicts highlighted in red. Click event → same edit popover.
- **Day view**: single-day timeline, basically the day drawer rendered inline as a full page.
- Selected view persisted in localStorage.

### 4. Better school import + chatbot bulk-fix

For your Teams screenshot problem, both fixes:
- **Re-import**: on the Sources page, add an "Image type" hint: `Monthly view (times unclear)` vs `Weekly/Daily view (times accurate)`. The parse-schedule prompt uses this to either trust times or flag events as "duration unknown — needs review". Show flagged events with a yellow warning so you don't blindly import bad times.
- **Bulk-fix in chat**: with `find_events` + `bulk_update_events`, you can say _"For all my school events on Tuesdays in May, the end time is 15:00"_ and the chatbot fixes them. It will list which events it'll change and ask "Apply to these 6 events?" before writing (your risk-aware preference).

### 5. Smaller polish

- Keep the assistant button visible above the mobile bottom nav.
- Show event count + a subtle "fix wrong times via chat" hint in the day drawer.

## Technical bits

**Files to change**
- `supabase/functions/assistant-chat/index.ts` — full ids in prompt, new tools (`find_events`, `bulk_update_events`), better error surfacing, optional streaming.
- `src/components/assistant-panel.tsx` — show tool errors clearly; minor UX.
- `src/components/day-drawer.tsx` — click event → edit popover.
- `src/components/edit-event-popover.tsx` (new) — inline edit.
- `src/components/add-event-dialog.tsx` — accept an existing event for "edit mode".
- `src/hooks/use-calendar-data.ts` — add `useUpdateEvent`.
- `src/routes/calendar.tsx` — view switcher; import new Week/Day components.
- `src/components/week-view.tsx` (new), `src/components/day-view.tsx` (new).
- `src/routes/sources.tsx` — image-type hint + flagged-events UI.
- `supabase/functions/parse-schedule/index.ts` — accept `viewHint`, output `confidence` per event.

**No DB migrations needed** — everything is on existing `events` and `calendars` tables.

**Out of scope for this round**: real two-way sync to Outlook/Google (still on the roadmap), voice input (the chatbot supports text only).
