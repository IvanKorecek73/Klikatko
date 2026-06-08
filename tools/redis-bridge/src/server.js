const http = require("http");
const net = require("net");
const fs = require("fs");
const path = require("path");

loadDotEnv();

const port = Number(process.env.REDIS_BRIDGE_PORT || process.env.PORT || 5097);
const redisConfig = parseRedisConfig(process.env.REDIS_URL || process.env.REDIS_CONNECTION_STRING || "localhost:6379");

const server = http.createServer(async (request, response) => {
  if (request.method === "OPTIONS") {
    sendJson(response, 204, null);
    return;
  }

  try {
    const url = new URL(request.url, `http://127.0.0.1:${port}`);

    if (request.method === "GET" && url.pathname === "/health") {
      const pong = await withRedis(client => client.command(["PING"]));
      sendJson(response, 200, {
        status: pong === "PONG" ? "OK" : "WARN",
        redis: publicRedisConfig()
      });
      return;
    }

    if (request.method === "GET" && url.pathname.startsWith("/session/")) {
      const identityId = decodeURIComponent(url.pathname.slice("/session/".length)).trim();
      const key = `mos:session:user:${identityId}`;
      sendJson(response, 200, await readSessionKey(key));
      return;
    }

    if (request.method === "GET" && url.pathname === "/key") {
      const key = String(url.searchParams.get("key") || "").trim();
      if (!key) {
        sendJson(response, 400, { error: "MissingKey", message: "Query parameter key is required." });
        return;
      }

      sendJson(response, 200, await readAnyKey(key));
      return;
    }

    if (request.method === "GET" && url.pathname === "/scan") {
      const pattern = String(url.searchParams.get("pattern") || "mos:session:user:*");
      const count = Math.min(Math.max(Number(url.searchParams.get("count") || 50), 1), 200);
      sendJson(response, 200, await scanKeys(pattern, count));
      return;
    }

    sendJson(response, 404, { error: "NotFound" });
  } catch (error) {
    sendJson(response, 500, {
      error: "RedisBridgeError",
      message: error instanceof Error ? error.message : String(error)
    });
  }
});

server.listen(port, "127.0.0.1", () => {
  console.log(`Klikatko Redis bridge: http://127.0.0.1:${port}`);
  console.log(`Redis target: ${publicRedisConfig().host}:${publicRedisConfig().port}`);
});

async function readSessionKey(key) {
  const data = await readAnyKey(key);
  const payload = parseJson(data.hash?.payload);
  return {
    ...data,
    sessionId: data.hash?.sid || payload?.sessionId || payload?.SessionId || "",
    payload
  };
}

async function readAnyKey(key) {
  return await withRedis(async client => {
    const type = await client.command(["TYPE", key]);
    const ttlSeconds = Number(await client.command(["TTL", key]));
    const result = { key, exists: type !== "none", type, ttlSeconds };

    if (type === "hash") {
      result.hash = await client.hgetall(key);
    } else if (type === "string") {
      result.value = await client.command(["GET", key]);
    }

    return result;
  });
}

async function scanKeys(pattern, count) {
  return await withRedis(async client => {
    let cursor = "0";
    const keys = [];

    do {
      const result = await client.command(["SCAN", cursor, "MATCH", pattern, "COUNT", String(count)]);
      cursor = String(result[0] || "0");
      keys.push(...(result[1] || []));
    } while (cursor !== "0" && keys.length < count);

    return { pattern, count, keys: keys.slice(0, count) };
  });
}

async function withRedis(action) {
  const client = new RedisRespClient(redisConfig);
  await client.connect();

  try {
    return await action(client);
  } finally {
    client.close();
  }
}

class RedisRespClient {
  constructor(config) {
    this.config = config;
    this.socket = null;
    this.buffer = Buffer.alloc(0);
  }

  connect() {
    return new Promise((resolve, reject) => {
      const socket = net.createConnection({
        host: this.config.host,
        port: this.config.port
      });

      socket.setTimeout(this.config.timeoutMs);
      socket.once("error", reject);
      socket.once("connect", async () => {
        socket.off("error", reject);
        this.socket = socket;
        socket.on("data", chunk => {
          this.buffer = Buffer.concat([this.buffer, chunk]);
        });

        try {
          if (this.config.password) {
            if (this.config.username) {
              await this.command(["AUTH", this.config.username, this.config.password]);
            } else {
              await this.command(["AUTH", this.config.password]);
            }
          }

          if (this.config.database > 0) {
            await this.command(["SELECT", String(this.config.database)]);
          }

          resolve();
        } catch (error) {
          reject(error);
        }
      });
    });
  }

  close() {
    this.socket?.end();
  }

  async hgetall(key) {
    const entries = await this.command(["HGETALL", key]);
    const hash = {};

    for (let index = 0; index < entries.length; index += 2) {
      hash[entries[index]] = entries[index + 1] ?? "";
    }

    return hash;
  }

