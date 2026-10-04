#[allow(warnings)]
mod bindings;

use bindings::exports::houetor::calc::calc::Guest;

struct Plugin;

impl Guest for Plugin {
    fn add(a: f64, b: f64) -> f64 {
        a + b
    }

    fn fibonacci(n: u32) -> u64 {
        let mut a: u64 = 0;
        let mut b: u64 = 1;
        for _ in 0..n {
            let c = a.wrapping_add(b);
            a = b;
            b = c;
        }
        a
    }

    fn greet(name: String) -> String {
        format!("Bonjour, {name} !")
    }

    fn read_file(path: String) -> Result<String, String> {
        std::fs::read_to_string(&path).map_err(|e| format!("{e}"))
    }
}

bindings::export!(Plugin with_types_in bindings);
