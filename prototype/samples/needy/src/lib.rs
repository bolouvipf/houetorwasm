// Plugin "needy" : réclame une capability hôte (env.host_log).
// Sert à prouver le deny-by-default du HOUETOR Plugin Host.
#[link(wasm_import_module = "env")]
extern "C" {
    fn host_log(ptr: *const u8, len: usize);
}

#[no_mangle]
pub extern "C" fn do_log() {
    let msg = b"je tente d'ecrire dans l'hote";
    unsafe { host_log(msg.as_ptr(), msg.len()) };
}

#[no_mangle]
pub extern "C" fn plugin_version() -> i32 {
    1
}
