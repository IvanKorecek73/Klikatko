param(
    [int]$Port = 5096,
    [string]$TargetBaseUrl = "http://localhost:5087",
    [int]$ProxyTimeoutSeconds = 30,
    [int]$RedisBridgePort = 5097,
    [string]$RedisConnectionString = "localhost:6379,abortConnect=false"
)

$ErrorActionPreference = "Stop"

Add-Type -AssemblyName System.Net.Http
Add-Type -AssemblyName System.Web

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$publicRoot = Join-Path $root "public"
$redisBridgeProcess = $null
$listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback, $Port)
$httpClientHandler = [System.Net.Http.HttpClientHandler]::new()
$decompressionMethods = [System.Net.DecompressionMethods]::GZip -bor [System.Net.DecompressionMethods]::Deflate

try {
    $decompressionMethods = $decompressionMethods -bor [System.Net.DecompressionMethods]::Brotli
}
catch {
    # Brotli is not available on older Windows PowerShell runtimes.
}

$httpClientHandler.AutomaticDecompression = $decompressionMethods
$httpClient = [System.Net.Http.HttpClient]::new($httpClientHandler)
$httpClient.Timeout = [TimeSpan]::FromSeconds($ProxyTimeoutSeconds)

$mimeTypes = @{
    ".html" = "text/html; charset=utf-8"
    ".css" = "text/css; charset=utf-8"
    ".js" = "application/javascript; charset=utf-8"
    ".json" = "application/json; charset=utf-8"
}

function Resolve-StaticPath {
    param([string]$RequestPath)

    if ($RequestPath -eq "/") {
        $RequestPath = "/index.html"
    }

    $relativePath = $RequestPath.TrimStart("/") -replace "/", [System.IO.Path]::DirectorySeparatorChar
    $filePath = [System.IO.Path]::GetFullPath((Join-Path $publicRoot $relativePath))
    $publicFullPath = [System.IO.Path]::GetFullPath($publicRoot)

    if (-not $filePath.StartsWith($publicFullPath, [System.StringComparison]::OrdinalIgnoreCase)) {
        return $null
    }

    return $filePath
}

function Read-Request {
    param([System.Net.Sockets.NetworkStream]$Stream)

    $buffer = New-Object byte[] 65536
    $memory = [System.IO.MemoryStream]::new()
    $headersEnd = -1

    while ($headersEnd -lt 0) {
        $read = $Stream.Read($buffer, 0, $buffer.Length)

        if ($read -le 0) {
            return $null
        }

        $memory.Write($buffer, 0, $read)
        $text = [System.Text.Encoding]::ASCII.GetString($memory.ToArray())
        $headersEnd = $text.IndexOf("`r`n`r`n", [System.StringComparison]::Ordinal)
    }

    $bytes = $memory.ToArray()
    $headerText = [System.Text.Encoding]::ASCII.GetString($bytes, 0, $headersEnd)
    $lines = $headerText -split "`r`n"
    $requestLine = $lines[0] -split " "
    $headers = @{}

    foreach ($line in $lines[1..($lines.Length - 1)]) {
        $separator = $line.IndexOf(":")

        if ($separator -gt 0) {
            $headers[$line.Substring(0, $separator)] = $line.Substring($separator + 1).Trim()
        }
    }

    $bodyStart = $headersEnd + 4
    $contentLength = if ($headers.ContainsKey("Content-Length")) { [int]$headers["Content-Length"] } else { 0 }
    $body = [System.IO.MemoryStream]::new()

    if ($bytes.Length -gt $bodyStart) {
        $existing = [Math]::Min($bytes.Length - $bodyStart, $contentLength)
        $body.Write($bytes, $bodyStart, $existing)
    }

    while ($body.Length -lt $contentLength) {
        $remaining = $contentLength - [int]$body.Length
        $read = $Stream.Read($buffer, 0, [Math]::Min($buffer.Length, $remaining))

        if ($read -le 0) {
            break
        }

        $body.Write($buffer, 0, $read)
    }

    return @{
        Method = $requestLine[0]
        Path = $requestLine[1]
        Headers = $headers
        Body = $body.ToArray()
    }
}

