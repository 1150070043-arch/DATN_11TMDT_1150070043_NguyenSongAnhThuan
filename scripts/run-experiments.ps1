param(
  [ValidateSet("all", "security", "functional", "performance")]
  [string]$Suite = "all",
  [ValidateRange(3, 10)][int]$Repetitions = 3
)

$ErrorActionPreference = "Stop"
$ProjectRoot = Split-Path -Parent $PSScriptRoot
Set-Location $ProjectRoot
$ReportsDir = Join-Path $ProjectRoot "reports\generated"
$WarmupDir = Join-Path $ReportsDir "warmup"
$ExperimentBatch = [datetime]::UtcNow.ToString("yyyyMMddTHHmmssZ")
New-Item -ItemType Directory -Path $WarmupDir -Force | Out-Null
$ComposeFiles = @("-f", "docker-compose.yml", "-f", "docker-compose.audit.yml")

function Invoke-Compose {
  param([string[]]$Arguments)
  & docker compose @ComposeFiles @Arguments
  if ($LASTEXITCODE -ne 0) { throw "docker compose failed: $($Arguments -join ' ')" }
}
function Invoke-Npm {
  param([string]$Script)
  & npm run $Script
  if ($LASTEXITCODE -ne 0) { throw "npm run $Script failed" }
}
function Reset-AuditData {
  Invoke-Compose @("stop", "api-baseline", "api-secure")
  & node --env-file=.env scripts/audit-db.mjs --reset
  if ($LASTEXITCODE -ne 0) { throw "Isolated audit reset failed" }
}
function Wait-Api {
  param([string]$Mode)
  $port = if ($Mode -eq "secure") { 4002 } else { 4001 }
  for ($attempt = 0; $attempt -lt 30; $attempt++) {
    try { $health = Invoke-RestMethod "http://127.0.0.1:$port/api/health" -TimeoutSec 5; if ($health.data.mode -eq $Mode -and $health.data.auditFixture) { return } } catch {}
    Start-Sleep -Seconds 1
  }
  throw "$Mode API did not become healthy"
}
function Memory-Mb {
  param([string]$Value)
  $number = [double]::Parse(($Value -replace '[^0-9.]', ''), [Globalization.CultureInfo]::InvariantCulture)
  if ($Value -match "GiB") { return $number * 1024 }
  if ($Value -match "KiB") { return $number / 1024 }
  if ($Value -match "MiB") { return $number }
  return $number / 1MB
}
function Resource-Summary {
  param($Samples)
  return [ordered]@{
    cpuPercent = [math]::Round(($Samples | Measure-Object -Property cpu -Average).Average, 3)
    memoryMb = [math]::Round(($Samples | Measure-Object -Property memory -Maximum).Maximum, 3)
    sampleCount = $Samples.Count
    cpuAggregation = "average"
    memoryAggregation = "peak"
  }
}
function Invoke-PerformanceRun {
  param([string]$Mode, [int]$Iteration)
  Reset-AuditData
  Invoke-Compose @("up", "-d", "--no-deps", "api-$Mode")
  Wait-Api $Mode
  # Warm the same catalog/database path without changing orders or the measured report.
  Invoke-Compose @("run", "--rm", "--no-deps", "-e", "WARMUP=true", "-e", "DURATION=10s", "-e", "OUTPUT_FILE=/reports/warmup/k6-$Mode-$Iteration.json", "performance-$Mode")
  $apiId = (& docker compose @ComposeFiles ps -q "api-$Mode").Trim()
  $sqlId = (& docker compose @ComposeFiles ps -q sqlserver).Trim()
  $job = Start-Job -ScriptBlock {
    param($Root, $Mode)
    Set-Location $Root
    # Compose writes normal progress to stderr; turn it into output rather than a
    # PowerShell RemoteException. The native exit code remains the failure gate.
    & docker compose -f docker-compose.yml -f docker-compose.audit.yml run --rm --no-deps "performance-$Mode" 2>&1 | ForEach-Object { $_.ToString() }
    if ($LASTEXITCODE -ne 0) { throw "k6 $Mode failed with exit code $LASTEXITCODE" }
  } -ArgumentList $ProjectRoot, $Mode
  $apiSamples = [Collections.Generic.List[object]]::new()
  $sqlSamples = [Collections.Generic.List[object]]::new()
  try {
    while ($job.State -in @("NotStarted", "Running")) {
      $raw = & docker stats --no-stream --format "{{json .}}" $apiId $sqlId 2>$null
      if ($LASTEXITCODE -eq 0) {
        foreach ($line in $raw) {
          $sample = $line | ConvertFrom-Json
          $value = [pscustomobject]@{
            cpu = [double]::Parse(($sample.CPUPerc -replace "%", ""), [Globalization.CultureInfo]::InvariantCulture)
            memory = Memory-Mb (($sample.MemUsage -split "/")[0].Trim())
          }
          if ($apiId.StartsWith($sample.ID)) { $apiSamples.Add($value) }
          elseif ($sqlId.StartsWith($sample.ID)) { $sqlSamples.Add($value) }
        }
      }
      Start-Sleep -Seconds 2
    }
    Receive-Job $job -Wait -ErrorAction Stop
    if ($job.State -eq "Failed") { throw "k6 job failed" }
  } finally { Remove-Job $job -Force -ErrorAction SilentlyContinue }
  if (-not $apiSamples.Count -or -not $sqlSamples.Count) { throw "Missing API or SQL resource samples" }
  $reportPath = Join-Path $ReportsDir "k6-$Mode.json"
  $report = Get-Content -LiteralPath $reportPath -Raw -Encoding UTF8 | ConvertFrom-Json
  if (-not $report.thresholdsPassed) { throw "k6 thresholds failed" }
  $resources = Resource-Summary $apiSamples
  $resources["sqlServer"] = Resource-Summary $sqlSamples
  $report | Add-Member -Force -NotePropertyName resources -NotePropertyValue $resources
  $report | Add-Member -Force -NotePropertyName experiment -NotePropertyValue ([ordered]@{
    iteration = $Iteration; repetitions = $Repetitions; seed = "36 books / 60 orders"
    batch = $ExperimentBatch
    warmupSeconds = 10; activeApi = $Mode; database = "isolated audit database"
    sqlServerShared = $true; fixtureResetBeforeEachRun = $true
  })
  $json = $report | ConvertTo-Json -Depth 30
  Set-Content -LiteralPath $reportPath -Value $json -Encoding UTF8
  $stamp = ([datetime]$report.generatedAt).ToUniversalTime().ToString("yyyyMMddTHHmmssZ")
  Set-Content -LiteralPath (Join-Path $ReportsDir "k6-$Mode-$stamp.json") -Value $json -Encoding UTF8
  Write-Host "Measured $Mode run $Iteration/$Repetitions archived." -ForegroundColor Green
}

