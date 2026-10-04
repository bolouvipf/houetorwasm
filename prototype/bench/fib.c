/* Référence §8 : même fonctionnalité en natif (C, MinGW gcc/clang) */
#include <stdio.h>
#include <stdlib.h>
#include <windows.h>
#include <psapi.h>

static long long fib(int n) {
    long long a = 0, b = 1;
    for (int i = 0; i < n; i++) { long long t = a + b; a = b; b = t; }
    return a;
}

static double ms_between(LARGE_INTEGER freq, LARGE_INTEGER a, LARGE_INTEGER b) {
    return (b.QuadPart - a.QuadPart) * 1000.0 / freq.QuadPart;
}

int main(void) {
    int K = 100000, N = 45;
    const char *ek = getenv("BENCH_K"); if (ek) K = atoi(ek);
    const char *en = getenv("BENCH_N"); if (en) N = atoi(en);

    LARGE_INTEGER freq, t0, t1, t2;
    QueryPerformanceFrequency(&freq);

    QueryPerformanceCounter(&t0);
    long long first = fib(N);
    QueryPerformanceCounter(&t1);
    volatile long long sink = 0; /* empêche l'élimination de code mort */
    for (int i = 0; i < K; i++) sink += fib(N);
    QueryPerformanceCounter(&t2);
    if (sink == -1) printf("impossible\n"); /* observateur */

    PROCESS_MEMORY_COUNTERS pmc; pmc.cb = sizeof(pmc);
    GetProcessMemoryInfo(GetCurrentProcess(), &pmc, pmc.cb);

    double compute = ms_between(freq, t1, t2);
    printf("{\"impl\":\"natif-c\",\"result\":\"%lld\",\"first_call_us\":%.3f,"
           "\"compute_ms\":%.3f,\"per_call_ns\":%.1f,\"k\":%d,\"n\":%d,"
           "\"maxrss_kb\":%llu}\n",
           first, ms_between(freq, t0, t1) * 1000.0, compute,
           compute * 1e6 / K, K, N,
           (unsigned long long)(pmc.PeakWorkingSetSize / 1024));
    return 0;
}