function Write-Response {
    param(
        [System.Net.Sockets.NetworkStream]$Stream,
        [int]$StatusCode,
        [string]$StatusText,
        [hashtable]$Headers,
        [byte[]]$Body
    )

    if (-not $Body) {
        $Body = [byte[]]::new(0)
    }

    $headersText = "HTTP/1.1 $StatusCode $StatusText`r`n"
    $headersText += "Content-Length: $($Body.Length)`r`n"
    $headersText += "Connection: close`r`n"

    foreach ($name in $Headers.Keys) {
        $headersText += "${name}: $($Headers[$name])`r`n"
    }

    $headersText += "`r`n"
    $headerBytes = [System.Text.Encoding]::ASCII.GetBytes($headersText)
    $Stream.Write($headerBytes, 0, $headerBytes.Length)

    if ($Body.Length -gt 0) {
        $Stream.Write($Body, 0, $Body.Length)
    }
}

function Send-StaticResponse {
    param(
        [System.Net.Sockets.NetworkStream]$Stream,
        [string]$RequestPath
    )

    $filePath = Resolve-StaticPath $RequestPath

    if (-not $filePath -or -not (Test-Path -LiteralPath $filePath -PathType Leaf)) {
        Write-Response $Stream 404 "Not Found" @{
            "Content-Type" = "text/plain; charset=utf-8"
            "Cache-Control" = "no-store"
        } ([System.Text.Encoding]::UTF8.GetBytes("Not found"))
        return
    }

    $extension = [System.IO.Path]::GetExtension($filePath)
    $contentType = $mimeTypes[$extension]

    if (-not $contentType) {
        $contentType = "application/octet-stream"
    }

    Write-Response $Stream 200 "OK" @{
        "Content-Type" = $contentType
        "Cache-Control" = "no-store"
    } ([System.IO.File]::ReadAllBytes($filePath))
}

function Send-ProxyResponse {
    param(
        [System.Net.Sockets.NetworkStream]$Stream,
        [hashtable]$Request
    )

    $targetPath = $Request.Path.Substring(4)
    $targetUri = [Uri]::new(([Uri]$script:TargetBaseUrl), $targetPath)
    $message = [System.Net.Http.HttpRequestMessage]::new(
        [System.Net.Http.HttpMethod]::new($Request.Method),
        $targetUri)

    foreach ($headerName in $Request.Headers.Keys) {
        if ($headerName -in @("Host", "Content-Length", "Connection", "Accept-Encoding")) {
            continue
        }

        [void]$message.Headers.TryAddWithoutValidation($headerName, $Request.Headers[$headerName])
    }

    [void]$message.Headers.TryAddWithoutValidation("Accept-Encoding", "identity")

    if ($Request.Body.Length -gt 0) {
        $message.Content = [System.Net.Http.ByteArrayContent]::new($Request.Body)

        if ($Request.Headers.ContainsKey("Content-Type")) {
            [void]$message.Content.Headers.TryAddWithoutValidation("Content-Type", $Request.Headers["Content-Type"])
        }
    }

    try {
        $targetResponse = $httpClient.SendAsync($message).GetAwaiter().GetResult()
        $body = $targetResponse.Content.ReadAsByteArrayAsync().GetAwaiter().GetResult()
        $contentType = "application/octet-stream"

        if ($targetResponse.Content.Headers.ContentType) {
            $contentType = $targetResponse.Content.Headers.ContentType.ToString()
        }

        $headers = @{
            "Access-Control-Allow-Origin" = "*"
            "Content-Type" = $contentType
        }

        Write-Response $Stream ([int]$targetResponse.StatusCode) $targetResponse.ReasonPhrase $headers $body
    }
    catch {
        $payload = @{
            error = "ProxyError"
            message = "Backend is not reachable. Start the WebApi or change the API proxy target."
            detail = $_.Exception.Message
            target = $targetUri.ToString()
        } | ConvertTo-Json -Depth 4
        Write-Response $Stream 502 "Bad Gateway" @{
            "Content-Type" = "application/json; charset=utf-8"
        } ([System.Text.Encoding]::UTF8.GetBytes($payload))
    }
}

