#!/bin/zsh
# S1 language check in Terminal.app with an isolated agent dir (the user's
# ~/.omp is not read or written). Starts Nightglide with nightglide.language
# set to <lang>, then captures: start, bare "/" menu, /settings, and (for zh)
# a live switch to English from the settings page.
#
#   lang-shot.sh <zh|en|auto> <out-dir> [LANG value for auto]
set -e
lang=$1; out=$2; locale=${3:-en_US.UTF-8}
here=${0:A:h}
root=/tmp/ngs1-$lang
rm -rf $root; mkdir -p $root/work $root/agent $out
printf 'setupVersion: 3\ntheme:\n  dark: nightglide-flight\n  light: nightglide-cloudlight\nnightglide:\n  language: %s\n' $lang > $root/agent/config.yml
fifo=$root/in.fifo
mkfifo $fifo
cat > $root/run.command <<EOF
#!/bin/zsh
printf '\e[8;${ROWS:-40};${COLS:-140}t'; sleep 0.5
cd $root/work
export NG_FIFO=$fifo PI_CODING_AGENT_DIR=$root/agent LANG=$locale LC_ALL=
python3 "$here/relay.py" "$here/../../nightglide"
EOF
chmod +x $root/run.command
osascript -e 'tell application "Terminal"' -e "set t to do script \"$root/run.command; exit\"" -e 'if exists settings set "Nightglide" then set current settings of t to settings set "Nightglide"' -e 'end tell' >/dev/null
sleep 12
wid=$(osascript -e 'tell application "Terminal" to id of front window')
exec 3<>$fifo
shot() { sleep ${2:-1.5}; screencapture -o -l $wid "$out/$lang-$1.png"; }
shot 1-start 0
printf '/' >&3; shot 2-slash
printf '\e' >&3; sleep 0.5; printf '\x15' >&3; sleep 0.3
printf '/settings' >&3; sleep 0.5; printf '\r' >&3; shot 3-settings 2
if [[ $lang == zh ]]; then
	# First row of the common page is the language: open it, pick English.
	printf '\r' >&3; shot 4-language-menu
	printf '\e[B' >&3; sleep 0.3; printf '\r' >&3; shot 5-settings-after-switch
	printf '\e' >&3; shot 6-main-after-switch
	printf '/' >&3; shot 7-slash-after-switch
	printf '\e' >&3; sleep 0.5; printf '\x15' >&3
else
	printf '\e' >&3; sleep 1
fi
printf '/exit\r' >&3; exec 3>&-
sleep 3
osascript -e "tell application \"Terminal\" to close (every window whose id is $wid)" >/dev/null 2>&1 || true
ls $out/$lang-*.png
