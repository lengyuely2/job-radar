$ErrorActionPreference = 'Stop'
$jobRoot = Split-Path -Parent $PSScriptRoot
$jobNodeCommand = Get-Command node -ErrorAction SilentlyContinue
if (-not $jobNodeCommand) { throw 'Please install Node.js 22.13 or newer.' }
if (-not (Test-Path -LiteralPath (Join-Path $jobRoot 'node_modules/exceljs'))) {
    throw 'Install dependencies first: open a terminal here and run npm install.'
}
$jobPort = if ($env:JOB_RADAR_PORT) { $env:JOB_RADAR_PORT } else { '4318' }
$jobAddress = 'http://127.0.0.1:' + $jobPort
Write-Host ('Job Radar: ' + $jobAddress)
Write-Host 'Keep this terminal open. Press Ctrl+C to stop the website.'
Start-Process $jobAddress
& $jobNodeCommand.Source (Join-Path $jobRoot 'local-server.mjs')
