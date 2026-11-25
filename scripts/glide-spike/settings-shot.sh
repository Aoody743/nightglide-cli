#!/bin/zsh
# S4 graphical settings page check in Terminal.app with an isolated agent dir
# (the user's ~/.omp is not read or written). Walks every category, commits a
# theme on the active slot (recolors at once) and on the other slot (saved for
# that background, look unchanged — the same semantics as the upstream
# submenu), reduces motion and shows the main UI after both, switches the
# interface language from the language row, enters the upstream advanced tabs
# and returns with Esc, and drives one pointer click through the relay FIFO
# (SGR mouse press + release).
#
#   settings-shot.sh <zh|en> <out-dir> [rows] [cols]     default 36 120 (wide,
#                                                        rail + content);
#                                                        24 80 walks the
#                                                        narrow single column.
set -e
lang=$1; out=$2; rows=${3:-36}; cols=${4:-120}
here=${0:A:h}
root=/tmp/ngs4-$lang-$rows-$cols
rm -rf $root; mkdir -p $root/work $root/agent $out
printf 'setupVersion: 3\ntheme:\n  dark: nightglide-flight\n  light: nightglide-cloudlight\nnightglide:\n  language: %s\n' $lang > $root/agent/config.yml
fifo=$root/in.fifo
mkfifo $fifo
cat > $root/run.command <<EOF
#!/bin/zsh
printf '\\e[8;${rows};${cols}t'; sleep 0.5
cd $root/work
export NG_FIFO=$fifo PI_CODING_AGENT_DIR=$root/agent
python3 "$here/relay.py" "$here/../../nightglide"
EOF
chmod +x $root/run.command
# Leftovers from an earlier run would steal "front window", so close the
# windows this script's runs create (their titles carry the isolated dir's
# ngs4- path and the run.command name) before launching a fresh one.
pkill -f "relay.py" >/dev/null 2>&1 || true
sleep 1
osascript -e 'tell application "Terminal" to close (every window whose name contains "ngs4-")' >/dev/null 2>&1 || true
sleep 1
osascript -e 'tell application "Terminal"' -e "set t to do script \"$root/run.command; exit\"" -e 'if exists settings set "Nightglide" then set current settings of t to settings set "Nightglide"' -e 'end tell' >/dev/null
sleep 12
wid=$(osascript -e 'tell application "Terminal" to id of front window')
exec 3<>$fifo
layout=$([[ $cols -ge 100 ]] && echo wide || echo narrow)
shot() { sleep ${2:-1.2}; screencapture -o -l $wid "$out/$lang-$layout-$1.png"; }
key() { printf "$1" >&3; }
# The language row's next value: zh walks zh→en with →, en walks en→zh with ←.
langStep=$([[ $lang == zh ]] && printf '\e[C' || printf '\e[D')

shot 1-start 2
if [[ $cols -ge 100 ]]; then
	# ── wide: rail on the left, controls on the right ─────────────────────────
	key '/settings'; sleep 0.6; key '\r'; shot 2-settings-appearance 2
	# 改即保存 on the active (light) slot: the page recolors at once.
	key '\x1b[B'; sleep 0.3; key '\e[C'; shot 3-theme-daybreak-live 2.5
	# The other slot saves for a dark terminal; the look stays.
	key '\x1b[A'; sleep 0.3; key '\e[D'; shot 4-dark-slot-saved 1.5
	key '\x1b[B'; sleep 0.3; key '\x1b[B'; sleep 0.3; key '\e[C'; shot 5-motion-reduced 1.5
	key '\e'; shot 6-main-after-theme-motion 3
	key '/settings'; sleep 0.6; key '\r'; sleep 1.5
	rail() { key '\t'; sleep 0.4; key '\x1b[B'; sleep 0.4; key '\t'; sleep 0.5; }
	rail; shot 8-model 1.5
	rail; shot 9-approval 1.5
	rail; shot 10-notify 1.2
	rail; shot 11-session 1.2
	rail; shot 12-language 1.2
	key "$langStep"; shot 13-language-live 2
	rail; shot 14-advanced-entry 1.2
	key '\r'; shot 15-advanced-tabs 2.5
	key '\e'; shot 16-back-from-advanced 1.5
	# Pointer click on the rail's 会话/Session row (SGR press + release).
	key '\e[<0;6;7M'; sleep 0.3; key '\e[<0;6;7m'; shot 17-click-session 1.5
else
	# ── narrow: one column; pick a category, Enter opens, Esc returns ─────────
	key '/settings'; sleep 0.6; key '\r'; shot 2-categories 1.5
	key '\r'; shot 3-appearance 2
	key '\x1b[B'; sleep 0.3; key '\e[C'; shot 4-theme-daybreak-live 2.5
	key '\x1b[A'; sleep 0.3; key '\e[D'; shot 5-dark-slot-saved 1.5
	key '\x1b[B'; sleep 0.3; key '\x1b[B'; sleep 0.3; key '\e[C'; sleep 0.5
	key '\e'; shot 6-categories-back 1.2
	list() { key '\x1b[B'; sleep 0.4; key '\r'; sleep 0.8; }
	list; shot 7-model 1.5
	key '\e[<65;40;12M'; sleep 0.5; shot 8-model-scrolled 1.2
	key '\e'; sleep 0.4
	list; shot 9-approval 1.5
	key '\e'; sleep 0.4
	list; shot 10-notify 1.2
	key '\e'; sleep 0.4
	list; shot 11-session 1.2
	key '\e[<65;40;12M'; sleep 0.5; shot 12-session-scrolled 1.2
	key '\e'; sleep 0.4
	list; shot 13-language 1.2
	key "$langStep"; shot 14-language-live 2
	key '\e'; sleep 0.4
	list; shot 15-advanced-entry 1.2
	key '\r'; shot 16-advanced-tabs 2.5
	key '\e'; shot 17-back-from-advanced 1.5
	key '\e'; sleep 0.4
	# Pointer click on the list's 会话/Session row.
	key '\e[<0;6;7M'; sleep 0.3; key '\e[<0;6;7m'; shot 18-click-session 1.5
fi
key '\e'; sleep 0.6
key '/exit\r'; exec 3>&-
sleep 3
osascript -e "tell application \"Terminal\" to close (every window whose id is $wid)" >/dev/null 2>&1 || true
ls $out/$lang-$layout-*.png
