const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const {
  buildDeleteKeyBatches,
  buildPointerMovePoints,
  countConfiguredActions,
  findNode,
  getPresentationTapTiming,
  keyEventForCharacter,
  normalizeEmulatorPace,
  normalizeAppPackageName,
  normalizeSwipeRepeat,
  parseUiNodes,
  tokenizeAdbText
} = require("../tools/emulator-bridge");

const bridgeSource = fs.readFileSync(path.join(__dirname, "..", "tools", "emulator-bridge.js"), "utf8");

const fixture = `<?xml version="1.0"?>
<hierarchy>
  <node text="" content-desc="Nastavení jízdného" class="android.view.View" clickable="false" enabled="true" bounds="[42,147][629,252]" />
  <node text="" content-desc="Výchozí způsob platby&#10;Nová karta" class="android.widget.ImageView" clickable="true" enabled="true" bounds="[36,503][886,651]" />
  <node text="Pokračovat" content-desc="" class="android.widget.Button" clickable="true" enabled="true" bounds="[84,2084][996,2210]" />
</hierarchy>`;

test("emulator bridge parses semantic labels and bounds from UIAutomator XML", () => {
  const nodes = parseUiNodes(fixture);

  assert.equal(nodes.length, 3);
  assert.equal(nodes[1].contentDescription, "Výchozí způsob platby\nNová karta");
  assert.deepEqual(nodes[1].bounds, { left: 36, top: 503, right: 886, bottom: 651 });
});

test("emulator bridge retains stable HTML field identifiers exposed by Android WebView", () => {
  const nodes = parseUiNodes('<node text="11/30" resource-id="expiry" hint="Platnost" class="android.widget.EditText" enabled="true" bounds="[44,1183][643,1317]" />');

  assert.equal(nodes[0].resourceId, "expiry");
  assert.equal(nodes[0].hint, "Platnost");
  assert.equal(findNode(nodes, { resourceId: "expiry" }).text, "11/30");
});

test("emulator bridge finds exact and partial presentation targets", () => {
  const nodes = parseUiNodes(fixture);

  assert.equal(findNode(nodes, { text: "Pokračovat", clickable: true }).text, "Pokračovat");
  assert.equal(findNode(nodes, { contentDescription: "Nová karta", exact: false }).contentDescription, "Výchozí způsob platby\nNová karta");
  assert.equal(findNode(nodes, { contentDescriptions: ["0006", "Nová karta"], exact: false }).contentDescription, "Výchozí způsob platby\nNová karta");
  assert.equal(findNode(nodes, { text: "Chybí" }), null);
  assert.equal(findNode(nodes, { className: "android.widget.EditText", occurrence: 1 }), null);
});

test("emulator bridge tokenizes reusable login and card values without a shell", () => {
  assert.deepEqual(tokenizeAdbText("user+demo@example.cz"), [
    { type: "text", value: "user" },
    { type: "key", key: "KEYCODE_PLUS" },
    { type: "text", value: "demo" },
    { type: "key", key: "KEYCODE_AT" },
    { type: "text", value: "example" },
    { type: "key", key: "KEYCODE_PERIOD" },
    { type: "text", value: "cz" }
  ]);
  assert.deepEqual(tokenizeAdbText("Test1234!"), [
    { type: "text", value: "Test1234" },
    { type: "key", key: "KEYCODE_1", modifier: "KEYCODE_SHIFT_LEFT" }
  ]);
  assert.throws(() => tokenizeAdbText("č"), /nepodporovaný znak/);
});

test("emulator bridge maps masked numeric inputs to real individual key events", () => {
  assert.equal(keyEventForCharacter("0"), "KEYCODE_0");
  assert.equal(keyEventForCharacter("9"), "KEYCODE_9");
  assert.equal(keyEventForCharacter("a"), "KEYCODE_A");
  assert.equal(keyEventForCharacter("/"), null);
});

test("emulator bridge clears existing Flutter text with bounded delete batches", () => {
  assert.deepEqual(buildDeleteKeyBatches(3), [["KEYCODE_DEL", "KEYCODE_DEL", "KEYCODE_DEL"]]);
  assert.deepEqual(buildDeleteKeyBatches(0), []);
  assert.deepEqual(buildDeleteKeyBatches(201).map(batch => batch.length), [80, 80, 40]);
});

test("emulator bridge counts conditional actions against the safety limit", () => {
  assert.equal(countConfiguredActions([
    {
      type: "ifNode",
      contentDescription: "Nastavení",
      actions: [
        { type: "tapNode", contentDescription: "Odhlásit se" },
        { type: "wait", durationMs: 100 }
      ]
    },
    { type: "assertNode", contentDescription: "Přihlaste se", exact: false }
  ]), 4);
});

test("emulator bridge bounds repeated swipes used to reveal off-screen controls", () => {
  assert.equal(normalizeSwipeRepeat(undefined), 1);
  assert.equal(normalizeSwipeRepeat(6), 6);
  assert.equal(normalizeSwipeRepeat(99), 80);
  assert.equal(normalizeSwipeRepeat(0), 1);
});

test("presentation taps keep a short visible pointer and touch without post-click delays", () => {
  assert.deepEqual(getPresentationTapTiming(), {
    hoverMs: 160,
    touchMs: 240,
    waitAfterMs: 0
  });
  assert.deepEqual(getPresentationTapTiming({
    hoverMs: 140,
    touchMs: 100,
    waitAfterMs: 700
  }), {
    hoverMs: 140,
    touchMs: 100,
    waitAfterMs: 0
  });
  assert.deepEqual(getPresentationTapTiming({}, "fast"), {
    hoverMs: 120,
    touchMs: 200,
    waitAfterMs: 0
  });
  assert.deepEqual(getPresentationTapTiming({ waitAfterMs: 700 }, "fast"), {
    hoverMs: 120,
    touchMs: 200,
    waitAfterMs: 0
  });
});

test("presentation pointer interpolates a visible path and lands exactly on the target", () => {
  assert.deepEqual(buildPointerMovePoints({ x: 0, y: 0 }, { x: 60, y: 120 }, 3), [
    { x: 20, y: 40 },
    { x: 40, y: 80 },
    { x: 60, y: 120 }
  ]);
});

test("emulator pace input falls back safely and presentation clicks expose pointer movement", () => {
  assert.equal(normalizeEmulatorPace("natural"), "natural");
  assert.equal(normalizeEmulatorPace("FAST"), "fast");
  assert.equal(normalizeEmulatorPace("unexpected"), "natural");
  assert.match(bridgeSource, /"input", "mouse", "motionevent", "MOVE"/);
  assert.match(bridgeSource, /"input", "touchscreen", "motionevent", "DOWN"/);
  assert.match(bridgeSource, /"input", "touchscreen", "motionevent", "UP"/);
  assert.match(bridgeSource, /"pointer_location", enabled \? "1" : "0"/);
});

test("emulator bridge accepts only safe Android application package names", () => {
  assert.equal(
    normalizeAppPackageName("cz.dpp.praguepublictransport.dev.pidlitacka"),
    "cz.dpp.praguepublictransport.dev.pidlitacka"
  );
  assert.throws(() => normalizeAppPackageName("pidlitacka"), /Neplatný název balíčku/);
  assert.throws(() => normalizeAppPackageName("cz.dpp.app; reboot"), /Neplatný název balíčku/);
});
