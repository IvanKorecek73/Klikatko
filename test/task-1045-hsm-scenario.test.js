const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const scenarioDirectory = path.join(
  __dirname,
  "..",
  "public",
  "scenarios",
  "pidlitacka");
const packPath = path.join(scenarioDirectory, "task-1045-mos-xml-hsm.json");
const manifestPath = path.join(scenarioDirectory, "index.json");

function loadJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function loadScenario(id) {
  return loadJson(packPath).scenarios.find(scenario => scenario.id === id);
}

test("task 1045 pack is registered in the PidLitacka manifest", () => {
  const manifest = loadJson(manifestPath);
  const registration = manifest.packs.find(pack => pack.id === "pidlitacka-task-1045-hsm");

  assert.ok(registration, "Task 1045 HSM pack is missing from the manifest.");
  assert.equal(registration.file, "task-1045-mos-xml-hsm.json");
});

test("task 1045 read-only smoke validates two truncated RVI keys", () => {
  const scenario = loadScenario("pidlitacka-hsm-1045-time-keys");
  assert.ok(scenario, "Task 1045 time-key scenario is missing.");
  assert.equal(scenario.requiresAuth, true);
  assert.equal(scenario.smoke, true);

  const step = scenario.steps[0];
  assert.equal(step.request.method, "GET");
  assert.equal(step.request.path, "/v1/client/validation/time-keys?duration=300");
  assert.equal(step.expected.status, 200);

  const lengthAssertion = step.expected.assertions.find(assertion => assertion.path === "$");
  const formatAssertion = step.expected.assertions.find(assertion => assertion.regex);
  assert.equal(lengthAssertion.lengthEquals, 2);
  assert.equal(formatAssertion.regex, "^\\[\"[0-9A-F]{8}\",\"[0-9A-F]{8}\"\\]$");
  assert.match(
    JSON.stringify(["A1B2C3D4", "01234567"]),
    new RegExp(formatAssertion.regex));
});

test("task 1045 signing scenario proves the public BE signing path without direct mock access", () => {
  const scenario = loadScenario("pidlitacka-hsm-1045-sign-validation-identifier");
  assert.ok(scenario, "Task 1045 signing scenario is missing.");
  assert.equal(scenario.requiresAuth, true);
  assert.equal(scenario.smoke, false);
  assert.equal(scenario.manualInputRequired, false);

  const step = scenario.steps[0];
  assert.equal(step.request.method, "POST");
  assert.equal(step.request.path, "/v1/client/validation/identifiers");
  assert.equal(step.fields.find(field => field.name === "deviceId").value, "{{uuid}}");
  assert.deepEqual(step.request.body, {
    deviceId: "{{form.deviceId}}",
    deviceModel: "{{form.deviceModel}}"
  });

  const assertions = step.expected.assertions;
  const etdSignature = assertions.find(assertion => assertion.sourcePath === "$.identifier.etd");
  const timeKeyCount = assertions.find(assertion => assertion.path === "$.identifier.timeKeys");
  const timeKeyFormat = assertions.find(assertion => assertion.sourcePath === "$.identifier.timeKeys");

  assert.equal(etdSignature.regex, "SG:[0-9A-V]+\\*$");
  assert.equal(timeKeyCount.lengthEquals, 13);
  assert.equal(timeKeyFormat.regex, "^\\[\"[0-9A-F]{8}\"(?:,\"[0-9A-F]{8}\"){12}\\]$");
  assert.match("ETD*1*IN:DPP*TT:PASS*SG:0123456789ABCDEFGHIJKLMNOPQRSTUV*", new RegExp(etdSignature.regex));
  assert.match(
    JSON.stringify(Array.from({ length: 13 }, () => "A1B2C3D4")),
    new RegExp(timeKeyFormat.regex));
  assert.equal(JSON.stringify(step).includes("hsm-mock.mos.oict.cz"), false);
  assert.equal(JSON.stringify(step).includes("services/signECDSA"), false);
});
