const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..");
const manifestPath = path.join(root, "public/scenarios/pidlitacka/index.json");
const packPath = path.join(root, "public/scenarios/pidlitacka/task-1200-ticket-number.json");

test("task 1200 pack buys a ticket and checks the number on the same ticket detail", () => {
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  const registration = manifest.packs.find(pack => pack.id === "pidlitacka-task-1200-ticket-number");
  assert.equal(registration.file, "task-1200-ticket-number.json");

  const scenario = JSON.parse(fs.readFileSync(packPath, "utf8")).scenarios[0];
  assert.ok(scenario.tags.includes("task-1200"));
  assert.equal(scenario.requiresAuth, true);
  assert.equal(scenario.smoke, false);

  const steps = new Map(scenario.steps.map(step => [step.id, step]));
  assert.equal(steps.get("ticket-1200-offer").request.path,
    "/v1/client/tickets/purchase/payment/offers");
  assert.equal(steps.get("ticket-1200-booking").request.path,
    "/v1/client/tickets/purchase/payment/bookings");
  assert.equal(steps.get("ticket-1200-booking-readback").request.path,
    "/v1/client/tickets/purchase/payment/bookings/{{context.ticket1200BookingId}}");
  assert.equal(steps.get("ticket-1200-booking-readback").expected.assertions
    .find(item => item.path === "$.status").equals, "FULFILLED");
  assert.equal(steps.get("ticket-1200-booking-readback").expected.warnings[0]
    .autoRetry.maxAttempts, 30);
  assert.equal(steps.get("ticket-1200-detail").request.path,
    "/v1/client/tickets/{{context.ticket1200FulfillmentId}}");
  assert.equal(steps.get("ticket-1200-detail").expected.assertions
    .find(item => item.path === "$.fulfillment.ticketNumber").equals,
    "{{context.ticket1200Number}}");
  assert.ok(scenario.instructions.some(line => line.includes("#1200")));
});
