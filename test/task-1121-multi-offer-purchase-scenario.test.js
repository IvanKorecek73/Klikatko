const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..");
const packPath = path.join(
  root,
  "public",
  "scenarios",
  "pidlitacka",
  "task-1121-multi-offer-purchase.json");
const manifestPath = path.join(root, "public", "scenarios", "pidlitacka", "index.json");

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function scenario() {
  return readJson(packPath).scenarios.find(
    item => item.id === "pidlitacka-task-1121-five-ticket-purchase");
}

function stepsById() {
  return new Map(scenario().steps.map(step => [step.id, step]));
}

test("task 1121 pack is registered as an authenticated local and INT regression", () => {
  const manifest = readJson(manifestPath);
  const registration = manifest.packs.find(
    item => item.id === "pidlitacka-task-1121-multi-offer-purchase");
  const flow = scenario();

  assert.equal(registration.file, "task-1121-multi-offer-purchase.json");
  assert.equal(flow.requiresAuth, true);
  assert.equal(flow.smoke, false);
  assert.equal(flow.manualInputRequired, true);
  assert.equal(flow.prewarmReturnUrl, true);
  assert.ok(flow.tags.includes("task-1121"));
  assert.ok(flow.tags.includes("local-seed"));
  assert.ok(!flow.tags.includes("int-only"));
  assert.equal(flow.steps.some(step => step.customAction === "requirePidLitackaIntEnvironment"), false);
  assert.equal(flow.steps[0].id, "ticket-1121-offer-1004");
});

test("task 1121 prices the exact five reported products as separate basket lines", () => {
  const flow = scenario();
  const offerSteps = flow.steps.filter(step => step.id.startsWith("ticket-1121-offer-"));

  assert.deepEqual(
    offerSteps.map(step => step.request.body.productId),
    [1004, 1005, 1006, 1007, 1008]);
  assert.deepEqual(
    offerSteps.map(step => step.expected.assertions.find(item => item.path === "$.offers[0].price.amount").equals),
    [48, 60, 72, 84, 96]);

  for (const step of offerSteps) {
    assert.equal(step.request.method, "POST");
    assert.equal(step.request.path, "/v1/client/tickets/purchase/payment/offers");
    assert.equal(step.request.body.amount, 1);
    assert.deepEqual(step.request.body.zones, []);
    assert.equal(step.request.body.validSince, "{{nowPlus2Minutes}}");
  }
});

test("task 1121 sends all five offer tokens once in one public booking request", () => {
  const booking = stepsById().get("ticket-1121-booking");

  assert.equal(booking.request.method, "POST");
  assert.equal(booking.request.path, "/v1/client/tickets/purchase/payment/bookings");
  assert.deepEqual(booking.request.body.offerIds, [
    "{{context.ticket1121Offer1004}}",
    "{{context.ticket1121Offer1005}}",
    "{{context.ticket1121Offer1006}}",
    "{{context.ticket1121Offer1007}}",
    "{{context.ticket1121Offer1008}}"
  ]);
  assert.equal(new Set(booking.request.body.offerIds).size, 5);
  assert.equal(booking.request.body.amount, 5);
  assert.equal(booking.request.body.activateAfterPayment, false);
  assert.ok(booking.request.headers["Idempotency-Key"]);
});

test("task 1121 recognizes the known pre-fix 4/5 and 312 CZK booking without hiding it", () => {
  const booking = stepsById().get("ticket-1121-booking");
  const warnings = booking.expected.warnings;

  assert.ok(warnings.some(warning => warning.when.some(condition =>
    condition.path === "$.bookedOffers.length" && condition.equals === 4)));
  assert.ok(warnings.some(warning => warning.when.some(condition =>
    condition.path === "$.provisionalPrice.amount" && condition.equals === 312)));
  assert.ok(warnings.every(warning => warning.blockAdvance !== true));
});

test("task 1121 post-fix contract requires 5 booked offers, 360 CZK and 5 fulfillments", () => {
  const steps = stepsById();
  const booking = steps.get("ticket-1121-booking");
  const fulfilled = steps.get("ticket-1121-booking-fulfilled");

  assert.equal(
    booking.expected.assertions.find(item => item.path === "$.bookedOffers").lengthEquals,
    5);
  assert.equal(
    booking.expected.assertions.find(item => item.path === "$.provisionalPrice.amount").equals,
    360);
  assert.equal(
    fulfilled.expected.assertions.find(item => item.path === "$.bookedOffers").lengthEquals,
    5);
  assert.equal(
    fulfilled.expected.assertions.find(item => item.path === "$.fulfillments").lengthEquals,
    5);
  assert.equal(
    fulfilled.expected.assertions.find(item => item.path === "$.confirmedPrice.amount").equals,
    360);
});

test("task 1121 completes one card payment and polls the authoritative booking", () => {
  const steps = stepsById();
  const payment = steps.get("ticket-1121-payment-initiate");
  const gateway = steps.get("ticket-1121-open-payment");
  const fulfilled = steps.get("ticket-1121-booking-fulfilled");

  assert.equal(payment.request.path, "/v1/client/tickets/purchase/payment/card/initiate");
  assert.equal(payment.request.body.bookingId, "{{context.ticket1121BookingId}}");
  assert.equal(payment.request.body.saveCard, false);
  assert.equal(
    payment.fields.find(field => field.name === "returnUrl").value,
    "http://localhost:5096/analysis/html/GwResponsePage.html?flow=task-1121-multi-offer");
  assert.equal(gateway.customAction, "showPaymentGatewayLink");
  assert.equal(
    fulfilled.request.path,
    "/v1/client/tickets/purchase/payment/bookings/{{context.ticket1121BookingId}}");
  assert.ok(fulfilled.expected.warnings.some(warning => warning.autoRetry?.maxAttempts === 72));
});

test("task 1121 final inventory check binds every product to the new booking", () => {
  const inventory = stepsById().get("ticket-1121-list-purchased-tickets");
  const products = inventory.expected.assertions.map(
    assertion => assertion.containsItem.productId);

  assert.equal(inventory.request.path, "/v1/client/tickets?limit=100&offset=0");
  assert.deepEqual(products, [1004, 1005, 1006, 1007, 1008]);
  for (const assertion of inventory.expected.assertions) {
    assert.equal(assertion.containsItem.bookingId, "{{context.ticket1121BookingId}}");
  }
});

test("task 1121 uses only public PidLitacka endpoints", () => {
  const requestSteps = scenario().steps.filter(step => step.request);

  assert.ok(requestSteps.length > 0);
  assert.ok(requestSteps.every(step => step.request.path.startsWith("/v1/")));
  assert.ok(requestSteps.every(step => !step.request.proxyTargetBaseUrl));
  assert.ok(requestSteps.every(step => !step.request.path.startsWith("/api/v1/")));
});
