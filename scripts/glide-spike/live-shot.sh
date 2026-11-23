#!/bin/zsh
# Live-model check in Terminal.app with the user's own agent dir (no config is
# written). Starts Nightglide, types one prompt, and captures a screenshot
# every few seconds while the reply streams.
#
#   live-shot.sh <out-prefix> <prompt> <shots> <interval-s> [nightglide args...]
set -e
out=$1; prompt=$2; shots=$3; interval=$4; shift 4
root=/tmp/nglive
mkdir -p $root/work
fifo=$root/in.fifo
[[ -p $fifo ]] || mkfifo $fifo
here=${0:A:h}
cat > $root/run.command <<EOF
#!/bin/zsh
printf '\e[8;${ROWS:-40};${COLS:-140}t'; sleep 0.5
cd $root/work
export NG_FIFO=$fifo
${LIVE_ENV:-}
python3 "$here/relay.py" "$here/../../nightglide" ${(j: :)${(q)@}}
EOF
chmod +x $root/run.command
osascript -e 'tell application "Terminal"' -e "set t to do script \"$root/run.command; exit\"" -e 'if exists settings set "Nightglide" then set current settings of t to settings set "Nightglide"' -e 'end tell' >/dev/null
sleep 12
wid=$(osascript -e 'tell application "Terminal" to id of front window')
screencapture -o -l $wid "$out-00-start.png"
exec 3<>$fifo
printf '%s' "$prompt" >&3; sleep 0.5; printf '\r' >&3
for i in $(seq 1 $shots); do
	sleep $interval
	screencapture -o -l $wid "$out-$(printf %02d $i).png"
done
printf '/exit\r' >&3; exec 3>&-
sleep 3
osascript -e "tell application \"Terminal\" to close (every window whose id is $wid)" >/dev/null 2>&1 || true
ls "$out"-*.png
