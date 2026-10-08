#!/usr/bin/env bash
# Downloads the published v1.1.23 installer next to the two this run built (put in $RUNNER_TEMP/inst/current
# and .../rebuilt by actions/download-artifact) and exports INSTALLER_PUBLISHED_1_1_23 / INSTALLER_CURRENT /
# INSTALLER_REBUILT_1_2_0 as Windows paths.
set -euo pipefail
mkdir -p "$RUNNER_TEMP/inst"
gh release download v1.1.23 --pattern '*.exe' --dir "$RUNNER_TEMP/inst/published"
for pair in PUBLISHED_1_1_23:published CURRENT:current REBUILT_1_2_0:rebuilt; do
  exe="$(ls "$RUNNER_TEMP/inst/${pair#*:}"/*.exe | head -1)"
  echo "INSTALLER_${pair%%:*}=$(cygpath -w "$exe")" >> "$GITHUB_ENV"
done
