param(
    [ValidateSet('x64', 'x86', 'arm64')]
    [string]$Architecture = 'x64'
)

$ErrorActionPreference = 'Stop'
$nativeRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$project = Join-Path $nativeRoot 'LXTA.Native\LXTA.Native.csproj'
$runtime = "win-$Architecture"
$node = (Get-Command node -ErrorAction Stop).Source

dotnet publish $project -c Release -r $runtime --self-contained false `
    -p:BundledNodePath="$node" `
    -p:GenerateAppxPackageOnBuild=true `
    -p:AppxBundle=Never `
    -p:UapAppxPackageBuildMode=SideLoadOnly `
    -p:AppxSymbolPackageEnabled=false `
    -p:AppxPackageSigningEnabled=false

$publish = Join-Path $nativeRoot "LXTA.Native\bin\Release\net10.0-windows10.0.26100.0\$runtime\publish"
$runtimeDirectory = Join-Path $publish 'Runtime'
New-Item -ItemType Directory -Path $runtimeDirectory -Force | Out-Null
Copy-Item -LiteralPath $node -Destination (Join-Path $runtimeDirectory 'node.exe') -Force

Write-Host "Published native app: $publish"
Write-Host "Bundled script runtime: $(Join-Path $runtimeDirectory 'node.exe')"
