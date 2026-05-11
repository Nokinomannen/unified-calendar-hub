
# Wave 1 — Confirmation gates, audit log, soft delete (final)

Skipping dark mode. Two clarifications applied:
- Manual UI delete will also soft-delete (consistent with agent path; `undo_last_delete` works for both).
- Grep done: `delete_event`, `bulk_update_events`, `bulk_create_events` are referenced **only** inside `supabase/functions/assistant-chat/index.ts` (tool definitions, system prompt, and the dispatch switch). No background jobs, sync code, or other functions call them. Safe to remove.

## 1. Migration

Single SQL migration. Includes the wave-2 TODO at the top.

```sql
-- TODO(wave 2): add a pg_cron job to hard-purge events where
-- deleted_at < now() - interval '30 days', and to delete
-- pending_actions where expires_at < now() - interval '1 day'.
```

### `pending_actions`
```
id                  uuid pk default gen_random_uuid()
user_id             uuid not null
action_type         text not null   -- 'delete_event' | 'bulk_update_events' | 'bulk_create_events' | 'reimport_apply'
payload             jsonb not null
confirmation_token  text not null
created_at          timestamptz not null default now()
expires_at          timestamptz not null default (now() + interval '5 minutes')
confirmed_at        timestamptz
```
- Unique partial index `(user_id, confirmation_token) where confirmed_at is null`.
- RLS: own-row select/insert/update by `auth.uid() = user_id`. No client delete needed.

### `agent_actions` (audit)
```
id          uuid pk default gen_random_uuid()
user_id     uuid not null
action      text not null    -- 'create' | 'update' | 'soft_delete' | 'restore'
event_id    uuid
before      jsonb
after       jsonb
tool_name   text not null    -- e.g. 'create_event', 'confirm_delete_event', 'ui_delete', 'undo_last_delete'
created_at  timestamptz not null default now()
```
- Index on `(user_id, created_at desc)` for "find latest delete".
- RLS: own-row select + insert. No update, no delete.

### `events.deleted_at`
- Add `deleted_at timestamptz` (nullable).
- Partial index `(user_id, start_at) where deleted_at is null`.

## 2. Edge function — `supabase/functions/assistant-chat/index.ts`

### Tool list (final)
Keep: `list_calendars`, `find_events`, `search_events`, `create_event`, `update_event`, `reimport_from_screenshot` (dry-run only path).

Remove: `delete_event`, `bulk_update_events`, `bulk_create_events` (replaced by preview/confirm pairs below).

Add:
- `preview_delete_event(id)` → fetches row (must be non-deleted, owned), inserts `pending_actions`, returns `{ confirmation_token, expires_at, preview }`.
- `confirm_delete_event(confirmation_token)` → validates token (own, not expired, not used), marks confirmed, soft-deletes row, writes `agent_actions{action:'soft_delete', before:fullRow, tool_name:'confirm_delete_event'}`.
- `preview_bulk_update_events(ids, patch)` → cap 50; computes per-row before/after; stores in `pending_actions.payload`; returns token + summary + sample diffs.
- `confirm_bulk_update_events(token)` → applies, writes one `agent_actions{action:'update', before, after}` per event.
- `preview_bulk_create_events(calendar_name, events)` → cap 50; returns token + count + sample.
- `confirm_bulk_create_events(token)` → inserts; writes `agent_actions{action:'create', after}` per row.
- `confirm_reimport(confirmation_token)` → applies the updates/inserts captured in `pending_actions.payload` from a prior `reimport_from_screenshot` call; per-event audit rows. Hard cap 50 enforced at preview time.
- `undo_last_delete()` → finds latest `agent_actions` for this user where `action='soft_delete'`, `created_at > now() - interval '30 days'`, and the event's `deleted_at` is still set (i.e. not already restored). Sets `deleted_at = null`, writes `agent_actions{action:'restore', after:fullRow, tool_name:'undo_last_delete'}`.

`reimport_from_screenshot` itself: now always behaves as the prior `dry_run=true` and ALWAYS returns a `confirmation_token` (when there's anything to apply). The `dry_run` and direct-apply paths are gone.

### Existing tools updated
- `create_event`, `update_event`: write `agent_actions` after successful mutation. No confirmation required (non-destructive single ops).
- All read tools: filter `.is('deleted_at', null)`.
- `update_event` reads the row first to capture `before`.

### System prompt
- Drop the events-list dump even outside the image branch (carried-over audit finding #2): inject just `calendars` + `(N events in window — call find_events for ids)`. Frees the prompt-injection surface and shrinks tokens.
- Replace risk paragraph: "To delete or bulk-modify, call `preview_*`, show the preview + token, ask 'Apply?', call `confirm_*`. Tokens expire in 5 minutes. Hard cap: 50 events per bulk op. To recover a delete, call `undo_last_delete`."

### Logging
Per tool call: `console.log("[tool]", name, {args_summary, result_summary, ms})`. Per turn: log gateway `usage`. Durable record lives in `agent_actions`.

## 3. Client code — `src/hooks/use-calendar-data.ts`

- `useEvents`: add `.is('deleted_at', null)`.
- `useDeleteEvent`: change from `.delete()` to `.update({ deleted_at: new Date().toISOString() })`. After update, insert `agent_actions{action:'soft_delete', before:fullRow, tool_name:'ui_delete'}` (read row first to capture `before`).
- No new UI; `undo_last_delete` is reachable by asking the assistant. (UI undo button is wave 2.)

## 4. Verification

1. Run migration; confirm tables, RLS, `events.deleted_at`, indexes.
2. Chat: "delete tomorrow's standup" → expect `preview_delete_event` → token shown → confirm "yes" → `confirm_delete_event` runs → event vanishes from UI; DB row has `deleted_at` set; `agent_actions` row exists with full `before`.
3. Chat: "undo that" → `undo_last_delete` → event reappears; second `agent_actions` row with `action='restore'`.
4. Manual UI delete via the day drawer → row's `deleted_at` set; `agent_actions` row with `tool_name='ui_delete'`. Then chat "undo last delete" → restored.
5. Bulk update of 4 school events → preview/confirm; 4 `agent_actions` rows with before/after.
6. Try bulk update of 51 ids → preview rejects with "exceeds 50-event cap"; no `pending_actions` row.
7. Wait 6 min after preview → confirm rejects with "token expired".
8. Reuse a confirmed token → rejects with "already used".

## Files touched

- `supabase/migrations/<new>.sql` — pending_actions, agent_actions, events.deleted_at, indexes, RLS, wave-2 TODO.
- `supabase/functions/assistant-chat/index.ts` — new tool list, preview/confirm handlers, soft-delete, audit writes, deleted_at filter, undo, slimmed system prompt.
- `src/hooks/use-calendar-data.ts` — soft-delete UI path + audit row + deleted_at filter on reads.

No new secrets. No UI components. No dark mode.
