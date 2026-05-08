# Import everything + AI calendar assistant

Two things to build on top of what's already there:

1. A real **bulk import** flow so you can dump everything you have right now in one go.
2. A **chat + voice assistant** that knows your full calendar and can add, move, delete, and answer questions about events.

---

## Part 1 — Bulk import everything

You already have a "paste schedule → AI parses" flow on `/sources`. We'll upgrade it so it actually handles a full year of stuff in one sitting.

**Upgrades to the existing import:**
- **Multi-paste / multi-source**: pick a target calendar per paste (School, Tiger of Sweden, A-hub, Personal) and queue several pastes before importing.
- **Screenshot / image upload**: drop a screenshot of your Outlook week or a shift schedule image. We send it to Gemini (vision) and get events back. Same review-then-import UX.
- **Strawberry browser dump helper**: a short on-screen instruction ("ask Strawberry to dump the visible Outlook week as text, paste below") + a "Dump next week" reminder so re-imports are a 10-second weekly habit.
- **Duplicate guard**: when re-importing School, you can tick "replace school events between [date] and [date]" so you don't end up with 3 copies of the same lecture.
- **Bigger AI context**: raise the model to `google/gemini-2.5-pro` for big pastes (better at long, messy timetables), keep flash for quick ones.
- **Review screen improvements**: edit title/time/location inline before importing, group by day, select-all / deselect-all.

**For the two jobs (Tiger, A-hub):**
- Quick "recurring shift" template (e.g. every Tue+Thu 16–22 until June 30) — already partially supported, surface it in the UI.
- Paste a shift email → AI extracts → confirm.

---

## Part 2 — AI assistant ("just tell it what's booked")

A chat panel that lives in the app. You either type or hold-to-talk. It reads your whole calendar, can change it, and answers questions.

**What it can do:**
- **Add**: "I have a dentist appointment next Thursday at 14:30 for an hour" → creates the event in Personal.
- **Add recurring**: "Tiger shifts every Saturday 10–18 in May and June" → creates a recurring event.
- **Move / reschedule**: "Move my Friday physics lecture to Monday same time."
- **Delete / cancel**: "Cancel everything on May 17, it's a holiday."
- **Answer questions**: "What do I have tomorrow?", "When's my next A-hub shift?", "Do I have anything on the 22nd?", "How many hours am I working at Tiger this month?"
- **Bulk dump**: "Here's my whole exam schedule: [paste]" → it parses and adds.
- **Conflict warnings**: if you add something that overlaps an existing event it tells you.

**How it knows your calendar:**
The assistant gets your events for a relevant window (default: 60 days back, 180 days forward) injected into context on each turn. For very large calendars it gets a compact summary + can call a `search_events` tool to pull specifics. It always sees: today's date, your timezone (Europe/Stockholm), and your list of calendars with their colors.

**Voice:**
- Hold-to-talk button uses the browser MediaRecorder, sends audio to a `transcribe` edge function that calls **ElevenLabs Scribe** (batch). Transcript drops into the chat input → you can edit then send, or auto-send.
- Optional later: realtime streaming transcription for live captions while you speak.
- TTS replies (assistant speaks back) optional — off by default to save credits.

**Where it lives:**
- A floating chat button in the bottom-right of every page (Today, Calendar, Sources).
- Full-screen chat route at `/assistant` for longer sessions.
- After every assistant action, the affected day(s) refresh in the background so you see the change immediately.

---

## Tech / data model changes

- New table `chat_messages` (id, user_id, role, content, tool_calls jsonb, created_at) so the assistant has memory across sessions.
- Edge function `assistant-chat` — streams from Lovable AI Gateway (`google/gemini-3-flash-preview` default, `gemini-2.5-pro` for heavy planning). Tool-calling enabled with these tools:
  - `create_event`, `update_event`, `delete_event`, `create_recurring_event`
  - `search_events(date_range, query?)`
  - `list_calendars`
  - `bulk_create_events` (for paste-style dumps inside chat)
  All tools execute server-side with the user's RLS-scoped Supabase client.
- Edge function `transcribe-audio` — accepts an audio blob, calls ElevenLabs Scribe, returns text. Needs the **ELEVENLABS_API_KEY** secret (we'll request it when we build this part).
- Edge function `parse-schedule` upgraded to accept either text or an image (base64) and to take a `targetCalendarId` hint.
- Frontend: `<AssistantPanel>` floating widget + `/assistant` route, react-markdown for rendering replies, MediaRecorder hook for voice.

---

## Build order

1. Upgrade `/sources`: multi-paste queue, screenshot upload, duplicate guard, inline edit on review, switch to gemini-2.5-pro for big pastes.
2. Add `chat_messages` table + `assistant-chat` edge function with tool-calling for create/update/delete/search.
3. Build floating chat panel + `/assistant` page (text only first).
4. Add voice: `transcribe-audio` edge function + hold-to-talk button (needs ElevenLabs key).
5. Polish: conflict warnings, "today brief" command, optional TTS replies.

---

## Honest caveats

- The assistant is only as good as what it sees. For school stuff you'll still re-import weekly (or use the chat to dump the week's text — same result, less clicking).
- Voice transcription needs an ElevenLabs API key (free tier exists, I'll walk you through it when we get to step 4). If you'd rather use browser-native speech recognition (free, lower quality, Chrome-only) we can do that instead — just say.
- AI tool-calls are not undoable in one click yet — we can add an "undo last assistant action" button in step 5 if you want it.
