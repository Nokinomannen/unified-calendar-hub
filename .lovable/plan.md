## Replace Tiger of Sweden shifts after June 20, 2026

### What exists today
Tiger of Sweden calendar (`c779759b…`) has 5 non-recurring events after June 20, 2026 (Jun 21, 27, 28, 29, 30). No RRULE events. All will be soft-deleted (`deleted_at = now()`) so they remain recoverable from "Recently Deleted".

### What to insert
23 new Tiger of Sweden shifts, year 2026, stored in UTC (Stockholm = UTC+2 in summer). Title `Tiger of Sweden`, location set to `Emporia` or `Malmö`.

| Date | Local | UTC | Location |
|---|---|---|---|
| Jun 21 | 09:45–17:00 | 07:45–15:00 | Emporia |
| Jun 22 | 09:50–18:00 | 07:50–16:00 | Malmö |
| Jul 1  | 09:45–17:00 | 07:45–15:00 | Emporia |
| Jul 2  | 12:00–20:10 | 10:00–18:10 | Emporia |
| Jul 4  | 09:50–17:00 | 07:50–15:00 | Malmö |
| Jul 5  | 12:00–16:00 | 10:00–14:00 | Malmö |
| Jul 12 | 09:50–17:00 | 07:50–15:00 | Malmö |
| Jul 13 | 09:50–18:00 | 07:50–16:00 | Malmö |
| Jul 14 | 09:50–18:00 | 07:50–16:00 | Malmö |
| Jul 18 | 09:50–18:00 | 07:50–16:00 | Malmö |
| Jul 19 | 12:00–16:00 | 10:00–14:00 | Malmö |
| Jul 20 | 09:50–17:00 | 07:50–15:00 | Malmö |
| Jul 21 | 09:50–18:10 | 07:50–16:10 | Malmö |
| Jul 23 | 09:50–18:10 | 07:50–16:10 | Malmö |
| Jul 25 | 09:50–17:00 | 07:50–15:00 | Malmö |
| Jul 28 | 09:50–18:00 | 07:50–16:00 | Malmö |
| Jul 29 | 09:50–18:00 | 07:50–16:00 | Malmö |
| Aug 3  | 09:50–18:10 | 07:50–16:10 | Malmö |
| Aug 4  | 09:50–18:10 | 07:50–16:10 | Malmö |
| Aug 8  | 09:50–17:00 | 07:50–15:00 | Malmö |
| Aug 9  | 12:00–16:00 | 10:00–14:00 | Malmö |
| Aug 10 | 09:50–18:00 | 07:50–16:00 | Malmö |
| Aug 11 | 09:50–18:00 | 07:50–16:00 | Malmö |

Semester block Jul 6–11 → no shifts inserted.

### How
Single SQL via the data tool:
1. `UPDATE events SET deleted_at = now() WHERE calendar_id = 'c779759b…' AND deleted_at IS NULL AND start_at >= '2026-06-20'`
2. `INSERT INTO events (user_id, calendar_id, title, location, start_at, end_at, all_day) VALUES (…)` for all 23 rows.

No code changes. No schema changes.
