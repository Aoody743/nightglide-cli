#!/bin/zsh
# /more check in Terminal.app with an isolated agent dir (the user's ~/.omp is
# not read or written): the grouped list, filtering by typed text, the
# leading "show advanced" row, and the list with advanced commands.
#
#   more-shot.sh <zh|en> <out-dir>
set -e
lang=$1; out=$2
here=${0:A:h}
root=/tmp/ngmore-$lang
rm -rf $root; mkdir -p $root/work $root/agent $out
printf 'setupVersion: 3\ntheme:\n  dark: nightglide-flight\n  light: nightglide-cloudlight\nnightglide:\n  language: %s\n' $lang > $root/agent/config.yml
fifo=$root/in.fifo
mkfifo $fifo
cat > $root/run.command <<EOF
#!/bin/zsh
printf '\e[8;${ROWS:-40};${COLS:-140}t'; sleep 0.5
cd $root/work
export NG_FIFO=$fifo PI_CODING_AGENT_DIR=$root/agent
python3 "$here/relay.py" "$here/../../nightglide"
EOF
chmod +x $root/run.command
osascript -e 'tell application "Terminal"' -e "set t to do script \"$root/run.command; exit\"" -e 'if exists settings set "Nightglide" then set current settings of t to settings set "Nightglide"' -e 'end tell' >/dev/null
sleep 12
wid=$(osascript -e 'tell application "Terminal" to id of front window')
exec 3<>$fifo
shot() { sleep ${2:-1.5}; screencapture -o -l $wid "$out/$lang-$1.png"; }
printf '/more' >&3; sleep 0.6; printf '\r' >&3; shot 1-more 2
printf 'git' >&3; shot 2-filter
printf '\x7f\x7f\x7f' >&3; sleep 0.5
# One Up from the first command reaches the leading "show advanced" switch.
printf '\e[A' >&3; shot 3-switch-row
printf '\r' >&3; shot 4-advanced 2
printf '\e' >&3; sleep 1
printf '/exit\r' >&3; exec 3>&-
sleep 3
osascript -e "tell application \"Terminal\" to close (every window whose id is $wid)" >/dev/null 2>&1 || true
ls $out/$lang-*.png
