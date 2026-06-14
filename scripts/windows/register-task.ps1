param(
    [string]$StartupTaskName = 'YiwuCollector-Startup',
    [string]$BackupTaskName = 'YiwuCollector-DailyBackup',
    [string]$BackupTime = '03:00'
)

$ErrorActionPreference = 'Stop'
$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$startScript = Join-Path $projectRoot 'scripts\windows\start.ps1'
$backupScript = Join-Path $projectRoot 'scripts\windows\backup.ps1'
$identity = [System.Security.Principal.WindowsIdentity]::GetCurrent().Name
$principal = New-ScheduledTaskPrincipal `
    -UserId $identity `
    -LogonType Interactive `
    -RunLevel Highest

$startupAction = New-ScheduledTaskAction `
    -Execute 'powershell.exe' `
    -Argument "-NoProfile -ExecutionPolicy Bypass -File `"$startScript`""
$startupTrigger = New-ScheduledTaskTrigger -AtLogOn -User $identity
Register-ScheduledTask `
    -TaskName $StartupTaskName `
    -Action $startupAction `
    -Trigger $startupTrigger `
    -Principal $principal `
    -Force | Out-Null

$backupAction = New-ScheduledTaskAction `
    -Execute 'powershell.exe' `
    -Argument "-NoProfile -ExecutionPolicy Bypass -File `"$backupScript`""
$backupTrigger = New-ScheduledTaskTrigger -Daily -At $BackupTime
Register-ScheduledTask `
    -TaskName $BackupTaskName `
    -Action $backupAction `
    -Trigger $backupTrigger `
    -Principal $principal `
    -Force | Out-Null

Write-Host "Registered $StartupTaskName and $BackupTaskName."
