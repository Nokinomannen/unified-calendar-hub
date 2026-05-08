## Audit findings

**1. Model in use (vision)**
- `supabase/functions/parse-schedule/index.ts` line ~46: `model: "google/gemini-2.5-pro"` when an image is attached, otherwise `gemini-2.5-flash` for text-only.
- Provider: **Google Gemini 2.5 Pro**, called via the Lovable AI Gateway (`https://ai.gateway.lovable.dev/v1/chat/completions`). This is already the strongest Gemini in that family and is multimodal.
- Note: we are not on OpenAI, so the OpenAI `detail: "high"` flag does not apply. The Gateway accepts the OpenAI-style `image_url` format and forwards full-resolution data URLs to Gemini, which has no equivalent "low/auto" downsampling toggle — it always processes full input.

**2. Resize / compression on the client**
- `assistant-panel.tsx` `addFiles()` uses `FileReader.readAsDataURL(file)` and strips the data-URL prefix. **No resizing, no re-encoding, no quality knob.** Original bytes are sent as base64.
- `assistant-chat` forwards `imageBase64` straight into `parse-schedule`, which embeds it as `data:${mime};base64,${b64}` in the `image_url`. **No mutation anywhere in our pipeline.** Good.

**3. OpenAI `detail` parameter**
- N/A — we don't use OpenAI for vision. If we switch (option below), we'll set `detail: "high"`.

**4. Debug visibility**
- Currently zero logging of payload. We can't tell from logs how big the image was, what mime came through, or whether the gateway truncated.

**5. Likely real cause of hallucinated dates (separate from model quality)**
The `assistant-chat` system prompt dumps the user's recent + upcoming events (titles + ISO dates) into context before the screenshot tool ever runs. When the model later parses an image, it has a strong prior toward dates it already saw in the prompt, and the `parse-schedule` prompt does not explicitly forbid using `referenceDate` to fabricate dates that aren't visible in the image. That matches the "completely wrong dates" symptom better than image quality does — Gemini 2.5 Pro reads small text in screenshots fine.

## Plan

### A. Logging (so you can verify nothing is being mangled)

In `parse-schedule/index.ts`, before the gateway call:
- Log: `imageMime`, `base64.length`, approximate byte size (`base64.length * 3/4`), first 16 hex bytes (magic-number sniff), and `viewHint`.
- Decode width/height for PNG/JPEG/WEBP from the header bytes (no library needed — read IHDR for PNG, SOF0 marker for JPEG, VP8 chunk for WEBP). Log `Wx H`.
- Log gateway response status + `usage` if returned.

In `assistant-chat/index.ts` `reimport_from_screenshot`:
- Log `image_index`, `images.length`, attached image byte size, mime.

### B. Stop the hallucination at the prompt level

In `parse-schedule/index.ts`:
- Tighten SYSTEM: *"Dates MUST come from text visible in the image (column headers, day labels, date stamps). The reference date is ONLY for resolving relative weekdays when the image itself shows a weekday but no full date. NEVER invent a date that is not directly readable in the image. If a date is unreadable, skip the event."*
- Add an `evidence` field to each tool-call event (`{ date_source: "image" | "inferred_from_weekday", visible_text: "..." }`) so we can see in logs what the model claimed to read.

In `assistant-chat/index.ts`:
- When `images.length > 0`, do NOT include the recent+upcoming events list in the system prompt for that turn. Instead tell the model "events list omitted to avoid biasing screenshot parsing — use `find_events` if you need ids." This removes the date-prior bias.

### C. Model choice

- Keep `google/gemini-2.5-pro` as the default (strong, already in use, no extra cost vs. switching).
- Add a `model` override knob: if env `PARSE_SCHEDULE_MODEL` is set, use it. Easy A/B against `openai/gpt-5` or `google/gemini-3.1-pro-preview` without code edits. When the model is OpenAI, also send `image_url: { url, detail: "high" }`.

### D. Resolution preservation (defensive)

Already preserved end-to-end. Add one safety net: if `base64.length * 3/4 > 18 MB`, log a warning. Don't downscale — surface to the user instead, since the gateway/model has its own input ceiling (~20 MB).

### E. Test loop

After deploy:
1. You upload the Notion screenshot through chat.
2. Check `parse-schedule` logs — confirm dimensions ≥ original, mime correct, byte size matches what your OS reports for the file.
3. Check the parsed `evidence` field — every event's `date_source` and `visible_text` should match what's actually in the image.
4. If dates are still wrong with `evidence` showing real visible text, that's a genuine model failure — flip `PARSE_SCHEDULE_MODEL=openai/gpt-5` and re-test.

## Files touched

- `supabase/functions/parse-schedule/index.ts` — logging, header-based dimension parsing, tightened system prompt, `evidence` field, model override.
- `supabase/functions/assistant-chat/index.ts` — drop event list from system prompt when images attached, log image byte size on `reimport_from_screenshot`.

No DB migration. No client changes. No new secrets unless you choose to set `PARSE_SCHEDULE_MODEL`.
