const http = require("http");
const https = require("https");
const fs = require("fs");
const path = require("path");
const zlib = require("zlib");
const { handleRedisBridgeRequest } = require("./tools/redis-bridge/src/server");
const { handleTask960FixtureRequest } = require("./tools/task-960-fixture-bridge");
const { handleEmulatorBridgeRequest } = require("./tools/emulator-bridge");
const { handleDesktopBridgeRequest } = require("./tools/desktop-bridge");

const host = process.env.HARNESS_HOST || "127.0.0.1";
const port = Number(process.env.PORT || 5096);
let targetBaseUrl = process.env.TICKET_SERVICE_BASE_URL || "http://localhost:5087";
let targetIgnoreTlsCertificateErrors = false;
const proxyTimeoutMs = Number(process.env.HARNESS_PROXY_TIMEOUT_MS || 30000);
const emulatorActionTimeoutMs = normalizeTimeout(
  process.env.HARNESS_EMULATOR_ACTION_TIMEOUT_MS,
  120000
);
const publicDir = path.join(__dirname, "public");

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml"
};

const server = http.createServer((request, response) => {
  if (request.url.startsWith("/__harness/meta")) {
    serveMeta(response);
    return;
  }

  if (request.url.startsWith("/__harness/config/proxy-target")) {
    configureProxyTarget(request, response);
    return;
  }

  if (request.url === "/api/__harness/fixtures/task-960"
    || request.url.startsWith("/api/__harness/fixtures/task-960?")) {
    handleTask960FixtureRequest(request, response, { targetBaseUrl });
    return;
  }

  if (request.url.startsWith("/api/")) {
    proxyApi(request, response);
    return;
  }

  if (request.url.startsWith("/__redis/")) {
    handleRedisBridgeRequest(request, response, {
      pathPrefix: "/__redis",
      redisConfigResolver: resolveRedisConnectionString
    });
    return;
  }

  if (request.url.startsWith("/__emulator/")) {
    if (request.method === "POST" && request.url.startsWith("/__emulator/actions")) {
      request.setTimeout(emulatorActionTimeoutMs);
      response.setTimeout(emulatorActionTimeoutMs);
    }
    handleEmulatorBridgeRequest(request, response);
    return;
  }

  if (request.url.startsWith("/__desktop/")) {
    handleDesktopBridgeRequest(request, response);
    return;
  }

  serveStatic(request, response);
});

server.listen(port, host, () => {
  console.log(`Klikátko: http://${host}:${port}`);
  console.log(`Proxy target: ${targetBaseUrl}`);
});

server.timeout = proxyTimeoutMs + 2000;

function normalizeTimeout(value, fallback) {
  const timeout = Number(value);
  return Number.isFinite(timeout) && timeout >= 10000
    ? Math.round(timeout)
    : fallback;
}

function serveMeta(response) {
  response.writeHead(200, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "Access-Control-Allow-Origin": "*"
  });
  response.end(JSON.stringify({
    host,
    port,
    proxyBasePath: "/api",
    proxyTarget: targetBaseUrl,
    proxyIgnoreTlsCertificateErrors: targetIgnoreTlsCertificateErrors
  }));
}

function configureProxyTarget(request, response) {
  if (request.method !== "POST") {
    response.writeHead(405, { "Content-Type": "application/json; charset=utf-8" });
    response.end(JSON.stringify({ error: "MethodNotAllowed" }));
    return;
  }

  const chunks = [];
  request.on("data", chunk => chunks.push(chunk));
  request.on("end", () => {
    try {
      const raw = Buffer.concat(chunks).toString("utf8");
      const payload = raw ? JSON.parse(raw) : {};
      const nextTargetBaseUrl = String(payload.targetBaseUrl || "").trim();
      const parsed = new URL(nextTargetBaseUrl);

      if (!["http:", "https:"].includes(parsed.protocol)) {
        throw new Error("Only http/https targets are supported.");
      }

      targetBaseUrl = parsed.toString().replace(/\/$/, "");
      targetIgnoreTlsCertificateErrors = Boolean(payload.ignoreTlsCertificateErrors);
      response.writeHead(200, {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store",
        "Access-Control-Allow-Origin": "*"
      });
      response.end(JSON.stringify({
        status: "OK",
        proxyTarget: targetBaseUrl,
        proxyIgnoreTlsCertificateErrors: targetIgnoreTlsCertificateErrors
      }));
    } catch (error) {
      response.writeHead(400, {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store"
      });
      response.end(JSON.stringify({
        error: "InvalidProxyTarget",
        message: error instanceof Error ? error.message : String(error)
      }));
    }
  });
}

