const fs = require("node:fs");
const path = require("node:path");
const { execFile } = require("node:child_process");
const { promisify } = require("node:util");

const execFileAsync = promisify(execFile);
const DEFAULT_DEVICE_ID = "emulator-5554";
const MAX_ACTIONS = 24;
const MAX_BODY_BYTES = 64 * 1024;
const REMOTE_UI_DUMP = "/sdcard/klikatko-window.xml";
const SAFE_KEY_EVENTS = new Set(["BACK", "HOME", "ENTER", "ESCAPE", "TAB", "DPAD_UP", "DPAD_DOWN", "DPAD_LEFT", "DPAD_RIGHT"]);

function resolveAdbPath() {
  const configured = String(process.env.ANDROID_ADB_PATH || "").trim();
  if (configured) {
    return configured;
  }

  if (process.platform === "win32" && process.env.LOCALAPPDATA) {
    const bundled = path.join(process.env.LOCALAPPDATA, "Android", "Sdk", "platform-tools", "adb.exe");
    if (fs.existsSync(bundled)) {
      return bundled;
    }
  }

  return "adb";
}

async function runAdb(args, options = {}) {
  const result = await execFileAsync(resolveAdbPath(), args, {
    encoding: "utf8",
    timeout: options.timeoutMs || 12000,
    windowsHide: true,
    maxBuffer: 4 * 1024 * 1024
  });
  return String(result.stdout || "").trim();
}

async function getEmulatorStatus(deviceId = DEFAULT_DEVICE_ID) {
  try {
    const state = await runAdb(["-s", deviceId, "get-state"]);
    const nodes = state === "device" ? await dumpVisibleNodes(deviceId) : [];
    return {
      ok: state === "device",
      deviceId,
      state,
      currentLabels: summarizeNodes(nodes)
    };
  } catch (error) {
    return {
      ok: false,
      deviceId,
      state: "unavailable",
      message: sanitizeError(error)
    };
  }
}

async function executeEmulatorActions(payload = {}) {
  const deviceId = normalizeDeviceId(payload.deviceId);
  const actions = Array.isArray(payload.actions) ? payload.actions : [];
  const actionCount = countConfiguredActions(actions);

  if (actions.length === 0 || actionCount > MAX_ACTIONS) {
    throw new Error(`Počet akcí musí být mezi 1 a ${MAX_ACTIONS}.`);
  }

  await runAdb(["-s", deviceId, "get-state"]);
  await configurePresentationTouches(deviceId, payload.showTouches !== false);

  const results = [];
  for (let index = 0; index < actions.length; index += 1) {
    const result = await executeAction(deviceId, actions[index], index);
    results.push(result);
  }

  const nodes = await dumpVisibleNodes(deviceId);
  return {
    ok: true,
    deviceId,
    actions: results,
    currentLabels: summarizeNodes(nodes)
  };
}

