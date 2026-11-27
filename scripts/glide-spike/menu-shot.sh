#!/bin/zsh
# `/` menu check in Terminal.app with an isolated agent dir (the user's ~/.omp
# is not read or written). Types each input into the composer, captures the
# menu, then clears the line.
#
#   menu-shot.sh <zh|en> <out-dir> <input>...     e.g. menu-shot.sh zh shots/s2 / /ren /sw /switch
set -e
lang=$1; out=$2; shift 2
here=${0:A:h}
root=/tmp/ngmenu-$lang
rm -rf $root; mkdir -p $root/work $root/agent $out
printf 'setupVersion: 4\ntheme:\n  dark: nightglide-flight\n  light: nightglide-cloudlight\nnightglide:\n  language: %s\n' $lang > $root/agent/config.yml
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
i=1
for input in "$@"; do
	printf '%s' "$input" >&3; sleep 1.5
	name=${${input#/}:-slash}
	screencapture -o -l $wid "$out/$lang-$i-$name.png"
	printf '\e' >&3; sleep 0.4; printf '\x15' >&3; sleep 0.4
	i=$((i + 1))
done
printf '/exit\r' >&3; exec 3>&-
sleep 3
osascript -e "tell application \"Terminal\" to close (every window whose id is $wid)" >/dev/null 2>&1 || true
ls $out/$lang-*.png
