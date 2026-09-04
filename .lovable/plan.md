# Outlook-kalendrar in i One — utan Entra ID

Den ursprungliga vägen krävde att du registrerar en egen app i Microsoft Entra — det behövs inte. Lovable har en färdig Microsoft-koppling där Lovable själva står för appregistreringen. Du loggar bara in med varje Microsoft-konto, som att logga in på vilken app som helst.

## Så funkar det för dig

1. På **Sources**-sidan finns en ny sektion "Outlook-konton" med knappen **Koppla Outlook-konto**.
2. Ett inloggningsfönster öppnas → du loggar in med Microsoft och godkänner att One läser kalendern. Upprepa för varje konto (upp till 3).
3. Varje konto blir en egen kalenderkälla i One med egen färg, och kan visas/döljas med chipsen på startsidan precis som Mannaz/A-hub/Personal.
4. Events hämtas automatiskt när du öppnar appen och var 15:e minut, plus en "Synka nu"-knapp per konto. Envägs: ändringar görs i Outlook, One speglar dem.
5. Du kan koppla bort ett konto när som helst; dess events försvinner ur One (ingenting rörs i Outlook).

**Företagskontona** (där inloggning utanför jobbdatorn är låst): de fortsätter via screenshot-flödet. Om du senare hittar "Publicera kalender" i Outlook Web på jobbet får du en länk du kan klistra in i One — det bygger jag in stöd för direkt, så det är klart den dagen du hittar en länk.

## Vad som byggs

- **Lovable-kopplingen för Microsoft Outlook** länkas till projektet, tre gånger (en per konto) — varje koppling får sin egen hemliga nyckel på servern. Du godkänner i ett kort här i chatten.
- **Tabell `outlook_accounts`**: kontots e-post, vilken hemlig nyckel som hör till, kopplad kalender i One, senast synkad. Server-only.
- **Serverfunktioner**: lista konton, synka ett konto, koppla från. Alla anrop till Microsoft sker på servern via Lovables gateway — inga tokens i webbläsaren.
- **Import till events**: hämtar ett rullande fönster (30 dagar bakåt, 180 framåt) och sparar/uppdaterar rader i `events` med Outlooks event-id så inget dubbleras. Borttagna events i Outlook markeras borttagna i One. Tider i UTC, heldags- och återkommande events hanteras.
- **ICS-länkstöd**: ett fält på Sources där du kan klistra in en publicerad Outlook-kalenderlänk; One prenumererar och uppdaterar varje timme. För företagskontona den dagen du kan dela dem.
- **Skydd**: Outlook-events är skrivskyddade i UI:t (redigera i Outlook), märkta med kontots färg.

## Teknisk detalj

- Gateway-anrop: `https://connector-gateway.lovable.dev/microsoft_outlook/me/calendarView?startDateTime=…&endDateTime=…` med `LOVABLE_API_KEY` + kontots `MICROSOFT_OUTLOOK_API_KEY*` (läses i server-handlers).
- Tre kopplingar av samma typ får unika hemlighetsnamn (`..._API_KEY`, `..._API_KEY_2`, `..._API_KEY_3`); `outlook_accounts.secret_env` pekar ut rätt.
- ICS-parsing på servern (`ical`-liknande parser, RRULE-expansion finns redan i appen).
- Befintlig funktionalitet (timer, Notion, DJ-sets, påminnelser, desktop-appen) rörs inte.
