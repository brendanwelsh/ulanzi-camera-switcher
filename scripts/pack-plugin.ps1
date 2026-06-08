# Zips the plugin folder (including node_modules/ws) into dist/ for sharing with others.
# They unzip into %APPDATA%\Ulanzi\UlanziDeck\Plugins\ and restart UlanziStudio.
# Run from the repo root: npm run pack
$ErrorActionPreference = 'Stop'
$root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$pluginDir = Join-Path $root 'plugin\com.ulanzi.camerascroller.ulanziPlugin'
$distDir = Join-Path $root 'dist'
$zip = Join-Path $distDir 'com.ulanzi.camerascroller.ulanziPlugin.zip'

if (-not (Test-Path (Join-Path $pluginDir 'node_modules\ws'))) {
  Write-Warning "node_modules\ws not found in the plugin. Run 'npm run setup:plugin' first so the shared zip actually works."
}
# Strip the recipient's private config so your NVR/camera IDs are never shipped.
$cfg = Join-Path $pluginDir 'config.json'
$cfgBak = $null
if (Test-Path $cfg) { $cfgBak = "$cfg.packbak"; Move-Item $cfg $cfgBak -Force }
try {
  New-Item -ItemType Directory -Force -Path $distDir | Out-Null
  if (Test-Path $zip) { Remove-Item $zip -Force }
  Compress-Archive -Path $pluginDir -DestinationPath $zip -Force
  Write-Host "Packed -> $zip  (config.json excluded; recipients copy config.example.json)"
} finally {
  if ($cfgBak) { Move-Item $cfgBak $cfg -Force }
}
