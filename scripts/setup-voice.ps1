# Voice Engine Setup

$binDir = "bin/piper"
$piperZip = "$binDir/piper.zip"
$extractPath = "$binDir"

if (-not (Test-Path $binDir)) {
    New-Item -ItemType Directory -Path $binDir | Out-Null
}

Write-Host "Downloading Piper Engine for Windows..." -ForegroundColor Cyan
$ProgressPreference = 'SilentlyContinue'
Invoke-WebRequest -Uri "https://github.com/rhasspy/piper/releases/latest/download/piper_windows_amd64.zip" -OutFile $piperZip

Write-Host "Extracting..." -ForegroundColor Cyan
Expand-Archive -Path $piperZip -DestinationPath $extractPath -Force
Remove-Item $piperZip

Write-Host "Checking for Jarvis Model (LFS)..." -ForegroundColor Cyan
if (-not (Test-Path "$binDir/jarvis-high.onnx")) {
    Write-Host "Warning: jarvis-high.onnx not found. Make sure you have Git LFS installed and run 'git lfs pull'." -ForegroundColor Yellow
} else {
    Write-Host "Jarvis Model found." -ForegroundColor Green
}

Write-Host "Setup Complete!" -ForegroundColor Green
