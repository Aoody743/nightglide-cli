#!/bin/zsh
# usage: launch.sh <Terminal profile>  -> prints window id
osascript -e 'tell application "Terminal"' -e "set t to do script \"sleep 2; '/Users/aoody743/Documents/Nightglide CLI/scripts/glide-spike/glide.command'\"" -e "set current settings of t to settings set \"$1\"" -e 'end tell' >/dev/null
sleep 11; osascript -e 'tell application "Terminal" to id of front window'
