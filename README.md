# CheerpX concurrent TCP hang

Minimal reproducer for a hang inside a process when several pthreads concurrently perform TCP loopback I/O. At N=6 client pthreads the hang fires reliably; at N=4-5 it fires intermittently across runs.

Individual `connect(2)` and `read(2)` calls stop returning within the test deadline. No syscall returns an error, no exception is raised, and the CheerpX VM itself stays responsive: only the affected pthreads are stuck. The same statically-linked i386 binary completes at N=50+ outside CheerpX.

## Requirements

- Docker
- pnpm

## Usage

```sh
pnpm install
pnpm build
pnpm test           # CheerpX repro
pnpm test:native    # native Linux baseline
```

Both honor `N` and `DEADLINE_MS` env vars:

```sh
N=3  pnpm test                       # below threshold, completes
N=4  pnpm test                       # intermittent
N=6  pnpm test                       # default, hangs reliably
DEADLINE_MS=10000 N=10 pnpm test     # longer wait window
```

### `pnpm test`

Boots CheerpX 1.3.2 and runs `/usr/local/bin/main N DEADLINE_MS` inside the VM. `main.c` spawns one listener pthread (`accept -> read -> write -> close` loop on `127.0.0.1:9559`, single-flight) and N client pthreads (each does one `socket -> connect -> write -> read -> close` cycle).

At N=6 in CheerpX this wedges every run tested. One client completes the full cycle; the listener halts in `read()` after a subsequent `accept()`; the remaining clients halt in either `connect()` or `read()`. No `RESULT` line is printed. At N=5 the same setup completes some runs and wedges others, so the threshold is not sharp.

### `pnpm test:native`

Runs the same binary directly via `docker run --platform linux/386`.