Invoke-Npm "build"
Invoke-Compose @("up", "-d", "--build", "api-baseline", "api-secure", "web-baseline", "web-secure")
if ($Suite -in @("all", "functional")) {
  Reset-AuditData
  Invoke-Compose @("up", "-d", "--no-deps", "api-baseline", "api-secure")
  Wait-Api "baseline"; Wait-Api "secure"
  Invoke-Npm "test:functional"
  # Each suite has its own limiter window; retain the actual limits in every suite.
  Invoke-Compose @("restart", "api-baseline", "api-secure")
  Wait-Api "baseline"; Wait-Api "secure"
  Invoke-Npm "test:commerce"
  Invoke-Compose @("restart", "api-baseline", "api-secure")
  Wait-Api "baseline"; Wait-Api "secure"
  Invoke-Npm "test:e2e"
}
if ($Suite -in @("all", "security")) {
  Reset-AuditData
  Invoke-Compose @("up", "-d", "--no-deps", "api-baseline", "api-secure")
  Wait-Api "baseline"; Wait-Api "secure"
  Invoke-Npm "test:security:browser"
  Invoke-Npm "test:security"
  & node --env-file=.env scripts/export-security-evidence.mjs
  if ($LASTEXITCODE -ne 0) { throw "Security event export failed" }
}
if ($Suite -in @("all", "performance")) {
  for ($iteration = 1; $iteration -le $Repetitions; $iteration++) {
    # Alternate order to reduce systematic warmup/host load bias.
    $modes = if ($iteration % 2) { @("baseline", "secure") } else { @("secure", "baseline") }
    foreach ($mode in $modes) { Invoke-PerformanceRun $mode $iteration }
  }
  Invoke-Compose @("up", "-d", "--no-deps", "api-baseline", "api-secure")
}
Write-Host "Isolated audit experiment reports saved in $ReportsDir" -ForegroundColor Green
Write-Host "Return to regular databases: docker compose up -d api-baseline api-secure web-baseline web-secure" -ForegroundColor Cyan
