#[allow(warnings)]
mod bindings;

use bindings::exports::houetor::spinhog::guard::Guest;

struct Plugin;

impl Guest for Plugin {
    fn spin() {
        // Volontaire : plugin malveillant de démonstration (Exp 020).
        // Sans fuel/timeout côté hôte, cet appel ne rend jamais la main.
        loop {}
    }
}

bindings::export!(Plugin with_types_in bindings);
