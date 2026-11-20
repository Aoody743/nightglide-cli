#!/bin/zsh
printf '\e[8;40;140t'; sleep 0.5
cd "$(cat /tmp/ngglide/cwd 2>/dev/null || echo /tmp/ngglide/work)"; NG_EXTRA="$(cat /tmp/ngglide/extra 2>/dev/null)"
NIGHTGLIDE_GLIDE=1 python3 "/Users/aoody743/Documents/Nightglide CLI/scripts/glide-spike/relay.py" "/Users/aoody743/Documents/Nightglide CLI/nightglide" --model omlx/endless ${=NG_EXTRA}
