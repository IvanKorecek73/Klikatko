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
  "task-1140-ipt-ticket-mapping.json");
const manifestPath = path.join(root, "public", "scenarios", "pidlitacka", "index.json");

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function scenario() {
  const result = readJson(packPath).scenarios
    .find(item => item.id === "pidlitacka-task-1140-resolve-and-activate");
  assert.ok(result, "Task 1140 scenario is missing.");
  return result;
}

function step(id) {
  const result = scenario().steps.find(item => item.id === id);
  assert.ok(result, `Task 1140 step ${id} is missing.`);
  return result;
}

test("task 1140 pack is registered as an automatic local fixture scenario", () => {
  const registration = readJson(manifestPath).packs
    .find(item => item.id === "pidlitacka-task-1140-ipt-ticket-mapping");
  const item = scenario();

  assert.equal(registration.file, "task-1140-ipt-ticket-mapping.json");
  assert.equal(item.smoke, false);
  assert.equal(item.manualInputRequired, false);
  assert.ok(item.tags.includes("task-1140"));
  assert.ok(item.tags.includes("task-1007"));
  assert.ok(item.tags.includes("local-fixture"));
});

test("task 1140 proves IPT 867 maps to owned and purchasable Tickets product 1002", () => {
  const fixture = step("ticket-1140-create-mapped-fixture");
  const resolver = step("ticket-1140-resolve-recommendation");

  assert.equal(fixture.request.path, "/__harness/fixtures/task-960");
  assert.equal(fixture.request.body.variant, "mapped");
  assert.equal(
    fixture.expected.assertions.find(item => item.path === "$.items[0].productId").equals,
    1002);

  assert.equal(resolver.request.path, "/v1/client/tickets/route-recommendations/resolve");
  assert.deepEqual(resolver.request.body.iptProductIds, [867]);
  assert.equal(
    resolver.expected.assertions.find(item => item.path === "$.items[0].activationResult").equals,
    "MAPPED");
  assert.equal(
    resolver.expected.assertions.find(item => item.path === "$.items[0].purchaseProductId").equals,
    1002);

  const candidates = resolver.expected.assertions
    .find(item => item.path === "$.items[0].activationCandidates");
  assert.deepEqual(candidates.containsItem, {
    fulfillmentId: "{{context.ticket1140FulfillmentId}}",
    ticketProductId: 1002
  });
});

test("task 1140 activates the exact fulfillment returned by the local fixture", () => {
  const activation = step("ticket-1140-activate-candidate");

  assert.equal(activation.request.method, "PATCH");
  assert.equal(
    activation.request.path,
    "/v1/client/tickets/{{context.ticket1140FulfillmentId}}");
  assert.equal(activation.request.body.deviceId, "{{context.ticket1140DeviceId}}");
  assert.equal(
    activation.expected.assertions.find(item => item.sourcePath === "$.status").regex,
    "^(FULFILLED|IN_PROTECTION_DELAY)$");
  assert.equal(
    activation.expected.assertions.find(item => item.path === "$.etd").notEmpty,
    true);
});
