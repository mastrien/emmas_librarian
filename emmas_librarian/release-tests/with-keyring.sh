#!/usr/bin/env bash
# Runs a command with an unlocked GNOME keyring, so Electron's safeStorage on Linux encrypts the API key with
# libsecret (backend "gnome_libsecret") as on a desktop, instead of the "basic_text" it falls back to on a bare
# runner. Run it inside a D-Bus session; the keyring password only exists on this throwaway runner.
# Needs gnome-keyring and libsecret-tools (secret-tool).
# Usage: dbus-run-session -- release-tests/with-keyring.sh xvfb-run -a npm run test:release-upgrade -- ...
set -euo pipefail

# --unlock creates the "login" keyring with this password when there is none yet, and starts the daemon.
echo -n 'release-test' | gnome-keyring-daemon --unlock --components=secrets > /dev/null

# The daemon answers before the keyring is ready. Chromium reads it on startup (cookie encryption), and a keyring
# that is not ready asks for a password on screen, which nobody answers under Xvfb: one CI run hung on the first
# launch that way (PR #26). Wait until an item can be stored and read back.
ready=false
for _ in $(seq 1 20); do
  if echo -n probe | timeout 5 secret-tool store --label='release-test probe' release-test probe 2> /dev/null &&
    [ "$(timeout 5 secret-tool lookup release-test probe 2> /dev/null)" = probe ]; then
    ready=true
    break
  fi
  sleep 1
done
if [ "$ready" != true ]; then
  echo '[ERR_RELEASE_TEST_KEYRING] The GNOME keyring did not store and return an item within 20 tries. Expected an unlocked login keyring.' >&2
  exit 1
fi

# Electron picks the backend from the desktop it thinks it runs in.
export XDG_CURRENT_DESKTOP=GNOME
exec "$@"
