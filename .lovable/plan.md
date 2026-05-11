# Fix assistant-chat crash on full convo replay

The client now sends back the server's full `convo` (incl. `assistant.tool_calls` and `tool` messages). The function crashes when (a) the client re-sends a stale `system` message and (b) tool-call/tool-result chains are broken (e.g. an assistant message with `tool_calls` whose matching `tool` reply is missing).

## Edits — all in `supabase/functions/assistant-chat/index.ts`

### 1. Debug log at handler entry
Right after parsing `{ messages, images }` (after line 249), add:
```ts
console.error("incoming messages structure:", JSON.stringify(
  (messages || []).map((m: any) => ({
    role: m.role,
    has_tool_calls: Array.isArray(m.tool_calls) && m.tool_calls.length > 0,
    tool_call_id: m.tool_call_id,
  }))
));
```

### 2. Sanitize the incoming history
Add a helper before line 287 that:
- drops every `system` message (we prepend a fresh one)
- walks the array; for each `assistant` message with `tool_calls`, peeks ahead to confirm every `tool_calls[i].id` is matched by a subsequent `tool` message with that `tool_call_id` *before the next assistant/user turn*. If any id is unmatched, drop that assistant message **and** any partial `tool` replies that referenced its ids.
- drops orphan `tool` messages (no preceding assistant `tool_calls` with that id).

```ts
function sanitizeHistory(raw: any[]): any[] {
  const msgs = (raw || []).filter((m: any) => m && m.role !== "system");
  const out: any[] = [];
  const knownToolCallIds = new Set<string>();
  for (let i = 0; i < msgs.length; i++) {
    const m = msgs[i];
    if (m.role === "assistant" && Array.isArray(m.tool_calls) && m.tool_calls.length) {
      const ids: string[] = m.tool_calls.map((tc: any) => tc.id).filter(Boolean);
      // collect tool replies that immediately follow (until next assistant/user)
      const replies: any[] = [];
      let j = i + 1;
      while (j < msgs.length && msgs[j].role === "tool") {
        replies.push(msgs[j]);
        j++;
      }
      const replyIds = new Set(replies.map((r) => r.tool_call_id));
      const allMatched = ids.every((id) => replyIds.has(id));
      if (!allMatched) {
        console.error("dropping orphan assistant tool_calls", { ids, replyIds: [...replyIds] });
        i = j - 1; // skip the partial replies too
        continue;
      }
      ids.forEach((id) => knownToolCallIds.add(id));
      out.push(m);
      for (const r of replies) out.push(r);
      i = j - 1;
    } else if (m.role === "tool") {
      if (m.tool_call_id && knownToolCallIds.has(m.tool_call_id)) {
        out.push(m); // shouldn't normally hit (consumed above) but safe
      } else {
        console.error("dropping orphan tool message", { tool_call_id: m.tool_call_id });
      }
    } else {
      out.push(m);
    }
  }
  return out;
}
```

### 3. Use sanitized history when building convo
Replace line 287:
```ts
const convo: any[] = [{ role: "system", content: sys }, ...sanitizeHistory(messages)];
```

## Why this works
- Stale client `system` messages no longer collide with the freshly-built `sys`.
- The Lovable AI gateway (OpenAI-compatible) rejects requests where an assistant `tool_calls` id has no matching `tool` reply — sanitizer drops those instead of forwarding malformed history.
- The debug log captures exactly what the client sent so future regressions are diagnosable from edge function logs.

## Out of scope
No client changes. No schema/DB changes. Existing token/preview/confirm flow untouched.