async function executeAction(deviceId, action, index) {
  const type = String(action?.type || "").trim();

  if (type === "restartApp") {
    const packageName = normalizeAppPackageName(action.packageName);
    await runAdb(["-s", deviceId, "shell", "am", "force-stop", packageName]);
    await runAdb([
      "-s", deviceId,
      "shell", "monkey",
      "-p", packageName,
      "-c", "android.intent.category.LAUNCHER",
      "1"
    ], { timeoutMs: 15000 });

    const readyContentDescriptions = Array.isArray(action.readyContentDescriptions)
      ? action.readyContentDescriptions.map(value => String(value || "").trim()).filter(Boolean)
      : [];
    const readyLabel = await waitForAnyContentDescription(
      deviceId,
      readyContentDescriptions,
      clampInteger(action.timeoutMs, 3000, 30000, 15000)
    );
    return { index, type, packageName, readyLabel };
  }

  if (type === "ifNode") {
    const nodes = await dumpVisibleNodes(deviceId);
    const match = findNode(nodes, action);
    if (!match) {
      return { index, type, matched: false, actions: [] };
    }

    const nestedActions = Array.isArray(action.actions) ? action.actions : [];
    const results = [];
    for (let nestedIndex = 0; nestedIndex < nestedActions.length; nestedIndex += 1) {
      results.push(await executeAction(deviceId, nestedActions[nestedIndex], nestedIndex));
    }

    return {
      index,
      type,
      matched: true,
      matchedText: match.contentDescription || match.text,
      actions: results
    };
  }

  if (type === "wait") {
    const durationMs = clampInteger(action.durationMs, 0, 5000, 500);
    await delay(durationMs);
    return { index, type, durationMs };
  }

  if (type === "back") {
    await runAdb(["-s", deviceId, "shell", "input", "keyevent", "BACK"]);
    await delay(clampInteger(action.waitAfterMs, 0, 5000, 500));
    return { index, type };
  }

  if (type === "keyevent") {
    const key = String(action.key || "").trim().toUpperCase();
    if (!SAFE_KEY_EVENTS.has(key)) {
      throw new Error(`Nepovolená klávesa v akci ${index + 1}: ${key || "prázdná"}.`);
    }
    await runAdb(["-s", deviceId, "shell", "input", "keyevent", key]);
    await delay(clampInteger(action.waitAfterMs, 0, 5000, 350));
    return { index, type, key };
  }

  if (type === "tap") {
    const x = clampInteger(action.x, 0, 10000);
    const y = clampInteger(action.y, 0, 10000);
    await presentationTap(deviceId, x, y, action);
    return { index, type, x, y };
  }

  if (type === "tapNode" || type === "assertNode") {
    const nodes = await dumpVisibleNodes(deviceId);
    const match = findNode(nodes, action);
    if (!match) {
      throw new Error(`Prvek pro akci ${index + 1} nebyl nalezen: ${describeMatcher(action)}.`);
    }

    if (type === "tapNode") {
      const point = centerOfBounds(match.bounds);
      await presentationTap(deviceId, point.x, point.y, action);
    }

    return {
      index,
      type,
      matchedText: match.contentDescription || match.text,
      bounds: match.bounds
    };
  }

  if (type === "inputText") {
    const value = String(action.value ?? "");
    if (value.length === 0 || value.length > 200) {
      throw new Error(`Text v akci ${index + 1} musí mít 1 až 200 znaků.`);
    }

    if (action.text || action.contentDescription || action.className) {
      const nodes = await dumpVisibleNodes(deviceId);
      const match = findNode(nodes, action);
      if (!match) {
        throw new Error(`Pole pro akci ${index + 1} nebylo nalezeno: ${describeMatcher(action)}.`);
      }
      const point = centerOfBounds(match.bounds);
      await presentationTap(deviceId, point.x, point.y, { ...action, waitAfterMs: 250 });
    }

    if (action.clear !== false) {
      await runAdb(["-s", deviceId, "shell", "input", "keycombination", "KEYCODE_CTRL_LEFT", "KEYCODE_A"]);
      await runAdb(["-s", deviceId, "shell", "input", "keyevent", "KEYCODE_DEL"]);
    }
    await typeAdbText(deviceId, value);
    await delay(clampInteger(action.waitAfterMs, 0, 5000, 350));
    return {
      index,
      type,
      field: action.contentDescription || action.text || "focused",
      value: action.sensitive === true ? "***" : value
    };
  }

  if (type === "swipe") {
    const x1 = clampInteger(action.x1, 0, 10000);
    const y1 = clampInteger(action.y1, 0, 10000);
    const x2 = clampInteger(action.x2, 0, 10000);
    const y2 = clampInteger(action.y2, 0, 10000);
    const durationMs = clampInteger(action.durationMs, 250, 3000, 850);
    await runAdb(["-s", deviceId, "shell", "input", "touchscreen", "swipe", String(x1), String(y1), String(x2), String(y2), String(durationMs)]);
    await delay(clampInteger(action.waitAfterMs, 0, 5000, 500));
    return { index, type, x1, y1, x2, y2, durationMs };
  }

  throw new Error(`Nepodporovaný typ emulator akce ${index + 1}: ${type || "prázdný"}.`);
}

function countConfiguredActions(actions) {
  return actions.reduce((count, action) => {
    const nestedActions = Array.isArray(action?.actions) ? action.actions : [];
    return count + 1 + countConfiguredActions(nestedActions);
  }, 0);
}

async function waitForAnyContentDescription(deviceId, expectedLabels, timeoutMs) {
  if (expectedLabels.length === 0) {
    await delay(Math.min(timeoutMs, 8000));
    return "";
  }

  const deadline = Date.now() + timeoutMs;
  let currentLabels = [];
  do {
    const nodes = await dumpVisibleNodes(deviceId);
    currentLabels = summarizeNodes(nodes);
    const matched = currentLabels.find(actual => expectedLabels.some(expected =>
      actual.toLocaleLowerCase("cs-CZ").includes(expected.toLocaleLowerCase("cs-CZ"))));
    if (matched) {
      return matched;
    }
    await delay(500);
  } while (Date.now() < deadline);

  throw new Error(`Aplikace po restartu nezobrazila očekávanou výchozí obrazovku (${expectedLabels.join(" nebo ")}).`);
}

