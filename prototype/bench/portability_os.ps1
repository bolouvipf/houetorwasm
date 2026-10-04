# Exp 010 — Pilote Windows de la portabilité multi-OS : exécute portability_os.sh
# dans WSL2 (Ubuntu) et écrit portability_os.json (preuve brute).
# Usage : powershell -File portability_os.ps1
$ErrorActionPreference = "Stop"
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
# chemin Windows -> chemin WSL : C:\foo -> /mnt/c/foo (lettre de lecteur en minuscule)
$u = ($here -replace '\\', '/')
$unix = '/mnt/' + $u.Substring(0, 1).ToLower() + $u.Substring(2)
$script = "$unix/portability_os.sh"
$out = & wsl -d Ubuntu bash "$script" 2>&1
$code = $LASTEXITCODE
$out | ForEach-Object { Write-Output $_ }
$json = @{
    date     = (Get-Date).ToUniversalTime().ToString("o")
    driver   = "portability_os.ps1 (Windows -> WSL2 Ubuntu)"
    exit     = $code
    lines    = @($out | ForEach-Object { "$_" })
} | ConvertTo-Json -Depth 5
Set-Content -Path (Join-Path $here "portability_os.json") -Value $json -Encoding UTF8
Write-Output "-> $here\portability_os.json (exit=$code)"
exit $code
