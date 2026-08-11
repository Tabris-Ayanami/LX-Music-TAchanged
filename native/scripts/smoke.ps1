param(
  [ValidateSet('Debug', 'Release')]
  [string]$Configuration = 'Debug'
)

$ErrorActionPreference = 'Stop'
$nativeRoot = Resolve-Path "$PSScriptRoot\.."
$solution = Join-Path $nativeRoot 'LXTA.Native.slnx'

dotnet build $solution -c $Configuration -p:Platform=x64 --disable-build-servers
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

dotnet test (Join-Path $nativeRoot 'tests\LXTA.Application.Tests\LXTA.Application.Tests.csproj') -c $Configuration -p:Platform=x64 --no-build --disable-build-servers
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

dotnet test (Join-Path $nativeRoot 'tests\LXTA.Storage.Tests\LXTA.Storage.Tests.csproj') -c $Configuration -p:Platform=x64 --no-build --disable-build-servers
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

$appOutput = Join-Path $nativeRoot "src\LXTA.App\bin\$Configuration\net10.0-windows10.0.26100.0\win-x64\LXTA.App.exe"
if (-not (Test-Path -LiteralPath $appOutput)) { throw "Native executable not found: $appOutput" }

Write-Host "LX-TA Native $Configuration x64 smoke checks passed"
Write-Host "Executable: $appOutput"
Write-Host 'UI workflow verification remains a manual step.'
