param(
    [string]$InstallRoot = 'C:\YiwuCollector'
)

$ErrorActionPreference = 'Stop'

if ($env:OS -ne 'Windows_NT') {
    throw 'This installer must run on Windows.'
}

$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$nodeVersion = (& node -p "process.versions.node") 2>$null
if (-not $nodeVersion) {
    throw 'Node.js 24 LTS is required but node.exe was not found.'
}
$nodeMajor = [int]($nodeVersion.Split('.')[0])
if ($nodeMajor -ne 24) {
    throw "Node.js 24 LTS is required. Current version: $nodeVersion"
}

$runtimeDir = Join-Path $InstallRoot 'runtime'
$runtimeSubdirectories = @(
    'raw',
    'screenshots',
    'logs',
    'backups',
    'secrets',
    'evidence',
    'preview',
    'pids'
)

New-Item -ItemType Directory -Force -Path $runtimeDir | Out-Null
foreach ($subdirectory in $runtimeSubdirectories) {
    New-Item -ItemType Directory -Force -Path (Join-Path $runtimeDir $subdirectory) | Out-Null
}

$localConfig = Join-Path $projectRoot 'config\app.local.json'
$exampleConfig = Join-Path $projectRoot 'config\app.example.json'
if (-not (Test-Path $localConfig)) {
    Copy-Item $exampleConfig $localConfig
    Write-Host "Created $localConfig. Review non-secret settings before startup."
}

Push-Location $projectRoot
try {
    & npm ci
    if ($LASTEXITCODE -ne 0) { throw 'Root npm ci failed.' }

    & npm ci --prefix admin
    if ($LASTEXITCODE -ne 0) { throw 'Admin npm ci failed.' }

    & npm run build
    if ($LASTEXITCODE -ne 0) { throw 'Server build failed.' }

    & npm run build:admin
    if ($LASTEXITCODE -ne 0) { throw 'Admin build failed.' }

    & npm run migrate -- --config $localConfig
    if ($LASTEXITCODE -ne 0) { throw 'Database migration failed.' }
}
finally {
    Pop-Location
}

Write-Host 'Installation completed. No credentials were written by this script.'
