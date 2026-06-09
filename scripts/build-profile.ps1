# Builds an importable Ulanzi Dial profile (.ulanziDeckProfile) that pre-places the Camera
# Scroller actions: knob = Camera Scroller; three keys = Camera Buttons (pick a camera in each).
#
# A .ulanziDeckProfile is a "#Version: 2" header line followed by a ZIP of a <guid>.ulanziProfile
# folder. Import it in Ulanzi Studio with the Dial selected. PII-free: no NVR, no camera names.
#   powershell -File scripts\build-profile.ps1               # generic (binds by Model on import)
#   powershell -File scripts\build-profile.ps1 -DialUuid X   # pre-bind to a specific dial
param([string]$DialUuid = '')
$ErrorActionPreference = 'Stop'
$root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$pluginDir = Join-Path $root 'plugin\com.ulanzi.camerascroller.ulanziPlugin'
$pluginIcon = Join-Path $pluginDir 'resources\pluginIcon.png'
$outDir = Join-Path $root 'profiles'

$P = 'com.ulanzi.ulanzistudio.camerascroller'
function Guid { [guid]::NewGuid().ToString() }
function Key($action, $name, $param, $view) {
  [ordered]@{ Action = "$P.$action"; ActionID = (Guid); ActionParam = $param; LinkedTitle = $true;
    Name = $name; Plugin = @{}; State = 0; ViewParam = @(@{ IconRel = ''; Name = $view }) }
}

$page = Guid; $profileGuid = Guid; $profileFolder = "$profileGuid.ulanziProfile"

# dial: Encoder slot 0_2 = knob (Camera Scroller); a few keys = Camera Buttons (choose a camera in each)
$encoder = [ordered]@{ Type = 'Encoder'; Actions = [ordered]@{
  '0_2' = (Key 'scroller' 'Camera Scroller' (@{}) 'Cameras')
} }
$keypad = [ordered]@{ Type = 'Keypad'; Actions = [ordered]@{
  '0_0' = (Key 'jump' 'Camera Button' (@{}) 'Camera')
  '0_1' = (Key 'jump' 'Camera Button' (@{}) 'Camera')
  '1_0' = (Key 'jump' 'Camera Button' (@{}) 'Camera')
} }
$pageManifest = [ordered]@{ Controllers = @($encoder, $keypad); Icon = ''; Name = '' }
$rootManifest = [ordered]@{
  Device = [ordered]@{ Model = 'Dial'; UUID = $DialUuid }
  Icon = 'icon.png'; Name = 'Camera Scroller'
  Pages = [ordered]@{ Current = $page; Pages = @($page) }
  Version = '2.0'
}

$stage = Join-Path $root '.tmp_profile'
if (Test-Path $stage) { Remove-Item $stage -Recurse -Force }
$pdir = Join-Path $stage $profileFolder
$pages = Join-Path $pdir "Profiles\$page"
New-Item -ItemType Directory -Force -Path (Join-Path $pages 'Files'), (Join-Path $pages 'Images') | Out-Null
$rootManifest | ConvertTo-Json -Depth 12 -Compress | Set-Content (Join-Path $pdir 'manifest.json') -Encoding UTF8
$pageManifest | ConvertTo-Json -Depth 12 -Compress | Set-Content (Join-Path $pages 'manifest.json') -Encoding UTF8
'{}' | Set-Content (Join-Path $pdir 'translator.json') -Encoding UTF8
if (Test-Path $pluginIcon) { Copy-Item $pluginIcon (Join-Path $pdir 'icon.png') -Force }

$zip = Join-Path $stage 'p.zip'
Compress-Archive -Path $pdir -DestinationPath $zip -Force
New-Item -ItemType Directory -Force -Path $outDir | Out-Null
$out = Join-Path $outDir 'Camera-Scroller.ulanziDeckProfile'
$header = [System.Text.Encoding]::UTF8.GetBytes("#Version: 2`r`n")
[System.IO.File]::WriteAllBytes($out, $header + [System.IO.File]::ReadAllBytes($zip))
Remove-Item $stage -Recurse -Force
Write-Host "Built -> $out  (knob=Camera Scroller, 3 Camera Button keys; Device Model=Dial)"
