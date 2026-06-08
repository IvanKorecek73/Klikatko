param(
    [int]$Port = 5095,
    [string]$TargetBaseUrl = "http://localhost:5087",
    [int]$ProxyTimeoutSeconds = 30
)

$ErrorActionPreference = "Stop"

Add-Type -AssemblyName System.Net.Http

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$publicRoot = Join-Path $root "public"
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

try {
    $listener.Start()
    Write-Host "Ticket Service demo harness: http://localhost:$Port"
    Write-Host "Proxy target: $TargetBaseUrl"
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
}
