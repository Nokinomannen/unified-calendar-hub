#!/bin/bash

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SOURCE_APP="$SCRIPT_DIR/One.app"
DESTINATION_APP="/Applications/One.app"

clear
echo "Installerar One …"
echo

if [ ! -d "$SOURCE_APP" ]; then
  echo "Kunde inte hitta One.app."
  echo "Packa upp hela zip-filen och dubbelklicka sedan på Installera One.command igen."
  echo
  read -r -p "Tryck Enter för att stänga."
  exit 1
fi

# Remove the download quarantine and create a local ad-hoc signature before
# copying. macOS will ask for the computer password when Applications needs it.
/usr/bin/xattr -cr "$SOURCE_APP"
/usr/bin/codesign --force --deep --sign - "$SOURCE_APP"

/usr/bin/osascript - "$SOURCE_APP" <<'APPLESCRIPT'
on run argv
  set sourceApp to item 1 of argv
  do shell script "/bin/rm -rf /Applications/One.app && /usr/bin/ditto " & quoted form of sourceApp & " /Applications/One.app && /usr/bin/xattr -cr /Applications/One.app && /usr/bin/codesign --force --deep --sign - /Applications/One.app" with administrator privileges
end run
APPLESCRIPT

echo
echo "Klart! One ligger nu i Program och öppnas automatiskt."
/usr/bin/open "$DESTINATION_APP"
sleep 2