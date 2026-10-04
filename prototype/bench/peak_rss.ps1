# Mesure complémentaire §7 : RSS pic par variante (polling PeakWorkingSet64 pendant l'exécution).
# WASI ne fournit pas de RSS (maxrss_kb=0 côté wasmtime) → mesure externe obligatoire.
# Usage : powershell -File peak_rss.ps1   → peak_rss.json (médiane de 3)
$ErrorActionPreference = "Stop"
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$runs = 3
$K = 10000000
$N = 45
$wasmtime = (Get-ChildItem "$env:USERPROFILE\.local\bin" -Directory -Filter "wasmtime*" |
    ForEach-Object { Join-Path $_.FullName "wasmtime.exe" } |
    Where-Object { Test-Path $_ } | Select-Object -First 1)
$wazeroCand = @((Join-Path $env:TEMP "opencode\wazero\wazero.exe"), "wazero.exe")
$wazero = ($wazeroCand | Where-Object { $_ -eq "wazero.exe" -or (Test-Path $_) } | Select-Object -First 1)

$variants = @(
    @{ id = "natif-c"; label = "Natif (C)"; cmd = "$here\fib_native.exe"; args = @() },
    @{ id = "python"; label = "Python 3.14"; cmd = "python"; args = @("$here\fib.py") },
    @{ id = "javascript-node"; label = "JavaScript (Node)"; cmd = "node"; args = @("$here\fib.js") },
    @{ id = "wasm-houetor"; label = "WASM plugin (host Node)"; cmd = "node"; args = @("$here\..\host\host.mjs", "bench", "hello", "fibonacci", "$N", "$K") },
    @{ id = "wasm-wasmtime"; label = "WASM commande (wasmtime)"; cmd = $wasmtime; args = @("run", "$here\fib_wasi\target\wasm32-wasip2\release\fib-wasi.wasm", "$K", "$N") },
    @{ id = "wasm-wazero"; label = "WASM commande (wazero)"; cmd = $wazero; args = @("run", "$here\fib_wasi\target\wasm32-wasip1\release\fib-wasi.wasm", "$K", "$N") }
)

$env:BENCH_K = "$K"
$env:BENCH_N = "$N"
$out = @()
foreach ($v in $variants) {
    if (-not $v.cmd -or -not (Get-Command $v.cmd -ErrorAction SilentlyContinue)) {
        $out += [pscustomobject]@{ id = $v.id; label = $v.label; status = "absent" }
        continue
    }
    $peaks = @()
    for ($i = 0; $i -lt $runs; $i++) {
        $redir = Join-Path $env:TEMP "peak_rss_out.txt"
        # Start-Process rejoint les arguments par espace → guillemeter les chemins avec espaces
        $argList = @($v.args | ForEach-Object { if ("$_" -match '\s') { '"' + $_ + '"' } else { "$_" } })
        if ($argList.Count -gt 0) {
            $p = Start-Process -FilePath $v.cmd -ArgumentList $argList -PassThru -NoNewWindow -RedirectStandardOutput $redir
        } else {
            $p = Start-Process -FilePath $v.cmd -PassThru -NoNewWindow -RedirectStandardOutput $redir
        }
        $peak = 0
        while (-not $p.HasExited) {
            try { $p.Refresh(); if ($p.PeakWorkingSet64 -gt $peak) { $peak = $p.PeakWorkingSet64 } } catch {}
            Start-Sleep -Milliseconds 2
        }
        $p.WaitForExit()
        $peaks += [math]::Round($peak / 1KB)
    }
    $sorted = $peaks | Sort-Object
    $median = $sorted[[int]($sorted.Count / 2)]
    $out += [pscustomobject]@{ id = $v.id; label = $v.label; status = "ok"; peak_kb = $median; samples_kb = $peaks }
    Write-Output ("{0} : {1} KB (samples: {2})" -f $v.label, $median, ($peaks -join ", "))
}
$json = @{ date = (Get-Date).ToUniversalTime().ToString("o"); machine = "$env:COMPUTERNAME win"; k = $K; n = $N; results = $out } | ConvertTo-Json -Depth 5
Set-Content -Path (Join-Path $here "peak_rss.json") -Value $json -Encoding UTF8
Write-Output "-> $(Join-Path $here 'peak_rss.json')"
