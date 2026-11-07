#!/bin/sh
# Run as the logged-in desktop user through labwc autostart.
set -eu
if command -v chromium >/dev/null 2>&1; then
    browser=chromium
elif command -v chromium-browser >/dev/null 2>&1; then
    browser=chromium-browser
else
    printf '%s\n' 'Install Chromium before starting the kiosk.' >&2
    exit 1
fi
profile="$HOME/.config/debtmonster/chromium"
mkdir -p "$profile"
while :; do
    until curl --fail --silent --output /dev/null --max-time 3 http://127.0.0.1:5050/display; do
        sleep 2
    done
    "$browser" --user-data-dir="$profile" --kiosk --no-first-run http://127.0.0.1:5050/display || true
    sleep 3
done
