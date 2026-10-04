#[no_mangle]
pub extern "C" fn add(a: f64, b: f64) -> f64 {
    a + b
}

#[no_mangle]
pub extern "C" fn fibonacci(n: i32) -> i32 {
    let mut a = 0i32;
    let mut b = 1i32;
    for _ in 0..n {
        let t = a.wrapping_add(b);
        a = b;
        b = t;
    }
    a
}

#[no_mangle]
pub extern "C" fn plugin_version() -> i32 {
    1
}