async function configurePresentationTouches(deviceId, enabled) {
  await runAdb(["-s", deviceId, "shell", "settings", "put", "system", "show_touches", enabled ? "1" : "0"]);
  await runAdb(["-s", deviceId, "shell", "settings", "put", "system", "pointer_location", "0"]);
}

async function presentationTap(deviceId, x, y, action = {}) {
  const { hoverMs, touchMs, waitAfterMs } = getPresentationTapTiming(action);
  await runAdb(["-s", deviceId, "shell", "input", "mouse", "motionevent", "MOVE", String(x), String(y)]);
  await delay(hoverMs);
  await runAdb(["-s", deviceId, "shell", "input", "touchscreen", "motionevent", "DOWN", String(x), String(y)]);
  await delay(touchMs);
  await runAdb(["-s", deviceId, "shell", "input", "touchscreen", "motionevent", "UP", String(x), String(y)]);
  await delay(waitAfterMs);
}

function getPresentationTapTiming(action = {}) {
  return {
    hoverMs: clampInteger(action.hoverMs ?? action.holdMs, 120, 1200, 420),
    touchMs: clampInteger(action.touchMs, 80, 500, 160),
    waitAfterMs: clampInteger(action.waitAfterMs, 0, 5000, 650)
  };
}

async function typeAdbText(deviceId, value) {
  for (const token of tokenizeAdbText(value)) {
    if (token.type === "text") {
      await runAdb(["-s", deviceId, "shell", "input", "text", token.value]);
      continue;
    }

    if (token.modifier) {
      await runAdb(["-s", deviceId, "shell", "input", "keycombination", token.modifier, token.key]);
    } else {
      await runAdb(["-s", deviceId, "shell", "input", "keyevent", token.key]);
    }
  }
}

function tokenizeAdbText(value) {
  const specialKeys = {
    "@": { key: "KEYCODE_AT" },
    ".": { key: "KEYCODE_PERIOD" },
    "+": { key: "KEYCODE_PLUS" },
    "-": { key: "KEYCODE_MINUS" },
    "_": { key: "KEYCODE_MINUS", modifier: "KEYCODE_SHIFT_LEFT" },
    "!": { key: "KEYCODE_1", modifier: "KEYCODE_SHIFT_LEFT" },
    "/": { key: "KEYCODE_SLASH" },
    " ": { key: "KEYCODE_SPACE" }
  };
  const tokens = [];
  let chunk = "";

  const flushChunk = () => {
    if (chunk) {
      tokens.push({ type: "text", value: chunk });
      chunk = "";
    }
  };

  for (const character of String(value || "")) {
    if (/^[A-Za-z0-9]$/.test(character)) {
      chunk += character;
      continue;
    }

    flushChunk();
    const key = specialKeys[character];
    if (!key) {
      throw new Error(`ADB text obsahuje nepodporovaný znak: ${character}`);
    }
    tokens.push({ type: "key", ...key });
  }
  flushChunk();
  return tokens;
}

async function dumpVisibleNodes(deviceId) {
  await runAdb(["-s", deviceId, "shell", "uiautomator", "dump", REMOTE_UI_DUMP], { timeoutMs: 15000 });
  const xml = await runAdb(["-s", deviceId, "exec-out", "sh", "-c", `cat ${REMOTE_UI_DUMP}`]);
  return parseUiNodes(xml);
}

function parseUiNodes(xml) {
  const nodes = [];
  const nodePattern = /<node\s+([^>]+?)(?:\/>|>)/g;
  let nodeMatch;

  while ((nodeMatch = nodePattern.exec(String(xml || ""))) !== null) {
    const attributes = {};
    const attributePattern = /([\w-]+)="([^"]*)"/g;
    let attributeMatch;
    while ((attributeMatch = attributePattern.exec(nodeMatch[1])) !== null) {
      attributes[attributeMatch[1]] = decodeXml(attributeMatch[2]);
    }

    const boundsMatch = /^\[(\d+),(\d+)\]\[(\d+),(\d+)\]$/.exec(attributes.bounds || "");
    if (!boundsMatch) {
      continue;
    }

    nodes.push({
      text: attributes.text || "",
      contentDescription: attributes["content-desc"] || "",
      className: attributes.class || "",
      clickable: attributes.clickable === "true",
      enabled: attributes.enabled !== "false",
      focusable: attributes.focusable === "true",
      focused: attributes.focused === "true",
      bounds: {
        left: Number(boundsMatch[1]),
        top: Number(boundsMatch[2]),
        right: Number(boundsMatch[3]),
        bottom: Number(boundsMatch[4])
      }
    });
  }

  return nodes;
}

