param(
    [Parameter(Mandatory = $true)]
    [ValidateNotNullOrEmpty()]
    [string] $UserId,

    [ValidateSet('fixed', 'zonal', 'mapped')]
    [string] $Variant = 'fixed'
)

$ErrorActionPreference = 'Stop'
$containerName = 'tickets-smoke-960-postgres-1'
$connectionVariable = 'TICKETS_SMOKE_CONNECTION_STRING'

$containerState = docker inspect $containerName --format '{{.State.Running}}' 2>$null
if ($LASTEXITCODE -ne 0 -or $containerState -ne 'true') {
    throw "Docker container '$containerName' is not running."
}

$containerEnvironment = docker inspect $containerName --format '{{range .Config.Env}}{{println .}}{{end}}'
$passwordLine = $containerEnvironment |
    Where-Object { $_.StartsWith('POSTGRES_PASSWORD=') } |
    Select-Object -First 1

if (-not $passwordLine) {
    throw "POSTGRES_PASSWORD is missing in '$containerName'."
}

$password = $passwordLine.Substring('POSTGRES_PASSWORD='.Length)
$previousConnection = [Environment]::GetEnvironmentVariable($connectionVariable, 'Process')

try {
    [Environment]::SetEnvironmentVariable(
        $connectionVariable,
        "Host=localhost;Port=55432;Database=ticket_service_dev;Username=postgres;Password=$password",
        'Process')

    dotnet run --project "$PSScriptRoot/Task960Fixture.csproj" -- --user-id $UserId --variant $Variant
    if ($LASTEXITCODE -ne 0) {
        throw "Fixture failed with exit code $LASTEXITCODE."
    }
}
finally {
    [Environment]::SetEnvironmentVariable($connectionVariable, $previousConnection, 'Process')
}
