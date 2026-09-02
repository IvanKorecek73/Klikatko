const assert = require("node:assert/strict");
const test = require("node:test");
const { normalizeDesktopPaymentUrl } = require("../tools/desktop-bridge");

test("desktop bridge accepts only credential-free HTTPS payment URLs", () => {
  const valid = "https://gateway.example/pay?token=one-time";
  assert.equal(normalizeDesktopPaymentUrl(valid), valid);
  assert.throws(() => normalizeDesktopPaymentUrl("http://gateway.example/pay"), /HTTPS/);
  assert.throws(() => normalizeDesktopPaymentUrl("https://user:secret@gateway.example/pay"), /HTTPS/);
  assert.throws(() => normalizeDesktopPaymentUrl("https://gateway.example/pay\nnext"), /Neplatná/);
});
