#!/usr/bin/env bash
# Runs a command with an unlocked GNOME keyring, so Electron's safeStorage on Linux encrypts the API key with
# libsecret (backend "gnome_libsecret") as on a desktop, instead of the "basic_text" it falls back to on a bare
# runner. Run it inside a D-Bus session; the keyring password only exists on this throwaway runner.
# Usage: dbus-run-session -- release-tests/with-keyring.sh xvfb-run -a npm run test:release-upgrade -- ...
set -euo pipefail

# --unlock creates the "login" keyring with this password when there is none yet, and starts the daemon.
echo -n 'release-test' | gnome-keyring-daemon --unlock --components=secrets > /dev/null
# Electron picks the backend from the desktop it thinks it runs in.
export XDG_CURRENT_DESKTOP=GNOME
exec "$@"