  command(parts) {
    const payload = encodeCommand(parts);
    this.socket.write(payload);
    return this.readValue();
  }

  readValue() {
    return new Promise((resolve, reject) => {
      const started = Date.now();
      const tryParse = () => {
        try {
          const parsed = parseResp(this.buffer);
          if (parsed) {
            this.buffer = this.buffer.slice(parsed.offset);
            resolve(parsed.value);
            return;
          }
        } catch (error) {
          reject(error);
          return;
        }

        if (Date.now() - started > this.config.timeoutMs) {
          reject(new Error("Redis response timed out."));
          return;
        }

        setTimeout(tryParse, 5);
      };

      tryParse();
    });
  }
}

function encodeCommand(parts) {
  const buffers = [Buffer.from(`*${parts.length}\r\n`, "utf8")];

  for (const part of parts) {
    const value = Buffer.from(String(part), "utf8");
    buffers.push(Buffer.from(`$${value.length}\r\n`, "utf8"), value, Buffer.from("\r\n", "utf8"));
  }

  return Buffer.concat(buffers);
}

function parseResp(buffer, offset = 0) {
  if (offset >= buffer.length) return null;
  const type = String.fromCharCode(buffer[offset]);

  if (type === "+") return parseLine(buffer, offset, value => value);
  if (type === "-") return parseLine(buffer, offset, value => { throw new Error(value); });
  if (type === ":") return parseLine(buffer, offset, value => Number(value));

  if (type === "$") {
    const header = readLine(buffer, offset + 1);
    if (!header) return null;
    const length = Number(header.value);
    if (length < 0) return { value: null, offset: header.offset };
    const start = header.offset;
    const end = start + length;
    if (buffer.length < end + 2) return null;
    return {
      value: buffer.toString("utf8", start, end),
      offset: end + 2
    };
  }

  if (type === "*") {
    const header = readLine(buffer, offset + 1);
    if (!header) return null;
    const length = Number(header.value);
    if (length < 0) return { value: null, offset: header.offset };
    const values = [];
    let nextOffset = header.offset;

    for (let index = 0; index < length; index += 1) {
      const parsed = parseResp(buffer, nextOffset);
      if (!parsed) return null;
      values.push(parsed.value);
      nextOffset = parsed.offset;
    }

    return { value: values, offset: nextOffset };
  }

  throw new Error(`Unsupported Redis response type '${type}'.`);
}

function parseLine(buffer, offset, map) {
  const line = readLine(buffer, offset + 1);
  if (!line) return null;
  return { value: map(line.value), offset: line.offset };
}

function readLine(buffer, offset) {
  const end = buffer.indexOf("\r\n", offset, "utf8");
  if (end < 0) return null;
  return {
    value: buffer.toString("utf8", offset, end),
    offset: end + 2
  };
}

function parseRedisConfig(input) {
  const raw = String(input || "").trim();
  const config = {
    host: "127.0.0.1",
    port: 6379,
    database: 0,
    username: "",
    password: "",
    timeoutMs: Number(process.env.REDIS_BRIDGE_TIMEOUT_MS || 3000)
  };

  if (raw.startsWith("redis://") || raw.startsWith("rediss://")) {
    const url = new URL(raw);
    config.host = url.hostname || config.host;
    config.port = Number(url.port || 6379);
    config.username = decodeURIComponent(url.username || "");
    config.password = decodeURIComponent(url.password || "");
    config.database = Number(url.pathname.replace("/", "") || 0);
    return config;
  }

  for (const segment of raw.split(",")) {
    const part = segment.trim();
    const separator = part.indexOf("=");

    if (separator < 0) {
      const [host, portText] = part.split(":");
      config.host = host || config.host;
      config.port = Number(portText || config.port);
      continue;
    }

    const key = part.slice(0, separator).trim().toLowerCase();
    const value = part.slice(separator + 1).trim();

    if (key === "password") config.password = value;
    if (key === "user" || key === "username") config.username = value;
    if (key === "defaultdatabase" || key === "database") config.database = Number(value || 0);
    if (key === "connecttimeout" || key === "synctimeout") config.timeoutMs = Number(value || config.timeoutMs);
  }

  return config;
}

function publicRedisConfig() {
  return {
    host: redisConfig.host,
    port: redisConfig.port,
    database: redisConfig.database
  };
}

function sendJson(response, status, payload) {
  response.writeHead(status, {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Cache-Control": "no-store",
    "Content-Type": "application/json; charset=utf-8"
  });
  response.end(payload === null ? "" : JSON.stringify(payload));
}

function parseJson(value) {
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function loadDotEnv() {
  const filePath = path.join(__dirname, "..", ".env");
  if (!fs.existsSync(filePath)) return;

  for (const line of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const separator = trimmed.indexOf("=");
    if (separator < 0) continue;
    const key = trimmed.slice(0, separator).trim();
    const value = trimmed.slice(separator + 1).trim();
    if (!process.env[key]) process.env[key] = value;
  }
}
