# Separata task-tavlor + tasklistan som toggle i kalendern

## 1. Work och Personal blir egna tavlor

Idag slås alla Notion-databaser ihop till en enda kanban, och statuskolumnerna från båda databaserna blandas. Eftersom Work Tasks nu bara har **To Do · Someday · Done** och Personal Tasks har **To Do · In Progress · Done** blir tavlan rörig och kolumner dyker upp som inte hör hemma i den databasen.

Ändring på `/tasks`:

- En rad med tavlor högst upp: **Work Tasks · Personal Tasks · (fler databaser du lägger till) · Alla**. Standard är den första databasen.
- När en tavla är vald visas **bara den databasens egna statuskolumner** — Work får To Do / Someday / Done, Personal får To Do / In Progress / Done. Ingen sammanslagning.
- "Alla" behåller dagens beteende (ihopslagen vy) för den som vill se allt på en gång.
- Drag-and-drop, "Ny task", redigera och arkivera funkar per tavla och skriver till rätt databas.
- Jobbfilter-chipsen (Mannaz, A-hub, Personligt …) ligger kvar och filtrerar inuti vald tavla.
- Antal per kolumn och tavla visas som idag.

## 2. Tasklistan i kalendervyn blir en toggle

På startsidan ligger task-panelen ovanför kalendern och trycker ner den, så du måste scrolla.

Ändring på startsidan:

- Task-panelen flyttas **under** kalendern istället för ovanför, så kalendern syns direkt.
- En liten knapp i topraden ("Tasks") slår av/på panelen direkt i vyn — inget behov av att gå in i Settings. Valet sparas i dina inställningar (`showTasks`), så det ligger kvar mellan besök och även i desktop-appen.
- Panelen är ihopfälld som standard om du stänger av den; ingen data hämtas i onödan när den är dold.

## Teknisk plan

- `src/lib/notion.functions.ts`: `listNotionTasks` returnerar redan `databases`-metadata; utöka så att statusoptioner följer med **per databas** (`databases[].statusOptions`) utöver den sammanslagna listan.
- `src/components/notion-kanban.tsx`: ny `activeDb`-state (default första databasen), tavelväljare, kolumner byggs från vald databas statusoptioner, filtrering av tasks på `dbId`. `Alla`-läget använder befintlig sammanslagen logik.
- `src/hooks/use-notion.ts`: exponera per-databas statusoptioner; ingen ändring i pollning eller kategorisering.
- `src/routes/index.tsx`: flytta `<NotionTasksPanel />` under kalendergriden och lägg till en toggle-knapp i toppraden som skriver `showTasks` via `useUpdateSettings`.
- Inga databas- eller Notion-schemaändringar.
