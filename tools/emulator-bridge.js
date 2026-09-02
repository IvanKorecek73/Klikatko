const fs = require("node:fs");
const path = require("node:path");
const { execFile } = require("node:child_process");
const { promisify } = require("node:util");

const execFileAsync = promisify(execFile);
const DEFAULT_DEVICE_ID = "emulator-5554";
const MAX_ACTIONS = 24;
const MAX_BODY_BYTES = 64 * 1024;
const SAFE_KEY_EVENTS = new Set(["BACK", "HOME", "ENTER", "ESCAPE", "TAB", "DPAD_UP", "DPAD_DOWN", "DPAD_LEFT", "DPAD_RIGHT"]);
const TICKET_PAYMENT_CALLBACK_SCHEME = "pid-litacka-payment:";
const TICKET_PAYMENT_CALLBACK_HOST = "ticket";
const EMULATOR_PACE_PROFILES = Object.freeze({
  natural: Object.freeze({
    waitAfterMs: 0,
    waitScale: 0,
    waitAfterLimitMs: 0,
    nodeTimeoutMs: 8000,
    nodePollMs: 0,
    swipeScale: 0.25
  }),
  fast: Object.freeze({
    waitAfterMs: 0,
    waitScale: 0,
    waitAfterLimitMs: 0,
    nodeTimeoutMs: 8000,
    nodePollMs: 0,
    swipeScale: 0.25
  })
});

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
  const pace = normalizeEmulatorPace(payload.pace);
  const actions = Array.isArray(payload.actions) ? payload.actions : [];
  const actionCount = countConfiguredActions(actions);

  if (actions.length === 0 || actionCount > MAX_ACTIONS) {
    throw new Error(`Počet akcí musí být mezi 1 a ${MAX_ACTIONS}.`);
  }

  await runAdb(["-s", deviceId, "get-state"]);
  await configurePresentationTouches(deviceId);

  const executionContext = {
    nodes: null,
    lastKnownNodes: null
  };
  const results = [];
  for (let index = 0; index < actions.length; index += 1) {
    const result = await executeAction(deviceId, actions[index], index, pace, executionContext);
    results.push(result);
  }

  const nodes = await getVisibleNodes(deviceId, executionContext);
  return {
    ok: true,
    deviceId,
    pace,
    actions: results,
    currentLabels: summarizeNodes(nodes)
  };
}

