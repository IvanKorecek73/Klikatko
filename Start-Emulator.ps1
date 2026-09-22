[CmdletBinding()]
param(
    [ValidatePattern('^[A-Za-z0-9_.-]+$')][string]$AvdName = 'PID_Litacka_API_36',
    [ValidateRange(1024, 8192)][int]$MemoryMB = 4096,
    [switch]$Preview
)

$ErrorActionPreference = 'Stop'
if ($env:OS -ne 'Windows_NT') { throw 'Tento spouštěč je určen pro Windows.' }

$sdkRoot = if ($env:ANDROID_HOME) { $env:ANDROID_HOME }
    elseif ($env:ANDROID_SDK_ROOT) { $env:ANDROID_SDK_ROOT }
    else { Join-Path $env:LOCALAPPDATA 'Android/Sdk' }
$androidUserRoot = if ($env:ANDROID_USER_HOME) { $env:ANDROID_USER_HOME }
    else { Join-Path $env:USERPROFILE '.android' }
$avdRoot = if ($env:ANDROID_AVD_HOME) { $env:ANDROID_AVD_HOME }
    else { Join-Path $androidUserRoot 'avd' }
$emulatorExe = Join-Path $sdkRoot 'emulator/emulator.exe'
$avdDescriptor = Join-Path $avdRoot ($AvdName + '.ini')
if (-not (Test-Path -LiteralPath $emulatorExe -PathType Leaf)) { throw "Nenalezen emulátor: $emulatorExe" }
$avdMatch = [regex]::Match((Get-Content -LiteralPath $avdDescriptor -Raw), '(?m)^path\s*=\s*(.+?)\s*$')
if (-not $avdMatch.Success) { throw "Chybí path v $avdDescriptor" }
$avdDirectory = (Resolve-Path -LiteralPath $avdMatch.Groups[1].Value).Path
$hardwareConfig = Get-Content -LiteralPath (Join-Path $avdDirectory 'config.ini') -Raw
function Read-DisplayDimension([string]$Key) {
    $match = [regex]::Match($hardwareConfig, '(?m)^' + [regex]::Escape($Key) + '\s*=\s*(\d+)\s*$')
    if (-not $match.Success -or [int]$match.Groups[1].Value -le 0) { throw "Chybí platné $Key v config.ini" }
    return [int]$match.Groups[1].Value
}
$displayWidth = Read-DisplayDimension 'hw.lcd.width'
$displayHeight = Read-DisplayDimension 'hw.lcd.height'

# Use desktop logical coordinates, like Qt, and reserve room for frame and toolbar.
# -scale is obsolete; emulator-user.ini stores the emulator's persisted window scale.
Add-Type -AssemblyName System.Windows.Forms
$area = [System.Windows.Forms.Screen]::PrimaryScreen.WorkingArea
$margin = 40
$frameAllowance = 100
$scale = [math]::Min(0.35, [math]::Min(
    ($area.Width - 2 * $margin - $frameAllowance) / $displayWidth,
    ($area.Height - 2 * $margin - $frameAllowance) / $displayHeight))
if ($scale -le 0) { throw 'Na aktuálním monitoru není dost místa pro okno emulátoru.' }
$scale = [math]::Floor($scale * 100) / 100
$placement = [ordered]@{
    'window.x' = ($area.Left + $margin).ToString([cultureinfo]::InvariantCulture)
    'window.y' = ($area.Top + $margin).ToString([cultureinfo]::InvariantCulture)
    'window.scale' = $scale.ToString('F6', [cultureinfo]::InvariantCulture)
}
$plan = [pscustomobject]@{
    avd = $AvdName; monitor = [System.Windows.Forms.Screen]::PrimaryScreen.DeviceName
    workingAreaWidth = $area.Width; workingAreaHeight = $area.Height
    window = $placement; memoryMB = $MemoryMB; preview = [bool]$Preview
}
if ($Preview) { $plan; return }

# Do not start a second instance or edit settings which a running emulator will overwrite.
$running = @(Get-Process -ErrorAction SilentlyContinue | Where-Object {
    $_.ProcessName -eq 'emulator' -or $_.ProcessName -like 'qemu-system-*'
})
if ($running.Count -gt 0) {
    throw 'Emulátor již běží. Nezakládám další instanci; nejprve jej řádně ukončete po dokončení testů.'
}
$userIni = Join-Path $avdDirectory 'emulator-user.ini'
$content = if (Test-Path -LiteralPath $userIni) { Get-Content -LiteralPath $userIni -Raw } else { '' }
if (Test-Path -LiteralPath $userIni) {
    Copy-Item -LiteralPath $userIni -Destination ($userIni + '.before-klikatko-window.bak') -Force
}
foreach ($entry in $placement.GetEnumerator()) {
    $pattern = '(?m)^' + [regex]::Escape($entry.Key) + '\s*=.*$'
    $line = $entry.Key + ' = ' + $entry.Value
    if ([regex]::IsMatch($content, $pattern)) { $content = [regex]::Replace($content, $pattern, $line) }
    else { $content = $content.TrimEnd() + "`r`n" + $line + "`r`n" }
}
[IO.File]::WriteAllText($userIni, $content, [Text.UTF8Encoding]::new($false))
$logDirectory = Join-Path $PSScriptRoot 'public/local/emulator'
[void](New-Item -ItemType Directory -Path $logDirectory -Force)
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss-fff'
$process = Start-Process -FilePath $emulatorExe -ArgumentList @('-avd', $AvdName, '-memory', $MemoryMB, '-no-snapshot') `
    -WindowStyle Hidden -PassThru `
    -RedirectStandardOutput (Join-Path $logDirectory "$stamp.stdout.log") `
    -RedirectStandardError (Join-Path $logDirectory "$stamp.stderr.log")
$plan | Add-Member -NotePropertyName launcherPid -NotePropertyValue $process.Id
$plan | Add-Member -NotePropertyName logPrefix -NotePropertyValue (Join-Path $logDirectory $stamp)
$plan
