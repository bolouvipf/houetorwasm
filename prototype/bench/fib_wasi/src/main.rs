// Jambe « wasm-wasmtime » du comparatif §8 : même fib(45), exécutée par wasmtime 49
// (runtime dédié, sans Node) — isole le coût réel du runtime WASM.
use std::time::Instant;

fn fib(n: i64) -> i64 {
    let (mut a, mut b) = (0i64, 1i64);
    for _ in 0..n {
        let t = a + b;
        a = b;
        b = t;
    }
    a
}

fn main() {
    let args: Vec<String> = std::env::args().collect();
    let k: i64 = args.get(1).and_then(|s| s.parse().ok()).unwrap_or(100_000);
    let n: i64 = args.get(2).and_then(|s| s.parse().ok()).unwrap_or(45);

    let t0 = Instant::now();
    let first = fib(n);
    let t1 = Instant::now();
    let mut sink: i64 = 0; // anti dead-code
    for _ in 0..k {
        sink = sink.wrapping_add(fib(n));
    }
    let t2 = Instant::now();
    if sink == i64::MIN {
        println!("impossible");
    }
    let compute = t2 - t1;
    let compute_ms = compute.as_secs_f64() * 1000.0;
    println!(
        "{{\"impl\":\"wasm-wasmtime\",\"result\":\"{}\",\"first_call_us\":{:.3},\"compute_ms\":{:.3},\"per_call_ns\":{:.1},\"k\":{},\"n\":{},\"maxrss_kb\":0}}",
        first,
        t1.duration_since(t0).as_secs_f64() * 1e6,
        compute_ms,
        compute.as_nanos() as f64 / k as f64,
        k,
        n
    );
}
