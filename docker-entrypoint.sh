#!/bin/sh
set -e

# Headed Chromium (Copart Imperva bypass in lib/copart.ts) needs an X server.
# Start a virtual one in the background, then hand the display to Next.
Xvfb :99 -screen 0 1280x1024x24 -nolisten tcp >/tmp/xvfb.log 2>&1 &
export DISPLAY=:99

# exec => Next/node becomes the main process, so its stdout reaches `docker logs`
# and it receives stop signals directly.
exec npm run start
