# Ny dagsvy med Dagens fokus

## Vad du får
När du klickar på en dag öppnas en mer överskådlig dagsvy, i den här ordningen:

1. **Dagsöversikt** – första och sista eventet, total bokad tid, antal events och lediga luckor (t.ex. "Ledigt 10:30–13:00").
2. **Dagens fokus** – en kort lista med saker du vill få gjort den dagen. Lägg till med Enter, bocka av, ta bort.
   - **Skicka till Notion**: en liten knapp som lägger in punkten som en vanlig kryssruta i to-do-listan på din Work-sida (inte som en stor task).
   - **Hämta från Notion**: en knapp som hämtar okryssade punkter från Work-listan in till dagens fokus. Redan hämtade/skickade punkter dubbleras inte.
   - **Flytta ofärdigt till imorgon**: ett klick flyttar allt som inte är avbockat till nästa dag.
3. **Anteckning för dagen** – fritt textfält som sparas automatiskt. Knappen **Skicka till Reflektioner** lägger in texten med datum som rubrik på din Reflektioner-sida i Notion.
4. **Events** – tidslinjen som idag, med "Add event".

Fungerar på både dator och mobil. Inget hämtas i bakgrunden: Notion anropas bara när du trycker på en knapp, så det kostar inga extra credits.

## En sak att lösa först
Lovable syns som kopplad i din Notion, men kopplingen appen använder ser fortfarande inte Work eller Reflektioner (den hittar andra sidor, t.ex. Workshop-sidan). Troligen är Lovable delad med en annan sida i trädet än just dessa. Första steget i bygget: jag testar igen, och om sidorna fortfarande saknas ber jag dig öppna Work och Reflektioner direkt → "..." → **Connections** och bekräfta att **Lovable** står där (inte bara på en sida ovanför). Allt annat i dagsvyn byggs oavsett.

## Tekniska detaljer
- Ny tabell `day_focus` (id, user_id, date, text, done, position, notion_block_id, created_at) och `day_notes` (user_id, date, content, notion_block_id, updated_at), med RLS per användare och grants.
- Ny `src/lib/day-focus.functions.ts` (requireSupabaseAuth + Notion-gatewayn, samma mönster som `notion-inbox.functions.ts`):
  - `sendFocusToNotion` – appendar ett `to_do`-block på Work-sidan (`3df2c3c0-f254-8100-9a7e-f180b3d3830f`), sparar blockets id på raden.
  - `pullFocusFromNotion` – läser `to_do`-block (okryssade), hoppar över de vars block-id redan finns, skapar rader för valt datum.
  - `sendNoteToReflections` – appendar rubrik med datum + stycke på Reflektioner-sidan (`4042c3c0-f254-8089-8a42-debcd06305b9`).
  - Bocka av i One uppdaterar även Notion-blocket om punkten är länkad.
- Ny hook `use-day-focus.ts` (React Query, hämtas bara när dagsvyn är öppen, optimistiska uppdateringar).
- `src/components/day-drawer.tsx` byggs om med sektionerna ovan; luckberäkning som ren funktion med ett litet test.
