# Project Architecture Rules

- Use dedicated agenda presentations below the `md` breakpoint for mobile day/week calendar views; keep the seven-column timeline for desktop because phone interaction and density requirements differ.
- Mobile month uses a date picker with an inline selected-day agenda below `md`; desktop retains MonthGrid so experimentation does not alter desktop or week layouts.
- MCP server for external agents lives in src/lib/mcp (one tool per file, OAuth via managed auth); tools use the caller token so RLS applies.
- Outlook (Hotmail) two-way sync lives in src/lib/outlook-sync.functions.ts: pull on demand (once per session + Sources button), push after each event mutation; no polling, to keep background cost near zero.
- Day focus/notes live in day_focus/day_notes; Notion (Work to-dos, Reflektioner) is touched only on explicit button presses in src/lib/day-focus.functions.ts, never on load, to keep background cost zero.
