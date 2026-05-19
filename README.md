# CheerpX concurrent TCP hang

Minimal reproducer for a hang inside a process when several pthreads concurrently perform TCP loopback I/O. The hang is probabilistic: rate climbs from ~0% at N≤3 to ~100% at N≥8 (see `histogram.txt` for the empirical curve).

Individual `connect(2)` and `read(2)` calls stop returning within the test deadline. No syscall returns an error, no exception is raised, and the CheerpX VM itself stays responsive: only the affected pthreads are stuck. The same statically-linked i386 binary completes at N=50+ outside CheerpX.

## Requirements

- Docker
- pnpm

## Usage

```sh
pnpm install
pnpm build
pnpm test             # CheerpX repro
pnpm test:native      # native Linux baseline
pnpm test:histogram   # M trials per N, output to histogram.txt
```

Both honor `N` and `DEADLINE_MS` env vars:

```sh
N=3  pnpm test                       # completes
N=5  pnpm test                       # intermittent (~40%)
N=8  pnpm test                       # default, hangs reliably
DEADLINE_MS=10000 N=10 pnpm test     # longer wait window
```

### `pnpm test`

Boots CheerpX 1.3.3 and runs `/usr/local/bin/main N DEADLINE_MS` inside the VM. `main.c` spawns one listener pthread (`accept -> read -> write -> close` loop on `127.0.0.1:9559`, single-flight) and N client pthreads (each does one `socket -> connect -> write -> read -> close` cycle).

At N=8 (the default) the hang fires 100% of runs in our sampling. One client completes the full cycle; the listener halts in `read()` after a subsequent `accept()`; the remaining clients halt in either `connect()` or `read()`. No `RESULT` line is printed. Below N=8 the wedge rate drops sharply (see `histogram.txt`).

### `pnpm test:native`

Runs the same binary directly via `docker run --platform linux/386`.

### `pnpm test:histogram`

Runs `M` trials per `N` (defaults M=50, N=1..10) and writes a histogram to `histogram.txt`. Override via env: `M=100 MAX_N=12 pnpm test:histogram`. ~1 hr at defaults. The committed `histogram.txt` is the curve we measured on CheerpX 1.3.3.
