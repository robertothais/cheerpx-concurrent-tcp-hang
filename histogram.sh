#!/bin/bash
set -e

cd "$(dirname "$0")"

M="${M:-50}"
MIN_N="${MIN_N:-1}"
MAX_N="${MAX_N:-10}"
VERSION="${CHEERPX_VERSION:-1.3.3}"
DEADLINE_MS="${DEADLINE_MS:-3000}"
OUT="histogram.txt"

if [ ! -f out.ext2 ]; then
    echo "Error: out.ext2 not found. Run ./build.sh first."
    exit 1
fi

pnpm exec serve -l 3000 --config serve.json . >/dev/null 2>&1 &
SERVER_PID=$!
trap "kill $SERVER_PID 2>/dev/null" EXIT
sleep 2

{
    echo "CheerpX version: $VERSION"
    echo "Trials per N:    $M"
    echo "Deadline:        ${DEADLINE_MS}ms"
    echo "Date:            $(date)"
    echo
} > "$OUT"

for n in $(seq "$MIN_N" "$MAX_N"); do
    echo
    echo "--- N=$n ---"
    wedged=0
    for ((i=1; i<=M; i++)); do
        if NODE_NO_WARNINGS=1 CHEERPX_VERSION="$VERSION" N="$n" DEADLINE_MS="$DEADLINE_MS" \
           pnpm exec playwright test --reporter=line >/dev/null 2>&1; then
            outcome="OK"
        else
            outcome="WEDGED"
            wedged=$((wedged + 1))
        fi
        echo "  trial $i/$M: $outcome"
    done

    pct=$((wedged * 100 / M))
    bar_len=$((wedged * 30 / M))
    bar=$(printf '%*s' "$bar_len" '' | tr ' ' '#')
    space=$(printf '%*s' "$((30 - bar_len))" '')
    line=$(printf "N=%2d [%s%s] %3d%% wedged (%d/%d)" "$n" "$bar" "$space" "$pct" "$wedged" "$M")

    echo "$line"
    echo "$line" >> "$OUT"
done

echo
echo "Saved to $OUT"
