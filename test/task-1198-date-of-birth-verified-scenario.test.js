const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const packPath = path.join(__dirname, '..', 'public', 'scenarios', 'pidlitacka', 'client-data.json');

test('#1198 scenario checks the new verified-date-of-birth API contract', () => {
  const pack = JSON.parse(fs.readFileSync(packPath, 'utf8'));
  const scenario = pack.scenarios.find(item => item.id === 'task-1198-date-of-birth-verified');

  assert.ok(scenario, 'scenario must be available in the client-data pack');
  assert.equal(scenario.requiresAuth, true);
  assert.equal(scenario.smoke, false);
  assert.equal(scenario.manualInputRequired, true);

  const [step] = scenario.steps;
  assert.equal(step.request.method, 'GET');
  assert.equal(step.request.path, '/v1/client/data');
  assert.equal(step.expected.status, 200);
  assert.ok(step.expected.assertions.some(assertion =>
    assertion.path === '$.personalData.dateOfBirthVerified' && assertion.equals === true));
});
