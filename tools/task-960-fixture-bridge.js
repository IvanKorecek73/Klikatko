const { execFile } = require("child_process");
const fs = require("fs");
const path = require("path");

const fixtureHeaderName = "x-klikatko-local-fixture";
const fixtureHeaderValue = "task-960";
const maxRequestBytes = 8 * 1024;
const maxOutputBytes = 1024 * 1024;
const processTimeoutMs = 120000;

function handleTask960FixtureRequest(request, response, options = {}) {
  if (request.method !== "POST") {
    writeJson(response, 405, { error: "MethodNotAllowed" });
    return;
  }

  if (!isLoopbackAddress(request.socket?.remoteAddress)) {
    writeJson(response, 403, {
      error: "LocalFixtureOnly",
      message: "Task 960 fixture is available only from the local machine."
    });
    return;
  }

  if (String(request.headers[fixtureHeaderName] || "") !== fixtureHeaderValue) {
    writeJson(response, 403, {
      error: "FixtureHeaderMissing",
      message: "The local fixture request header is missing."
    });
    return;
  }

  if (!String(request.headers["content-type"] || "").toLowerCase().startsWith("application/json")) {
    writeJson(response, 415, {
      error: "UnsupportedMediaType",
      message: "The local fixture endpoint accepts application/json only."
    });
    return;
  }

  let target;
  try {
    target = new URL(String(options.targetBaseUrl || ""));
  } catch {
    writeJson(response, 409, {
      error: "LocalEnvironmentRequired",
      message: "Select the LOCAL PidLitacka environment before preparing the fixture."
    });
    return;
  }

  if (!isLocalHostname(target.hostname)) {
    writeJson(response, 409, {
      error: "LocalEnvironmentRequired",
      message: "Task 960 fixture is disabled outside the LOCAL environment."
    });
    return;
  }

  readJsonBody(request)
    .then(payload => validatePayload(payload))
    .then(payload => createFixtures(payload, options))
    .then(result => writeJson(response, 201, result))
    .catch(error => {
      const statusCode = error.statusCode || 503;
      writeJson(response, statusCode, {
        error: error.code || "FixtureUnavailable",
        message: sanitizeMessage(error.message)
      });
    });
}

function readJsonBody(request) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let byteLength = 0;

    request.on("data", chunk => {
      byteLength += chunk.length;
      if (byteLength > maxRequestBytes) {
        reject(createHttpError(413, "FixtureRequestTooLarge", "Fixture request is too large."));
        request.destroy();
        return;
      }

      chunks.push(chunk);
    });

    request.on("end", () => {
      try {
        const raw = Buffer.concat(chunks).toString("utf8");
        resolve(raw ? JSON.parse(raw) : {});
      } catch {
        reject(createHttpError(400, "InvalidFixtureRequest", "Fixture request must contain valid JSON."));
      }
    });

    request.on("error", reject);
  });
}

function validatePayload(payload) {
  const userId = String(payload?.userId || "").trim();
  const variant = String(payload?.variant || "").trim().toLowerCase();
  const count = Number(payload?.count ?? 1);

  if (!isGuid(userId)) {
    throw createHttpError(400, "InvalidFixtureUser", "Fixture userId must be the identityId UUID of the logged-in LOCAL user.");
  }

  if (!new Set(["fixed", "zonal"]).has(variant)) {
    throw createHttpError(400, "InvalidFixtureVariant", "Fixture variant must be fixed or zonal.");
  }

  if (!Number.isInteger(count) || count < 1 || count > 2) {
    throw createHttpError(400, "InvalidFixtureCount", "Fixture count must be 1 or 2.");
  }

  return { userId, variant, count };
}

async function createFixtures(payload, options) {
  const fixtureDirectory = path.resolve(
    options.fixtureDirectory
      || process.env.TASK_960_FIXTURE_DIR
      || path.join(__dirname, "..", "..", "pid-litacka-2.0-smoke-960", "fixture"));
  const scriptPath = path.join(fixtureDirectory, "New-AvailableFulfillment.ps1");

  if (!fs.existsSync(scriptPath)) {
    throw createHttpError(
      503,
      "FixtureScriptMissing",
      `Task 960 fixture script was not found in ${fixtureDirectory}.`);
  }

  const items = [];
  for (let index = 0; index < payload.count; index += 1) {
    items.push(await runFixtureScript(scriptPath, fixtureDirectory, payload));
  }

  return {
    variant: payload.variant,
    count: items.length,
    suggestedValidSince: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
    items
  };
}

function runFixtureScript(scriptPath, fixtureDirectory, payload) {
  const executable = process.env.TASK_960_POWERSHELL_EXE
    || (process.platform === "win32" ? "powershell.exe" : "pwsh");
  const args = [
    "-NoLogo",
    "-NoProfile",
    "-NonInteractive",
    "-ExecutionPolicy",
    "Bypass",
    "-File",
    scriptPath,
    "-UserId",
    payload.userId,
    "-Variant",
    payload.variant
  ];

  return new Promise((resolve, reject) => {
    execFile(executable, args, {
      cwd: fixtureDirectory,
      timeout: processTimeoutMs,
      maxBuffer: maxOutputBytes,
      windowsHide: true
    }, (error, stdout, stderr) => {
      if (error) {
        const detail = String(stderr || stdout || error.message || "Fixture process failed.").trim();
        reject(createHttpError(503, "FixtureProcessFailed", detail));
        return;
      }

      try {
        resolve(parseFixtureOutput(stdout));
      } catch (parseError) {
        reject(createHttpError(502, "InvalidFixtureOutput", parseError.message));
      }
    });
  });
}

function parseFixtureOutput(stdout) {
  const lines = String(stdout || "")
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean)
    .reverse();

  for (const line of lines) {
    try {
      const parsed = JSON.parse(line);
      if (isGuid(parsed?.fulfillmentId) && parsed?.status === "AVAILABLE") {
        return {
          fulfillmentId: parsed.fulfillmentId,
          userId: parsed.userId ?? parsed.UserId,
          productId: parsed.productId ?? parsed.ProductId,
          productSubTypeCode: parsed.productSubTypeCode ?? parsed.ProductSubTypeCode ?? null,
          status: parsed.status,
          variant: parsed.variant,
          validZones: parsed.validZones ?? parsed.ValidZones ?? null
        };
      }
    } catch {
      // dotnet may write build information before the final JSON result.
    }
  }

  throw new Error("Fixture process did not return an AVAILABLE fulfillment.");
}

function createHttpError(statusCode, code, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  return error;
}

function sanitizeMessage(value) {
  return String(value || "Task 960 fixture failed.")
    .replace(/(Password\s*=\s*)[^;\s]+/gi, "$1***")
    .replace(/(POSTGRES_PASSWORD\s*=\s*)\S+/gi, "$1***")
    .slice(0, 2000);
}

function isGuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(value || ""));
}

function isLoopbackAddress(address) {
  const normalized = String(address || "").toLowerCase();
  return normalized === "127.0.0.1"
    || normalized === "::1"
    || normalized === "::ffff:127.0.0.1";
}

function isLocalHostname(hostname) {
  const normalized = String(hostname || "").toLowerCase();
  return normalized === "localhost"
    || normalized === "127.0.0.1"
    || normalized === "::1";
}

function writeJson(response, statusCode, body) {
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store"
  });
  response.end(JSON.stringify(body));
}

module.exports = {
  handleTask960FixtureRequest,
  parseFixtureOutput,
  sanitizeMessage,
  validatePayload
};
