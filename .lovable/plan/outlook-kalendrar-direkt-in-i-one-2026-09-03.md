# Outlook-kalendrar direkt in i One

Mål: koppla upp till 3 Outlook-konton med inloggning i appen, så deras events dyker upp automatiskt i kalendern. Envägs — One läser från Outlook, ändringar görs i Outlook.

## Så funkar det för dig

1. Ny sektion "Outlook-konton" på **Sources**-sidan med tre platser att koppla.
2. Du klickar "Koppla konto", ett litet inloggningsfönster öppnas, du loggar in med Microsoft och godkänner läsning av kalendern.
3. Varje kopplat konto blir en egen kalenderkälla i One med egen färg, precis som Mannaz/A-hub/Personal — och kan visas/döljas med chipsen på startsidan.
4. Events hämtas när du öppnar appen och därefter var 15:e minut. Det finns även en "Synka nu"-knapp per konto.
5. Du kan koppla från ett konto när som helst; då försvinner dess events ur One (inget rörs i Outlook).

Företagskontona som inte kan logga in: de fortsätter tills vidare via screenshot-flödet i chatten. Om du senare hittar en publicerad kalenderlänk i Outlook Web kan vi lägga till den som en fjärde källa — det är en liten separat insats.

## Vad som byggs

- **App User Connector för Microsoft Outlook** kopplas till projektet (kräver ett godkännande-kort från dig, plus att Microsoft-appen tillåter både jobb- och privatkonton).
- **Tre kontoplatser.** Gatewayen binder en anslutning per konto-id, så varje plats får ett eget härlett id (`<ditt användar-id>:outlook-1/2/3`). Det gör att tre olika Microsoft-konton kan leva sida vid sida.
- **Ny tabell `outlook_accounts`** (server-only): plats-nummer, kontots e-post, krypterad anslutningsnyckel, kopplad kalender, senast synkad. Nyckeln lagras krypterad, aldrig i klartext, och läses bara av serverkod.
- **Serverfunktioner**: starta inloggning, slutföra inloggning (byta engångskod mot nyckel), lista konton, koppla från, samt en hämtningsfunktion som läser Outlook-kalendern.
- **Import till events**: hämtar ett rullande fönster (30 dagar bakåt, 180 framåt) via Microsoft Graph `calendarView`, och sparar/uppdaterar rader i `events` med `source = outlook` och Outlooks event-id, så samma event aldrig dubbleras. Events som tagits bort i Outlook markeras som borttagna i One. Tider sparas i UTC som resten av appen; heldagsevents och återkommande serier hanteras via de expanderade instanserna Graph returnerar.
- **Skyddsräcken**: Outlook-events är skrivskyddade i UI:t (går inte att redigera/ta bort i One, eftersom synken är envägs) och märks med kontots färg.

## Teknisk detalj

- Scopes: `openid profile email offline_access Calendars.Read`, `prompt: select_account` och `domain_hint: none` så du kan välja mellan jobb- och privatkonto.
- Alla Graph-anrop sker i `createServerFn`-handlers via `callAsAppUser`; inga tokens når webbläsaren.
- Inloggningen sker i popup med redirect-flöde; engångskoden växlas in server-side och nyckeln krypteras med projektets befintliga krypteringsnyckel.
- Synk-loop: klientsidig fråga var 15:e minut mot en serverfunktion som gör upsert på `events` (unikt index på `source_event_id` + kalender).
- Befintlig funktionalitet (timer, Notion, DJ-sets, påminnelser, desktop-appen) rörs inte.
