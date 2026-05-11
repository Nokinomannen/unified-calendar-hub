## Mål

Få den inbyggda agenten att, från SameSystem-skärmdumpar, **rensa dubbletter** i Tiger of Sweden-kalendern: för varje datum där kalendern har 2+ pass behålls/skapas bara passet som matchar skärmdumpen, övriga raderas. Datum utan dubbletter rörs inte. Dubblettinformationen loggas i `agent_actions`.

## Vad som finns idag

`reimport_from_screenshot` i `supabase/functions/assistant-chat/index.ts` parsar skärmdumpen (via `parse-schedule`, gemini-2.5-pro), matchar varje parsat event mot **ett** existerande event per (titel|datum) och föreslår uppdatering av tider eller insert. Den hittar/raderar inte dubbletter.

## Ändringar

### 1. Ny gren i `reimport_from_screenshot`: `mode: "dedupe_only"`

Lägg till parametern `mode` (`"reconcile"` default = nuvarande beteende, `"dedupe_only"` = nytt) i tool-schemat (rad ~196) och i grenen (rad ~549).

I `dedupe_only`-läget:
- Parsa skärmdumpen som vanligt → lista av "korrekta" pass per datum.
- Hämta alla icke-raderade events i kalendern över skärmdumpens datumspann.
- Gruppera DB-events per `stockholmDate(start_at)`.
- För varje datum **där DB har 2+ events**:
  - Identifiera vilket DB-event som ligger närmast det parsade passet (samma start/slut → exakt match; annars minsta tidsavstånd; om inget parsat finns för datumet → behåll det första, radera resten och flagga).
  - Lägg "behållaren" i `keepers`. Om dess tider skiljer sig från parsens → lägg en patch i `updates`.
  - Lägg övriga i `to_delete` med `before`-snapshot.
- Datum med endast 1 DB-event ignoreras (även om det skiljer sig från skärmdumpen — det är dedup-läge, inte reconcile).

Returnera preview med:
- `confirmation_token`, `expires_in_seconds: 300`
- `would_delete`, `would_update`, `dates_with_duplicates` (lista)
- `sample_deletes`, `sample_updates`
- `dedup_report`: per datum `{ date, kept: {id,title,from,to}, removed: [{id,title,from,to}] }` — sparas både i payload och returneras (trunkerad) så agenten kan visa.

Spara i `pending_actions` med `action_type: "reimport_dedupe"` och payload `{ calendar_id, updates, deletes, dedup_report }`.

### 2. Ny gren `confirm_reimport` → hantera `reimport_dedupe`

Antingen utöka `confirm_reimport` att också acceptera token-typ `reimport_dedupe`, eller (renare) lägg till `confirm_reimport_dedupe`. Jag väljer att utöka `confirm_reimport` så agenten har ett enda confirm-verb per skärmdumps-flöde:
- Kör `update`s som idag.
- Kör soft-delete (sätt `deleted_at = now()`) på `deletes`, audita som `soft_delete` med `before`-snapshot (matchar `undo_last_delete`).
- Skriv en extra rad i `agent_actions` med `action: "dedupe_report"`, `tool_name: "confirm_reimport"`, `before: null`, `after: dedup_report` så historiken finns kvar.
- Returnera `{ applied, updated, deleted, errors }`.

### 3. Systemprompt-tillägg

Två nya rader i systemprompten (rad ~272–284):
- "Om användaren säger 'rensa dubbletter', 'fixa dubbletterna' eller skickar SameSystem-skärmdumpar för dubblettrensning: anropa `reimport_from_screenshot` med `mode='dedupe_only'`, visa preview och vänta på bekräftelse innan `confirm_reimport`."
- "Default `mode` är `reconcile` (nuvarande beteende). Använd `dedupe_only` när uppgiften uttryckligen handlar om dubbletter."

### 4. Verkställ användarens nuvarande begäran

Eftersom skärmdumparna redan är uppladdade i chatten kan användaren skicka ett meddelande som "rensa dubbletter i Tiger of Sweden från dessa skärmdumpar" och agenten kör hela flödet. Ingen separat backend-batch behövs — flödet ÄR själva verkställandet.

## Tekniska detaljer

- Filer: `supabase/functions/assistant-chat/index.ts` (tool-schema + 2 grenar + systemprompt). Ingen ändring i `parse-schedule`, ingen migration (ny `action_type`-sträng räcker, kolumnen är `text`).
- `dedup_report` lagras både i `pending_actions.payload` (för preview) och i en `agent_actions`-rad efter confirm (uppfyller "kommer ihåg informationen om dubletterna").
- Soft-delete (inte hard delete) så `undo_last_delete` fortsätter fungera om du ångrar dig.
- Cap: återanvänd `MAX_BULK` på `updates.length + deletes.length`.
- Parsen kan returnera flera pass på samma datum (skärmdumpen visar både "Faktiska timmar" och "Tidigare arbetspass"). Filtrera parsade events så endast Faktiska timmar används: parse-schedule känner inte till kolumnen, så vi gör det heuristiskt — om parsen returnerar 2 events på samma datum med samma titel, behåll det med `Acceptera`-markering om gemini lyfter ut det; annars behåll det första. Detta är en fallback; det primära signalvärdet är vilken DB-rad som matchar närmast.