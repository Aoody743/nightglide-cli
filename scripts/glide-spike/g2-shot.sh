#!/bin/zsh
# G2 real-terminal capture in Terminal.app, with an isolated agent dir so the
# user's own config is never touched. Only the theme and default model role are
# written (no credentials); the app is started but no prompt is sent.
#
#   g2-shot.sh <theme> <out-prefix> [nightglide args...]
# Captures <out-prefix>-a.png and <out-prefix>-b.png ~1.2 s apart, then exits.
set -e
theme=$1; out=$2; shift 2
root=/tmp/ngg2
mkdir -p $root/agent $root/work
model=$(sed -n 's/^  default: *"\{0,1\}\([^"]*\)"\{0,1\}$/\1/p' ~/.omp/agent/config.yml | head -1)
cat > $root/agent/config.yml <<EOF
symbolPreset: unicode
setupVersion: 4
theme:
  dark: $theme
  light: $theme
modelRoles:
  default: "$model"
EOF
fifo=$root/in.fifo
[[ -p $fifo ]] || mkfifo $fifo
cat > $root/run.command <<EOF
#!/bin/zsh
printf '\e[8;${ROWS:-40};${COLS:-140}t'; sleep 0.5
cd $root/work
export PI_CODING_AGENT_DIR=$root/agent NG_FIFO=$fifo
python3 "${0:A:h}/relay.py" "${0:A:h}/../../nightglide" ${(j: :)${(q)@}}
EOF
chmod +x $root/run.command
osascript -e 'tell application "Terminal"' -e "set t to do script \"$root/run.command; exit\"" -e 'if exists settings set "Nightglide" then set current settings of t to settings set "Nightglide"' -e 'end tell' >/dev/null
sleep 12
wid=$(osascript -e 'tell application "Terminal" to id of front window')
screencapture -o -l $wid "$out-a.png"
sleep 1.2
screencapture -o -l $wid "$out-b.png"
exec 3<>$fifo; printf '/exit\r' >&3; exec 3>&-
sleep 3
osascript -e "tell application \"Terminal\" to close (every window whose id is $wid)" >/dev/null 2>&1 || true
echo "$out-a.png $out-b.png"
