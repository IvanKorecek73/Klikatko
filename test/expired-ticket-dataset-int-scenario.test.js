const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..");
const packPath = path.join(root, "public", "scenarios", "pidlitacka", "expired-ticket-dataset-int.json");
const manifestPath = path.join(root, "public", "scenarios", "pidlitacka", "index.json");
const appPath = path.join(root, "public", "app.js");

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function scenario() {
  return readJson(packPath).scenarios[0];
}

function activeLongTicketScenario() {
  return readJson(packPath).scenarios.find(item =>
    item.id === "pidlitacka-int-create-active-120h-ticket");
}

function stepsById() {
  return new Map(scenario().steps.map(step => [step.id, step]));
}

test("INT expired-ticket data pack is registered and visibly destructive", () => {
  const registration = readJson(manifestPath).packs.find(item =>
    item.id === "pidlitacka-expired-ticket-dataset-int");
  const item = scenario();

  assert.equal(registration.file, "expired-ticket-dataset-int.json");
  assert.equal(item.smoke, false);
  assert.equal(item.manualInputRequired, true);
  assert.ok(item.tags.includes("int-only"));
  assert.ok(item.tags.includes("destructive"));
  assert.match(item.instructions.join("\n"), /pouze jednou/i);
  assert.match(item.instructions.join("\n"), /tarifní půlnoci/i);
});

test("scenario pins the safe account and blocks mutations outside INT", () => {
  const item = scenario();
  const steps = new Map(item.steps.map(step => [step.id, step]));
  const login = steps.get("expired-dataset-login");
  const guard = steps.get("expired-dataset-require-int");
  const firstMutationIndex = item.steps.findIndex(step =>
    ["POST", "PATCH", "PUT", "DELETE"].includes(step.request?.method));

  assert.equal(login.profileLogin.email, "wijessibrouma-5506@yopmail.com");
  assert.equal(guard.customAction, "requirePidLitackaIntEnvironment");
  assert.ok(item.steps.indexOf(guard) < firstMutationIndex);
});

test("scenario opens and pauses on two independent card gateway payments", () => {
  const item = scenario();
  const steps = new Map(item.steps.map(step => [step.id, step]));
  const firstPayment = steps.get("expired-dataset-payment-1");
  const openFirstPayment = steps.get("expired-dataset-open-payment-1");
  const firstPaymentCheck = steps.get("expired-dataset-payment-1-check");
  const secondPayment = steps.get("expired-dataset-payment-2");
  const openSecondPayment = steps.get("expired-dataset-open-payment-2");
  const secondPaymentCheck = steps.get("expired-dataset-payment-2-check");

  assert.equal(item.prewarmReturnUrl, true);
  assert.equal(firstPayment.request.path, "/v1/client/tickets/purchase/payment/card/initiate");
  assert.equal(firstPayment.request.body.saveCard, false);
  assert.equal(firstPayment.request.body.bookingId, "{{context.expiredDatasetBookingId1}}");
  assert.equal(firstPayment.fields.find(field => field.name === "returnUrl").value, "pid-litacka-payment://ticket");
  assert.ok(firstPaymentCheck.expected.assertions.some(assertion =>
    assertion.path === "$.paymentState" && assertion.equals === "PAID"));
  assert.equal(openFirstPayment.customAction, "showPaymentGatewayLink");
  assert.equal(openFirstPayment.paymentGateway.url, "{{context.expiredDatasetPaymentUrl1}}");
  assert.equal(openFirstPayment.workflowStopAfter.preserveResult, true);
  assert.ok(openFirstPayment.workflowStopAfter.instructions.some(line => line.includes("4000007000010006")));
  assert.ok(item.steps.indexOf(firstPayment) < item.steps.indexOf(openFirstPayment));
  assert.ok(item.steps.indexOf(openFirstPayment) < item.steps.indexOf(firstPaymentCheck));
  assert.equal(secondPayment.request.path, "/v1/client/tickets/purchase/payment/card/initiate");
  assert.equal(secondPayment.request.body.saveCard, false);
  assert.equal(secondPayment.request.body.bookingId, "{{context.expiredDatasetBookingId2}}");
  assert.equal(secondPayment.fields.find(field => field.name === "returnUrl").value, "pid-litacka-payment://ticket");
  assert.equal(openSecondPayment.customAction, "showPaymentGatewayLink");
  assert.equal(openSecondPayment.paymentGateway.url, "{{context.expiredDatasetPaymentUrl2}}");
  assert.equal(openSecondPayment.workflowStopAfter.preserveResult, true);
  assert.ok(secondPaymentCheck.expected.assertions.some(assertion =>
    assertion.path === "$.paymentState" && assertion.equals === "PAID"));
  assert.ok(item.steps.indexOf(secondPayment) < item.steps.indexOf(openSecondPayment));
  assert.ok(item.steps.indexOf(openSecondPayment) < item.steps.indexOf(secondPaymentCheck));
});