function findNode(nodes, matcher = {}) {
  const expectedText = String(matcher.text || "").trim();
  const expectedDescription = String(matcher.contentDescription || "").trim();
  const expectedClassName = String(matcher.className || "").trim();
  if (!expectedText && !expectedDescription && !expectedClassName) {
    throw new Error("Akce vyžaduje text, contentDescription nebo className.");
  }

  const exact = matcher.exact !== false;
  const matches = nodes.filter(node => {
    if (matcher.clickable === true && !node.clickable) {
      return false;
    }
    if (!node.enabled) {
      return false;
    }
    if (expectedClassName && node.className !== expectedClassName) {
      return false;
    }
    if (!expectedText && !expectedDescription) {
      return true;
    }

    const actual = expectedDescription ? node.contentDescription : node.text;
    const expected = expectedDescription || expectedText;
    return exact ? actual === expected : actual.toLocaleLowerCase("cs-CZ").includes(expected.toLocaleLowerCase("cs-CZ"));
  });

  return matches[clampInteger(matcher.occurrence, 0, 100, 0)] || null;
}

function summarizeNodes(nodes) {
  return [...new Set(nodes
    .map(node => node.contentDescription || node.text)
    .filter(Boolean))]
    .slice(0, 20);
}

function centerOfBounds(bounds) {
  return {
    x: Math.round((bounds.left + bounds.right) / 2),
    y: Math.round((bounds.top + bounds.bottom) / 2)
  };
}

function describeMatcher(action) {
  return action.contentDescription
    ? `contentDescription=${action.contentDescription}`
    : action.text
      ? `text=${action.text}`
      : `className=${action.className}`;
}

function normalizeDeviceId(value) {
  const deviceId = String(value || DEFAULT_DEVICE_ID).trim();
  if (!/^[A-Za-z0-9._:-]+$/.test(deviceId)) {
    throw new Error("Neplatné ID emulátoru.");
  }
  return deviceId;
}

function normalizeAppPackageName(value) {
  const packageName = String(value || "").trim();
  if (packageName.length > 200
    || !/^[A-Za-z][A-Za-z0-9_]*(?:\.[A-Za-z][A-Za-z0-9_]*)+$/.test(packageName)) {
    throw new Error("Neplatný název balíčku aplikace.");
  }
  return packageName;
}

function clampInteger(value, minimum, maximum, fallback = minimum) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return fallback;
  }
  return Math.min(maximum, Math.max(minimum, Math.round(numeric)));
}

function decodeXml(value) {
  return String(value || "")
    .replace(/&#10;/g, "\n")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

function sanitizeError(error) {
  return String(error?.stderr || error?.message || error || "Neznámá chyba").trim().slice(0, 1000);
}

function delay(durationMs) {
  return new Promise(resolve => setTimeout(resolve, durationMs));
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

async function handleEmulatorBridgeRequest(request, response) {
  try {
    if (request.method === "GET" && request.url.startsWith("/__emulator/status")) {
      const url = new URL(request.url, "http://localhost");
      writeJson(response, 200, await getEmulatorStatus(url.searchParams.get("deviceId") || DEFAULT_DEVICE_ID));
      return;
    }

    if (request.method === "POST" && request.url.startsWith("/__emulator/actions")) {
      if (!String(request.headers["content-type"] || "").toLowerCase().startsWith("application/json")) {
        writeJson(response, 415, { ok: false, error: "JsonContentTypeRequired" });
        return;
      }
      const payload = await readJsonBody(request);
      writeJson(response, 200, await executeEmulatorActions(payload));
      return;
    }

    writeJson(response, 405, { ok: false, error: "MethodNotAllowed" });
  } catch (error) {
    writeJson(response, 400, {
      ok: false,
      error: "EmulatorActionFailed",
      message: sanitizeError(error)
    });
  }
}

module.exports = {
  countConfiguredActions,
  executeEmulatorActions,
  findNode,
  getPresentationTapTiming,
  getEmulatorStatus,
  handleEmulatorBridgeRequest,
  normalizeAppPackageName,
  parseUiNodes,
  tokenizeAdbText
};