function Send-HarnessMeta {
    param([System.Net.Sockets.NetworkStream]$Stream)

    $payload = @{
        port = $Port
        proxyBasePath = "/api"
        proxyTarget = $script:TargetBaseUrl
    } | ConvertTo-Json -Depth 4

    Write-Response $Stream 200 "OK" @{
        "Content-Type" = "application/json; charset=utf-8"
        "Cache-Control" = "no-store"
        "Access-Control-Allow-Origin" = "*"
    } ([System.Text.Encoding]::UTF8.GetBytes($payload))
}

function Set-ProxyTarget {
    param(
        [System.Net.Sockets.NetworkStream]$Stream,
        [hashtable]$Request
    )

    if ($Request.Method -ne "POST") {
        Write-Response $Stream 405 "Method Not Allowed" @{
            "Content-Type" = "application/json; charset=utf-8"
        } ([System.Text.Encoding]::UTF8.GetBytes('{"error":"MethodNotAllowed"}'))
        return
    }

    try {
        $raw = [System.Text.Encoding]::UTF8.GetString($Request.Body)
        $payload = if ([string]::IsNullOrWhiteSpace($raw)) { $null } else { $raw | ConvertFrom-Json }
        $nextTarget = [string]$payload.targetBaseUrl

        if ([string]::IsNullOrWhiteSpace($nextTarget)) {
            throw "targetBaseUrl is required."
        }

        $uri = [Uri]$nextTarget

        if ($uri.Scheme -notin @("http", "https")) {
            throw "Only http/https targets are supported."
        }

        $script:TargetBaseUrl = $uri.ToString().TrimEnd("/")
        $responsePayload = @{
            status = "OK"
            proxyTarget = $script:TargetBaseUrl
        } | ConvertTo-Json -Depth 4

        Write-Response $Stream 200 "OK" @{
            "Content-Type" = "application/json; charset=utf-8"
            "Cache-Control" = "no-store"
            "Access-Control-Allow-Origin" = "*"
        } ([System.Text.Encoding]::UTF8.GetBytes($responsePayload))
    }
    catch {
        $payload = @{
            error = "InvalidProxyTarget"
            message = $_.Exception.Message
        } | ConvertTo-Json -Depth 4

        Write-Response $Stream 400 "Bad Request" @{
            "Content-Type" = "application/json; charset=utf-8"
            "Cache-Control" = "no-store"
        } ([System.Text.Encoding]::UTF8.GetBytes($payload))
    }
}

function Get-RedisConfig {
    $config = @{
        Host = "localhost"
        Port = 6379
        Database = 0
        Password = $null
    }

    if ([string]::IsNullOrWhiteSpace($RedisConnectionString)) {
        return $config
    }

    if ($RedisConnectionString.StartsWith("redis://", [System.StringComparison]::OrdinalIgnoreCase)) {
        $uri = [Uri]$RedisConnectionString
        $config.Host = $uri.Host
        $config.Port = if ($uri.Port -gt 0) { $uri.Port } else { 6379 }
        $dbText = $uri.AbsolutePath.Trim("/")
        if (-not [string]::IsNullOrWhiteSpace($dbText)) {
            $config.Database = [int]$dbText
        }
        if (-not [string]::IsNullOrWhiteSpace($uri.UserInfo)) {
            $parts = $uri.UserInfo.Split(":", 2)
            $config.Password = [Uri]::UnescapeDataString($parts[$parts.Length - 1])
        }
        return $config
    }

    foreach ($part in ($RedisConnectionString -split ",")) {
        $item = $part.Trim()
        if ([string]::IsNullOrWhiteSpace($item)) {
            continue
        }

        $separator = $item.IndexOf("=")
        if ($separator -gt 0) {
            $name = $item.Substring(0, $separator).Trim().ToLowerInvariant()
            $value = $item.Substring($separator + 1).Trim()

            if ($name -in @("defaultdatabase", "database")) {
                $config.Database = [int]$value
            }
            elseif ($name -eq "password") {
                $config.Password = $value
            }
            continue
        }

        $hostParts = $item.Split(":", 2)
        $config.Host = $hostParts[0]
        if ($hostParts.Length -gt 1) {
            $config.Port = [int]$hostParts[1]
        }
    }

    return $config
}

