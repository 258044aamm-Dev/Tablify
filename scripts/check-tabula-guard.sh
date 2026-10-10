#!/usr/bin/env bash
# Extension guard: Fails the build if 'tabula' appears anywhere in src/ (case-insensitive).
# Tablify handles ONLY .tablify files. It never reads, writes, imports, detects,
# or migrates .tabula files.
#
# Documentation files may mention .tabula for clarity; this check only scans source code.

set -euo pipefail

echo "Running .tabula extension guard..."

if grep -ri 'tabula' src/; then
  echo ""
  echo "FAIL: src/ contains references to 'tabula'."
  echo "Tablify never handles .tabula files. Remove the reference(s) above."
  exit 1
fi

echo "PASS: No .tabula references found in src/"
exit 0
