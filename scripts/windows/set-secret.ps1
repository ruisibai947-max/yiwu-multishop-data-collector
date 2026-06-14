param(
    [Parameter(Mandatory = $true)]
    [ValidatePattern('^[a-z][a-z0-9_]*$')]
    [string]$Name,

    [string]$SecretDirectory = 'C:\YiwuCollector\runtime\secrets'
)

$ErrorActionPreference = 'Stop'

New-Item -ItemType Directory -Force -Path $SecretDirectory | Out-Null
$secureValue = Read-Host "Enter value for secret '$Name'" -AsSecureString
$encryptedValue = ConvertFrom-SecureString -SecureString $secureValue
$target = Join-Path $SecretDirectory "$Name.dpapi"

Set-Content -Path $target -Value $encryptedValue -Encoding UTF8
Write-Host "Secret stored for the current Windows user at $target"
