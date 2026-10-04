# build.ps1 - Exp 020 : composant « plugin malveillant » (boucle infinie)
# Usage : powershell -NoProfile -ExecutionPolicy Bypass -File build.ps1
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$witBindgen = "$env:USERPROFILE\.local\bin\wit-bindgen.exe"
$cargo = "$env:USERPROFILE\.cargo\bin\cargo.exe"

& $witBindgen rust "$root\wit" --world plugin --out-dir "$root\src" --format
if ($LASTEXITCODE -ne 0) { throw "wit-bindgen a echoue" }
Move-Item "$root\src\plugin.rs" "$root\src\bindings.rs" -Force

Push-Location $root
& $cargo build --release --target wasm32-wasip2
$code = $LASTEXITCODE
Pop-Location
if ($code -ne 0) { throw "cargo build a echoue" }

Copy-Item "$root\target\wasm32-wasip2\release\spinhog.wasm" "$root\spinhog.wasm" -Force
Write-Output "composant : $root\spinhog.wasm"
