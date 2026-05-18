#!/bin/bash
set -e

cd "$(dirname "$0")"

IMAGE="cheerpx-concurrent-tcp-hang"
N="${N:-6}"
DEADLINE_MS="${DEADLINE_MS:-3000}"

if ! docker image inspect "$IMAGE" >/dev/null 2>&1; then
    echo "Error: image '$IMAGE' not found. Run \`pnpm build\` first."
    exit 1
fi

exec docker run --rm --platform linux/386 "$IMAGE" /usr/local/bin/main "$N" "$DEADLINE_MS"
