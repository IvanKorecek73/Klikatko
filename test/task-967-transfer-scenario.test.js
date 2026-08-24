const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..");
const packPath = path.join(root, "public", "scenarios", "pidlitacka", "feature-967-prevod-jizdenky.json");
const manifestPath = path.join(root, "public", "scenarios", "pidlitacka", "index.json");
const projectsPath = path.join(root, "public", "scenarios", "index.json");
const appPath = path.join(root, "public", "app.js");

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

test("task 967 pack is registered and uses the saved-login recipient source", () => {
  const manifest = readJson(manifestPath);
  const pack = readJson(packPath);
  const registration = manifest.packs.find(item => item.id === "pidlitacka-feature-967");
  const scenario = pack.scenarios.find(item => item.id === "pidlitacka-ticket-967-purchase-transfer-verify");
  const recipientStep = scenario.steps.find(step => step.id === "ticket-967-select-recipient");
  const recipientField = recipientStep.fields.find(field => field.name === "ticket967RecipientEmail");

  assert.equal(registration.file, "feature-967-prevod-jizdenky.json");
  assert.equal(scenario.requiresAuth, true);
  assert.equal(scenario.smoke, false);
  assert.equal(scenario.manualInputRequired, true);
  assert.equal(scenario.prewarmReturnUrl, true);
  assert.equal(recipientField.optionsSource, "pidlitacka-auth-profiles");
  assert.equal(recipientField.excludeCurrentSession, true);
  assert.equal(
    recipientStep.fields.find(field => field.name === "ticket967TicketsBaseUrl").value,
    "http://localhost:28180");
  assert.equal(
    recipientStep.fields.find(field => field.name === "ticket967PidLitackaBaseUrl").value,
    "http://localhost:5065");
});

test("PidLitacka exposes the private Aspire environment used by task 967", () => {
  const pidLitacka = readJson(projectsPath).projects.find(project => project.id === "pidlitacka");
  const environment = pidLitacka.environments.find(item => item.id === "pidlitacka-local-aspire");

  assert.deepEqual(environment, {
    id: "pidlitacka-local-aspire",
    name: "LOCAL ASPIRE",
    targetBaseUrl: "http://localhost:5065"
  });
});

test("task 967 purchase bypasses PidLitacka BE but transfer and inventory checks use it", () => {
  const scenario = readJson(packPath).scenarios[0];
  const steps = new Map(scenario.steps.map(step => [step.id, step]));
  const directTicketStepIds = [
    "ticket-967-create-offer",
    "ticket-967-create-booking",
    "ticket-967-create-payment",
    "ticket-967-confirm-payment",
    "ticket-967-dispatch-payment",
    "ticket-967-dispatch-fulfillment",
    "ticket-967-read-booking"
  ];

  for (const stepId of directTicketStepIds) {
    assert.equal(
      steps.get(stepId).request.proxyTargetBaseUrl,
      "{{form.ticket967TicketsBaseUrl}}",
      `${stepId} must target Tickets directly`);
  }

  assert.equal(steps.get("ticket-967-create-offer").request.path, "/api/v1/offers");
  assert.equal(steps.get("ticket-967-create-booking").request.path, "/api/v1/bookings");
  assert.equal(
    steps.get("ticket-967-create-payment").request.path,
    "/api/v1/bookings/{{context.ticket967BookingId}}/payments");
  assert.equal(
    steps.get("ticket-967-create-payment").request.body.returnUrl,
    "http://localhost:5096/analysis/html/GwResponsePage.html?flow=ticket-967");
  assert.equal(
    steps.get("ticket-967-create-payment").expected.assertions
      .find(assertion => assertion.path === "$.status").equals,
    "IN_PROGRESS");
  assert.equal(steps.get("ticket-967-confirm-payment").request.path, "/api/v1/dev/payments/poll");
  assert.equal(
    steps.get("ticket-967-dispatch-payment").request.path,
    "/api/v1/bookings/{{context.ticket967BookingId}}");
  assert.equal(
    steps.get("ticket-967-dispatch-payment").expected.assertions[0].regex,
    "^(CONFIRMED|FULFILLED)$");
  assert.equal(
    steps.get("ticket-967-dispatch-fulfillment").request.path,
    "/api/v1/dev/fulfillments/issue");
  assert.equal(
    steps.get("ticket-967-read-booking").expected.assertions
      .find(assertion => assertion.path === "$.status").equals,
    "FULFILLED");

  const productField = steps.get("ticket-967-create-offer").fields
    .find(field => field.name === "ticket967ProductId");
  assert.equal(productField.value, "101");
  assert.deepEqual(productField.options.map(option => option.value), ["101", "102"]);

  const transfer = steps.get("ticket-967-transfer");
  assert.equal(transfer.request.proxyTargetBaseUrl, "{{form.ticket967PidLitackaBaseUrl}}");
  assert.equal(
    transfer.request.path,
    "/v1/client/tickets/{{context.ticket967OriginalFulfillmentId}}/transfer");
  assert.equal(transfer.request.body.recipientEmail, "{{context.ticket967RecipientEmail}}");
  assert.deepEqual(
    transfer.expected.assertions.map(assertion => assertion.path),
    ["$.originalFulfillmentId", "$.newFulfillmentId", "$.transferredAt"]);
  assert.equal(transfer.extract.ticket967RecipientIdentityId, undefined);

  const senderInventory = steps.get("ticket-967-verify-sender-inventory");
  const recipientInventory = steps.get("ticket-967-verify-recipient-inventory");
  assert.equal(senderInventory.request.proxyTargetBaseUrl, "{{form.ticket967PidLitackaBaseUrl}}");
  assert.equal(recipientInventory.request.proxyTargetBaseUrl, "{{form.ticket967PidLitackaBaseUrl}}");
  assert.equal(
    recipientInventory.expected.assertions[0].containsItem.fulfillmentId,
    "{{context.ticket967TransferredFulfillmentId}}");
});

