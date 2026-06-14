param(
    [string]$ConfigPath
)

$ErrorActionPreference = 'Stop'
$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
if (-not $ConfigPath) {
    $ConfigPath = Join-Path $projectRoot 'config\app.local.json'
}
$config = Get-Content $ConfigPath -Raw | ConvertFrom-Json
$pidDirectory = Join-Path $config.runtimeDir 'pids'
$pidFile = Join-Path $pidDirectory 'collector.pid'
$logDirectory = Join-Path $config.runtimeDir 'logs'

New-Item -ItemType Directory -Force -Path $pidDirectory | Out-Null
New-Item -ItemType Directory -Force -Path $logDirectory | Out-Null

if (Test-Path $pidFile) {
    $existingId = [int](Get-Content $pidFile -Raw)
    if (Get-Process -Id $existingId -ErrorAction SilentlyContinue) {
        Write-Host "Collector is already running with PID $existingId."
        exit 0
    }
    Remove-Item $pidFile -Force
}

$env:YIWU_COLLECTOR_CONFIG = $ConfigPath
$process = Start-Process `
    -FilePath 'node.exe' `
    -ArgumentList @('dist/server.js') `
    -WorkingDirectory $projectRoot `
    -RedirectStandardOutput (Join-Path $logDirectory 'server.stdout.log') `
    -RedirectStandardError (Join-Path $logDirectory 'server.stderr.log') `
    -WindowStyle Hidden `
    -PassThru

Set-Content -Path $pidFile -Value $process.Id -Encoding ASCII
Write-Host "Collector started with PID $($process.Id)."
