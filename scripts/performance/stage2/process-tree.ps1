param(
  [Parameter(Mandatory = $true)]
  [int]$RootPid,
  [Parameter(Mandatory = $true)]
  [ValidateRange(1, 2147483647)]
  [int]$SampleMs
)

$ErrorActionPreference = 'Stop'
$sampleSeconds = $SampleMs / 1000

function Get-TreeIds {
  param(
    [object[]]$ProcessRows,
    [int]$Root
  )
  $ids = [System.Collections.Generic.HashSet[int]]::new()
  [void]$ids.Add($Root)
  do {
    $previousCount = $ids.Count
    foreach ($item in $ProcessRows) {
      if ($ids.Contains([int]$item.ParentProcessId)) {
        [void]$ids.Add([int]$item.ProcessId)
      }
    }
  } while ($ids.Count -gt $previousCount)
  return $ids
}

$beforeRows = @(Get-CimInstance Win32_Process)
if (-not ($beforeRows | Where-Object ProcessId -eq $RootPid)) {
  throw 'Electron root process not found'
}
$beforeIds = Get-TreeIds -ProcessRows $beforeRows -Root $RootPid
$cpuBefore = @{}
foreach ($processId in $beforeIds) {
  $process = Get-Process -Id $processId -ErrorAction SilentlyContinue
  if ($null -ne $process) {
    $cpuBefore[$processId] = $process.CPU
  }
}

Start-Sleep -Milliseconds $SampleMs

$afterRows = @(Get-CimInstance Win32_Process)
$afterIds = Get-TreeIds -ProcessRows $afterRows -Root $RootPid
$allIds = [System.Collections.Generic.HashSet[int]]::new()
foreach ($processId in $beforeIds) { [void]$allIds.Add($processId) }
foreach ($processId in $afterIds) { [void]$allIds.Add($processId) }

$rows = foreach ($processId in $allIds) {
  $process = Get-Process -Id $processId -ErrorAction SilentlyContinue
  $cim = $afterRows | Where-Object ProcessId -eq $processId | Select-Object -First 1
  if (($null -ne $process) -and ($null -ne $cim)) {
    $startCpu = if ($cpuBefore.ContainsKey($processId)) { [double]$cpuBefore[$processId] } else { 0 }
    $type = if ($processId -eq $RootPid) {
      'browser'
    } elseif ($cim.CommandLine -match '(?:^|\s)--type=([^\s"'']+)') {
      $Matches[1]
    } else {
      'sidecar'
    }
    [pscustomobject]@{
      pid = [int]$processId
      parentPid = [int]$cim.ParentProcessId
      imageName = [string]$cim.Name
      type = $type
      workingSetMiB = [math]::Round($process.WorkingSet64 / 1MB, 2)
      privateBytesMiB = [math]::Round($process.PrivateMemorySize64 / 1MB, 2)
      cpuPercentOneCore = [math]::Round((([double]$process.CPU - $startCpu) / $sampleSeconds) * 100, 1)
      threads = [int]$process.Threads.Count
      handles = [int]$process.HandleCount
    }
  }
}
$rows = @($rows)

[pscustomobject]@{
  processes = $rows
  totals = [pscustomobject]@{
    processCount = $rows.Count
    workingSetMiB = [math]::Round(($rows | Measure-Object workingSetMiB -Sum).Sum, 2)
    privateBytesMiB = [math]::Round(($rows | Measure-Object privateBytesMiB -Sum).Sum, 2)
    cpuPercentOneCore = [math]::Round(($rows | Measure-Object cpuPercentOneCore -Sum).Sum, 1)
    threads = [int](($rows | Measure-Object threads -Sum).Sum)
    handles = [int](($rows | Measure-Object handles -Sum).Sum)
  }
} | ConvertTo-Json -Depth 5 -Compress
