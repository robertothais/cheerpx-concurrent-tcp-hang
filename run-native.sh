#!/bin/bash
set -e

cd "$(dirname "$0")"
. ./config.env

IMAGE="cheerpx-concurrent-tcp-hang"

if ! docker image inspect "$IMAGE" >/dev/null 2>&1; then
    echo "Error: image '$IMAGE' not found. Run \`pnpm build\` first."
    exit 1
fi

exec docker run --rm --platform linux/386 "$IMAGE" /usr/local/bin/main "$N" "$DEADLINE_MS"
