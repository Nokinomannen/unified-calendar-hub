# Bättre snabbinmatning + fler inställningar

## Buggen först: fel kalender i Quick Add

Snabbraden gissar alltid "personal" som standardkalender — men ingen av dina kalendrar har den källan (A-hub och Mannaz är `job`, DJ och Personal är `manual`, School är `school`). Fallbacken blir därför den första kalendern i listan, ofta School. Dessutom känns bara `@a-hub`/`#a-hub` igen som kalenderledtråd, inte vanlig text som "a-hub" eller "mannaz".

Fixar:
- Matcha kalendernamn direkt i texten (a-hub, ahub, mannaz, dj, skola/school, personligt) utan att `@` krävs, och plocka bort ordet ur titeln.
- Alias per kalender som du själv kan redigera (t.ex. "jobb" → Mannaz, "gig" → DJ).
- Standardkalender blir en inställning du väljer, inte en gissning.
- Kalenderväljare direkt i snabbraden: en liten färgprick du kan klicka/pila mellan innan du trycker Enter, så du alltid ser vart eventet hamnar.
- Bättre parsning: "13-15", "kl 9", "imorgon", "nästa fredag", "1,5h", plus plats efter "på/@plats" och heldag ("heldag", "hela dagen").

## Ny inställningssida

Idag ligger inställningar utspridda på Sources. Jag samlar dem i en egen **Inställningar**-sida (nås även via ⌘K) med sektioner:

- **Kalendrar** — namn, färg, timlön, alias för snabbraden, arkivera/återställa, dölj i vyn.
- **Snabbrad** — standardkalender, standardlängd (30/45/60 min), avrundning av starttid, om raden ska visas.
- **Utseende** — tema (ljus/mörk/system), zoom, kompakt vs luftig täthet, veckostart (mån/sön), 24h-format, om helger ska visas, tidsintervall i veckovyn.
- **Kalendervy** — standardvy (dag/vecka/månad), synligt tidsspann (t.ex. 07–23), visa väder, visa konflikter.
- **Tid & pengar** — valuta, skattesats för uppskattning, målsatta timmar per vecka, om DJ-arvoden ska räknas in i prognosen.
- **Påminnelser** — befintliga inställningar flyttas hit oförändrade.
- **Data** — export (CSV/ICS), nyligen borttaget, rensa gamla mjukraderade event.

Allt sparas per användare så det följer med mellan webb och Mac-appen.

## Fler förbättringar

- **Tangentbord**: `N` nytt event, `T` idag, `1/2/3` dag/vecka/månad, `Q` fokusera snabbraden, `⌘K` palett.
- **Snabbrads-förhandsvisning** visar kalender, tid, längd och varning vid krock innan du trycker Enter.
- **Mallar**: spara ett event som mall (t.ex. "Standup 14:30–15 A-hub") och lägg till med ett klick.

## Tekniskt

- Ny tabell `user_settings` (en rad per användare, jsonb för preferenser) med RLS och GRANTs; hook `use-settings.ts` med optimistisk uppdatering.
- Nya kolumner på `calendars`: `aliases text[]`, `hidden boolean`.
- `src/lib/quick-parse.ts` utökas med kalendermatchning (namn + alias), plats, heldag och konfigurerbar standardlängd; `quick-add-bar.tsx` får kalenderväljare och krockvarning.
- Ny route `src/routes/settings.tsx` som återanvänder `calendar-colors.tsx`, `reminder-settings.tsx`, `recently-deleted.tsx` och `export-hours.tsx`.
- Vy-, tema- och zoominställningar läses från `user_settings` med nuvarande localStorage som fallback.

Kalendervyn, eventaggregeringen och tidsregistreringen rörs inte i övrigt.
