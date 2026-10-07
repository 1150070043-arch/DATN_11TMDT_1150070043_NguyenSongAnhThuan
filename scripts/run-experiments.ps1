param(
  [ValidateSet("all", "security", "functional", "performance")]
  [string]$Suite = "all",
  [switch]$SkipReset
)

$ErrorActionPreference = "Stop"
$ProjectRoot = Split-Path -Parent $PSScriptRoot
$ReportsDir = Join-Path $ProjectRoot "reports\generated"
New-Item -ItemType Directory -Path $ReportsDir -Force | Out-Null
Set-Location $ProjectRoot

function Invoke-CheckedCompose {
  param([string[]]$Arguments)
  & docker compose @Arguments
  if ($LASTEXITCODE -ne 0) {
    throw "docker compose failed: $($Arguments -join ' ')"
  }
}

function Convert-MemoryToMb {
  param([string]$Value)
  $number = [double]::Parse(($Value -replace '[^0-9.]', ''), [Globalization.CultureInfo]::InvariantCulture)
  if ($Value -match 'GiB') { return $number * 1024 }
  if ($Value -match 'KiB') { return $number / 1024 }
  if ($Value -match 'B$' -and $Value -notmatch 'MiB|GiB|KiB') { return $number / 1MB }
  return $number
}

function Invoke-PerformanceRun {
  param(
    [ValidateSet("baseline", "secure")][string]$Mode
  )

  $apiService = "api-$Mode"
  $testService = "performance-$Mode"
  $containerId = (& docker compose ps -q $apiService).Trim()
  if (-not $containerId) { throw "$apiService is not running." }

  $job = Start-Job -ScriptBlock {
    param($WorkingDirectory, $Service)
    Set-Location $WorkingDirectory
    & docker compose --profile tools run --rm $Service
    if ($LASTEXITCODE -ne 0) { throw "$Service failed with exit code $LASTEXITCODE" }
  } -ArgumentList $ProjectRoot, $testService

  $cpuSamples = [Collections.Generic.List[double]]::new()
  $memorySamples = [Collections.Generic.List[double]]::new()
  try {
    while ($job.State -in @("NotStarted", "Running")) {
      $raw = & docker stats --no-stream --format "{{json .}}" $containerId 2>$null
      if ($LASTEXITCODE -eq 0 -and $raw) {
        $sample = $raw | ConvertFrom-Json
        $cpuSamples.Add([double]::Parse(($sample.CPUPerc -replace '%', ''), [Globalization.CultureInfo]::InvariantCulture))
        $usedMemory = ($sample.MemUsage -split '/')[0].Trim()
        $memorySamples.Add((Convert-MemoryToMb $usedMemory))
      }
      Start-Sleep -Seconds 2
    }
    Receive-Job $job -Wait
  }
  finally {
    Remove-Job $job -Force -ErrorAction SilentlyContinue
  }

  $reportPath = Join-Path $ReportsDir "k6-$Mode.json"
  $report = Get-Content $reportPath -Raw | ConvertFrom-Json
  $averageCpu = if ($cpuSamples.Count) { ($cpuSamples | Measure-Object -Average).Average } else { $null }
  $peakMemory = if ($memorySamples.Count) { ($memorySamples | Measure-Object -Maximum).Maximum } else { $null }
  $report | Add-Member -Force -NotePropertyName resources -NotePropertyValue ([ordered]@{
    cpuPercent = if ($null -eq $averageCpu) { $null } else { [math]::Round($averageCpu, 3) }
    memoryMb = if ($null -eq $peakMemory) { $null } else { [math]::Round($peakMemory, 3) }
    sampleCount = $cpuSamples.Count
    cpuAggregation = "average"
    memoryAggregation = "peak"
  })
  $json = $report | ConvertTo-Json -Depth 20
  Set-Content -Path $reportPath -Value $json -Encoding utf8
  $timestamp = ([datetime]$report.generatedAt).ToUniversalTime().ToString("yyyyMMddTHHmmssZ")
  Set-Content -Path (Join-Path $ReportsDir "k6-$Mode-$timestamp.json") -Value $json -Encoding utf8
}

Invoke-CheckedCompose -Arguments @("up", "-d", "--build", "sqlserver", "mailpit", "db-init", "api-baseline", "api-secure", "web-baseline", "web-secure")

if (-not $SkipReset) {
  Write-Host "Đang reset hai database về cùng seed trước thực nghiệm..." -ForegroundColor Yellow
  Invoke-CheckedCompose -Arguments @("run", "--rm", "db-init", "node", "dist/db/cli.js", "reset")
}

if ($Suite -in @("all", "security")) {
  Invoke-CheckedCompose -Arguments @("--profile", "tools", "run", "--rm", "security-tests")
}
if ($Suite -in @("all", "functional")) {
  Invoke-CheckedCompose -Arguments @("--profile", "tools", "run", "--rm", "functional-tests")
}
if ($Suite -in @("all", "performance")) {
  Invoke-PerformanceRun "baseline"
  Invoke-PerformanceRun "secure"
}

Write-Host "Báo cáo thật đã được lưu tại $ReportsDir" -ForegroundColor Green
Write-Host "Mở Admin > Thực nghiệm và chọn Đồng bộ báo cáo." -ForegroundColor Cyan
