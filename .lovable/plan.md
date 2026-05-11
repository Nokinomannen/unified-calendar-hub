# Calendar-first landing, dark mode, agent hardening, visual polish

Four bundled changes. Frontend + one edge-function tweak. No schema changes.

## 1. Calendar = home

- Move month-view code from `src/routes/calendar.tsx` into `src/routes/index.tsx` (so `/` shows the big month grid).
- Delete the old "Today / Good morning + Next up + upcoming list" content from `index.tsx`.
- Keep `/calendar` working by either (a) redirecting it to `/` via `beforeLoad`, or (b) deleting `routes/calendar.tsx` and removing the Calendar nav item. Plan: redirect, keep Calendar nav label pointing to `/` so the navbar still has Today/Calendar/Sources without dead links.
- Default `view` to `"month"` and ignore any stale `localStorage["cal-view"]` if it equals `"day"` only when there is no width hint — simpler: leave persistence as-is, but seed initial state to `"month"` for first-time users.
- `AppShell` nav: rename "Today" → "Calendar" (single item to `/`), drop the duplicate.

## 2. Dark mode by default

- In `src/routes/__root.tsx` (root layout), add `className="dark"` to `<html>` so the `.dark` token block in `src/styles.css` is always applied.
- Refresh the dark palette in `src/styles.css` for a richer feel:
  - `--background` → near-black with a hint of indigo (`oklch(0.16 0.02 270)`)
  - `--card` → slightly lifted surface (`oklch(0.21 0.02 270)`)
  - `--primary` → vivid violet (`oklch(0.65 0.22 285)`) with `--primary-foreground` near-white
  - `--border` → `oklch(1 0 0 / 8%)`, `--muted-foreground` → `oklch(0.72 0.02 260)`
  - Add `--gradient-primary`, `--shadow-elegant` tokens for reuse.
- Keep `:root` (light) values intact in case we want a toggle later, but the app ships dark-only.

## 3. AI agent reliability

The recent fixes (sanitize tool history, 402 → friendly reply, send full `convo` with tool messages) handle the crash modes. Remaining gaps:

- **Tool-loop watchdog (`supabase/functions/assistant-chat/index.ts`)**: if the gateway returns 5xx mid-loop, retry once with 800ms backoff before bailing. If the model emits a tool call we don't know, return a structured `tool` reply with `{ error: "unknown_tool" }` instead of throwing — lets the model recover.
- **Token expiry UX**: when `consumeToken` rejects with "expired/used", reply to the user with "That confirmation expired — want me to preview again?" instead of a raw error.
- **Client (`src/components/assistant-panel.tsx`)**:
  - On error, don't push the cryptic "Sorry, that failed." Instead show the server's `reply` if present.
  - Add a small "Reset chat" button in the panel header that clears `convo`, `messages`, and any in-flight token (purely client state).
  - Disable the input while `busy` (already) and show a typing indicator instead of swallowing the turn.
- **Visible status**: render the last tool name in a tiny line above the assistant bubble (e.g. "→ find_events", "→ preview_delete_event") so the user sees progress and can tell when something stalls.

No model swap, no new env vars.

## 4. Visual polish

Scope: shared chrome + month grid + assistant panel. No new libraries.

- **Header (`AppShell`)**: thinner divider, gradient logo chip using `--gradient-primary`, slightly larger brand text. Replace "One" with the existing brand if any (keeping "One" otherwise).
- **Month grid (`MonthGrid` / `DayCell` in the new `index.tsx`)**:
  - Cell min-height 128px on desktop, rounded inner corners on the outer container, hairline borders using `--border`.
  - Today's date pill: gradient background, soft glow shadow.
  - Event chips: bigger left bar (4px), subtle bg `bg-card/40`, hover lifts with `--shadow-elegant`.
  - Free-day badge: switch from emerald tint to a calmer mint that reads in dark mode.
  - Conflict marker: replace inline `AlertTriangle` with a red dot + tooltip on hover.
  - Calendar filter chips: pill style with filled dot, active = full color, inactive = outline + 40% opacity (already close, just tighten spacing and use tokens).
- **FAB**: gradient background, larger shadow, scale-on-hover already present — add a subtle ring on focus.
- **Assistant panel**: rounded-2xl, blurred backdrop, message bubbles use `--card` for assistant and `--primary/15` tinted for user. Add the status line from §3.
- **Empty states**: replace plain dashed boxes with centered icon + one-line copy.

All colors via tokens — no hex literals in components.

## Files touched

- `src/routes/__root.tsx` — add `dark` class
- `src/routes/index.tsx` — replace with month-calendar view
- `src/routes/calendar.tsx` — convert to redirect (or delete + update nav)
- `src/components/app-shell.tsx` — nav cleanup, header polish, FAB polish
- `src/components/assistant-panel.tsx` — reset button, status line, better error reply
- `src/styles.css` — refreshed dark palette + gradient/shadow tokens
- `supabase/functions/assistant-chat/index.ts` — 5xx retry, unknown-tool guard, friendlier expired-token reply

## Out of scope

- Light-mode toggle (dark only for now)
- Calendar source sync work
- New AI features