test("scenario buys exactly two independent batches of 100 half-hour tickets", () => {
  const steps = stepsById();

  for (const batch of [1, 2]) {
    const offer = steps.get(`expired-dataset-offer-${batch}`);
    const booking = steps.get(`expired-dataset-booking-${batch}`);

    assert.equal(offer.request.path, "/v1/client/tickets/purchase/payment/offers");
    assert.equal(offer.request.body.productId, 1018);
    assert.equal(offer.request.body.amount, 100);
    assert.equal(offer.request.body.validSince, "{{nowPlus2Minutes}}");
    assert.deepEqual(offer.request.body.zones, ["P", "0", "B"]);
    assert.ok(offer.expected.assertions.some(assertion =>
      assertion.path === "$.offers[0].admission.duration" && assertion.equals === 30));

    assert.equal(booking.request.path, "/v1/client/tickets/purchase/payment/bookings");
    assert.equal(booking.request.body.amount, 100);
    assert.equal(booking.request.body.activateAfterPayment, false);
    assert.ok(booking.request.headers["Idempotency-Key"]);

  }

  const secondPayment = steps.get("expired-dataset-payment-2");
  assert.equal(secondPayment.request.path, "/v1/client/tickets/purchase/payment/card/initiate");
  assert.equal(secondPayment.request.body.bookingId, "{{context.expiredDatasetBookingId2}}");
  assert.ok(secondPayment.request.headers["Idempotency-Key"]);
  assert.ok(secondPayment.expected.assertions.some(assertion =>
    assertion.path === "$.paymentUrl" && assertion.notEmpty === true));

  assert.notEqual(
    steps.get("expired-dataset-booking-1").extract.expiredDatasetBookingId1,
    undefined);
  assert.notEqual(
    steps.get("expired-dataset-booking-2").extract.expiredDatasetBookingId2,
    undefined);
});

test("bulk activation is scoped to the two new bookings and exactly 200 fulfillments", () => {
  const activate = stepsById().get("expired-dataset-activate-all");

  assert.equal(activate.customAction, "activateTicketDataset");
  assert.deepEqual(activate.ticketDataset.bookingIds, [
    "{{context.expiredDatasetBookingId1}}",
    "{{context.expiredDatasetBookingId2}}"
  ]);
  assert.equal(activate.ticketDataset.expectedCount, 200);
  assert.equal(activate.ticketDataset.expectedEmail, "wijessibrouma-5506@yopmail.com");
  assert.equal(activate.ticketDataset.deviceId, "{{context.expiredDatasetDeviceId}}");
  assert.ok(activate.ticketDataset.concurrency <= 4);
});

test("runner implements INT guard, future validity and retry-safe activation", () => {
  const source = fs.readFileSync(appPath, "utf8");

  assert.match(source, /step\.customAction === "requirePidLitackaIntEnvironment"/);
  assert.match(source, /selectedEnvironment\?\.id !== "pidlitacka-integration"/);
  assert.match(source, /usesHarnessProxy \? proxyTarget : parsedBaseUrl\.toString\(\)/);
  assert.match(source, /hostname !== "pidl2-backend\.int\.pidlitacka\.cz"/);
  assert.match(source, /step\.customAction === "requireSavedCardSuffix"/);
  assert.match(source, /step\.customAction === "showPaymentGatewayLink"/);
  assert.match(source, /if \(step\.workflowStopAfter\)/);
  assert.match(source, /step\.customAction === "activateTicketDataset"/);
  assert.match(source, /callPidLitackaApi\(`\/v1\/client\/tickets\/\$\{encodeURIComponent\(fulfillmentId\)\}`/);
  assert.match(source, /\[429, 502, 504\]\.includes\(status\)/);
  assert.match(source, /"FULFILLED", "IN_PROTECTION_DELAY", "EXPIRED"/);
  assert.match(source, /replaceAll\("\{\{nowPlus2Minutes\}\}"/);
});

test("profile login step can replace an expired session before authorization checks", () => {
  const source = fs.readFileSync(appPath, "utf8");
  const functionStart = source.indexOf("function requiresAuthorizationForStep(step)");
  const functionEnd = source.indexOf("\n}", functionStart);
  const implementation = source.slice(functionStart, functionEnd + 2);

  assert.match(implementation, /step\?\.customAction === "loginPidLitackaProfile"/);
  assert.match(implementation, /return false/);
  assert.ok(
    implementation.indexOf("loginPidLitackaProfile") < implementation.indexOf("requiresAuthorization(state.scenario)"),
    "login must bypass the scenario-level authorization requirement before a stale session is refreshed");
});

test("separate INT scenario purchases and activates one verified 120-hour ticket", () => {
  const item = activeLongTicketScenario();
  const steps = new Map(item.steps.map(step => [step.id, step]));
  const login = steps.get("active-long-ticket-login");
  const guard = steps.get("active-long-ticket-require-int");
  const offer = steps.get("active-long-ticket-offer");
  const booking = steps.get("active-long-ticket-booking");
  const payment = steps.get("active-long-ticket-payment");
  const openPayment = steps.get("active-long-ticket-open-payment");
  const activation = steps.get("active-long-ticket-activate");

  assert.ok(item);
  assert.equal(login.profileLogin.email, "wijessibrouma-5506@yopmail.com");
  assert.equal(guard.customAction, "requirePidLitackaIntEnvironment");
  assert.equal(offer.request.body.productId, 1052);
  assert.equal(offer.request.body.amount, 1);
  assert.ok(offer.expected.assertions.some(assertion =>
    assertion.path === "$.offers[0].admission.duration" && assertion.equals === 7200));
  assert.equal(booking.request.body.amount, 1);
  assert.equal(booking.request.body.activateAfterPayment, false);
  assert.equal(payment.request.path, "/v1/client/tickets/purchase/payment/card/initiate");
  assert.equal(payment.request.body.saveCard, false);
  assert.equal(openPayment.customAction, "showPaymentGatewayLink");
  assert.equal(openPayment.workflowStopAfter.preserveResult, true);
  assert.equal(activation.customAction, "activateTicketDataset");
  assert.equal(activation.ticketDataset.expectedCount, 1);
  assert.deepEqual(activation.ticketDataset.bookingIds, ["{{context.activeLongTicketBookingId}}"]) ;
  assert.equal(activation.ticketDataset.contextPrefix, "activeLongTicket");
});
