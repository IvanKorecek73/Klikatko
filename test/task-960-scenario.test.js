const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const packPath = path.join(
  __dirname,
  "..",
  "public",
  "scenarios",
  "pidlitacka",
  "feature-960-aktivace-jizdenky.json");

function loadScenario(id) {
  const pack = JSON.parse(fs.readFileSync(packPath, "utf8"));
  return pack.scenarios.find(scenario => scenario.id === id);
}

test("task 960 retry compares the signed ETD instead of sub-microsecond timestamps", () => {
  const scenario = loadScenario("pidlitacka-ticket-960-activate-fixed-now");
  assert.ok(scenario, "Fixed activation scenario is missing.");

  const activation = scenario.steps.find(step => step.id === "ticket-960-fixed-activate-now");
  const retry = scenario.steps.find(step => step.id === "ticket-960-fixed-retry");
  assert.ok(activation, "Activation step is missing.");
  assert.ok(retry, "Retry step is missing.");

  assert.equal(activation.extract.ticket960FixedEtd, "$.etd");

  const assertionsByPath = new Map(
    retry.expected.assertions.map(assertion => [assertion.path, assertion]));

  assert.deepEqual(assertionsByPath.get("$.validSince"), {
    path: "$.validSince",
    notEmpty: true
  });
  assert.deepEqual(assertionsByPath.get("$.validUntil"), {
    path: "$.validUntil",
    notEmpty: true
  });
  assert.equal(
    assertionsByPath.get("$.etd").equals,
    "{{context.ticket960FixedEtd}}");
});

test("task 960 zonal activation proves forwarded default zones in the signed ETD", () => {
  const scenario = loadScenario("pidlitacka-ticket-960-activate-zonal-now");
  assert.ok(scenario, "Zonal activation scenario is missing.");

  const activation = scenario.steps.find(step => step.id === "ticket-960-zonal-activate-now");
  assert.ok(activation, "Zonal activation step is missing.");

  const assertions = activation.expected.assertions;
  assert.equal(
    assertions.some(assertion => assertion.path === "$.validZones"),
    false,
    "The BE smoke must not depend on the known upstream validZones persistence gap.");

  const etdAssertion = assertions.find(assertion => assertion.sourcePath === "$.etd");
  assert.deepEqual(etdAssertion, {
    sourcePath: "$.etd",
    regex: "\\*VZ:0,B,1\\*",
    message: "Podepsané ETD nepotvrdilo předání výchozího bloku pásem 0, B, 1."
  });
});

test("task 960 multi-activation reuses one explicit validSince with separate keys", () => {
  const scenario = loadScenario("pidlitacka-ticket-960-activate-two");
  assert.ok(scenario, "Multi-activation scenario is missing.");

  const first = scenario.steps.find(step => step.id === "ticket-960-two-activate-first");
  const second = scenario.steps.find(step => step.id === "ticket-960-two-activate-second");
  const list = scenario.steps.find(step => step.id === "ticket-960-two-list-active");
  assert.ok(first && second && list, "Multi-activation steps are incomplete.");

  assert.equal(first.request.body.validSince, "{{now}}");
  assert.equal(first.extract.ticket960TwoCommonValidSince, "$.validSince");
  assert.equal(second.request.body.validSince, "{{context.ticket960TwoCommonValidSince}}");
  assert.ok(second.requiresContext.includes("ticket960TwoCommonValidSince"));

  const secondTimeAssertion = second.expected.assertions.find(
    assertion => assertion.path === "$.validSince");
  assert.equal(secondTimeAssertion.equals, "{{context.ticket960TwoCommonValidSince}}");

  assert.equal(first.fields[0].value, "{{uuid}}");
  assert.equal(second.fields[0].value, "{{uuid}}");
  assert.notEqual(first.id, second.id, "Each activation must render its own idempotency key field.");

  for (const assertion of list.expected.assertions) {
    assert.equal(
      assertion.containsItem.validSince,
      "{{context.ticket960TwoCommonValidSince}}");
  }
});

test("task 960 missing-key scenario expects the standardized validation ProblemDetails", () => {
  const scenario = loadScenario("pidlitacka-ticket-960-missing-idempotency-key");
  assert.ok(scenario, "Missing Idempotency-Key scenario is missing.");

  const step = scenario.steps.find(step => step.id === "ticket-960-missing-key-rejected");
  assert.ok(step, "Missing Idempotency-Key step is missing.");
  assert.equal(step.request.headers, undefined, "The negative request must not send any header.");
  assert.equal(step.expected.status, 400);
  assert.equal(step.expected.outcome, "expectedError");

  const assertionsByPath = new Map(
    step.expected.assertions.map(assertion => [assertion.path, assertion]));
  assert.equal(assertionsByPath.get("$.status").equals, 400);
  assert.equal(assertionsByPath.get("$.title").equals, "Validation Error");
  assert.equal(
    assertionsByPath.get("$.type").equals,
    "https://tools.ietf.org/html/rfc9110#section-15.5.1");
  assert.equal(assertionsByPath.get("$.traceId").notEmpty, true);
  assert.equal(assertionsByPath.get("$.errors.IdempotencyKey").lengthEquals, 1);
  assert.equal(
    assertionsByPath.get("$.errors.IdempotencyKey[0]").equals,
    "Idempotency-Key header must contain a valid UUID.");
});
