# Référence §8 : même fonctionnalité en Python
import ctypes, ctypes.wintypes, json, os, time

def fib(n):
    a, b = 0, 1
    for _ in range(n):
        a, b = b, a + b
    return a

K = int(os.environ.get("BENCH_K", 100000))
N = int(os.environ.get("BENCH_N", 45))

t0 = time.perf_counter()
first = fib(N)
t1 = time.perf_counter()
sink = 0
for _ in range(K):
    sink += fib(N)
t2 = time.perf_counter()

class PROCESS_MEMORY_COUNTERS(ctypes.Structure):
    _fields_ = [
        ("cb", ctypes.wintypes.DWORD),
        ("PageFaultCount", ctypes.wintypes.DWORD),
        ("PeakWorkingSetSize", ctypes.c_size_t),
        ("WorkingSetSize", ctypes.c_size_t),
        ("QuotaPeakPagedPoolUsage", ctypes.c_size_t),
        ("QuotaPagedPoolUsage", ctypes.c_size_t),
        ("QuotaPeakNonPagedPoolUsage", ctypes.c_size_t),
        ("QuotaNonPagedPoolUsage", ctypes.c_size_t),
        ("PagefileUsage", ctypes.c_size_t),
        ("PeakPagefileUsage", ctypes.c_size_t),
    ]

pmc = PROCESS_MEMORY_COUNTERS()
pmc.cb = ctypes.sizeof(pmc)
GetProcessMemoryInfo = ctypes.windll.psapi.GetProcessMemoryInfo
GetProcessMemoryInfo.argtypes = [
    ctypes.wintypes.HANDLE,
    ctypes.POINTER(PROCESS_MEMORY_COUNTERS),
    ctypes.wintypes.DWORD,
]
GetProcessMemoryInfo.restype = ctypes.wintypes.BOOL
ok = GetProcessMemoryInfo(
    ctypes.windll.kernel32.GetCurrentProcess(), ctypes.byref(pmc), pmc.cb
)

compute = (t2 - t1) * 1e3
print(json.dumps({
    "impl": "python",
    "result": str(first),
    "first_call_us": (t1 - t0) * 1e6,
    "compute_ms": compute,
    "per_call_ns": compute * 1e6 / K,
    "k": K,
    "n": N,
    "maxrss_kb": pmc.PeakWorkingSetSize // 1024 if ok else 0,
    "sink": sink if False else 0,  # anti dead-code, non lu
}))
