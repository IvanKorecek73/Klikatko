const assert = require("node:assert/strict");
const test = require("node:test");
const { countConfiguredActions, findNode, parseUiNodes, tokenizeAdbText } = require("../tools/emulator-bridge");

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

test("emulator bridge finds exact and partial presentation targets", () => {
  const nodes = parseUiNodes(fixture);

  assert.equal(findNode(nodes, { text: "Pokračovat", clickable: true }).text, "Pokračovat");
  assert.equal(findNode(nodes, { contentDescription: "Nová karta", exact: false }).contentDescription, "Výchozí způsob platby\nNová karta");
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
