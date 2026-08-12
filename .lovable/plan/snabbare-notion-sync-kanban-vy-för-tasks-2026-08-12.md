# Snabbare Notion-sync + kanban-vy för Tasks

Två saker: tasks ska kännas "direkt" när du ändrar i Notion, och `/tasks` blir en kanban-tavla du faktiskt kan jobba i istället för en enkel lista.

## 1. Nära realtid istället för varje minut

Notion skickar inte webhooks till oss via kopplingen vi använder, så äkta push är inte möjligt här. Istället bygger vi det som känns direkt i praktiken:

- Polling var 15:e sekund när Tasks-fliken/panelen är synlig och fönstret är aktivt; pausas helt när fliken ligger i bakgrunden (ingen onödig belastning).
- Omedelbar refetch när du växlar tillbaka till appen (window focus / visibility change) — kommer du från Notion syns ändringen direkt.
- Billig ändringskoll: servern frågar Notion sorterat på `last_edited_time` och returnerar en signatur; ändras inget skickas ingen ny render.
- Optimistiska uppdateringar redan vid klick i appen, med rollback om Notion nekar.
- Liten "Uppdaterad för X sek sedan"-indikator + manuell refresh.

Om du senare vill ha äkta push går det att lägga till en Notion-automation som pingar en publik endpoint i appen — det kan bli en senare omgång.

## 2. Kanban på /tasks

`/tasks` blir en tavla:

- En kolumn per statusvärde i din Notion-databas (t.ex. Not started / In progress / Done), i Notions egen ordning.
- Kort visar titel, deadline (försenat i rött, "Idag" markerat), prioritet och länk till Notion.
- Dra-och-släpp mellan kolumner skriver tillbaka status till Notion direkt, optimistiskt.
- Sortering inom kolumn: deadline först, sedan prioritet.
- Filterrad: sök, "bara mina förfallna", visa/dölj Done-kolumnen.
- Är statuskolumnen en checkbox får du två kolumner: Öppna / Klara.
- Fungerar på smal skärm: kolumnerna scrollar horisontellt.

Startsidans kompakta panel behålls som lista (den ska vara tät), men får samma snabba uppdatering.

## Teknisk plan

- `src/lib/notion.functions.ts`: `listNotionTasks` returnerar även `statusOptions` (namn + färg + ordning) och `lastEditedMax`; ny `setNotionTaskStatus` som sätter valfritt statusvärde (status/select/checkbox) istället för bara done/inte done. Query får `sorts: [{ timestamp: "last_edited_time", direction: "descending" }]`.
- `src/hooks/use-notion.ts`: `refetchInterval` blir dynamisk (15 s aktiv flik, `false` i bakgrunden via `document.visibilityState`), `refetchOnWindowFocus: true`, `structuralSharing` så oförändrad data inte triggar omrendering. Ny `useSetNotionTaskStatus()` med optimistisk cache-uppdatering och rollback.
- Ny `src/components/notion-kanban.tsx`: kolumner från `statusOptions`, dnd via HTML5 drag events (inget nytt beroende), kortkomponent delad med panelen.
- `src/routes/tasks.tsx`: renderar kanban i full bredd, behåller egen `head()`.
- `src/components/notion-tasks-panel.tsx`: byter till nya mutationen, lägger till senast-uppdaterad-indikator.
- Inga databasändringar; konfigurationen ligger kvar i `user_settings.prefs.notion`.
