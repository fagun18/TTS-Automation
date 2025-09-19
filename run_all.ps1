param(
  [int]$Port = 3000,
  [switch]$WithWer
)

$ErrorActionPreference = "Stop"

Write-Host "Preparing mock server on port $Port..." -ForegroundColor Cyan
if ($env:MOCK_REAL_VOICE -eq "1") {
  Write-Host "Real voice enabled: ensuring Python venv and requirements..." -ForegroundColor Cyan
  if (-not (Test-Path ".\.venv")) { python -m venv .venv }
  .\.venv\Scripts\python.exe -m pip install --upgrade pip
  .\.venv\Scripts\pip.exe install -r requirements.txt
}
try {
  $conn = Get-NetTCPConnection -LocalPort $Port -ErrorAction Stop
  if ($conn) {
    Write-Host "Port $Port in use. Stopping owning process $($conn.OwningProcess)..." -ForegroundColor Yellow
    Stop-Process -Id $conn.OwningProcess -Force -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 1
  }
} catch {}

$env:PORT = "$Port"
$ApiUrl = "http://localhost:$Port/synthesize"

Write-Host "Starting mock server..." -ForegroundColor Cyan
$mock = Start-Process -FilePath "npm.cmd" -ArgumentList "run","mock" -NoNewWindow -PassThru
Start-Sleep -Seconds 1

try {
  $env:TTS_API_URL = $ApiUrl
  Write-Host "Running smoke..." -ForegroundColor Cyan
  npm run smoke

  Write-Host "Running tests..." -ForegroundColor Cyan
  npm test

  if ($WithWer) {
    Write-Host "Running WER eval..." -ForegroundColor Cyan
    if (-not (Test-Path ".\.venv")) { python -m venv .venv }
    .\.venv\Scripts\Activate.ps1
    pip install -r requirements.txt
    python wer_eval.py .\outputs\run_results.csv
  }

  Write-Host "Generating HTML report..." -ForegroundColor Cyan
  npm run report
}
finally {
  if ($mock -and -not $mock.HasExited) { Write-Host "Stopping mock server..." -ForegroundColor Yellow; Stop-Process -Id $mock.Id -Force }
}

Write-Host "Done. See .\\outputs for files and report.html" -ForegroundColor Green


