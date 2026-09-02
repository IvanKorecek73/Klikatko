const { execFile } = require("node:child_process");

const MAX_BODY_BYTES = 8 * 1024;

function normalizeDesktopPaymentUrl(value) {
  const raw = String(value || "").trim();
  if (raw.length === 0 || raw.length > 4096 || /[\u0000-\u001f\u007f]/.test(raw)) {
    throw new Error("Neplatná URL platební brány.");
  }

  let url;
  try {
    url = new URL(raw);
  } catch {
    throw new Error("Neplatná URL platební brány.");
  }

  if (url.protocol !== "https:" || !url.hostname || url.username || url.password) {
    throw new Error("Platební bránu lze otevřít pouze přes bezpečnou HTTPS URL.");
  }

  return raw;
}

function openDesktopUrl(url, callback) {
  if (process.platform === "win32") {
    const child = execFile(
      "rundll32.exe",
      ["url.dll,FileProtocolHandler", url],
      { windowsHide: true },
      callback
    );
    child.unref();
    return;
  }

  const executable = process.platform === "darwin" ? "open" : "xdg-open";
  const child = execFile(executable, [url], callback);
  child.unref();
}

function readJsonBody(request) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    request.on("data", chunk => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        reject(new Error("Požadavek je příliš velký."));
        request.destroy();
        return;
      }
      chunks.push(chunk);
    });
    request.on("end", () => {
      try {
        const raw = Buffer.concat(chunks).toString("utf8");
        resolve(raw ? JSON.parse(raw) : {});
      } catch (error) {
        reject(error);
      }
    });
    request.on("error", reject);
  });
}

function writeJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store"
  });
  response.end(JSON.stringify(payload));
}

async function handleDesktopBridgeRequest(request, response, options = {}) {
  if (request.method !== "POST" || request.url !== "/__desktop/open-payment") {
    writeJson(response, 405, { ok: false, error: "MethodNotAllowed" });
    return;
  }

  try {
    if (!String(request.headers["content-type"] || "").toLowerCase().startsWith("application/json")) {
      writeJson(response, 415, { ok: false, error: "JsonContentTypeRequired" });
      return;
    }
    const payload = await readJsonBody(request);
    const url = normalizeDesktopPaymentUrl(payload.url);
    const opener = options.openUrl || openDesktopUrl;
    await new Promise((resolve, reject) => {
      opener(url, error => error ? reject(error) : resolve());
    });
    writeJson(response, 200, { ok: true });
  } catch (error) {
    writeJson(response, 400, {
      ok: false,
      error: "DesktopPaymentOpenFailed",
      message: error instanceof Error ? error.message : String(error)
    });
  }
}

module.exports = {
  handleDesktopBridgeRequest,
  normalizeDesktopPaymentUrl
};
