# Nästa steg — våg 2 och lite till

Våg 1 är byggd (ekonomiöversikt, CSV-export, konfliktvarningar, ⌘K-palett, inställningar, per-vy-filter). Här är vad jag föreslår härnäst, i den ordning jag skulle bygga det.

## 1. Riktiga återkommande serier

Idag skapas upprepningar som separata poster, vilket gör "flytta alla måndagar" tungt.

- Serie med regel (varje vecka/varannan vecka, till och med-datum) plus undantagsdatum.
- När du redigerar en instans får du välja: bara denna, denna och framåt, eller hela serien.
- Migrering av dagens dubblettposter till serier där mönstret är tydligt.

## 2. Veckoplaneringsvy (söndagsritual)

En egen vy som samlar: veckan som kommer, ologgade timmar från förra veckan, förväntad inkomst, och knappar för att logga det som saknas direkt i listan.

## 3. Proaktiv assistent

- Morgonsammanfattning som notis/mejl: dagens pass, första starttid, restidsvarning.
- "Du glömde logga fredagens pass"-nudge med en knapp som öppnar loggdialogen förifylld.
- Använder befintlig påminnelsekö och mejlinfrastrukturen.

## 4. Restid och reseblock

Plats på event + en ruttjänst ger automatiskt reseblock före pass med känd adress, och "du behöver åka 17:40" i påminnelsen.

## 5. Mobilpolering

Svepbar dag/vecka, större träffytor, en stor start/stopp-knapp för timern överst. Appen används mest i farten.

## 6. Delbar länk för DJ-spelningar

Publik, skrivskyddad sida med kommande spelningar som kan delas med bokare — bara datum, tid och plats, inget gage.

## 7. Historik och backup

Ångra-historik utöver senaste raderingen, plus export av all data (event, timmar, DJ-set) som JSON/CSV-backup.

## Tekniska noteringar

- Punkt 1 kräver ett schemaskifte: `event_series`-tabell plus undantag, och att expansionen i `use-calendar-data.ts` läser serier istället för dubbletter.
- Punkt 2 och 3 bygger på befintliga tabeller och påminnelsekön — ingen ny extern tjänst.
- Punkt 4 kräver en extern ruttjänst och koordinater på event.
- Punkt 6 kräver en läsregel som bara exponerar valda fält för kommande DJ-datum till anonyma besökare.

## Förslag

Börja med punkt 1 (återkommande serier) eftersom den påverkar allt annat, sedan 2 och 3 som paket. Säg till om du hellre vill peka ut egna favoriter — jag kan också bygga flera punkter i samma omgång.
