# Fixa mobilversionen utan att ändra desktop

## Vad jag hittade

Jag testade appen inloggad i en iPhone-vy med din riktiga kalenderdata och gick igenom Kalender, Källor, Inställningar, mini-timer, månad/vecka/dag, dagsdetaljer, nytt event, snabbinmatning och assistenten.

1. **Dagsvyn är faktiskt felbyggd på mobil.** Den visar fortfarande en sjudagars veckokalender och börjar på måndag, trots att bara vald dags event filtreras fram. Resultatet är att dagens kolumn ofta ligger utanför skärmen.
2. **Veckovyn är en 840 px bred desktopkalender inuti en 390 px skärm.** Den går att dra sidledes, men utan tydlig position eller mobilanpassning ser man bara ungefär tre dagar och tappar överblicken.
3. **Nytt-event-fönstret går bakom den fasta bottenmenyn.** De nedersta fälten och Spara/Avbryt kan döljas eller bli besvärliga att nå.
4. **Månadsvyn går att använda, men sju kolumner gör verkliga eventnamn nästan oläsliga.** Långa titlar från din data klipps korrekt och orsakar inte sidscroll; problemet är informationsmängden per cell.
5. **Dagsdetaljer fungerar**, men rubrik, totalsumma och knappen ligger för tätt på liten skärm. Samtidiga event kan också bli för smala att trycka på.
6. **Assistenten fungerar som bottenpanel**, men använder bara 80 % av höjden och hjälptexten tar onödigt utrymme. Tangentbordet riskerar därför att lämna för lite plats för konversationen.
7. **Tryckytor är för små på flera ställen**, framför allt kalenderfilter, mini-timerns toppikoner, färgval och vissa små eventkontroller.
8. **iPhones säkra nederkant hanteras inte.** Bottenmeny och flytande knappar kan hamna för nära hemindikatorn eller ovanpå innehåll.
9. **Källor och Inställningar håller sig inom skärmen**, men färgvalen är täta och långa importerade event/location-texter behöver bättre radbrytning.
10. **Det finns även ett fristående laddningsfel:** tema/zoom sätts före sidladdning och ger en återkommande mismatch-varning. Det är inte orsaken till layoutproblemen, men ska rättas eftersom det sker på varje sida.
11. **Din data förklarar en del av det visuella bruset, inte själva felet.** Långa eventtitlar är redan säkert avkortade. En gammal Outlook-kalender och en arkiverad Tiger-kalender syns fortfarande bland kalenderdata, men jag raderar eller ändrar ingen data i denna mobilfix.

## Vad jag ändrar

- Bygg en riktig **mobil dagsvy** med endast vald dag och hela skärmbredden; desktop fortsätter använda nuvarande vy.
- Gör **mobil veckovy** avsiktligt bläddringsbar med en tydlig, stabil mobilstart och mindre men tryckbara dagskolumner; desktopbehålls exakt från `md` och uppåt.
- Anpassa **månadsvyn på mobil** till datum, färgmarkörer och antal event, och öppna dagsdetaljer för fulla titlar. Desktop behåller sina eventrader.
- Ge eventformuläret full mobilhöjd, egen säker scroll och nederknappar som alltid går att nå ovanför bottenmenyn/tangentbordet.
- Stapla dagsdetaljernas rubrik och åtgärder på mobil och undvik otappbart smala överlappande event.
- Gör assistenten helskärmsstor på mobil, håll skrivfältet synligt med tangentbordet och dölj desktopinstruktioner som inte gäller touch.
- Lägg iPhone-safe-area på topp/botten där det behövs och flytta de två flytande knapparna så de inte kolliderar med bottenmenyn.
- Höj de viktigaste tryckytorna till mobilvänlig storlek utan att göra desktop större.
- Förbättra radbrytning för verkliga långa namn i importresultat och inställningsrader.
- Rätta tema/zoom-laddningen så varningen försvinner utan visuellt hopp.

## Verifiering

- Testa alla sidor igen vid **390 × 844** och en mindre iPhone-storlek.
- Kör huvudflödena: byta månad/vecka/dag, öppna en dag, skapa/redigera event, skriva i snabbinmatningen, öppna/ladda upp i assistenten, ändra färg och inställning samt starta timer.
- Kontrollera lång verklig eventdata, tangentbordsläge, porträttläge, sidscroll, bottenmeny och tryckytor.
- Jämför desktop före/efter och säkerställ att ändringarna bara aktiveras under mobilbrytpunkten.
- Kontrollera att appen bygger utan fel och att inga nya fel syns i webbläsaren.
