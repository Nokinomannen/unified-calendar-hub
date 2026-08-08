# Expand & polish One — dashboard, quick add, drag-to-log, weather

Nothing existing is removed. The calendar view, event aggregation, timer and hour logging keep working exactly as today; every item below is additive except the font fix.

## 1. Font fix (desktop-safe)

Today the app declares no webfont at all, so the desktop build falls back to whatever the OS ships — that's the "fonts not rendering" symptom. Fix by bundling the fonts into the app instead of fetching from Google:

- Install `@fontsource-variable/inter` (UI text) and `@fontsource-variable/geist-mono` (timer/number columns), imported at the top of `src/styles.css` so they ship in the bundle — no network, no CORS.
- Map them in `@theme` as `--font-sans` / `--font-mono` and apply on `body`.
- No remote `<link>` to fonts.googleapis.com anywhere.

## 2. Insights dashboard (`/dashboard`)

New tab in the header nav (and mobile bar) next to Calendar and Sources. Built with Recharts (already installed) and existing hooks (`useEvents`, `useWorkLogs`, `useDjSets`, calendars):

- KPI row: hours this week, this month, earnings, active-timer state.
- Bar chart: hours per week (last 12 weeks) or per month (last 12 months), toggleable, stacked by calendar colour.
- Grouped bar: scheduled hours vs actually logged hours per period, plus a delta badge (over/under).
- Donut: hours split per job (Mannaz / A-hub / DJ sets).
- Line: cumulative earnings over the selected period.
- Period switcher (This week / This month / Last 3 months / All time) reusing the HoursTracker filter logic.

Read-only page — it computes from existing data, writes nothing.

## 3. Natural-language Quick Add

Sticky input bar above the calendar grid: type "Lunch with team tomorrow at 12:00 for 1h" → parsed → confirm chip → event created.

- A local deterministic parser (`src/lib/quick-parse.ts`) handles the common Swedish/English patterns: today/tomorrow/imorgon, weekday names, `d/m`, `HH:mm`, `for 1h` / `1.5h` / `13-15`, trailing `@Mannaz` or `#personal` to pick a calendar.
- Shows an inline preview ("Tue 11 Aug · 12:00–13:00 · Personal") with Enter to create, Esc to cancel — nothing is saved until you confirm.
- If the text can't be parsed confidently, one click hands it to the existing assistant panel instead.

## 4. Drag-and-drop / right-click time logging

- Right-click (and long-press on mobile) any event in month, week or day view → context menu with "Convert to logged hours", which opens the existing `LogHoursDialog` prefilled with the event's date, calendar and duration.
- Drag an event onto a "Log time" drop zone that appears in the sidebar/hours area while dragging — same prefilled dialog on drop.
- Existing click-to-edit behaviour is untouched.

## 5. Dark mode & motion polish

- Theme toggle already exists (Light/Dark/System) — keep it, verify both themes on the new pages, and refine the dark palette for a Linear-like feel (deeper neutral surfaces, softer borders, one accent).
- Add Framer Motion for subtle transitions: view switches (month/week/day), route transitions between Calendar / Dashboard / Sources, dialog and drawer easing, number roll-ups on the KPI cards. Motion respects `prefers-reduced-motion`.

## 6. Weather overlay

- Mocked-first `useWeather()` hook returning a 5-day forecast (icon, high/low) keyed by date, with a real fetch from Open-Meteo (no API key, free) for Malmö/Århus and a graceful fall back to the mock if the call fails.
- Rendered as a tiny icon + temperature in the corner of the next 5 day cells in month view and in the week/day headers. Purely decorative, never blocks rendering.

## Technical notes

- New files: `src/routes/dashboard.tsx`, `src/components/dashboard/*` (charts), `src/lib/quick-parse.ts`, `src/components/quick-add-bar.tsx`, `src/hooks/use-weather.ts`, `src/components/weather-badge.tsx`.
- Edited files: `src/styles.css` (fonts + palette tweaks), `src/components/app-shell.tsx` (nav item), `src/routes/index.tsx` (quick add bar, weather, motion), `src/components/week-view.tsx` + `day-drawer.tsx` (context menu / drag source), `package.json` (fontsource, framer-motion).
- No database migration is needed — quick add and convert-to-log reuse the existing events and `work_logs` writes.
- Order of work: fonts → dashboard → quick add → drag/right-click logging → motion & palette → weather.
