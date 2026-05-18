#!/bin/bash
set -e

cd "$(dirname "$0")"

if [ ! -f out.ext2 ]; then
  echo "Error: out.ext2 not found. Run ./build.sh first."
  exit 1
fi

VERSION="${CHEERPX_VERSION:-1.3.2}"

pnpm exec serve -l 3000 --config serve.json . >/dev/null 2>&1 &
SERVER_PID=$!
trap "kill $SERVER_PID 2>/dev/null" EXIT
sleep 2

NODE_NO_WARNINGS=1 CHEERPX_VERSION="$VERSION" pnpm exec playwright test --reporter=line