async function executeAction(
  deviceId,
  action,
  index,
  pace = "natural",
  executionContext = { nodes: null, lastKnownNodes: null }
) {
  const type = String(action?.type || "").trim();

  if (type === "restartApp") {
    const packageName = normalizeAppPackageName(action.packageName);
    invalidateVisibleNodes(executionContext);
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
      clampInteger(action.timeoutMs, 3000, 30000, 15000),
      executionContext
    );
    return { index, type, packageName, readyLabel };
  }

  if (type === "clearLogcat") {
    await runAdb(["-s", deviceId, "logcat", "-c"]);
    return { index, type };
  }

  if (type === "captureTicketCardPayment") {
    const timeoutMs = clampInteger(action.timeoutMs, 1000, 30000, 10000);
    const pollMs = clampInteger(action.pollMs, 100, 2000, 400);
    const deadline = Date.now() + timeoutMs;

    while (Date.now() <= deadline) {
      const log = await runAdb(["-s", deviceId, "logcat", "-d", "-v", "raw"], {
        timeoutMs: 12000
      });
      const payment = extractTicketPaymentInitiationFromLog(log);
      if (payment) {
        return { index, type, ...payment };
      }
      await delay(pollMs);
    }

    throw new Error("V logu emulátoru nebyla nalezena iniciační odpověď platby jízdenky.");
  }

  if (type === "openDeepLink") {
    const uri = normalizeTicketPaymentDeepLink(action.uri);
    const packageName = action.packageName
      ? normalizeAppPackageName(action.packageName)
      : null;
    const args = [
      "-s", deviceId,
      "shell", "am", "start",
      "-a", "android.intent.action.VIEW",
      "-d", uri
    ];
    if (packageName) {
      args.push("-p", packageName);
    }
    await runAdb(args, { timeoutMs: 15000 });
    invalidateVisibleNodes(executionContext);

    const waitForMatcher = normalizeWaitForMatcher(action.waitFor, action.transitionTimeoutMs);
    const transitionMatch = waitForMatcher
      ? await waitForNode(deviceId, waitForMatcher, pace, executionContext)
      : null;
    if (waitForMatcher && !transitionMatch) {
      throw new Error(`Po návratu přes deep link se neobjevil očekávaný prvek: ${describeMatcher(waitForMatcher)}.`);
    }

    return {
      index,
      type,
      bookingId: new URL(uri).pathname.replace(/^\//, ""),
      waitForMatchedText: transitionMatch?.contentDescription || transitionMatch?.text || null
    };
  }

  if (type === "ifNode") {
    const nodes = await getVisibleNodes(deviceId, executionContext);
    const match = findNode(nodes, action);
    if (!match) {
      return { index, type, matched: false, actions: [] };
    }

    const nestedActions = Array.isArray(action.actions) ? action.actions : [];
    const results = [];
    for (let nestedIndex = 0; nestedIndex < nestedActions.length; nestedIndex += 1) {
      results.push(await executeAction(deviceId, nestedActions[nestedIndex], nestedIndex, pace, executionContext));
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
    const durationMs = getPacedWaitMs(action.durationMs, pace, 500);
    await delay(durationMs);
    invalidateVisibleNodes(executionContext);
    return { index, type, durationMs };
  }

  if (type === "back") {
    await runAdb(["-s", deviceId, "shell", "input", "keyevent", "BACK"]);
    await delay(getPacedWaitMs(action.waitAfterMs, pace, 500));
    invalidateVisibleNodes(executionContext);
    return { index, type };
  }

  if (type === "hideKeyboard") {
    const inputMethodState = await runAdb(["-s", deviceId, "shell", "dumpsys", "input_method"]);
    const wasVisible = /\bmInputShown=true\b/.test(inputMethodState);
    if (wasVisible) {
      await runAdb(["-s", deviceId, "shell", "input", "keyevent", "BACK"]);
      await delay(clampInteger(action.settleMs, 0, 2000, 250));
      invalidateVisibleNodes(executionContext);
    }
    return { index, type, wasVisible };
  }

  if (type === "keyevent") {
    const key = String(action.key || "").trim().toUpperCase();
    if (!SAFE_KEY_EVENTS.has(key)) {
      throw new Error(`Nepovolená klávesa v akci ${index + 1}: ${key || "prázdná"}.`);
    }
    await runAdb(["-s", deviceId, "shell", "input", "keyevent", key]);
    await delay(getPacedWaitMs(action.waitAfterMs, pace, 350));
    invalidateVisibleNodes(executionContext);
    return { index, type, key };
  }

  if (type === "tap") {
    const x = clampInteger(action.x, 0, 10000);
    const y = clampInteger(action.y, 0, 10000);
    await presentationTap(deviceId, x, y, action, pace, executionContext);
    invalidateVisibleNodes(executionContext);
    return { index, type, x, y };
  }

  if (type === "tapNode" || type === "assertNode") {
    const waitForMatcher = type === "tapNode"
      ? normalizeWaitForMatcher(action.waitFor, action.transitionTimeoutMs)
      : null;
    let match = await waitForNode(deviceId, action, pace, executionContext, {
      allowLastKnown: Boolean(waitForMatcher)
    });
    if (!match) {
      throw new Error(`Prvek pro akci ${index + 1} nebyl nalezen: ${describeMatcher(action)}.`);
    }

    if (type === "tapNode") {
      const maximumAttempts = waitForMatcher
        ? 1 + clampInteger(action.retryCount, 0, 3, 0)
        : 1;
      let transitionMatch = null;

      for (let attempt = 1; attempt <= maximumAttempts; attempt += 1) {
        const point = centerOfBounds(match.bounds);
        await presentationTap(deviceId, point.x, point.y, action, pace, executionContext);
        invalidateVisibleNodes(executionContext);

        if (!waitForMatcher) {
          break;
        }

        transitionMatch = await waitForNode(deviceId, waitForMatcher, pace, executionContext);
        if (transitionMatch) {
          return {
            index,
            type,
            matchedText: match.contentDescription || match.text,
            bounds: match.bounds,
            attempts: attempt,
            waitForMatchedText: transitionMatch.contentDescription || transitionMatch.text
          };
        }

        if (attempt < maximumAttempts) {
          match = await waitForNode(deviceId, { ...action, timeoutMs: 0 }, pace, executionContext);
          if (!match) {
            break;
          }
        }
      }

      if (waitForMatcher && !transitionMatch) {
        throw new Error(
          `Po kliknutí na ${describeMatcher(action)} se neobjevil očekávaný prvek: ${describeMatcher(waitForMatcher)}.`
        );
      }
    }

    return {
      index,
      type,
      matchedText: match.contentDescription || match.text,
      bounds: match.bounds
    };
  }

  if (type === "inputTextGroup") {
    const fields = Array.isArray(action.fields) ? action.fields : [];
    if (fields.length < 2 || fields.length > 8) {
      throw new Error(`Skupina polí v akci ${index + 1} musí obsahovat 2 až 8 položek.`);
    }

    const firstField = fields[0];
    const firstMatch = await waitForNode(deviceId, firstField, pace, executionContext);
    if (!firstMatch) {
      throw new Error(`První pole pro akci ${index + 1} nebylo nalezeno: ${describeMatcher(firstField)}.`);
    }

    const firstPoint = pointWithinBounds(firstMatch.bounds, firstField.tapHorizontalRatio);
    await presentationTap(deviceId, firstPoint.x, firstPoint.y, firstField, pace, executionContext);
    await delay(clampInteger(action.focusSettleMs, 0, 2000, 200));

    for (let fieldIndex = 0; fieldIndex < fields.length; fieldIndex += 1) {
      const field = fields[fieldIndex];
      const value = String(field.value ?? "");
      if (value.length === 0 || value.length > 200) {
        throw new Error(`Text v poli ${fieldIndex + 1} akce ${index + 1} musí mít 1 až 200 znaků.`);
      }

      if (fieldIndex > 0) {
        await runAdb(["-s", deviceId, "shell", "input", "keyevent", "TAB"]);
        await delay(clampInteger(action.tabSettleMs, 0, 1000, 75));
      }

      if (field.clear !== false) {
        await runAdb(["-s", deviceId, "shell", "input", "keycombination", "KEYCODE_CTRL_LEFT", "KEYCODE_A"]);
        await runAdb(["-s", deviceId, "shell", "input", "keyevent", "KEYCODE_DEL"]);
      }
      if (field.keyByKey === true) {
        await typeAdbTextKeyByKey(deviceId, value, field.keyDelayMs);
      } else {
        await typeAdbText(deviceId, value);
      }
    }

    invalidateVisibleNodes(executionContext);
    const verifiedNodes = await getVisibleNodes(deviceId, executionContext, { refresh: true });
    const mismatches = fields.filter(field => {
      if (field.expectedValue === undefined) {
        return false;
      }
      const actualValue = findNode(verifiedNodes, fieldMatcher(field))?.text ?? null;
      return actualValue !== String(field.expectedValue);
    });

    // Some hosted payment fields advance focus automatically. If that makes
    // the fast TAB path skip a field, retry only the mismatched fields with
    // the slower selector-based input instead of slowing every successful run.
    for (const field of mismatches) {
      await executeAction(deviceId, {
        ...field,
        type: "inputText",
        clear: true
      }, index, pace, executionContext);
    }

    return {
      index,
      type,
      fields: fields.map(field => ({
        field: field.resourceId || field.contentDescription || field.text || "focused",
        value: field.sensitive === true ? "***" : String(field.value)
      })),
      fallbackCount: mismatches.length
    };
  }

  if (type === "inputText") {
    const value = String(action.value ?? "");
    if (value.length === 0 || value.length > 200) {
      throw new Error(`Text v akci ${index + 1} musí mít 1 až 200 znaků.`);
    }

    const expectedValue = action.expectedValue === undefined ? null : String(action.expectedValue);
    const maximumAttempts = expectedValue === null
      ? 1
      : 1 + clampInteger(action.retryCount, 0, 3, 1);
    let actualValue = null;

    for (let attempt = 1; attempt <= maximumAttempts; attempt += 1) {
      let matchedField = null;
      if (action.text || action.contentDescription || action.className || action.resourceId) {
        matchedField = await waitForNode(deviceId, action, pace, executionContext);
        if (!matchedField) {
          throw new Error(`Pole pro akci ${index + 1} nebylo nalezeno: ${describeMatcher(action)}.`);
        }
        const point = pointWithinBounds(matchedField.bounds, action.tapHorizontalRatio);
        await presentationTap(deviceId, point.x, point.y, { ...action, waitAfterMs: 250 }, pace, executionContext);
        // Chrome Custom Tabs may expose the focused field in the accessibility
        // tree before the web input is ready to accept ADB key events. This is
        // a synchronization wait, not presentation pacing, so keep it even at
        // the fastest workflow pace.
        await delay(clampInteger(action.focusSettleMs, 0, 2000, 250));
        invalidateVisibleNodes(executionContext);
      }

      if (action.clear !== false) {
        await runAdb(["-s", deviceId, "shell", "input", "keycombination", "KEYCODE_CTRL_LEFT", "KEYCODE_A"]);
        await runAdb(["-s", deviceId, "shell", "input", "keyevent", "KEYCODE_DEL"]);
        const remainingCharacterCount = Array.from(String(matchedField?.text || "")).length;
        if (remainingCharacterCount > 0) {
          await runAdb(["-s", deviceId, "shell", "input", "keyevent", "KEYCODE_MOVE_END"]);
          for (const batch of buildDeleteKeyBatches(remainingCharacterCount)) {
            await runAdb(["-s", deviceId, "shell", "input", "keyevent", ...batch]);
          }
        }
      }
      if (action.keyByKey === true) {
        await typeAdbTextKeyByKey(deviceId, value, action.keyDelayMs);
      } else {
        await typeAdbText(deviceId, value);
      }
      await delay(getPacedWaitMs(action.waitAfterMs, pace, 350));
      invalidateVisibleNodes(executionContext);

      if (expectedValue === null) {
        break;
      }

      const nodes = await getVisibleNodes(deviceId, executionContext, { refresh: true });
      const field = findNode(nodes, fieldMatcher(action));
      actualValue = field?.text ?? null;
      if (actualValue === expectedValue) {
        break;
      }
      invalidateVisibleNodes(executionContext);
    }

    if (expectedValue !== null && actualValue !== expectedValue) {
      const detail = action.sensitive === true ? "" : ` Očekáváno ${expectedValue}, nalezeno ${actualValue ?? "nic"}.`;
      throw new Error(`Pole pro akci ${index + 1} po vyplnění neobsahuje očekávanou hodnotu.${detail}`);
    }
    return {
      index,
      type,
      field: action.resourceId || action.contentDescription || action.text || "focused",
      value: action.sensitive === true ? "***" : value
    };
  }

  if (type === "swipe") {
    const x1 = clampInteger(action.x1, 0, 10000);
    const y1 = clampInteger(action.y1, 0, 10000);
    const x2 = clampInteger(action.x2, 0, 10000);
    const y2 = clampInteger(action.y2, 0, 10000);
    const durationMs = getPacedSwipeDurationMs(action.durationMs, pace);
    const repeat = normalizeSwipeRepeat(action.repeat);
    const untilMatcher = action.until && typeof action.until === "object" && !Array.isArray(action.until)
      ? action.until
      : null;
    const checkEvery = clampInteger(action.checkEvery, 1, 12, 6);
    let untilMatch = null;
    let performedSwipes = 0;
    for (let iteration = 0; iteration < repeat; iteration += 1) {
      await runAdb(["-s", deviceId, "shell", "input", "touchscreen", "swipe", String(x1), String(y1), String(x2), String(y2), String(durationMs)]);
      performedSwipes += 1;
      const shouldCheck = untilMatcher && ((iteration + 1) % checkEvery === 0 || iteration + 1 === repeat);
      if (shouldCheck) {
        invalidateVisibleNodes(executionContext);
        untilMatch = findNode(await getVisibleNodes(deviceId, executionContext, { refresh: true }), untilMatcher);
        if (untilMatch) {
          break;
        }
      }
    }
    await delay(getPacedWaitMs(action.waitAfterMs, pace, 500));
    invalidateVisibleNodes(executionContext);
    if (untilMatcher && !untilMatch) {
      throw new Error(`Po odrolování se neobjevil očekávaný prvek: ${describeMatcher(untilMatcher)}.`);
    }
    return {
      index,
      type,
      x1,
      y1,
      x2,
      y2,
      durationMs,
      repeat: performedSwipes,
      maximumRepeats: repeat,
      matchedText: untilMatch ? untilMatch.contentDescription || untilMatch.text : undefined
    };
  }

  throw new Error(`Nepodporovaný typ emulator akce ${index + 1}: ${type || "prázdný"}.`);
}

function countConfiguredActions(actions) {
  return actions.reduce((count, action) => {
    const nestedActions = Array.isArray(action?.actions) ? action.actions : [];
    return count + 1 + countConfiguredActions(nestedActions);
  }, 0);
}

async function waitForAnyContentDescription(deviceId, expectedLabels, timeoutMs, executionContext) {
  if (expectedLabels.length === 0) {
    await delay(Math.min(timeoutMs, 8000));
    return "";
  }

  const deadline = Date.now() + timeoutMs;
  let currentLabels = [];
  do {
    const nodes = await getVisibleNodes(deviceId, executionContext, { refresh: true });
    currentLabels = summarizeNodes(nodes);
    const matched = currentLabels.find(actual => expectedLabels.some(expected =>
      actual.toLocaleLowerCase("cs-CZ").includes(expected.toLocaleLowerCase("cs-CZ"))));
    if (matched) {
      return matched;
    }
    await delay(0);
  } while (Date.now() < deadline);

  throw new Error(`Aplikace po restartu nezobrazila očekávanou výchozí obrazovku (${expectedLabels.join(" nebo ")}).`);
}

async function configurePresentationTouches(deviceId) {
  await runAdb(["-s", deviceId, "shell", "settings", "put", "system", "show_touches", "0"]);
  await runAdb(["-s", deviceId, "shell", "settings", "put", "system", "pointer_location", "0"]);
}

async function presentationTap(
  deviceId,
  x,
  y,
  action = {},
  pace = "natural",
  executionContext = { nodes: null, lastKnownNodes: null }
) {
  const waitAfterMs = getPacedWaitMs(action.waitAfterMs, pace, 0);
  await runAdb(["-s", deviceId, "shell", "input", "tap", String(x), String(y)]);
  await delay(waitAfterMs);
}

function normalizeEmulatorPace(value) {
  const pace = String(value || "natural").trim().toLowerCase();
  return Object.hasOwn(EMULATOR_PACE_PROFILES, pace) ? pace : "natural";
}

function getPacedWaitMs(value, pace, fallbackMs) {
  const profile = EMULATOR_PACE_PROFILES[normalizeEmulatorPace(pace)];
  const configured = clampInteger(value, 0, 5000, fallbackMs);
  return Math.min(profile.waitAfterLimitMs, Math.round(configured * profile.waitScale));
}

function getPacedSwipeDurationMs(value, pace) {
  const profile = EMULATOR_PACE_PROFILES[normalizeEmulatorPace(pace)];
  const configured = clampInteger(value, 100, 3000, 850);
  return clampInteger(configured * profile.swipeScale, 100, 1200, 400);
}

function normalizeSwipeRepeat(value) {
  return clampInteger(value, 1, 80, 1);
}

function buildDeleteKeyBatches(characterCount, batchSize = 80) {
  const count = clampInteger(characterCount, 0, 200, 0);
  const size = clampInteger(batchSize, 1, 100, 80);
  const batches = [];
  for (let offset = 0; offset < count; offset += size) {
    batches.push(Array(Math.min(size, count - offset)).fill("KEYCODE_DEL"));
  }
  return batches;
}

async function waitForNode(deviceId, matcher, pace, executionContext, options = {}) {
  const profile = EMULATOR_PACE_PROFILES[normalizeEmulatorPace(pace)];
  const timeoutMs = clampInteger(matcher.timeoutMs, 0, 30000, profile.nodeTimeoutMs);
  const deadline = Date.now() + timeoutMs;
  if (options.allowLastKnown && !executionContext?.nodes && executionContext?.lastKnownNodes) {
    const lastKnownMatch = findNode(executionContext.lastKnownNodes, matcher);
    if (lastKnownMatch) {
      return lastKnownMatch;
    }
  }
  let refresh = executionContext?.nodes === null;

  do {
    const nodes = await getVisibleNodes(deviceId, executionContext, { refresh });
    const match = findNode(nodes, matcher);
    if (match) {
      return match;
    }
    if (Date.now() >= deadline) {
      return null;
    }
    refresh = true;
    await delay(profile.nodePollMs);
  } while (true);
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

async function typeAdbTextKeyByKey(deviceId, value, keyDelayMs) {
  const intervalMs = clampInteger(keyDelayMs, 80, 1000, 350);
  const characters = [...String(value || "")];
  const keys = characters.map(keyEventForCharacter);
  if (keys.every(Boolean)) {
    await runAdb([
      "-s", deviceId, "shell", "input", "keyevent", "--delay", String(intervalMs), ...keys
    ]);
    await delay(intervalMs);
    return;
  }

  for (let index = 0; index < characters.length; index += 1) {
    const key = keys[index];
    if (key) {
      await runAdb(["-s", deviceId, "shell", "input", "keyevent", key]);
    } else {
      await typeAdbText(deviceId, characters[index]);
    }
    await delay(intervalMs);
  }
}

function keyEventForCharacter(character) {
  if (/^[0-9]$/.test(character)) {
    return `KEYCODE_${character}`;
  }
  if (/^[A-Za-z]$/.test(character)) {
    return `KEYCODE_${character.toUpperCase()}`;
  }
  return null;
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
  const xml = await runAdb(["-s", deviceId, "exec-out", "uiautomator", "dump", "/dev/tty"], { timeoutMs: 15000 });
  return parseUiNodes(xml);
}

async function getVisibleNodes(deviceId, executionContext, options = {}) {
  if (!options.refresh && executionContext?.nodes) {
    return executionContext.nodes;
  }

  const nodes = await dumpVisibleNodes(deviceId);
  if (executionContext) {
    executionContext.nodes = nodes;
    executionContext.lastKnownNodes = nodes;
  }
  return nodes;
}

function invalidateVisibleNodes(executionContext) {
  if (executionContext) {
    executionContext.nodes = null;
  }
}

function normalizeWaitForMatcher(value, transitionTimeoutMs) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  return {
    ...value,
    timeoutMs: transitionTimeoutMs === undefined
      ? clampInteger(value.timeoutMs, 0, 30000, 3000)
      : clampInteger(transitionTimeoutMs, 0, 30000, 3000)
  };
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
      resourceId: attributes["resource-id"] || "",
      hint: attributes.hint || "",
      className: attributes.class || "",
      clickable: attributes.clickable === "true",
      enabled: attributes.enabled !== "false",
      focusable: attributes.focusable === "true",
      focused: attributes.focused === "true",
      selected: attributes.selected === "true",
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
  const expectedDescriptions = [
    expectedDescription,
    ...(Array.isArray(matcher.contentDescriptions) ? matcher.contentDescriptions : [])
  ]
    .map(value => String(value || "").trim())
    .filter(Boolean)
    .slice(0, 10);
  const expectedClassName = String(matcher.className || "").trim();
  const expectedResourceId = String(matcher.resourceId || "").trim();
  if (!expectedText && expectedDescriptions.length === 0 && !expectedClassName && !expectedResourceId) {
    throw new Error("Akce vyžaduje text, contentDescription, className nebo resourceId.");
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
    if (expectedResourceId && node.resourceId !== expectedResourceId) {
      return false;
    }
    if (typeof matcher.selected === "boolean" && node.selected !== matcher.selected) {
      return false;
    }
    if (!expectedText && expectedDescriptions.length === 0) {
      return true;
    }

    const actual = expectedDescriptions.length > 0 ? node.contentDescription : node.text;
    const expectedValues = expectedDescriptions.length > 0 ? expectedDescriptions : [expectedText];
    return expectedValues.some(expected => exact
      ? actual === expected
      : actual.toLocaleLowerCase("cs-CZ").includes(expected.toLocaleLowerCase("cs-CZ")));
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

function pointWithinBounds(bounds, horizontalRatio) {
  const ratio = clampNumber(horizontalRatio, 0.1, 0.9, 0.5);
  return {
    x: Math.round(bounds.left + ((bounds.right - bounds.left) * ratio)),
    y: Math.round((bounds.top + bounds.bottom) / 2)
  };
}

function fieldMatcher(action) {
  return {
    className: action.className,
    resourceId: action.resourceId,
    occurrence: action.occurrence
  };
}

function describeMatcher(action) {
  return action.resourceId
    ? `resourceId=${action.resourceId}`
    : action.contentDescription
    ? `contentDescription=${action.contentDescription}`
    : Array.isArray(action.contentDescriptions)
      ? `contentDescription=${action.contentDescriptions.join(" nebo ")}`
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

function clampNumber(value, minimum, maximum, fallback = minimum) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return fallback;
  }
  return Math.min(maximum, Math.max(minimum, numeric));
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

function extractTicketPaymentInitiationFromLog(log) {
  const source = String(log || "");
  const candidates = [];
  const starts = [...source.matchAll(/\{\s*"paymentId"\s*:/g)].map(match => match.index);

  for (const start of starts) {
    // Flutter's debug logger wraps long response bodies across physical logcat lines,
    // including in the middle of URL and UUID string values. Join only the bounded
    // response window and extract the three fields needed to resume the live booking.
    const response = source.slice(start, start + 30000).replace(/\r?\n/g, "");
    const paymentId = response.match(/"paymentId"\s*:\s*"([0-9a-f-]+)"/i)?.[1] || "";
    const paymentUrl = (response.match(/"paymentUrl"\s*:\s*"([^"]+)"/i)?.[1] || "")
      .replace(/\s+/g, "");
    const booking = response.slice(Math.max(0, response.indexOf('"booking"')));
    const bookingId = booking.match(/"bookingId"\s*:\s*"([0-9a-f-]+)"/i)?.[1] || "";

    if (isUuid(paymentId) && isUuid(bookingId) && isSafePaymentGatewayUrl(paymentUrl)) {
      candidates.push({ paymentId, paymentUrl, bookingId });
    }
  }

  return candidates.at(-1) || null;
}

function isSafePaymentGatewayUrl(value) {
  try {
    const uri = new URL(value);
    return uri.protocol === "https:"
      && Boolean(uri.hostname)
      && !uri.username
      && !uri.password;
  } catch {
    return false;
  }
}

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function normalizeTicketPaymentDeepLink(value) {
  const raw = String(value || "").trim();
  let uri;
  try {
    uri = new URL(raw);
  } catch {
    throw new Error("Neplatný návratový deep link platby jízdenky.");
  }

  const bookingId = uri.pathname.replace(/^\//, "");
  if (uri.protocol !== TICKET_PAYMENT_CALLBACK_SCHEME
      || uri.hostname !== TICKET_PAYMENT_CALLBACK_HOST
      || !isUuid(bookingId)
      || uri.username
      || uri.password) {
    throw new Error("Deep link musí mířit na konkrétní booking pid-litacka-payment://ticket/{bookingId}.");
  }

  return raw;
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
  buildDeleteKeyBatches,
  countConfiguredActions,
  executeEmulatorActions,
  extractTicketPaymentInitiationFromLog,
  findNode,
  getEmulatorStatus,
  handleEmulatorBridgeRequest,
  normalizeEmulatorPace,
  normalizeAppPackageName,
  normalizeTicketPaymentDeepLink,
  normalizeSwipeRepeat,
  keyEventForCharacter,
  parseUiNodes,
  tokenizeAdbText
};
