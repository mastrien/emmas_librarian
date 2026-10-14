#!/bin/bash
# TEMPORARY diagnostic for issue #37. Two modes, both under xvfb-run:
#   capture <AppRun> <outFile>        launch AppRun, save the app's real /proc/<pid>/environ (NUL separated), kill it.
#   exec <environFile> <dropRegex> <binary>
#                                     exec <binary> in that environment minus the variables matching dropRegex
#                                     (empty regex keeps all).
set -e
mode="$1"
if [ "$mode" = capture ]; then
  "$2" &
  sleep 5
  pid=$(pgrep -o -x emmas-librarian)
  cp "/proc/$pid/environ" "$3"
  pkill -KILL -x emmas-librarian || true
  exit 0
fi
mapfile -d '' vars < "$2"
keep=()
for v in "${vars[@]}"; do
  if [ -n "$3" ] && [[ "$v" =~ $3 ]]; then continue; fi
  keep+=("$v")
done
exec env -i "${keep[@]}" "$4"
