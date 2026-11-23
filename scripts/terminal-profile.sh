#!/bin/zsh
# Create (or update) a Terminal.app profile named "Nightglide" that uses the
# NeoX Mono font. A terminal program cannot pick its own font; the terminal's
# profile does. The font itself is not bundled (its license reserves all
# rights): install NeoX Mono first.
#
#   scripts/terminal-profile.sh            create/update the profile only
#   scripts/terminal-profile.sh --default  also make it Terminal's default and
#                                          startup profile
#   NG_FONT_SIZE=15 scripts/terminal-profile.sh
set -e
FONT="NeoXMono1.4-Regular"
SIZE="${NG_FONT_SIZE:-14}"
PROFILE="Nightglide"

if ! system_profiler SPFontsDataType 2>/dev/null | grep -q "$FONT"; then
	echo "NeoX Mono ($FONT) is not installed. Install the font, then run this again." >&2
	exit 1
fi

osascript <<EOF
tell application "Terminal"
	if not (exists settings set "$PROFILE") then
		make new settings set with properties {name:"$PROFILE"}
	end if
	set font name of settings set "$PROFILE" to "$FONT"
	set font size of settings set "$PROFILE" to $SIZE
	set number of columns of settings set "$PROFILE" to 140
	set number of rows of settings set "$PROFILE" to 40
end tell
EOF
echo "Terminal profile \"$PROFILE\" uses $FONT at ${SIZE}pt."

if [[ "$1" == "--default" ]]; then
	osascript -e "tell application \"Terminal\" to set default settings to settings set \"$PROFILE\"" \
		-e "tell application \"Terminal\" to set startup settings to settings set \"$PROFILE\""
	echo "\"$PROFILE\" is now Terminal's default and startup profile."
else
	echo "Use it from Terminal > Settings > Profiles, or rerun with --default to make it the default."
fi
