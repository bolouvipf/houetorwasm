// Référence §8 : même fonctionnalité en JavaScript (Node)
// fib(45)=1134903170 < 2^53 → exact en IEEE-754 double (pas de BigInt : même régime numérique que C/WASM i32)
function fib(n) {
  let a = 0,
    b = 1;
  for (let i = 0; i < n; i++) {
    const t = a + b;
    a = b;
    b = t;
  }
  return a;
}

const K = Number(process.env.BENCH_K ?? 100000);
const N = Number(process.env.BENCH_N ?? 45);

const t0 = process.hrtime.bigint();
const first = fib(N);
const t1 = process.hrtime.bigint();
let sink = 0;
for (let i = 0; i < K; i++) sink += fib(N);
const t2 = process.hrtime.bigint();

const compute = Number(t2 - t1) / 1e6;
console.log(
  JSON.stringify({
    impl: "javascript-node",
    result: String(first + (sink < 0 ? 0 : 0)), // sink : anti dead-code, n'influe pas sur result
    first_call_us: Number(t1 - t0) / 1000,
    compute_ms: compute,
    per_call_ns: (compute * 1e6) / K,
    k: K,
    n: N,
    maxrss_kb: Math.round(process.resourceUsage().maxRSS),
  })
);
