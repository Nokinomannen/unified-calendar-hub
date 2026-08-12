# One — Mac-app

En riktig desktopapp: hela kalendern i ett fönster, en flytande mini-timer som
alltid ligger överst, och en ikon i menyraden som visar tiden medan du jobbar.

## Installera (macOS)

1. Ladda ner zip-filen som matchar din Mac:
   - **One-mac-appleSilicon-v3.zip** — M1/M2/M3/M4 (Apple-menyn → Om den här datorn → "Chip: Apple ...")
   - **One-mac-intel-v3.zip** — äldre Intel-Mac
2. Dubbelklicka på zip-filen i Hämtade filer. Du får en mapp med `One.app`
   och `Installera One.command`.
3. Dubbelklicka på **Installera One.command**. Blockerar macOS den:
   högerklicka → Öppna → Öppna, eller Systeminställningar → Integritet och
   säkerhet → "Öppna ändå".
4. Skriv ditt datorlösenord när rutan dyker upp. Skriptet tar bort karantänen,
   signerar appen lokalt, lägger den i Program och startar den.
   Säger du nej till lösenordet installeras den i stället i `~/Applications`.
5. Logga in en gång i huvudfönstret. Sessionen sparas.

Ingen Terminal-kommandon behövs. (Manuell nödlösning om du vill:
`xattr -cr /Applications/One.app && codesign --force --deep --sign - /Applications/One.app`.)


## Så funkar den

- **Huvudfönster** — hela kalendern, dashboarden och chatten.
- **Mini-timer** — litet fönster utan ram som alltid ligger överst, även över
  helskärmsappar. Dra i den för att flytta; positionen sparas till nästa gång.
  Håll musen över den för knapparna "dölj" och "öppna kalendern".
- **Menyraden** — ikonen visar tiden som räknas medan timern går.
  Klick växlar mini-timern. Högerklick ger meny: öppna kalendern, visa/dölj
  timern, starta vid inloggning, avsluta.
- **Kortkommando** — `⌘⇧T` växlar mini-timern var du än är i macOS.
- **App-meny** — Arkiv, Redigera, Visa och Fönster med Ladda om, Zooma in/ut,
  Helskärm och klipp/kopiera/klistra in precis som i webbläsaren.
- **Dock-ikonen** får en prick när timern går (⏸ när den är pausad).
- **Offline** — utan nät visas en egen "Ingen anslutning"-vy som försöker igen
  automatiskt när nätet är tillbaka.
- **Fönsterläge sparas** — huvudfönstrets storlek och position kommer tillbaka.
- Startar du appen igen medan den redan kör fokuseras den befintliga i stället
  för att skapa en till menyradsikon.
- Stänger du kalenderfönstret ligger appen kvar i menyraden och timern
  fortsätter räkna.

## Peka appen mot en annan adress

Appen laddar den publicerade webbadressen. Byt genom att sätta miljövariabeln
`ONE_APP_URL`, eller lägg `{"appUrl": "..."}` i `config.json` i appens
userData-mapp (`~/Library/Application Support/One/config.json`).

## Bygga själv

```bash
npm install
npx @electron/packager . "One" --platform=darwin --arch=arm64 \
  --icon=electron/icon.icns --app-bundle-id=com.noahkruegers.one \
  --out=electron-release --overwrite \
  --ignore='^/node_modules' --ignore='^/src' --ignore='^/public' \
  --ignore='^/electron-release' --ignore='^/supabase'
# ad hoc-signera så macOS inte kallar appen "skadad"
codesign --force --deep --sign - electron-release/One-darwin-arm64/One.app
cd electron-release/One-darwin-arm64 && ditto -c -k --keepParent One.app ../../One-mac-appleSilicon.zip
```