function resolveRedisConnectionString(environmentId) {
  const normalizedEnvironmentId = String(environmentId || "").trim();
  const localConfig = loadLocalConfig();
  const redisConnections = localConfig.redisConnections || localConfig.redisConnectionStrings || {};
  const redisConfig = localConfig.redis || {};
  const directValue = normalizedEnvironmentId ? redisConnections[normalizedEnvironmentId] : "";
  const objectValue = normalizedEnvironmentId ? redisConfig[normalizedEnvironmentId]?.connectionString : "";
  const fallbackValue = redisConnections.default || redisConfig.default?.connectionString || "";

  if (directValue || objectValue) {
    return directValue || objectValue;
  }

  if (normalizedEnvironmentId && normalizedEnvironmentId !== "pidlitacka-local" && !fallbackValue) {
    throw new Error(`Redis connection string for environment '${normalizedEnvironmentId}' is not configured in public/local/klikatko.local.json.`);
  }

  return fallbackValue || null;
}

function loadLocalConfig() {
  const filePath = path.join(publicDir, "local", "klikatko.local.json");

  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return {};
  }
}

function serveStatic(request, response) {
  const url = new URL(request.url, `http://localhost:${port}`);
  const relativePath = url.pathname === "/" ? "/index.html" : url.pathname;
  const filePath = path.normalize(path.join(publicDir, relativePath));

  if (!filePath.startsWith(publicDir)) {
    response.writeHead(403);
    response.end("Forbidden");
    return;
  }

  fs.readFile(filePath, (error, content) => {
    if (error) {
      response.writeHead(404);
      response.end("Not found");
      return;
    }

    response.writeHead(200, {
      "Content-Type": mimeTypes[path.extname(filePath)] || "application/octet-stream",
      "Cache-Control": "no-store"
    });
    response.end(content);
  });
}

function proxyApi(request, response) {
  const targetUrl = new URL(request.url.replace(/^\/api/, ""), targetBaseUrl);
  const requestImpl = targetUrl.protocol === "https:" ? https : http;
  const requestOptions = {
    method: request.method,
    headers: {
      ...request.headers,
      "accept-encoding": "identity",
      host: targetUrl.host
    }
  };

  if (targetUrl.protocol === "https:" && (isLocalHostname(targetUrl.hostname) || targetIgnoreTlsCertificateErrors)) {
    requestOptions.rejectUnauthorized = false;
  }

  const proxyRequest = requestImpl.request(
    targetUrl,
    requestOptions,
    proxyResponse => {
      const chunks = [];
      proxyResponse.on("data", chunk => chunks.push(chunk));
      proxyResponse.on("end", () => {
        decodeProxyBody(Buffer.concat(chunks), proxyResponse.headers["content-encoding"], (error, body) => {
          if (error) {
            response.writeHead(502, { "Content-Type": "application/json; charset=utf-8" });
            response.end(JSON.stringify({
              error: "ProxyError",
              message: "Backend response could not be decoded.",
              detail: error.message,
              target: targetUrl.toString()
            }));
            return;
          }

          response.writeHead(proxyResponse.statusCode || 502, sanitizeProxyResponseHeaders(proxyResponse.headers, body.length));
          response.end(body);
        });
      });
    });

  proxyRequest.setTimeout(proxyTimeoutMs, () => {
    proxyRequest.destroy(new Error(`Backend response timed out after ${proxyTimeoutMs} ms.`));
  });

  proxyRequest.on("error", error => {
    response.writeHead(502, { "Content-Type": "application/json; charset=utf-8" });
    response.end(JSON.stringify({
      error: "ProxyError",
      message: "Target service is not reachable. Check the API proxy target, network, TLS, or service availability.",
      detail: error.message,
      code: error.code || "",
      name: error.name || "",
      target: targetUrl.toString()
    }));
  });

  request.pipe(proxyRequest);
}

function decodeProxyBody(body, contentEncoding, callback) {
  const encoding = String(contentEncoding || "").toLowerCase();

  if (!encoding || encoding === "identity") {
    callback(null, body);
    return;
  }

  if (encoding.includes("gzip")) {
    zlib.gunzip(body, callback);
    return;
  }

  if (encoding.includes("br") && typeof zlib.brotliDecompress === "function") {
    zlib.brotliDecompress(body, callback);
    return;
  }

  if (encoding.includes("deflate")) {
    zlib.inflate(body, callback);
    return;
  }

  callback(null, body);
}

function sanitizeProxyResponseHeaders(headers, bodyLength) {
  const nextHeaders = {
    ...headers,
    "Access-Control-Allow-Origin": "*"
  };

  delete nextHeaders["content-encoding"];
  delete nextHeaders["Content-Encoding"];
  delete nextHeaders["content-length"];
  delete nextHeaders["Content-Length"];
  delete nextHeaders["transfer-encoding"];
  delete nextHeaders["Transfer-Encoding"];
  nextHeaders["Content-Length"] = String(bodyLength);

  return nextHeaders;
}

function isLocalHostname(hostname) {
  const normalized = String(hostname || "").toLowerCase();
  return normalized === "localhost"
    || normalized === "127.0.0.1"
    || normalized === "::1";
}
