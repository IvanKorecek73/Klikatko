param(
    [ValidateSet('LOCAL', 'INT')]
    [string]$Environment = 'LOCAL',
    [string]$DeviceId = 'emulator-5554'
)

$ErrorActionPreference = 'Stop'
if ($DeviceId -notmatch '^emulator-\d+$') { throw 'Vyberte lokální Android emulátor.' }
$taskAdb = $env:ANDROID_ADB_PATH
if (-not $taskAdb) { $taskAdb = Join-Path $env:LOCALAPPDATA 'Android/Sdk/platform-tools/adb.exe' }
if (-not (Test-Path -LiteralPath $taskAdb)) { throw 'ADB není dostupné.' }
$taskPackages = @{
    LOCAL = 'cz.dpp.praguepublictransport.dev.pidlitacka'
    INT = 'cz.dpp.praguepublictransport.pidlitacka.int'
}
$taskTarget = $taskPackages[$Environment]
$taskOther = if ($Environment -eq 'INT') { $taskPackages.LOCAL } else { $taskPackages.INT }
$taskInstalled = & $taskAdb -s $DeviceId shell pm list packages
if ($LASTEXITCODE -ne 0) { throw 'Emulátor není dostupný; automatický restart se neprovádí.' }
if ($taskInstalled -notcontains "package:$taskTarget") { throw "Nejprve nainstalujte variantu $Environment ($taskTarget)." }

# Both variants register the same payment callback scheme. Keep only the selected
# variant enabled so Android does not send a genuine gateway return to the other one.
& $taskAdb -s $DeviceId shell pm enable --user 0 $taskTarget
if ($LASTEXITCODE -ne 0) { throw 'Nepodařilo se povolit vybranou aplikaci.' }
if ($taskInstalled -contains "package:$taskOther") {
    & $taskAdb -s $DeviceId shell am force-stop $taskOther
    if ($LASTEXITCODE -ne 0) { throw 'Nepodařilo se ukončit druhou variantu.' }
    & $taskAdb -s $DeviceId shell pm disable-user --user 0 $taskOther
    if ($LASTEXITCODE -ne 0) { throw 'Nepodařilo se dočasně vypnout druhou variantu.' }
}
Write-Output "Připraveno $Environment ($taskTarget). Data aplikací zachována."
Write-Output 'Pro návrat k lokálním testům spusťte tento skript s -Environment LOCAL.'
