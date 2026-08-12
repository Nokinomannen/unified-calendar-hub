# Notion-tasks i One

Koppla din egen Notion-workspace till kalendern så att dina tasklists syns direkt i appen — i en panel på startsidan och på en egen sida `/tasks`. Du kan bocka av tasks härifrån, och ändringen skrivs tillbaka till Notion.

## Så funkar det för dig

1. Du kopplar Notion en gång via ett kort i chatten (OAuth) och väljer vilka sidor/databaser appen får se.
2. Under **Sources** väljer du vilken/vilka Notion-databaser som är dina tasklists, och mappar fälten: titel, status/checkbox, datum, prioritet.
3. Tasks visas i:
   - **Tasks-panel** på startsidan (bredvid Kommande/Timmar) — det som är försenat, idag och närmaste dagarna.
   - **Egen sida `/tasks`** med alla tasks, filter (öppna/klara/förfallna) och gruppering per databas.
4. Datan hämtas vid sidladdning och uppdateras automatiskt var 60:e sekund, plus en manuell refresh-knapp.
5. Klickar du i checkboxen markeras tasken som klar i Notion direkt (optimistiskt, med rollback om Notion nekar).

Inget skrivs in i kalenderdatabasen — Notion förblir sanningen. Tasks blir alltså inte events, de visas som en egen lista (går att lägga till senare om du vill).

## Teknisk plan

**Koppling**
- Notion App Connector via `standard_connectors--connect` (connector_id `notion`). Ger `NOTION_API_KEY` i servermiljön; alla anrop går genom Lovable connector-gateway (`/notion/v1/...`) från serverfunktioner — aldrig från klienten.

**Serverfunktioner** (`src/lib/notion.functions.ts`, alla med `requireSupabaseAuth`)
- `listNotionDatabases` — `POST /v1/search` filtrerat på `data_source`/`database`, för databasväljaren i Sources.
- `getNotionDatabaseSchema` — hämtar properties så fältmappningen kan visa riktiga fältnamn.
- `listNotionTasks` — frågar valda databaser (`POST /v1/databases/{id}/query`, med paginering), normaliserar till `{ id, title, done, dueDate, priority, url, databaseId }`.
- `setNotionTaskDone` — `PATCH /v1/pages/{id}` som sätter status/checkbox enligt mappningen.
- Alla svar felhanteras med status + body från gateway och surfas i UI:t (t.ex. "sidan är inte delad med integrationen").

**Konfiguration**
- Sparas i befintliga `user_settings.prefs` under nyckeln `notion`: `{ databases: [{ id, name, titleProp, statusProp, statusDoneValue, dateProp, priorityProp }] }`. Ingen ny tabell behövs.

**Klient**
- `src/hooks/use-notion.ts` — React Query: `useNotionTasks()` med `refetchInterval: 60_000` och `refetchOnWindowFocus`, samt `useToggleNotionTask()` med optimistisk uppdatering.
- `src/components/notion-tasks-panel.tsx` — kompakt panel, rendreras på startsidan och styrs av en ny `showTasks`-inställning i `use-settings.ts`.
- `src/routes/tasks.tsx` — full vy med filter, gruppering och länk till Notion-sidan. Egen `head()` med titel/description.
- `src/components/notion-settings.tsx` — databasval + fältmappning, placeras i Sources bredvid `CalendarColorSettings`.
- Navigation: `Tasks` läggs till i `AppShell` och i kommandopaletten.

**Avgränsningar i denna omgång**
- Endast läsning + bocka av (inga nya tasks skapas från appen).
- Inga webhooks; uppdatering sker via polling var 60:e sekund.
- Tasks blir inte kalender-events.
