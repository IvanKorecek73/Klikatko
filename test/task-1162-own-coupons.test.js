const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const crypto = require('node:crypto').webcrypto;

const root = path.resolve(__dirname, '..');
const read = file => JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));
const pack = read('public/scenarios/pidlitacka/task-1162-own-coupons.json');
const source = fs.readFileSync(path.join(root, 'public/app.js'), 'utf8');

function load(context, name) {
  const match = source.match(new RegExp(`(?:async )?function ${name}\\([^]*?\\n\\}`));
  assert.ok(match, name);
  vm.runInContext(match[0], context);
}

function engine(scenario) {
  const context = vm.createContext({
    URL, crypto,
    state: {
      scenario, currentProject: { id: 'pidlitacka' }, context: {}, values: {}, secrets: {},
      dirty: false, stepIndex: 0, stepResults: {}
    },
    elements: { baseUrl: { value: '/api' } },
    window: { location: { origin: 'http://127.0.0.1:5096' } },
    requiresAuthorizationForStep: () => false,
    isExternalTokenizerStep: () => false,
    makeAppMessage: () => ''
  });
  for (const name of [
    'evaluateStep', 'getPath', 'getRegexAssertionSource', 'normalizeXmlPrefixes',
    'resolveExpectedValue', 'resolveObject', 'resolveRuntimeTemplateValue', 'resolveTemplate',
    'randomHex', 'isEmpty', 'deepEqual', 'containsMatchingItem', 'itemMatchesExpectedShape',
    'looseScalarEqual', 'describeExpectedErrorBody'
  ]) load(context, name);
  return context;
}

test('pack is registered and all #1162 steps are read-only and manual', () => {
  const manifest = read('public/scenarios/pidlitacka/index.json');
  assert.ok(manifest.packs.some(item => item.file === 'task-1162-own-coupons.json'));
  assert.equal(pack.scenarios.length, 2);
  for (const scenario of pack.scenarios) {
    assert.equal(scenario.requiresAuth, true);
    assert.equal(scenario.smoke, false);
    assert.equal(scenario.manualInputRequired, true);
    for (const step of scenario.steps) {
      assert.equal(step.request.method, 'GET');
      assert.match(step.request.path, /^\/v1\/client\/(?:coupons|identifiers)$/);
    }
  }
});

test('mixed account assertion rejects a foreign coupon and a missing anonymous token', () => {
  const scenario = pack.scenarios[0];
  const context = engine(scenario);
  const identifiersStep = scenario.steps[0];
  const couponsStep = scenario.steps[1];
  context.state.values = {
    selfIdentifierId: '11', selfAnonymousIdentifierId: '12',
    childIdentifierId: '21', sharedIdentifierId: '31', selfCouponId: '101'
  };
  const identifiers = {
    identifiers: [
      { identifierId: 11, isPersonalized: true }, { identifierId: 12, isPersonalized: false },
      { identifierId: 21, isPersonalized: true }, { identifierId: 31, isPersonalized: true }
    ]
  };
  const own = {
    status: 'Completed', identifiers: identifiers.identifiers.slice(0, 2),
    coupons: [{ couponId: 101, status: 'Valid', identifier: { identifierId: 11 } }]
  };
  assert.equal(context.evaluateStep(identifiersStep, 200, identifiers).level, 'ok');
  assert.equal(context.evaluateStep(couponsStep, 200, own).level, 'ok');
  assert.equal(context.evaluateStep(couponsStep, 200, {
    ...own, coupons: [...own.coupons, { couponId: 201, status: 'Valid', identifier: { identifierId: 21 } }]
  }).level, 'error');
  assert.equal(context.evaluateStep(couponsStep, 200, {
    ...own, identifiers: [own.identifiers[0]]
  }).level, 'error');
});

test('empty Self requires evidence of linked identifier before accepting an empty overview', () => {
  const scenario = pack.scenarios[1];
  const context = engine(scenario);
  context.state.values = { childIdentifierId: '21' };
  assert.equal(context.evaluateStep(scenario.steps[0], 200, {
    identifiers: [{ identifierId: 21 }]
  }).level, 'ok');
  assert.equal(context.evaluateStep(scenario.steps[0], 200, { identifiers: [] }).level, 'error');
  assert.equal(context.evaluateStep(scenario.steps[1], 200, {
    status: 'Completed', identifiers: [], coupons: []
  }).level, 'ok');
  assert.equal(context.evaluateStep(scenario.steps[1], 200, {
    status: 'Completed', identifiers: [{ identifierId: 21 }], coupons: []
  }).level, 'error');
});
