# Notion-tasks: skapa, redigera, ta bort — plus en genomgång som fixar det som är trasigt

## 1. Varför tasks inte syns (bekräftat)

Startsidan visar bara tasks-panelen om den gamla inställningen `notion.databaseId` finns. När vi gick över till flera databaser (`notion.databases`) sattes den gamla nyckeln till tom — så villkoret blir falskt och panelen renderas aldrig, trots att du har två databaser kopplade (Work Tasks + Personal Tasks) och kopplingen mot Notion svarar korrekt.

Fix: startsidan använder samma hjälpfunktion som Kanban-vyn (`notionDatabases`), så panelen syns så fort minst en databas är vald.

## 2. Skapa, redigera och ta bort tasks

Nya möjligheter, allt skrivs direkt till Notion (Notion förblir sanningen):

- **Ny task** — knapp i tasks-panelen, "+"-knapp överst i varje Kanban-kolumn (skapar direkt i den statusen) och i kommandopaletten (⌘K). Dialog med: titel, databas (Work/Personal), status, deadline, prioritet, anteckning.
- **Redigera** — klick på ett kort öppnar samma dialog med värdena ifyllda. Ändra titel, deadline, prioritet, status, anteckning.
- **Ta bort** — papperskorg på kortet med bekräftelse. Sidan arkiveras i Notion (går att återställa där).
- **Snabbtillägg** — skriv `task: ring Caspar imorgon 14:00 #mannaz !hög` i quick add-fältet eller be chatt-agenten. Datum, prioritet och jobb-kategori tolkas ur texten, och rätt databas väljs automatiskt (personligt → Personal Tasks, annars Work Tasks).
- Allt sker optimistiskt: kortet dyker upp/ändras direkt och rullas tillbaka med felmeddelande om Notion nekar.

## 3. Genomgång och uppstädning

- Tasks-panelen på startsidan får samma kort-utseende och kategorifärger som Kanban, plus knapp till `/tasks`.
- Snyggare tomt läge: när ingen databas är vald länkas du direkt till inställningen istället för en grå text.
- Tydliga felmeddelanden när Notion svarar med fel (t.ex. sidan inte delad) istället för tyst tom lista.
- Kanban: fixar att drag-and-drop kan hoppa tillbaka, gör kolumnerna scrollbara på smal skärm och lägger till antal per kolumn.
- Notion-inställningarna under Sources: rensar bort resterna av den gamla enkel-databas-inställningen så gammal och ny konfiguration inte kan krocka igen.
- Sidladdning: tasks hämtas parallellt med kalendern och paginering läggs till så inget kapas vid fler än 100 tasks.

## Teknisk plan

- `src/lib/notion.functions.ts`: nya serverfunktioner `createNotionTask`, `updateNotionTask`, `archiveNotionTask` (alla med `requireSupabaseAuth`, via connector-gateway). Gemensam hjälpare som slår upp databasens properties (title/status/date/select/rich_text) och bygger rätt `properties`-payload. `loadDatabase` får paginering via `start_cursor` och cachning av databasschemat per anrop.
- `src/hooks/use-notion.ts`: `useCreateNotionTask`, `useUpdateNotionTask`, `useDeleteNotionTask` med optimistisk cache-uppdatering och rollback (återanvänder `useTaskCacheUpdater`).
- Ny `src/components/notion-task-dialog.tsx`: delad skapa/redigera-dialog (shadcn Dialog + Select + datumfält).
- `src/components/notion-kanban.tsx`: kortklick öppnar dialogen, `+` per kolumn, radera-knapp, kolumnräknare, horisontell scroll.
- `src/components/notion-tasks-panel.tsx`: "Ny task"-knapp, klickbara kort, delad kortkomponent.
- `src/routes/index.tsx`: byt villkoret `settings.notion?.databaseId` mot `notionDatabases(settings).length > 0`.
- `src/lib/quick-parse.ts` + `src/components/quick-add-bar.tsx`: känner igen `task:`-prefix och routar till Notion i stället för kalendern.
- `supabase/functions/assistant-chat/index.ts`: verktygen `create_notion_task`, `update_notion_task`, `preview_delete_notion_task`/`confirm_delete_notion_task` (borttagning bakom bekräftelse, i linje med övriga destruktiva verktyg).
- Inga databasändringar; konfigurationen ligger kvar i `user_settings.prefs.notion`.
