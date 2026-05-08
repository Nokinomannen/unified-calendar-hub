## Goal

Your school events were imported from monthly Teams screenshots, so end times are wrong (everything looks like a 1-hour block starting ~9:30). You've now uploaded 6 weekly-view screenshots covering May 11 – Jun 21. Let's use them to fix the times — and make this repeatable so the chatbot can do it next time.

## Plan

### 1. One-time fix (run now, in this turn)
- Parse all 6 uploaded weekly screenshots through the existing `parse-schedule` edge function with `viewHint: "weekly"` so visible block heights are trusted.
- For each parsed event, match it against your existing DB events by **title + date** (school calendar source only).
  - Match found → update `start_at` / `end_at` to the weekly-view times.
  - No match → insert as a new event (covers things like "Hugs and farewell w. Lærke" which only show in weekly view).
- Skip the all-day "Host: …" banner rows (they're hosting metadata, not bookable time).
- Show you a summary in chat: "Updated X events, added Y, skipped Z" with the title list so you can spot-check.

### 2. Make the chatbot able to do this itself
Add one new tool to the assistant so next time you can just upload screenshots into chat:

- **`reimport_from_screenshot`** — takes an image + calendar source + view hint ("weekly" / "monthly"), calls `parse-schedule`, then runs the same title+date match-and-update logic. Returns a preview ("I'll update 12 events and add 2 new ones — confirm?") before writing, per the existing risk policy (>3 events → confirm first).

This means in the future you can paste a screenshot in the chat panel and say "update my school events from this" and it works in one shot.

### 3. Small UX touch on Sources page
Add a "Re-import & replace times" button next to each connected source that opens the existing screenshot uploader pre-set to "weekly view" — so you don't have to go through the chatbot if you'd rather do it visually.

## Technical notes

- **Matching key**: `lower(trim(title))` + `date(start_at AT TIME ZONE 'Europe/Stockholm')` scoped to one calendar. Fuzzy fallback (Levenshtein ≤ 2) for typos like "Holdiay" vs "Holiday" so we don't double-insert.
- **Recurring events**: school events are stored as individual occurrences (no `rrule`), so each weekly screenshot updates that week's row directly — no rrule surgery needed.
- **All-day banners**: parser already returns these; we filter rows where `all_day=true` AND title starts with `Host:` / contains `Public Holiday` already in DB → skip update.
- **Files touched**:
  - `supabase/functions/assistant-chat/index.ts` — register `reimport_from_screenshot` tool, reuse the match-update helper.
  - `supabase/functions/parse-schedule/index.ts` — already supports `viewHint`, no change.
  - New helper `supabase/functions/_shared/match-events.ts` — title+date matcher used by both the one-time fix and the new tool.
  - `src/routes/sources.tsx` — "Re-import & replace times" button.
  - `src/components/assistant-panel.tsx` — accept image attachments in chat (small upload button next to send).

## What I'll do this turn after approval

1. Build the matcher + new edge function tool.
2. Run the one-time fix against your 6 uploaded screenshots and report what changed.
3. Add the Sources button and chat image upload.

No DB migration needed.
