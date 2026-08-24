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
  "task-1067-product-subtype.json");
const manifestPath = path.join(root, "public", "scenarios", "pidlitacka", "index.json");

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function stepsById() {
  const scenario = readJson(packPath).scenarios
    .find(item => item.id === "pidlitacka-ticket-1067-product-subtype");
  assert.ok(scenario, "Task 1067 scenario is missing.");
  return new Map(scenario.steps.map(step => [step.id, step]));
}

function assertionsByPath(step) {
  return new Map(step.expected.assertions.map(assertion => [
    assertion.path ?? assertion.sourcePath,
    assertion
  ]));
}

test("task 1067 pack is registered as a local fixture scenario", () => {
  const manifest = readJson(manifestPath);
  const registration = manifest.packs
    .find(item => item.id === "pidlitacka-task-1067-product-subtype");
  const scenario = readJson(packPath).scenarios[0];

  assert.equal(registration.file, "task-1067-product-subtype.json");
  assert.equal(scenario.smoke, false);
  assert.equal(scenario.manualInputRequired, false);
  assert.ok(scenario.tags.includes("task-1067"));
  assert.ok(scenario.tags.includes("local-fixture"));
});

test("task 1067 verifies subtype in list activation and detail responses", () => {
  const steps = stepsById();
  const list = steps.get("ticket-1067-list-available");
  const activation = steps.get("ticket-1067-activate");
  const detail = steps.get("ticket-1067-detail");

  assert.equal(list.request.path, "/v1/client/tickets?limit=100&offset=0&status=AVAILABLE");
  assert.deepEqual(list.expected.assertions[0].containsItem, {
    fulfillmentId: "{{context.ticket1067FulfillmentId}}",
    status: "AVAILABLE",
    productSubTypeCode: "adult",
    "productSubTypeDetail.code": "adult",
    "productSubTypeDetail.name.cs": "Dospělý",
    "productSubTypeDetail.iconName": "adult",
    "productSubTypeDetail.sortOrder": 1
  });

  const activationAssertions = assertionsByPath(activation);
  assert.equal(activation.request.method, "PATCH");
  assert.equal(activationAssertions.get("$.productSubTypeCode").equals, "adult");
  assert.equal(activationAssertions.get("$.productSubTypeDetail.name.cs").equals, "Dospělý");
  assert.equal(activationAssertions.get("$.productSubTypeDetail.iconName").equals, "adult");
  assert.equal(activationAssertions.get("$.productSubTypeDetail.sortOrder").equals, 1);

  const detailAssertions = assertionsByPath(detail);
  assert.equal(detail.request.method, "GET");
  assert.equal(detail.request.headers["X-Device-Id"], "{{form.otherDeviceId}}");
  assert.equal(detailAssertions.get("$.fulfillment.productSubTypeCode").equals, "adult");
  assert.equal(
    detailAssertions.get("$.fulfillment.productSubTypeDetail.iconName").equals,
    "adult");
});

test("task 1067 fixture and every API step use only the local public flow", () => {
  const steps = [...stepsById().values()];
  const fixture = steps.find(step => step.id === "ticket-1067-create-fixture");

  assert.equal(fixture.request.path, "/__harness/fixtures/task-960");
  assert.equal(fixture.request.headers["X-Klikatko-Local-Fixture"], "task-960");
  assert.equal(fixture.request.body.variant, "fixed");
  assert.equal(fixture.expected.assertions
    .find(assertion => assertion.path === "$.items[0].productSubTypeCode").equals, "adult");

  const apiSteps = steps.filter(step => step.request.path.startsWith("/v1/"));
  assert.ok(apiSteps.length >= 4);
  assert.ok(apiSteps.every(step => step.request.proxyTargetBaseUrl === undefined));
});
