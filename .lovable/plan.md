# Unified Calendar App

One place for your school timetable, second Outlook account, and shifts at Tiger of Sweden + A-hub. Web app with calendar view, list view, and browser push reminders.

## What you get

- **Single timeline** merging every source, color-coded by calendar
- **Three views**: month grid, week grid, agenda/list
- **Quick add**: type "Tiger shift Fri 12-20" and it parses
- **Push reminders** (browser/PWA) — e.g. 30 min before
- **Today widget** as the home screen — what's next, what's now
- **Installable as PWA** so it sits on your phone home screen like a native app

## Calendar sources & how they get in

**1. School (Outlook/Teams) — the hard one**
You mentioned Strawberry Browser can read your Outlook tab. Best path:
- App gives you a **"Paste schedule" box** + an **"AI import"** flow
- You either (a) ask Strawberry to dump the visible week as text/JSON and paste it in, or (b) screenshot → upload → AI extracts events
- AI (via Lovable AI Gateway, no key needed) parses into structured events and you confirm before saving
- Re-run weekly. Bulk-replace school events in a date range so re-imports don't duplicate.
- *Backup option:* if your school Outlook ever exposes "Publish calendar" → ICS URL, the app can subscribe and auto-refresh hourly. We'll include the field but won't depend on it.

**2. Second Outlook/Microsoft account**
Sign in with Microsoft OAuth (personal/work account, not the school one) → reads via Graph API, auto-syncs. If your other account also blocks third-party apps, falls back to the same paste/ICS flow.

**3. Job shifts (Tiger of Sweden, A-hub)**
- Manual entry with **recurring rules** (e.g. "every Tue+Thu 16-22 until June")
- **Paste a schedule** box → AI parses into shifts
- Per-employer color and label

## Screens

- **Today** (home): now / next up / rest of day, quick-add bar
- **Calendar**: month + week views, filter chips per source
- **Agenda**: scrollable list grouped by day
- **Sources**: manage connected calendars, re-import school, OAuth Microsoft
- **Settings**: reminder defaults, notification permission, theme

## Reminders

- Browser Notifications API + service worker for push when the tab is closed
- Per-event override; default lead time in settings
- Works on desktop reliably; on iOS requires installing the PWA to home screen

## Tech notes

- **Backend**: Lovable Cloud (auth + Postgres + storage)
- **AI parsing**: Lovable AI Gateway (Gemini) — no key needed, used to turn pasted text/screenshots into structured events
- **Microsoft OAuth**: per-user OAuth (you create an app registration in Microsoft Entra; one-time, ~5 min). Connector approach won't work because each user needs their own account.
- **Data model**: `calendars` (source, color, name) + `events` (start, end, title, location, recurrence_rule, calendar_id, external_id) — RLS scoped to your user
- **PWA**: manifest + service worker for install + push
- **Recurrence**: stored as RRULE; expanded on read

## Build order

1. Auth + DB schema + Today/Calendar/Agenda views with manual events
2. Quick-add NL parser + recurring shifts (covers both jobs immediately)
3. Paste-schedule + screenshot → AI import flow (school calendar)
4. Microsoft OAuth for second account + ICS subscription fallback
5. PWA install + push reminders
6. Polish: filters, search, drag to reschedule

## Honest caveats

- iOS push only works after installing the PWA to home screen
- School re-imports are a weekly habit, not magic — but it's 10 seconds with Strawberry + paste
- Microsoft OAuth needs you to register one app in Entra (free, I'll walk you through it when we get there)
