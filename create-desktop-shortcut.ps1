# create-desktop-shortcut.ps1
# Creates a Desktop shortcut to start-local-dashboard.bat
# Run from the project root:
#   powershell -ExecutionPolicy Bypass -File .\create-desktop-shortcut.ps1

$projectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$target      = Join-Path $projectRoot "start-local-dashboard.bat"
$desktop     = [Environment]::GetFolderPath("Desktop")
$shortcut    = Join-Path $desktop "Quant Portfolio Dashboard.lnk"

$shell = New-Object -ComObject WScript.Shell
$lnk   = $shell.CreateShortcut($shortcut)
$lnk.TargetPath       = $target
$lnk.WorkingDirectory = $projectRoot
$lnk.Description      = "Start Quant Portfolio Analytics Dashboard (proxy + frontend)"
$lnk.Save()

Write-Host ""
Write-Host "  Shortcut created:"
Write-Host "    $shortcut"
Write-Host ""
Write-Host "  Double-click it from the Desktop to launch the dashboard."
Write-Host ""
