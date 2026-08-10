param(
  [string]$Project = "$PSScriptRoot\..\LXTA.Native\LXTA.Native.csproj"
)

$ErrorActionPreference = 'Stop'
$repoRoot = Resolve-Path "$PSScriptRoot\..\.."
$dataRoot = Join-Path $env:APPDATA 'LX-TA\LxDatas'
$database = Join-Path $dataRoot 'lx.data.db'
$settings = Join-Path $env:APPDATA 'LX-TA\NativeData\settings.json'

if (-not (Test-Path $database)) { throw "Legacy database not found: $database" }
dotnet build $Project -c Debug --no-restore
dotnet run --project (Join-Path $repoRoot 'native\tests\AudioGraphSmoke\AudioGraphSmoke.csproj') -c Release
if (-not (Test-Path $settings)) { throw "Native settings were not created: $settings" }

$nativeExe = Join-Path (Split-Path $Project) 'bin\Debug\net10.0-windows10.0.26100.0\win-x64\LXTA.Native.exe'
if (-not (Test-Path $nativeExe)) { throw "Native executable not found: $nativeExe" }
Write-Host "LX-TA native smoke checks passed"
Write-Host "Database: $database"
Write-Host "Executable: $nativeExe"
