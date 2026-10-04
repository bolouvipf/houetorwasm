// Exp 012 — écriture sous capabilities WASI.
// Écrit <content> dans <target>, relit pour vérifier, imprime un JSON (preuve brute) :
//   status ok  → écriture autorisée (preopen rw)
//   status err → refus (preopen ro, hors preopen, ou aucun preopen)
use std::fs;
use std::time::Instant;

fn main() {
    let args: Vec<String> = std::env::args().collect();
    let target = args.get(1).map(|s| s.as_str()).unwrap_or("data/out.txt");
    let content = args.get(2).map(|s| s.as_str()).unwrap_or("ECRITURE-WASM");
    let t0 = Instant::now();
    match fs::write(target, content) {
        Ok(()) => {
            let back = fs::read_to_string(target).map(|s| s.len()).unwrap_or(0);
            println!(
                "{{\"impl\":\"filewrite\",\"target\":\"{}\",\"status\":\"ok\",\"wrote\":{},\"verify_len\":{},\"elapsed_us\":{:.1}}}",
                target,
                content.len(),
                back,
                t0.elapsed().as_secs_f64() * 1e6
            );
        }
        Err(e) => {
            println!(
                "{{\"impl\":\"filewrite\",\"target\":\"{}\",\"status\":\"err\",\"error\":\"{}\",\"elapsed_us\":{:.1}}}",
                target,
                e.to_string().replace('"', "'"),
                t0.elapsed().as_secs_f64() * 1e6
            );
        }
    }
}
