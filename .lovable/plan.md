## Goal

Let you paste a weekly Teams screenshot directly into the chatbot and have it match titles + dates against existing events and update their times — no more going through the Sources page or asking me to do it manually.

## How it will work (your view)

1. In the chat panel, a small 📎 button appears next to the send box.
2. You attach one (or several) weekly screenshots, optionally type "update my school events from this", and hit send.
3. The assistant replies with a preview: *"I found 12 events in this screenshot. 10 match existing school events (times will change), 2 are new. Confirm?"*
4. You reply "yes" → it updates and reports back. Per the existing risk policy, anything touching >3 events always asks first.

## What I'll build

### 1. Chat input accepts images (`src/components/assistant-panel.tsx`)
- Add paperclip button + hidden file input (accept `image/*`, multi).
- Show small thumbnails of attached images above the textarea with an X to remove.
- On send, convert each to base64 and include them in the request body as `images: [{ base64, mime }]`.

### 2. Edge function accepts images (`supabase/functions/assistant-chat/index.ts`)
- Accept `images` array in the request payload.
- When images are present, inject a system note: *"User attached N screenshot(s). Use the `reimport_from_screenshot` tool to parse + match against existing events. Default viewHint = 'weekly'."*
- Pass image data through to the new tool.

### 3. New tool: `reimport_from_screenshot`
Registered in the assistant's tool list. Args:
- `image_index` (which attached image to use)
- `calendar_id` (which source to match against — defaults to school if title looks like school content)
- `view_hint` ("weekly" | "monthly", default "weekly")
- `dry_run` (boolean, default true → returns preview, doesn't write)

Handler steps:
1. Calls `parse-schedule` with the image + view hint.
2. Filters out all-day "Host:" banners.
3. For each parsed event, looks up existing events in the chosen calendar by `lower(trim(title))` + same date in Europe/Stockholm. Levenshtein ≤ 2 for typo tolerance.
4. Returns a structured preview: `{ to_update: [...], to_insert: [...], skipped: [...] }`.
5. If `dry_run=false` and counts are within risk policy (or user confirmed), runs the updates/inserts and returns a summary.

### 4. Shared matcher helper (`supabase/functions/_shared/match-events.ts`)
Pulled out so both the one-time fix logic and the new tool use the exact same matching rules. Pure function: takes parsed events + DB events + calendar_id, returns `{ updates, inserts, skips }`.

## Technical notes

- Image payloads in chat are kept in component state only (not persisted to `chat_messages`) — base64 in DB would bloat it. The text message is saved as `"[attached 2 screenshots] update school times"`.
- Tool result preview is rendered as markdown in the assistant message (already supported via `react-markdown`).
- Risk policy reused: `to_update.length + to_insert.length > 3` → must confirm before write.
- No DB migration. No new env vars. `parse-schedule` already supports `viewHint`.

## Files touched

- `src/components/assistant-panel.tsx` — image attachment UI + send payload.
- `supabase/functions/assistant-chat/index.ts` — accept images, register `reimport_from_screenshot` tool, wire to matcher.
- `supabase/functions/_shared/match-events.ts` — new shared matcher.

## What you'll be able to say after this

- *"Here's this week's school screenshot, fix the times"* (with image attached)
- *"Same for next week"* (with another image)
- *"Use monthly view hint"* (overrides default)