function Read-RedisLine {
    param([System.IO.Stream]$Stream)

    $bytes = [System.Collections.Generic.List[byte]]::new()
    while ($true) {
        $value = $Stream.ReadByte()
        if ($value -lt 0) {
            throw "Redis connection closed."
        }
        if ($value -eq 13) {
            $lf = $Stream.ReadByte()
            if ($lf -ne 10) {
                throw "Invalid Redis line ending."
            }
            break
        }
        $bytes.Add([byte]$value)
    }

    return [System.Text.Encoding]::UTF8.GetString($bytes.ToArray())
}

function Read-RedisValue {
    param([System.IO.Stream]$Stream)

    $prefix = $Stream.ReadByte()
    if ($prefix -lt 0) {
        throw "Redis connection closed."
    }

    switch ([char]$prefix) {
        "+" { return Read-RedisLine $Stream }
        "-" { throw (Read-RedisLine $Stream) }
        ":" { return [int64](Read-RedisLine $Stream) }
        "$" {
            $length = [int](Read-RedisLine $Stream)
            if ($length -lt 0) {
                return $null
            }

            $buffer = New-Object byte[] $length
            $offset = 0
            while ($offset -lt $length) {
                $read = $Stream.Read($buffer, $offset, $length - $offset)
                if ($read -le 0) {
                    throw "Redis bulk string ended early."
                }
                $offset += $read
            }
            [void]$Stream.ReadByte()
            [void]$Stream.ReadByte()
            return [System.Text.Encoding]::UTF8.GetString($buffer)
        }
        "*" {
            $count = [int](Read-RedisLine $Stream)
            if ($count -lt 0) {
                return $null
            }

            $items = @()
            for ($i = 0; $i -lt $count; $i += 1) {
                $items += ,(Read-RedisValue $Stream)
            }
            return $items
        }
        default {
            throw "Unsupported Redis response prefix '$([char]$prefix)'."
        }
    }
}

function Write-RedisCommand {
    param(
        [System.IO.Stream]$Stream,
        [string[]]$Parts
    )

    $payload = New-Object System.Text.StringBuilder
    [void]$payload.Append("*$($Parts.Length)`r`n")
    foreach ($part in $Parts) {
        $bytes = [System.Text.Encoding]::UTF8.GetBytes([string]$part)
        [void]$payload.Append("`$$($bytes.Length)`r`n")
        [void]$payload.Append([string]$part)
        [void]$payload.Append("`r`n")
    }

    $data = [System.Text.Encoding]::UTF8.GetBytes($payload.ToString())
    $Stream.Write($data, 0, $data.Length)
    return Read-RedisValue $Stream
}

function Invoke-RedisCommand {
    param([string[]]$Parts)

    $config = Get-RedisConfig
    $client = [System.Net.Sockets.TcpClient]::new()
    $client.ReceiveTimeout = 5000
    $client.SendTimeout = 5000

    try {
        $connect = $client.ConnectAsync([string]$config.Host, [int]$config.Port)
        if (-not $connect.Wait(5000)) {
            throw "Redis connection timed out."
        }

        $stream = $client.GetStream()

        if (-not [string]::IsNullOrWhiteSpace($config.Password)) {
            [void](Write-RedisCommand $stream @("AUTH", [string]$config.Password))
        }

        if ([int]$config.Database -gt 0) {
            [void](Write-RedisCommand $stream @("SELECT", [string]$config.Database))
        }

        return Write-RedisCommand $stream $Parts
    }
    finally {
        $client.Close()
    }
}

function Invoke-RedisConfiguredCommand {
    param([string[]]$Parts)

    return Invoke-RedisCommand $Parts
}

