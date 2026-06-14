param(
    [string]$ConfigPath
)

$ErrorActionPreference = 'Stop'
$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
if (-not $ConfigPath) {
    $ConfigPath = Join-Path $projectRoot 'config\app.local.json'
}
$config = Get-Content $ConfigPath -Raw | ConvertFrom-Json
$pidFile = Join-Path (Join-Path $config.runtimeDir 'pids') 'collector.pid'

if (-not (Test-Path $pidFile)) {
    Write-Host 'Collector PID file does not exist.'
    exit 0
}

$processId = [int](Get-Content $pidFile -Raw)
if (Get-Process -Id $processId -ErrorAction SilentlyContinue) {
    Stop-Process -Id $processId
    Wait-Process -Id $processId -ErrorAction SilentlyContinue
}
Remove-Item $pidFile -Force
Write-Host "Collector process $processId stopped."