test("task 967 can resume an already fulfilled booking after a gateway timeout", () => {
  const scenario = readJson(packPath).scenarios.find(
    item => item.id === "pidlitacka-ticket-967-resume-fulfilled-booking");
  const steps = new Map(scenario.steps.map(step => [step.id, step]));

  assert.equal(scenario.requiresAuth, true);
  assert.equal(
    steps.get("ticket-967-resume-booking").request.path,
    "/api/v1/bookings/{{form.ticket967ResumeBookingId}}");
  assert.equal(
    steps.get("ticket-967-resume-booking").expected.assertions[0].equals,
    "FULFILLED");
  assert.equal(
    steps.get("ticket-967-resume-transfer").request.path,
    "/v1/client/tickets/{{context.ticket967OriginalFulfillmentId}}/transfer");
  assert.deepEqual(
    steps.get("ticket-967-resume-transfer").expected.assertions.map(assertion => assertion.path),
    ["$.originalFulfillmentId", "$.newFulfillmentId", "$.transferredAt"]);
  assert.equal(
    steps.get("ticket-967-resume-transfer").extract.ticket967RecipientIdentityId,
    undefined);
  assert.equal(
    steps.get("ticket-967-resume-login-recipient").customAction,
    "loginPidLitackaProfile");
});

test("task 967 offers a purchase-free sender-ticket-recipient flow with final verification", () => {
  const scenario = readJson(packPath).scenarios.find(
    item => item.id === "pidlitacka-ticket-967-transfer-existing-ticket");
  const steps = new Map(scenario.steps.map(step => [step.id, step]));
  const senderLogin = steps.get("ticket-967-quick-login-sender");
  const ticketSelection = steps.get("ticket-967-quick-select-ticket");
  const transfer = steps.get("ticket-967-quick-transfer");
  const recipientLogin = steps.get("ticket-967-quick-login-recipient");
  const recipientVerification = steps.get("ticket-967-quick-verify-recipient");

  assert.equal(scenario.requiresAuth, false, "sender login must be runnable without a pre-existing session");
  assert.equal(scenario.autoTags, false, "the positive transfer flow must not inherit a Negativní tag");
  assert.equal(scenario.steps.length, 5);

  assert.equal(senderLogin.customAction, "loginPidLitackaProfile");
  assert.equal(senderLogin.profileLogin.email, "{{form.ticket967QuickSenderEmail}}");
  assert.equal(senderLogin.profileLogin.password, "{{form.ticket967QuickSenderPassword}}");
  assert.equal(senderLogin.profileLogin.roleLabel, "odesílatel");
  const senderField = senderLogin.fields.find(field => field.name === "ticket967QuickSenderEmail");
  assert.equal(senderField.optionsSource, "pidlitacka-auth-profiles");
  assert.equal(senderField.allowCustomValue, true);
  assert.equal(senderField.customInputType, "email");
  assert.equal(
    senderLogin.fields.find(field => field.name === "ticket967QuickSenderPassword").type,
    "password");

  assert.equal(ticketSelection.requiresAuth, true);
  assert.equal(ticketSelection.request.path, "/v1/client/tickets?limit=100&offset=0&status=AVAILABLE");
  assert.equal(ticketSelection.selection.sourcePath, "$.items");
  assert.equal(
    ticketSelection.selection.store.ticket967QuickOriginalFulfillmentId,
    "$.fulfillmentId");

  const recipientField = transfer.fields.find(field => field.name === "ticket967QuickRecipientEmail");
  assert.equal(recipientField.optionsSource, "pidlitacka-auth-profiles");
  assert.equal(recipientField.excludeCurrentSession, true);
  assert.equal(recipientField.allowCustomValue, true);
  assert.equal(recipientField.customInputType, "email");
  assert.equal(
    transfer.fields.find(field => field.name === "ticket967QuickRecipientPassword").type,
    "password");
  assert.equal(
    transfer.rememberSecret.ticket967QuickRecipientPassword,
    "{{form.ticket967QuickRecipientPassword}}");
  assert.equal(
    transfer.request.path,
    "/v1/client/tickets/{{context.ticket967QuickOriginalFulfillmentId}}/transfer");
  assert.equal(transfer.request.body.recipientEmail, "{{form.ticket967QuickRecipientEmail}}");
  assert.equal(
    transfer.extract.ticket967QuickTransferredFulfillmentId,
    "$.newFulfillmentId");

  assert.equal(recipientLogin.customAction, "loginPidLitackaProfile");
  assert.equal(recipientLogin.profileLogin.email, "{{context.ticket967QuickRecipientEmail}}");
  assert.equal(recipientLogin.profileLogin.password, "{{secret.ticket967QuickRecipientPassword}}");
  assert.equal(recipientLogin.profileLogin.roleLabel, "příjemce");
  assert.equal(recipientVerification.requiresAuth, true);
  assert.equal(
    recipientVerification.expected.assertions[0].containsItem.fulfillmentId,
    "{{context.ticket967QuickTransferredFulfillmentId}}");
});

