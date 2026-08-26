const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..");
const packPath = path.join(root, "public", "scenarios", "pidlitacka", "coupon-save-card.json");

function readPack() {
  return JSON.parse(fs.readFileSync(packPath, "utf8"));
}

function getScenario(id) {
  return readPack().scenarios.find(scenario => scenario.id === id);
}

function getSteps(id) {
  const scenario = getScenario(id);
  return new Map(scenario.steps.map(step => [step.id, step]));
}

test("coupon saved-card lifecycle is a manual authenticated save-use-delete flow", () => {
  const scenario = getScenario("client-coupon-purchase-save-card");
  const steps = getSteps(scenario.id);

  assert.equal(scenario.requiresAuth, true);
  assert.equal(scenario.smoke, false);
  assert.equal(scenario.manualInputRequired, true);
  assert.equal(steps.get("coupon-save-card-before").expected.assertions[0].equals.length, 0);
  assert.equal(steps.get("coupon-saved-card-verify-cleanup").expected.assertions[0].equals.length, 0);
  assert.ok(scenario.instructions.some(line => line.includes("nerevokuje")));
});

test("newly persisted coupon card is selected and reused by its public saved-card id", () => {
  const steps = getSteps("client-coupon-purchase-save-card");
  const select = steps.get("coupon-save-card-after");
  const createOrder = steps.get("coupon-saved-card-create-second-order");
  const process = steps.get("coupon-saved-card-process-init");

  assert.equal(select.selection.sourcePath, "$");
  assert.equal(select.selection.filter.status, "Active");
  assert.equal(select.selection.store.pidCouponSavedCardId, "$.id");
  assert.equal(createOrder.request.path, "/v1/client/coupons/purchase/orders");
  assert.equal(
    process.request.path,
    "/v1/client/coupons/purchase/payment/card-token/{{context.pidCouponSavedCardOrderId}}/process");
  assert.equal(process.request.body.paymentMethod, "SavedCard");
  assert.equal(process.request.body.savedPaymentCardId, "{{context.pidCouponSavedCardId}}");
  assert.equal(process.request.body.saveCard, false);
  assert.equal(process.request.body.paymentData, null);
  assert.equal(process.request.body.additionalSdkData, null);
  assert.equal(process.request.body.isSdkUsed, false);
});

test("saved-card lifecycle exposes browser fingerprint and authentication actions", () => {
  const steps = getSteps("client-coupon-purchase-save-card");
  const initiate = steps.get("coupon-saved-card-process-init");
  const fingerprint = steps.get("coupon-saved-card-open-fingerprint");
  const authenticate = steps.get("coupon-saved-card-open-authenticate");
  const final = steps.get("coupon-saved-card-process-final");

  assert.equal(
    initiate.extract.pidCouponSavedCardFingerprintUrl,
    "$.actions.fingerprintAction.browserFingerprintSubAction.url");
  assert.equal(
    initiate.extract.pidCouponSavedCardAuthenticateUrl,
    "$.actions.authenticateAction.browserChallengeAuthSubAction.url");
  assert.equal(fingerprint.customAction, "showPaymentGatewayLink");
  assert.equal(fingerprint.skipWhen.contextMissing, "pidCouponSavedCardFingerprintUrl");
  assert.equal(authenticate.customAction, "showPaymentGatewayLink");
  assert.equal(authenticate.skipWhen.contextMissing, "pidCouponSavedCardAuthenticateUrl");
  assert.equal(
    final.expected.warnings.find(warning => warning.blockAdvance).when[0].equals,
    "InProgress");
});

test("result distinguishes a working token from the reproduced canceled outcome before cleanup", () => {
  const scenario = getScenario("client-coupon-purchase-save-card");
  const steps = getSteps(scenario.id);
  const result = steps.get("coupon-saved-card-second-order-result");
  const remove = steps.get("coupon-saved-card-delete-created-card");
  const resultIndex = scenario.steps.findIndex(step => step.id === result.id);
  const removeIndex = scenario.steps.findIndex(step => step.id === remove.id);

  assert.equal(result.expected.assertions[1].sourcePath, "$.status");
  assert.equal(result.expected.assertions[1].regex, "^(CouponReady|Canceled)$");
  assert.ok(result.expected.warnings.some(warning => warning.when[0].equals === "Canceled"));
  assert.ok(removeIndex > resultIndex);
  assert.equal(remove.request.method, "DELETE");
  assert.equal(remove.request.path, "/v1/accounts/me/saved-cards/{{context.pidCouponSavedCardId}}");
  assert.equal(remove.expected.assertions[1].equals, "Deleted");
});

test("pack contains an independent interrupted-run cleanup scenario", () => {
  const scenario = getScenario("client-coupon-saved-card-cleanup");
  const steps = getSteps(scenario.id);
  const select = steps.get("coupon-saved-card-cleanup-select");
  const remove = steps.get("coupon-saved-card-cleanup-delete");

  assert.equal(scenario.requiresAuth, true);
  assert.equal(scenario.smoke, false);
  assert.equal(scenario.manualInputRequired, true);
  assert.ok(scenario.tags.includes("cleanup"));
  assert.equal(select.selection.store.pidCouponCleanupSavedCardId, "$.id");
  assert.equal(remove.request.method, "DELETE");
  assert.match(remove.request.path, /pidCouponCleanupSavedCardId/);
  assert.equal(remove.expected.assertions[1].equals, "Deleted");
});
