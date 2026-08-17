# Tasks sorterade per jobb — A-hub, Mannaz, Personligt

Du ska kunna pumpa in tasks i Notion precis som idag, utan att ändra ditt system. One läser av vilket jobb varje task hör till, och allt som inte matchar hamnar under Personligt.

## 1. Flera Notion-databaser

Idag kan bara **en** databas väljas, så dina personliga tasks syns inte. Under Sources blir det en lista där du kan lägga till flera databaser (t.ex. Work och Personal). Varje databas kan få en valfri standardkategori — sätter du "Personligt" på din personliga databas hamnar allt därifrån rätt direkt, utan gissning.

Alla databaser hämtas parallellt och slås ihop till en lista i appen. Kanban, panelen på startsidan och 15-sekunders-uppdateringen fungerar som idag.

## 2. Automatisk sortering till jobb

Varje task får en kategori i den här ordningen — första träffen vinner:

1. **Manuell override** i appen (du klickar på ett kort och väljer jobb — sparas i One, inte i Notion).
2. **Notion-signaler:** en select/multi-select/relation/tagg vars värde matchar ett jobbnamn eller alias, samt `#taggar` i titeln.
3. **Nyckelord i titel:** t.ex. "a-hub", "ahub", "mannaz", "praktik", "skola", "kth", "dj", "gig".
4. **Fallback:** Personligt.

Kategorierna kommer från dina kalenderkällor (Mannaz, A-hub, Personligt, Skola, DJ), så listan följer automatiskt med om du lägger till en källa. Aliaslistan är redigerbar under Sources: en rad per jobb där du skriver kommaseparerade ord appen ska känna igen. Matchningen är skiftlägesokänslig och ignorerar bindestreck/mellanslag, så "A-Hub", "ahub" och "A hub" är samma sak.

## 3. Vyn på /tasks

- Filterchips ovanför kanban-tavlan: **Alla · Mannaz · A-hub · Personligt · …**, med antal per jobb. Chipsen använder samma färger som kalenderkällorna.
- Kanban-kolumnerna förblir statuskolumner; chipsen filtrerar korten.
- Varje kort får en liten färgprick + jobbnamn, och en meny där du kan byta jobb manuellt (skapar en override).
- Kort som gissats (inte manuellt satta) markeras diskret så du ser vad appen antagit.
- Panelen på startsidan får samma färgprick och respekterar valt filter om ett är aktivt.

## Teknisk plan

- `use-settings.ts`: `notion` blir `notion.databases: NotionDbConfig[]` (id + prop-mappning + `defaultCategory`), plus `notion.categoryAliases: Record<string, string[]>` och `notion.overrides: Record<pageId, categoryKey>`. Migrering i läsläget: finns gamla `notion.databaseId` konverteras den till ett element i arrayen, så inget går sönder.
- `src/lib/notion.functions.ts`: `listNotionTasks` tar en array av databaskonfigurationer, hämtar dem parallellt, taggar varje task med `dbId`/`dbName` och returnerar även select/multi-select/relation-värden per task (`tags: string[]`) för kategorisering. Statusoptioner slås ihop per namn.
- Ny `src/lib/task-category.ts`: ren funktion `categorize(task, aliases, overrides, dbDefault)` med prioritetsordningen ovan + normalisering. Enhetstestbar utan nätverk.
- `src/hooks/use-notion.ts`: bygger kategorier från `useCalendars()` (namn + färg), applicerar `categorize` på resultatet, exponerar `useSetTaskCategory()` som skriver override till settings.
- `src/components/notion-kanban.tsx`: chip-rad, filter-state, färgprick och kategorimeny på korten.
- `src/components/notion-settings.tsx`: lista med flera databaser (lägg till/ta bort), standardkategori per databas, aliasredigering per jobb.
- `src/components/notion-tasks-panel.tsx`: färgprick + respekterar filter.
- Inga databasändringar — allt ligger i `user_settings.prefs.notion`.