test("task 967 custom profile fields render as editable suggestions and use one-run credentials", () => {
  const appSource = fs.readFileSync(appPath, "utf8");
  const fieldRenderer = appSource.slice(
    appSource.indexOf("function renderField(field, value)"),
    appSource.indexOf("function getScenarioFieldOptions(field)"));
  const customLogin = appSource.slice(
    appSource.indexOf('if (step.customAction === "loginPidLitackaProfile")'),
    appSource.indexOf('if (step.customAction === "requireTemplateValue")'));

  assert.match(fieldRenderer, /field\.allowCustomValue === true/);
  assert.match(fieldRenderer, /document\.createElement\("datalist"\)/);
  assert.match(customLogin, /createNewAuthProfileDraftValues\(\)/);
  assert.match(customLogin, /password: manualPassword/);
  assert.doesNotMatch(customLogin, /saveNewAuthProfileAfterSuccessfulLogin/);
});

test("task 967 switches to the selected recipient before the final inventory check", () => {
  const scenario = readJson(packPath).scenarios[0];
  const loginIndex = scenario.steps.findIndex(step => step.id === "ticket-967-login-recipient");
  const verificationIndex = scenario.steps.findIndex(step => step.id === "ticket-967-verify-recipient-inventory");
  const login = scenario.steps[loginIndex];

  assert.equal(login.customAction, "loginPidLitackaProfile");
  assert.equal(login.profileLogin.email, "{{context.ticket967RecipientEmail}}");
  assert.ok(loginIndex >= 0 && verificationIndex > loginIndex);
});

test("interactive login refreshes the active scenario authorization and recipient choices", () => {
  const appSource = fs.readFileSync(appPath, "utf8");
  const loginHandler = appSource.slice(
    appSource.indexOf("async function executeAuthLogin()"),
    appSource.indexOf("async function executeAuthRefresh()"));
  const refreshHandler = appSource.slice(
    appSource.indexOf("async function executeAuthRefresh()"),
    appSource.indexOf("async function executeAuthSessionRenew()"));

  assert.match(loginHandler, /renderStep\(\{ preserveValues: true \}\)/);
  assert.match(refreshHandler, /renderStep\(\{ preserveValues: true \}\)/);
});