function Get-RedisHash {
    param([string]$Key)

    $entries = Invoke-RedisConfiguredCommand @("HGETALL", $Key)
    $hash = @{}
    for ($i = 0; $i -lt $entries.Count; $i += 2) {
        $hash[[string]$entries[$i]] = if ($i + 1 -lt $entries.Count) { [string]$entries[$i + 1] } else { "" }
    }
    return $hash
}

function ConvertFrom-JsonSafe {
    param([string]$Value)

    if ([string]::IsNullOrWhiteSpace($Value)) {
        return $null
    }

    try {
        return $Value | ConvertFrom-Json
    }
    catch {
        return $null
    }
}

function Read-RedisAnyKey {
    param([string]$Key)

    $type = [string](Invoke-RedisConfiguredCommand @("TYPE", $Key))
    $ttl = [int64](Invoke-RedisConfiguredCommand @("TTL", $Key))
    $result = @{
        key = $Key
        exists = ($type -ne "none")
        type = $type
        ttlSeconds = $ttl
    }

    if ($type -eq "hash") {
        $result.hash = Get-RedisHash $Key
    }
    elseif ($type -eq "string") {
        $result.value = Invoke-RedisConfiguredCommand @("GET", $Key)
    }

    return $result
}

function Read-RedisSession {
    param([string]$IdentityId)

    $key = "mos:session:user:$IdentityId"
    $data = Read-RedisAnyKey $key
    $payload = ConvertFrom-JsonSafe $data.hash.payload
    $sessionId = ""

    if ($data.hash.sid) {
        $sessionId = [string]$data.hash.sid
    }
    elseif ($payload -and $payload.sessionId) {
        $sessionId = [string]$payload.sessionId
    }
    elseif ($payload -and $payload.SessionId) {
        $sessionId = [string]$payload.SessionId
    }

    $data.payload = $payload
    $data.sessionId = $sessionId
    return $data
}

function Scan-RedisKeys {
    param(
        [string]$Pattern,
        [int]$Count
    )

    $cursor = "0"
    $keys = @()

    do {
        $scan = Invoke-RedisConfiguredCommand @("SCAN", $cursor, "MATCH", $Pattern, "COUNT", [string]$Count)
        $cursor = [string]$scan[0]
        $keys += @($scan[1])
    } while ($cursor -ne "0" -and $keys.Count -lt $Count)

    return @{
        pattern = $Pattern
        count = $Count
        keys = @($keys | Select-Object -First $Count)
    }
}

function Send-RedisResponse {
    param(
        [System.Net.Sockets.NetworkStream]$Stream,
        [hashtable]$Request
    )

    try {
        $uri = [Uri]::new("http://localhost$($Request.Path)")
        $path = $uri.AbsolutePath
        $query = [System.Web.HttpUtility]::ParseQueryString($uri.Query)
        $payload = $null

        if ($Request.Method -ne "GET") {
            Write-Response $Stream 405 "Method Not Allowed" @{
                "Content-Type" = "application/json; charset=utf-8"
            } ([System.Text.Encoding]::UTF8.GetBytes('{"error":"MethodNotAllowed"}'))
            return
        }

        if ($path.Equals("/__redis/health", [System.StringComparison]::OrdinalIgnoreCase)) {
            $pong = Invoke-RedisConfiguredCommand @("PING")
            $config = Get-RedisConfig
            $payload = @{
                status = if ($pong -eq "PONG") { "OK" } else { "WARN" }
                redis = @{
                    host = $config.Host
                    port = $config.Port
                    database = $config.Database
                }
            }
        }
        elseif ($path.StartsWith("/__redis/session/", [System.StringComparison]::OrdinalIgnoreCase)) {
            $identityId = [Uri]::UnescapeDataString($path.Substring("/__redis/session/".Length)).Trim()
            $payload = Read-RedisSession $identityId
        }
        elseif ($path.Equals("/__redis/key", [System.StringComparison]::OrdinalIgnoreCase)) {
            $key = [string]$query["key"]
            if ([string]::IsNullOrWhiteSpace($key)) {
                throw "Query parameter key is required."
            }
            $payload = Read-RedisAnyKey $key
        }
        elseif ($path.Equals("/__redis/scan", [System.StringComparison]::OrdinalIgnoreCase)) {
            $pattern = if ([string]::IsNullOrWhiteSpace($query["pattern"])) { "mos:session:user:*" } else { [string]$query["pattern"] }
            $count = if ([string]::IsNullOrWhiteSpace($query["count"])) { 50 } else { [int]$query["count"] }
            $count = [Math]::Min([Math]::Max($count, 1), 200)
            $payload = Scan-RedisKeys $pattern $count
        }
        else {
            Write-Response $Stream 404 "Not Found" @{
                "Content-Type" = "application/json; charset=utf-8"
            } ([System.Text.Encoding]::UTF8.GetBytes('{"error":"NotFound"}'))
            return
        }

        $json = $payload | ConvertTo-Json -Depth 20
        Write-Response $Stream 200 "OK" @{
            "Content-Type" = "application/json; charset=utf-8"
            "Cache-Control" = "no-store"
            "Access-Control-Allow-Origin" = "*"
        } ([System.Text.Encoding]::UTF8.GetBytes($json))
    }
    catch {
        $json = @{
            error = "RedisBridgeError"
            message = $_.Exception.Message
        } | ConvertTo-Json -Depth 4
        Write-Response $Stream 500 "Internal Server Error" @{
            "Content-Type" = "application/json; charset=utf-8"
            "Cache-Control" = "no-store"
            "Access-Control-Allow-Origin" = "*"
        } ([System.Text.Encoding]::UTF8.GetBytes($json))
    }
}

