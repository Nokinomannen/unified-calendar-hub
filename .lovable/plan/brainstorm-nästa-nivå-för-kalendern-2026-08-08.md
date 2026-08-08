# Brainstorm: nästa nivå för kalendern

En genomgång av vad appen redan gör bra och var det finns mest att hämta. Idéerna är sorterade i vågor — du väljer vilka som ska byggas.

## Var appen står idag

Kalender (månad/vecka/dag), källor med färger, timer med paus, faktiska timmar vs schema, DJ-spelningar som egen källa med tvåvägssynk, lön/intäkter, AI-assistent med skärmdumpsimport och bekräftelsesteg, dashboard, påminnelser med notiser och mejl, mörkt läge, zoom, Electron-skal.

## Våg 1 — störst nytta per krona

1. **Ekonomiöversikt per månad**
   Prognos ("du ligger på X kr i augusti, Y kr om alla pass hålls"), fördelning per källa, jämförelse mot förra månaden, och en enkel skatt/nettouppskattning. Bygger på timmar och timpriser som redan finns.

2. **Fakturaunderlag / export**
   Markera en period och exportera timmar per arbetsgivare som PDF eller CSV — särskilt för A-hub och DJ-gager. Sparar tid varje månad.

3. **Konflikt- och luckdetektor**
   Varning direkt när ett nytt event krockar med ett befintligt, och "du har 3 h ledigt mellan skolan och passet". Visas i kalendern och när assistenten föreslår en tid.

4. **Sökning och kommandopalett (Cmd+K)**
   Sök på titel, plats, källa, datumintervall. Hoppa till datum, byt vy, starta timer, logga timmar — allt från tangentbordet.

## Våg 2 — smartare vardag

5. **Återkommande events på riktigt**
   Serier med undantag ("alla måndagar, utom 14 sep"). Redigera en instans eller hela serien. Idag skapas upprepningar som separata poster.

6. **Restid och reseblock**
   Automatiskt reseblock före pass med känd plats, plus "du behöver åka 17:40" i påminnelsen.

7. **Veckoplaneringsritual**
   En söndagsvy: veckan som kommer, olo­ggade timmar från förra veckan, förväntad inkomst, och en knapp för att fixa allt som saknas.

8. **Assistenten blir proaktiv**
   Daglig sammanfattning på morgonen och en "du glömde logga fredagens pass"-nudge — via notis eller mejl, med knappar för att åtgärda direkt.

## Våg 3 — polering och räckvidd

9. **Mobilupplevelse**
   Svepbar dag/vecka, större träffytor, snabbknapp för start/stopp av timer. Appen används mest i farten.

10. **Delbar länk för spelningar**
    Publik, skrivskyddad sida för kommande DJ-datum som kan delas med bokare.

11. **Riktig kalendersynk**
    Läsning från Google/iCloud så att externa möten dyker upp bredvid dina egna källor.

12. **Historik och trygghet**
    Ångra-historik utöver senaste raderingen, samt export av all data som backup.

## Tekniska noteringar

- Våg 1 kräver inga nya externa tjänster; punkt 1, 2 och 3 bygger på befintliga tabeller för events, arbetsloggar och DJ-spelningar.
- Återkommande serier (punkt 5) kräver ett schemaskifte: en serietabell plus undantag, och migrering av dagens duplicerade poster.
- Restid (punkt 6) kräver en extern ruttjänst och platskoordinater på events.
- Kalendersynk (punkt 11) kräver OAuth per konto och en synkloop på serversidan — den största enskilda insatsen i listan.
- Publik delningssida (punkt 10) kräver en läsregel som bara exponerar valda fält för kommande DJ-datum.

## Förslag

Börja med våg 1 i ordningen ekonomiöversikt, konfliktdetektor, kommandopalett, fakturaexport. Säg till om du hellre vill peka ut egna favoriter ur listan.
