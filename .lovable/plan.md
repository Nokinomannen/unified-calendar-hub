## Wave 1.1 — Same-turn confirmation gate + model upgrade

Scope: `supabase/functions/assistant-chat/index.ts` only. No DB, no client, no other tools.

### 1. Same-turn token guard

At the top of the request handler (just before the `for (let i = 0; i < 8; i++)` loop, ~line 285), declare:

```ts
const tokensIssuedThisRequest = new Set<string>();
```

After each tool call inside the inner `for (const tc of toolCalls)` loop (~line 317), if `name.startsWith("preview_")` (also include `reimport_from_screenshot`, since it returns a token too) and `result?.confirmation_token` is a string, add it to the set.

Pass `tokensIssuedThisRequest` into `runTool` as a new parameter, then forward it to `consumeToken`.

In `consumeToken` (~line 689), after the missing-token check, add:

```ts
if (tokensIssuedThisRequest.has(token)) {
  return { error: "This token was just created in the same turn. Show the preview to the user and wait for their explicit confirmation in a new message before calling confirm_*." };
}
```

This is the single chokepoint — every `confirm_*` case already routes through `consumeToken`, so no per-case changes needed beyond plumbing the set through.

### 2. Model upgrade

Line 291: change `"google/gemini-2.5-flash"` → `"google/gemini-2.5-pro"`. Matches `parse-schedule`.

### 3. Verification

- Ask the assistant to delete an event in one message. Expect: it calls `preview_delete_event`, then if it tries `confirm_delete_event` in the same turn the tool returns the "same turn" error, and the model is forced to surface the preview and stop.
- Second user message ("yes, apply") → `confirm_delete_event` succeeds (token is no longer in the per-request set).
- Existing flows (cross-turn confirm, expired token, reused token) still work.
- Check edge function logs to confirm `[tool]` lines show the rejected confirm in the bad case.

### Out of scope

No changes to tool schemas, system prompt, DB, client, or other functions.
