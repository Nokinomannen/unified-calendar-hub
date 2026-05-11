## Fix

In `src/components/assistant-panel.tsx`, persist the server's full `convo` (with `tool_calls` and `tool` results) and use it as the source of truth for the next request.

### Changes

1. Add a new state alongside `messages`:
   ```ts
   const [convo, setConvo] = useState<any[]>([]);
   ```

2. In `send()`, build the request body from `convo` + the new user turn instead of the visible `messages`:
   ```ts
   const userTurn = { role: "user", content: display };
   const outgoing = [...convo.filter((m) => m.role !== "system"), userTurn];
   // ...
   body: { messages: outgoing, images: ... }
   ```
   Stripping the leading system message keeps the server free to prepend its fresh one each turn.

3. After a successful response, store the returned convo:
   ```ts
   setConvo(((data as any).convo || []).filter((m: any) => m.role !== "system"));
   ```
   `messages` continues to hold only what's rendered.

4. No server changes — `assistant-chat/index.ts` already returns `convo` on the success path (line 313 `return json({ reply: msg.content || "", convo });`).

### Why this fixes the loop

When the user replies "yes apply", the model needs to see its own previous `assistant` message with `tool_calls: [preview_delete_event(...)]` and the matching `tool` result containing `confirmation_token`. The current client only sends `{role, content}` pairs, so those tool turns are erased and the model re-runs the preview every time. Sending back the server's `convo` restores the full history, so the model calls `confirm_delete_event` with the real token.