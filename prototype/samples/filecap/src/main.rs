// Exp 011 — capabilities fichier WASI.
// Lit la cible passée en argument, imprime un JSON (preuve brute) :
//   status ok  → lecture autorisée par le preopen accordé par l'hôte
//   status err → refus (aucun preopen couvrant le chemin = deny-by-default WASI)
use std::fs;
use std::time::Instant;

fn main() {
    let args: Vec<String> = std::env::args().collect();
    let target = args.get(1).map(|s| s.as_str()).unwrap_or("input.txt");
    let t0 = Instant::now();
    match fs::read_to_string(target) {
        Ok(s) => {
            let sum: u64 = s.bytes().map(|b| b as u64).sum();
            println!(
                "{{\"impl\":\"filecap\",\"target\":\"{}\",\"status\":\"ok\",\"len\":{},\"byte_sum\":{},\"elapsed_us\":{:.1}}}",
                target,
                s.len(),
                sum,
                t0.elapsed().as_secs_f64() * 1e6
            );
        }
        Err(e) => {
            println!(
                "{{\"impl\":\"filecap\",\"target\":\"{}\",\"status\":\"err\",\"error\":\"{}\",\"elapsed_us\":{:.1}}}",
                target,
                e.to_string().replace('"', "'"),
                t0.elapsed().as_secs_f64() * 1e6
            );
        }
    }
}
