## Wave 1.2 — Stop fabricated previews

Scope: `supabase/functions/assistant-chat/index.ts` only.

### Status of previous fix
Already shipped — verified in current file:
- `tokensIssuedThisRequest` set is wired through `runTool` → `consumeToken` (line 287, 320, 689).
- Model is already `google/gemini-2.5-pro` (line 291).

No re-ship needed. Only the prompt rule is missing.

### Change: tighten system prompt

In the `sys` string (~line 266), replace the current "To delete or bulk-modify…" bullet and add two new rules right after it:

```
- To delete or bulk-modify: you MUST first call the matching preview_* tool and receive a real confirmation_token. Only after that token exists may you ask the user "Apply?". Do NOT tell the user you "will delete" or "will update" anything before the preview_* call has actually returned. Never fabricate a preview or a token.
- If find_events returns no matches for what the user described, stop and tell them immediately: "I couldn't find an event matching [their description]. Could you give me more detail?" Do not invent an event, do not call preview_*, do not ask "Apply?".
- After the user confirms in a NEW message, call confirm_* with the token. Tokens expire in 5 minutes and are one-time use.
```

### Verification

- "Delete my dentist appointment" when none exists → assistant calls `find_events`, gets empty result, asks for clarification. No `preview_delete_event` call, no fake "Apply?".
- "Delete my dentist appointment" when one exists → `find_events` → `preview_delete_event` returns token → assistant shows preview and asks "Apply?" → ends turn (same-turn guard already blocks chained confirm).
- Next user message "yes" → `confirm_delete_event` succeeds.
- Check `[tool]` log lines to confirm `preview_delete_event` actually fires before any "Apply?" reply.

### Out of scope

DB, client, other tools, schemas.
