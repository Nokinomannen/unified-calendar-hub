# Genomgång: gör Mac-appen felfri att ladda ner och minst lika bra som webben

Kontroll av nuläget: båda zip-filerna finns och är kompletta, den publicerade adressen svarar (200) och även `/mini-timer` svarar, och typsnitten bundlas lokalt (`@fontsource-variable`) så de renderas i appen utan nätberoende. Grunden är alltså på plats — nedan är det som saknas för att nedladdning och daglig användning ska bli helt smärtfri.

## 1. Nedladdning och första start

- **Ad-hoc-signera appbundlen** vid paketering så macOS slutar säga "One är skadad och bör flyttas till papperskorgen". Idag kräver det att du kör `xattr -cr` i Terminal, vilket är den vanligaste anledningen att en osignerad app känns "trasig".
- **Ta bort karantänflaggan i zip-steget** genom att zippa med bevarade attribut, så första start blir högerklick → Öppna och inget mer.
- **Verifiera paketen efter bygget**: packa upp båda, läs `Info.plist` (arkitektur, bundle-id, ikon), och bekräfta att `One.app` startar utan felmeddelanden i loggen.

## 2. Robusthet i appen

- **Single instance lock** — idag kan appen startas två gånger och skapa två menyradsikoner och två timerfönster. Andra instansen ska istället fokusera den befintliga.
- **Offlineläge** — om nätet ligger nere visar appen just nu Chromiums felsida. Ersätts med en enkel svensk "ingen anslutning"-vy med Försök igen-knapp, plus automatiskt omförsök när nätet kommer tillbaka.
- **Kom ihåg huvudfönstrets storlek och position** mellan starter, precis som mini-timern redan gör.
- **Startskärm** medan sidan laddar, så fönstret inte blinkar tomt/svart.

## 3. Lika bra som webben — och bättre

- **App-meny på macOS** med rätt svenska poster: Ladda om, Zooma in/ut, Fullskärm, Göm, Avsluta — och fungerande Klipp/Kopiera/Klistra in i chatten och formulär.
- **Notiser** — påminnelserna som funkar i webbläsaren ska begära och använda macOS systemnotiser i appen, med klick som öppnar rätt dag i kalendern.
- **Dock-ikon och menyrad i samklang** — badge på dock-ikonen när timern går, och timern fortsätter synas i menyraden när fönstret är stängt (redan implementerat, verifieras).
- **⌘⇧T** och övriga snabbkommandon testas i praktiken efter bygget.

## 4. Leverans

Nya zip-filer för Apple Silicon och Intel byggs om med allt ovan, verifieras, och läggs som nedladdningar i chatten tillsammans med en kort installationsinstruktion på svenska.

## Tekniska detaljer

- `electron/main.cjs`: `app.requestSingleInstanceLock()`, `did-fail-load` → lokal `offline.html`, `Menu.setApplicationMenu` med svensk mall, fönsterstate i befintlig `window-state.json`, `show: false` + `ready-to-show`, `app.dock.setBadge`.
- Notiser: `Notification` från renderern funkar redan via Electron; kopplas till befintlig `use-reminders`-logik utan ändring i backend eller schema.
- Paketering: `@electron/packager` med `--osx-sign` i ad-hoc-läge (`identity: "-"`) alternativt `codesign --force --deep --sign -` efter bygget, sedan `ditto -c -k --keepParent` för zip istället för vanlig zip.
- Kalenderdata, timerlogik, databas och webbappens beteende rörs inte.
