/* One listener pthread + N client pthreads, loopback TCP on :9559.
 * Usage: main [N] [deadline_ms]    defaults: N=6, deadline=3000 */

#include <arpa/inet.h>
#include <netinet/in.h>
#include <pthread.h>
#include <stdatomic.h>
#include <stdio.h>
#include <stdlib.h>
#include <sys/socket.h>
#include <time.h>
#include <unistd.h>

#define PORT 9559

static long long now_ms(void) {
    struct timespec ts;
    clock_gettime(CLOCK_MONOTONIC, &ts);
    return (long long)ts.tv_sec * 1000 + ts.tv_nsec / 1000000;
}

static void *listener_fn(void *unused) {
    (void)unused;
    int s = socket(AF_INET, SOCK_STREAM, 0);
    if (s < 0) { perror("listener: socket"); return NULL; }

    struct sockaddr_in addr = {0};
    addr.sin_family = AF_INET;
    addr.sin_port = htons(PORT);
    addr.sin_addr.s_addr = htonl(INADDR_LOOPBACK);
    if (bind(s, (struct sockaddr *)&addr, sizeof(addr)) < 0) {
        perror("listener: bind");
        return NULL;
    }
    if (listen(s, 64) < 0) {
        perror("listener: listen");
        return NULL;
    }
    fprintf(stderr, "listener: listening on :%d\n", PORT);

    int i = 0;
    for (;;) {
        int c = accept(s, NULL, NULL);
        if (c < 0) { perror("listener: accept"); continue; }
        fprintf(stderr, "listener: accepted #%d\n", i);

        char buf[256];
        ssize_t n = read(c, buf, sizeof(buf));
        fprintf(stderr, "listener: read %zd bytes (#%d)\n", n, i);
        if (n > 0) {
            ssize_t w = write(c, "ok\n", 3);
            fprintf(stderr, "listener: wrote %zd bytes (#%d)\n", w, i);
        }
        close(c);
        i++;
    }
}

typedef struct {
    int id;
    atomic_int *done;
} client_arg_t;

static void *client_fn(void *arg) {
    client_arg_t *ca = arg;
    int id = ca->id;

    fprintf(stderr, "client %d: started\n", id);

    int s = socket(AF_INET, SOCK_STREAM, 0);
    if (s < 0) { fprintf(stderr, "client %d: socket failed\n", id); return NULL; }
    fprintf(stderr, "client %d: socket ok\n", id);

    struct sockaddr_in addr = {0};
    addr.sin_family = AF_INET;
    addr.sin_port = htons(PORT);
    addr.sin_addr.s_addr = htonl(INADDR_LOOPBACK);
    if (connect(s, (struct sockaddr *)&addr, sizeof(addr)) < 0) {
        fprintf(stderr, "client %d: connect failed\n", id);
        close(s);
        return NULL;
    }
    fprintf(stderr, "client %d: connected\n", id);

    if (write(s, "hi\n", 3) != 3) {
        fprintf(stderr, "client %d: write failed\n", id);
        close(s);
        return NULL;
    }
    fprintf(stderr, "client %d: wrote\n", id);

    char buf[256];
    int total = 0;
    for (;;) {
        ssize_t n = read(s, buf, sizeof(buf));
        if (n <= 0) break;
        total += (int)n;
    }
    fprintf(stderr, "client %d: read %d bytes\n", id, total);

    close(s);

    if (total > 0) atomic_fetch_add(ca->done, 1);
    return NULL;
}

int main(int argc, char **argv) {
    int n = (argc > 1) ? atoi(argv[1]) : 6;
    int deadline_ms = (argc > 2) ? atoi(argv[2]) : 3000;
    fprintf(stderr, "burst n=%d deadline=%dms\n", n, deadline_ms);

    pthread_t listener_t;
    if (pthread_create(&listener_t, NULL, listener_fn, NULL) != 0) {
        perror("pthread_create listener");
        return 1;
    }
    usleep(100 * 1000);

    pthread_t *clients = malloc(sizeof(pthread_t) * n);
    client_arg_t *args = malloc(sizeof(client_arg_t) * n);
    atomic_int done = 0;

    for (int i = 0; i < n; i++) {
        args[i].id = i;
        args[i].done = &done;
        fprintf(stderr, "main: spawning client %d\n", i);
        if (pthread_create(&clients[i], NULL, client_fn, &args[i]) != 0) {
            fprintf(stderr, "pthread_create client %d failed\n", i);
        }
    }
    fprintf(stderr, "main: all %d clients spawned\n", n);

    long long start = now_ms();
    while (now_ms() - start < deadline_ms) {
        if (atomic_load(&done) >= n) break;
        usleep(20 * 1000);
    }

    int completed = atomic_load(&done);
    fprintf(stderr, "RESULT: %d/%d done in %lld ms\n", completed, n, now_ms() - start);

    free(args);
    free(clients);
    return completed == n ? 0 : 2;
}
