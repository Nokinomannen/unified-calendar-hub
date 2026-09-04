# Fixa Outlook-kopplingen + få in den i Mac-appen

## Vad felet beror på

Jag testade dina två Microsoft-kopplingar direkt. Båda är länkade till projektet, men de gav godkännande bara för **e-post** (Mail), inte för **kalender**. Därför svarar Microsoft "401 – inte behörig" när One frågar efter kontot, och knappen "Hitta kopplade konton" kan inte göra något.

Kontrollerat: kopplingens godkända behörigheter är Mail.Read / Mail.ReadWrite / Mail.Send. Kalenderbehörighet saknas helt.

## Så fixar vi det

1. **Du godkänner om kopplingen med kalenderbehörighet.** Jag öppnar ett kort här i chatten per konto; du loggar in med Microsoft och godkänner "Läs dina kalendrar". Tar ~20 sekunder per konto.
2. **Jag ändrar hur One identifierar kontot.** Idag frågar den efter din profil (kräver en behörighet vi inte har). Istället läser den kalenderns ägare, som ingår i kalenderbehörigheten — då funkar "Hitta kopplade konton" direkt.
3. **Dubbletter blir inga problem.** Är de två kopplingarna samma konto upptäcker One det på e-postadressen och skapar bara en kalender — den andra kopplingen ligger kvar oanvänd tills du lägger till ett nytt konto. Du behöver inte ta bort något.
4. **Tydligare felmeddelande** än "svar 401": om behörighet saknas står det rakt ut att kontot behöver godkännas om.
5. **Mac-appen:** den visar exakt samma sak som webben, så när allt är på plats publicerar jag projektet — då dyker Outlook-kalendern upp i appen på skrivbordet också, utan ny nedladdning.

## Teknisk detalj

- `standard_connectors--reconnect` på båda `microsoft_outlook`-kopplingarna med `required_scopes: ["Calendars.Read"]` (behåll befintliga Mail-scopes).
- I `claimOutlookConnections` (`src/lib/outlook.functions.ts`): byt `/me?$select=...` mot `/me/calendar?$select=owner,name` och läs `owner.address` / `owner.name`; fall tillbaka på kopplingens namn om ägaren saknas.
- Dedupe på `email` mot befintliga rader i `outlook_accounts` innan ny kalender skapas.
- Mappa 401/403 från gatewayen till ett läsbart meddelande i UI:t.
- Ingen ändring av synklogik, ICS-stöd, timer, Notion eller övrigt.
