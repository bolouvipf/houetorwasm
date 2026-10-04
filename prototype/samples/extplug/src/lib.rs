use extism_pdk::*;

#[plugin_fn]
pub fn add(input: String) -> FnResult<String> {
    let nums: Vec<f64> = input
        .split_whitespace()
        .map(|s| s.parse::<f64>().expect("nombre attendu (ex. 2 3.5)"))
        .collect();
    Ok(format!("{}", nums.iter().sum::<f64>()))
}

#[plugin_fn]
pub fn fetch(url: String) -> FnResult<String> {
    let req = HttpRequest::new(url).with_method("GET");
    let response = http::request(&req, None::<&str>)?;
    let body = response.body();
    Ok(String::from_utf8_lossy(&body).into_owned())
}

#[plugin_fn]
pub fn spin() -> FnResult<String> {
    loop {
        std::hint::spin_loop();
    }
}

#[plugin_fn]
pub fn hog() -> FnResult<String> {
    let n = 64 * 1024 * 1024;
    let mut v: Vec<u64> = vec![0u64; n / 8];
    for (i, x) in v.iter_mut().enumerate() {
        *x = i as u64;
    }
    Ok(format!("{} octets touches", v.len() * 8))
}