try {
    $nodeCommand = Get-Command node -ErrorAction SilentlyContinue
    if ($nodeCommand) {
        $env:REDIS_BRIDGE_PORT = [string]$RedisBridgePort
        $env:REDIS_CONNECTION_STRING = $RedisConnectionString
        $redisBridgeScript = Join-Path $root "tools\redis-bridge\src\server.js"
        try {
            $redisBridgeProcess = Start-Process -FilePath $nodeCommand.Source -ArgumentList @($redisBridgeScript) -WorkingDirectory $root -WindowStyle Hidden -PassThru
        }
        catch {
            $redisBridgeProcess = $null
        }
    }

    $listener.Start()
    Write-Host "Ticket Service demo harness: http://localhost:$Port"
    Write-Host "Proxy target: $TargetBaseUrl"
    if ($redisBridgeProcess) {
        Write-Host "Redis bridge: http://127.0.0.1:$RedisBridgePort"
    }
    else {
        Write-Host "Redis bridge: same-origin /__redis"
    }
    Write-Host "Stop with Ctrl+C."

    while ($true) {
        $client = $listener.AcceptTcpClient()

        try {
            $stream = $client.GetStream()
            $request = Read-Request $stream

            if (-not $request) {
                continue
            }

            $pathOnly = ([Uri]::new("http://localhost$($request.Path)")).AbsolutePath

            if ($pathOnly.Equals("/__harness/meta", [System.StringComparison]::OrdinalIgnoreCase)) {
                Send-HarnessMeta $stream
            }
            elseif ($pathOnly.Equals("/__harness/config/proxy-target", [System.StringComparison]::OrdinalIgnoreCase)) {
                Set-ProxyTarget $stream $request
            }
            elseif ($pathOnly.StartsWith("/__redis/", [System.StringComparison]::OrdinalIgnoreCase)) {
                Send-RedisResponse $stream $request
            }
            elseif ($pathOnly.StartsWith("/api/", [System.StringComparison]::OrdinalIgnoreCase)) {
                Send-ProxyResponse $stream $request
            }
            else {
                Send-StaticResponse $stream $pathOnly
            }
        }
        finally {
            $client.Close()
        }
    }
}
finally {
    $httpClient.Dispose()
    $listener.Stop()
    if ($redisBridgeProcess -and -not $redisBridgeProcess.HasExited) {
        $redisBridgeProcess.Kill()
        $redisBridgeProcess.Dispose()
    }
}
