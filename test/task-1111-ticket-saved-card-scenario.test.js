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
  "task-1111-ticket-saved-card.json");
const manifestPath = path.join(root, "public", "scenarios", "pidlitacka", "index.json");

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function getScenario(pack, id = "pidlitacka-ticket-save-and-use-card") {
  return pack.scenarios.find(item => item.id === id);
}

function stepsById(scenario) {
  return new Map(scenario.steps.map(step => [step.id, step]));
}

test("task 1111 ticket saved-card pack is registered as a manual authenticated regression", () => {
  const manifest = readJson(manifestPath);
  const pack = readJson(packPath);
  const registration = manifest.packs.find(
    item => item.id === "pidlitacka-task-1111-ticket-saved-card");
  const scenario = getScenario(pack);

  assert.equal(registration.file, "task-1111-ticket-saved-card.json");
  assert.equal(scenario.requiresAuth, true);
  assert.equal(scenario.smoke, false);
  assert.equal(scenario.manualInputRequired, true);
  assert.equal(scenario.prewarmReturnUrl, true);
  assert.ok(scenario.tags.includes("task-1111"));
});

test("both ticket purchases use only public PidLitacka backend endpoints", () => {
  const scenario = getScenario(readJson(packPath));
  const steps = stepsById(scenario);
  const requestSteps = scenario.steps.filter(step => step.request);

  assert.ok(requestSteps.length > 0);
  assert.ok(requestSteps.every(step => step.request.path.startsWith("/v1/")));
  assert.ok(requestSteps.every(step => !step.request.proxyTargetBaseUrl));
  assert.ok(requestSteps.every(step => !step.request.path.startsWith("/api/v1/")));

  const requests = requestSteps.map(step => `${step.request.method} ${step.request.path}`);
  assert.deepEqual(requests.filter(request => request.endsWith("/offers")), [
    "POST /v1/client/tickets/purchase/payment/offers",
    "POST /v1/client/tickets/purchase/payment/offers"
  ]);
  assert.deepEqual(requests.filter(request => request.endsWith("/bookings")), [
    "POST /v1/client/tickets/purchase/payment/bookings",
    "POST /v1/client/tickets/purchase/payment/bookings"
  ]);

  const firstOffer = steps.get("ticket-1111-first-offer");
  const secondOffer = steps.get("ticket-1111-second-offer");
  assert.equal(firstOffer.fields.find(field => field.name === "productId").value, 101);
  assert.equal(secondOffer.fields.find(field => field.name === "productId").value, 101);
  assert.equal(secondOffer.request.body.productId, "{{form.productId}}");
  assert.deepEqual(firstOffer.request.body.zones, ["P", "0"]);
  assert.deepEqual(secondOffer.request.body.zones, ["P", "0"]);
});

test("first purchase explicitly saves the card before the scenario selects it", () => {
  const scenario = getScenario(readJson(packPath));
  const steps = stepsById(scenario);
  const payment = steps.get("ticket-1111-first-payment");
  const paidBooking = steps.get("ticket-1111-first-booking-paid");
  const selectCard = steps.get("ticket-1111-select-saved-card");

  assert.equal(payment.request.path, "/v1/client/tickets/purchase/payment/card/initiate");
  assert.equal(payment.request.body.saveCard, true);
  assert.equal(payment.request.body.bookingId, "{{context.ticket1111FirstBookingId}}");
  assert.ok(payment.request.headers["Idempotency-Key"]);
  assert.equal(
    payment.fields.find(field => field.name === "returnUrl").value,
    "http://localhost:5096/analysis/html/GwResponsePage.html?flow=task-1111-ticket-saved-card");

  assert.ok(
    scenario.steps.indexOf(paidBooking) < scenario.steps.indexOf(selectCard),
    "paid booking reconciliation must happen before reading the saved card");
  assert.equal(paidBooking.expected.assertions[1].path, "$.paymentState");
  assert.equal(paidBooking.expected.assertions[1].equals, "PAID");
  assert.equal(selectCard.request.path, "/v1/accounts/me/saved-cards");
  assert.equal(selectCard.selection.store.ticket1111SavedCardId, "$.id");
});

test("second purchase charges the newly persisted card by its public saved-card id", () => {
  const scenario = getScenario(readJson(packPath));
  const steps = stepsById(scenario);
  const initiate = steps.get("ticket-1111-saved-card-initiate");
  const processAfterFingerprint = steps.get("ticket-1111-process-after-fingerprint");
  const processFinal = steps.get("ticket-1111-process-final");
  const finalBooking = steps.get("ticket-1111-second-booking-paid");

  assert.equal(
    initiate.request.path,
    "/v1/client/tickets/purchase/payment/saved-card/{{context.ticket1111SecondBookingId}}/initiate");
  assert.equal(
    initiate.request.body.savedPaymentCardId,
    "{{context.ticket1111SavedCardId}}");
  assert.equal(initiate.request.body.isSdkUsed, false);
  assert.ok(initiate.request.body.additionalBrowserData);
  assert.equal(initiate.request.body.additionalBrowserData.userAgent, "{{browser.userAgent}}");
  assert.equal(initiate.request.body.additionalBrowserData.screenWidth, "{{browser.screenWidth}}");
  assert.equal(initiate.warningWhen[0].when[0].contextExists, "ticket1111SecondPaymentId");
  assert.ok(initiate.request.headers["Idempotency-Key"]);
  assert.equal(initiate.request.body.savedCardToken, undefined);

  for (const process of [processAfterFingerprint, processFinal]) {
    assert.equal(
      process.request.path,
      "/v1/client/tickets/purchase/payment/{{context.ticket1111SecondBookingId}}/payments/{{context.ticket1111SecondPaymentId}}/process");
    assert.equal(process.request.body.paymentMethod, "SavedCard");
    assert.equal(
      process.request.body.savedPaymentCardId,
      "{{context.ticket1111SavedCardId}}");
    assert.equal(process.request.body.additionalBrowserData.userAgent, "{{browser.userAgent}}");
  }

  assert.equal(
    processFinal.expected.assertions.find(assertion => assertion.path === "$.status").equals,
    "PAID");
  assert.equal(finalBooking.expected.assertions[1].path, "$.paymentState");
  assert.equal(finalBooking.expected.assertions[1].equals, "PAID");
  assert.equal(finalBooking.expected.warnings[0].when[0].equals, "IN_PROGRESS");
  assert.ok(processFinal.expected.warnings.some(warning =>
    warning.when?.some(condition => condition.path === "$.paymentInProgress" && condition.equals === false)));
});

