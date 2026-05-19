# syntax=docker/dockerfile:1
# check=skip=FromPlatformFlagConstDisallowed

FROM --platform=linux/386 debian:bookworm-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
        gcc libc6-dev \
    && rm -rf /var/lib/apt/lists/*

COPY main.c /tmp/

RUN gcc -O2 -static -pthread -o /usr/local/bin/main /tmp/main.c \
    && rm /tmp/main.c \
    && apt-get purge -y gcc libc6-dev \
    && apt-get autoremove -y \
    && rm -rf /var/lib/apt/lists/* /var/cache/* /tmp/*

CMD ["/usr/local/bin/main"]
