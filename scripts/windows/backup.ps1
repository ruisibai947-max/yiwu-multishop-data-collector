param(
    [string]$ConfigPath,
    [int]$WaitSeconds = 300
)

$ErrorActionPreference = 'Stop'
$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
if (-not $ConfigPath) {
    $ConfigPath = Join-Path $projectRoot 'config\app.local.json'
}
$config = Get-Content $ConfigPath -Raw | ConvertFrom-Json
$apiBase = "http://$($config.api.host):$($config.api.port)"
$timestamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$backupRoot = Join-Path (Join-Path $config.runtimeDir 'backups') $timestamp
$databasePath = Join-Path $config.runtimeDir $config.databaseFile

New-Item -ItemType Directory -Force -Path $backupRoot | Out-Null

Invoke-RestMethod -Method Post -Uri "$apiBase/api/system/pause" | Out-Null
try {
    $deadline = (Get-Date).AddSeconds($WaitSeconds)
    do {
        $jobs = @(Invoke-RestMethod -Method Get -Uri "$apiBase/api/jobs")
        $runningCount = @($jobs | Where-Object { $_.status -eq 'running' }).Count
        if ($runningCount -eq 0) { break }
        if ((Get-Date) -ge $deadline) {
            throw "Timed out waiting for $runningCount running jobs."
        }
        Start-Sleep -Seconds 2
    } while ($true)

    Push-Location $projectRoot
    try {
        & node 'dist/cli/backup-database.js' `
            $databasePath `
            (Join-Path $backupRoot $config.databaseFile)
        if ($LASTEXITCODE -ne 0) { throw 'SQLite backup failed.' }
    }
    finally {
        Pop-Location
    }

    $safeConfig = Get-Content $ConfigPath -Raw | ConvertFrom-Json
    $safeConfig.secrets = [PSCustomObject]@{}
    $safeConfig |
        ConvertTo-Json -Depth 10 |
        Set-Content (Join-Path $backupRoot 'app.local.without-secrets.json') -Encoding UTF8

    Copy-Item (Join-Path $projectRoot 'migrations') `
        (Join-Path $backupRoot 'migrations') -Recurse
    Copy-Item (Join-Path $projectRoot 'config\app.example.json') `
        (Join-Path $backupRoot 'app.example.json')
    $reportDefinitions = Join-Path $projectRoot 'config\report-definitions'
    if (Test-Path $reportDefinitions) {
        Copy-Item $reportDefinitions `
            (Join-Path $backupRoot 'report-definitions') -Recurse
    }
}
finally {
    Invoke-RestMethod -Method Post -Uri "$apiBase/api/system/resume" | Out-Null
}

Write-Host "Backup completed at $backupRoot"
