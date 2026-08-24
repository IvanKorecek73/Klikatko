const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..");
const packPath = path.join(root, "public", "scenarios", "pidlitacka", "tickets.json");
const manifestPath = path.join(root, "public", "scenarios", "pidlitacka", "index.json");
const appPath = path.join(root, "public", "app.js");

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function allRequestSteps(pack) {
  return pack.scenarios.flatMap(scenario => scenario.steps)
    .filter(step => step.request?.method && step.request?.path);
}

test("ticket pack is registered and starts with the unfiltered inventory", () => {
  const manifest = readJson(manifestPath);
  const pack = readJson(packPath);
  const registration = manifest.packs.find(item => item.id === "pidlitacka-tickets");
  const firstScenario = pack.scenarios[0];
  const firstStep = firstScenario.steps[0];

  assert.equal(registration.file, "tickets.json");
  assert.equal(firstScenario.id, "pidlitacka-tickets-list-all");
  assert.equal(firstStep.request.method, "GET");
  assert.equal(firstStep.request.path, "/v1/client/tickets?limit=100&offset=0");
  assert.equal(firstStep.selection, undefined);
});

test("ticket pack covers every completed frontend-facing ticket method", () => {
  const requests = new Set(allRequestSteps(readJson(packPath))
    .map(step => `${step.request.method} ${step.request.path}`));
  const expected = [
    "GET /v1/client/tickets?limit=100&offset=0",
    "GET /v1/client/tickets/{{context.ticketDetailId}}",
    "GET /v1/tickets/products?limit=100&offset=0",
    "GET /v1/client/tickets/devices",
    "POST /v1/client/tickets/devices",
    "PATCH /v1/client/tickets/{{context.ticketToActivateId}}",
    "POST /v1/client/tickets/{{context.ticketToTransferId}}/transfer",
    "POST /v1/client/tickets/purchase/payment/bookings-search",
    "GET /v1/client/tickets/purchase/payment/bookings/{{context.selectedTicketBookingId}}",
    "GET /v1/client/tickets/purchase/payment/document/{{context.ticketDocumentBookingId}}?documentType={{form.documentType}}",
    "POST /v1/client/tickets/purchase/payment/card/initiate",
    "GET /v1/accounts/me/ticket-payment-settings",
    "PUT /v1/accounts/me/ticket-payment-settings",
    "DELETE /v1/accounts/me/ticket-payment-settings",
    "GET /v1/accounts/me/ticket-recommendation-settings",
    "PATCH /v1/accounts/me/ticket-recommendation-settings",
    "DELETE /v1/accounts/me/ticket-recommendation-settings"
  ];

  for (const request of expected) {
    assert.ok(requests.has(request), `missing scenario request: ${request}`);
  }

  assert.ok(allRequestSteps(readJson(packPath)).every(step => !step.request.proxyTargetBaseUrl));
});

test("mutating ticket flows are excluded from smoke and use idempotency keys", () => {
  const pack = readJson(packPath);
  const mutatingScenarioIds = [
    "pidlitacka-ticket-devices",
    "pidlitacka-ticket-activate",
    "pidlitacka-ticket-transfer",
    "pidlitacka-ticket-card-payment",
    "pidlitacka-ticket-payment-settings",
    "pidlitacka-ticket-recommendation-settings"
  ];

  for (const scenarioId of mutatingScenarioIds) {
    assert.equal(pack.scenarios.find(item => item.id === scenarioId).smoke, false);
  }

  const keyedRequests = allRequestSteps(pack).filter(step => [
    "/v1/client/tickets/devices",
    "/v1/client/tickets/{{context.ticketToActivateId}}",
    "/v1/client/tickets/{{context.ticketToTransferId}}/transfer",
    "/v1/client/tickets/purchase/payment/card/initiate"
  ].includes(step.request.path) && step.request.method !== "GET");

  assert.ok(keyedRequests.length >= 4);
  assert.ok(keyedRequests.every(step => step.request.headers?.["Idempotency-Key"]));
});

test("ticket responses have dedicated mobile card renderers", () => {
  const appSource = fs.readFileSync(appPath, "utf8");

  assert.match(appSource, /function renderTicketFulfillmentsCardsHtml/);
  assert.match(appSource, /function renderTicketDevicesCardsHtml/);
  assert.match(appSource, /function renderTicketBookingsCardsHtml/);
  assert.match(appSource, /function renderValidatedTicketCardHtml/);
  assert.match(appSource, /function renderTicketTransferCardHtml/);
});