test("task 1111 protects an initiated payment from accidental re-initiation", () => {
  const appSource = fs.readFileSync(path.join(root, "public", "app.js"), "utf8");
  const scenario = getScenario(readJson(packPath));
  const secondBooking = stepsById(scenario).get("ticket-1111-second-booking");

  assert.match(appSource, /status >= 400 && step\.extractOnError !== true/);
  assert.equal(secondBooking.remember.ticket1111SecondPaymentId, "");
  assert.equal(secondBooking.remember.ticket1111FingerprintUrl, "");
  assert.match(appSource, /getBrowserRuntimeValue/);
});

test("task 1111 offers a standalone existing-card purchase without the first payment", () => {
  const pack = readJson(packPath);
  const scenario = getScenario(pack, "pidlitacka-ticket-use-existing-card");
  const appSource = fs.readFileSync(path.join(root, "public", "app.js"), "utf8");

  assert.equal(scenario.requiresAuth, true);
  assert.equal(scenario.smoke, false);
  assert.equal(scenario.steps.length, 1);
  assert.equal(scenario.steps[0].selection.store.ticket1111SavedCardId, "$.id");
  assert.deepEqual(scenario.appendStepsFrom, {
    scenarioId: "pidlitacka-ticket-save-and-use-card",
    startStepId: "ticket-1111-second-offer",
    endStepId: "ticket-1111-second-booking-paid"
  });
  assert.match(appSource, /function expandReferencedScenarioSteps/);
});

test("task 1111 scenario supports 3DS and cleans up only the selected test card", () => {
  const scenario = getScenario(readJson(packPath));
  const steps = stepsById(scenario);
  const fingerprint = steps.get("ticket-1111-open-fingerprint");
  const processAfterFingerprint = steps.get("ticket-1111-process-after-fingerprint");
  const authenticate = steps.get("ticket-1111-open-authenticate");
  const processFinal = steps.get("ticket-1111-process-final");
  const remove = steps.get("ticket-1111-delete-card");
  const cleanup = getScenario(readJson(packPath), "pidlitacka-ticket-1111-card-cleanup");

  assert.equal(fingerprint.customAction, "showPaymentGatewayLink");
  assert.equal(fingerprint.paymentGateway.actionKind, "fingerprint");
  assert.equal(fingerprint.skipWhen.contextMissing, "ticket1111FingerprintUrl");
  assert.equal(authenticate.customAction, "showPaymentGatewayLink");
  assert.equal(authenticate.paymentGateway.actionKind, "challenge");
  assert.equal(authenticate.skipWhen.contextMissing, "ticket1111AuthenticateUrl");
  assert.equal(processAfterFingerprint.expected.warnings[1].blockAdvance, true);
  assert.deepEqual(processAfterFingerprint.expected.warnings[1].autoRetry, {
    delaySeconds: 5,
    maxAttempts: 18,
    label: "Čekám na 3DS challenge"
  });
  assert.ok(processAfterFingerprint.expected.warnings[1].when.some(condition =>
    condition.path === "$.authenticateRequired" && condition.equals === false));
  assert.ok(processAfterFingerprint.expected.warnings.some(warning =>
    warning.when?.some(condition => condition.path === "$.paymentInProgress" && condition.equals === false)));
  assert.equal(
    processFinal.extract.ticket1111AuthenticateUrl,
    "$.actions.authenticateAction.browserChallengeAuthSubAction.url");
  assert.equal(processFinal.expected.warnings[0].when[0].path, "$.authenticateRequired");
  assert.equal(processFinal.expected.warnings[0].blockAdvance, true);
  assert.ok(processFinal.expected.warnings[2].when.some(condition =>
    condition.path === "$.authenticateRequired" && condition.equals === false));
  assert.equal(
    remove.request.path,
    "/v1/accounts/me/saved-cards/{{context.ticket1111SavedCardId}}");
  assert.equal(cleanup.smoke, false);
  assert.equal(cleanup.steps[0].selection.store.ticket1111CleanupCardId, "$.id");
});

test("task 1111 visualizes and can cancel automatic 3DS polling", () => {
  const appSource = fs.readFileSync(path.join(root, "public", "app.js"), "utf8");
  const styles = fs.readFileSync(path.join(root, "public", "styles.css"), "utf8");

  assert.match(appSource, /function scheduleAutoRetry/);
  assert.match(appSource, /data-auto-retry-seconds/);
  assert.match(appSource, /data-auto-retry-cancel/);
  assert.match(appSource, /function cancelAutoRetry/);
  assert.match(styles, /\.auto-retry-countdown/);
});
