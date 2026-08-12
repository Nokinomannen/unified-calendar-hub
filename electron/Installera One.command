#!/bin/bash

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SOURCE_APP="$SCRIPT_DIR/One.app"
DESTINATION_APP="/Applications/One.app"

clear
echo "Installerar One …"
echo

if [ ! -d "$SOURCE_APP" ]; then
  echo "Kunde inte hitta One.app bredvid det här skriptet."
  echo "Packa upp HELA zip-filen (dubbelklicka på den) och kör sedan"
  echo "Installera One.command från samma mapp igen."
  echo
  read -r -p "Tryck Enter för att stänga."
  exit 1
fi

# Ta bort nedladdningskarantänen och skapa en lokal signatur innan kopiering.
/usr/bin/xattr -cr "$SOURCE_APP" 2>/dev/null
/usr/bin/codesign --force --deep --sign - "$SOURCE_APP" 2>/dev/null

echo "macOS frågar nu efter ditt datorlösenord för att lägga appen i Program."
echo

if /usr/bin/osascript - "$SOURCE_APP" <<'APPLESCRIPT'
on run argv
  set sourceApp to item 1 of argv
  do shell script "/bin/rm -rf /Applications/One.app && /usr/bin/ditto " & quoted form of sourceApp & " /Applications/One.app && /usr/bin/xattr -cr /Applications/One.app && /usr/bin/codesign --force --deep --sign - /Applications/One.app" with administrator privileges
end run
APPLESCRIPT
then
  :
else
  echo "Installationen till Program avbröts. Försöker i stället lägga appen"
  echo "i din egen programmapp (~/Applications) …"
  mkdir -p "$HOME/Applications"
  /bin/rm -rf "$HOME/Applications/One.app"
  /usr/bin/ditto "$SOURCE_APP" "$HOME/Applications/One.app"
  /usr/bin/xattr -cr "$HOME/Applications/One.app" 2>/dev/null
  /usr/bin/codesign --force --deep --sign - "$HOME/Applications/One.app" 2>/dev/null
  DESTINATION_APP="$HOME/Applications/One.app"
fi

if [ ! -d "$DESTINATION_APP" ]; then
  echo "Något gick fel — appen kunde inte installeras."
  read -r -p "Tryck Enter för att stänga."
  exit 1
fi

echo
echo "Klart! One ligger nu i $(dirname "$DESTINATION_APP") och öppnas automatiskt."
/usr/bin/open "$DESTINATION_APP"
sleep 2
