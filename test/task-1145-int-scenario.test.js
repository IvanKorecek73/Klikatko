const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const crypto = require('node:crypto').webcrypto;

const root = path.resolve(__dirname, '..');
const read = p => JSON.parse(fs.readFileSync(path.join(root, p), 'utf8'));
const pack = read('public/scenarios/pidlitacka/task-1145-prague-zone-count-int.json');
const source = fs.readFileSync(path.join(root, 'public/app.js'), 'utf8');
const scenario = suffix => pack.scenarios.find(s => s.id.endsWith('-' + suffix));
const step = (s, suffix) => s.steps.find(s => s.id.endsWith('-' + suffix));
const detailBody = fulfillment => ({ fulfillment, rviKeys: [] });

function load(context, name) {
  const match = source.match(new RegExp(`(?:async )?function ${name}\\([^]*?\\n\\}`));
  assert.ok(match, name);
  vm.runInContext(match[0], context);
}

function engine(s = scenario('prague-four')) {
  const c = vm.createContext({
    URL, crypto,
    state: { scenario: s, currentProject: { id: 'pidlitacka' }, currentEnvironmentId: 'pidlitacka-integration',
      harnessMeta: { proxyTarget: 'https://pidl2-backend.int.pidlitacka.cz/' }, context: {}, values: {}, secrets: {}, dirty: false,
      stepIndex: 0, stepResults: {} },
    elements: { baseUrl: { value: '/api' } },
    window: { location: { origin: 'http://127.0.0.1:5096' } },
    requiresAuthorizationForStep: () => false,
    isExternalTokenizerStep: () => false,
    makeAppMessage: () => '',
  });
  for (const name of ['getScenarioEnvironmentError', 'evaluateStep', 'getPath', 'getRegexAssertionSource',
    'normalizeXmlPrefixes', 'resolveExpectedValue', 'resolveObject', 'resolveRuntimeTemplateValue', 'resolveTemplate',
    'randomHex', 'isEmpty', 'deepEqual', 'containsMatchingItem', 'itemMatchesExpectedShape', 'looseScalarEqual',
    'describeExpectedErrorBody', 'getSelectionItems', 'selectionItemMatchesFilter']) load(c, name);
  return c;
}

test('INT pack is registered, manual, environment-bound and contains no fixture or payment request', () => {
  const manifest = read('public/scenarios/pidlitacka/index.json');
  assert.ok(manifest.packs.some(p => p.file === 'task-1145-prague-zone-count-int.json'));
  assert.equal(pack.scenarios.length, 8);
  const ids = pack.scenarios.flatMap(s => [s.id, ...s.steps.map(s => s.id)]);
  assert.equal(new Set(ids).size, ids.length);
  for (const s of pack.scenarios) {
    assert.equal(s.smoke, false);
    assert.equal(s.manualInputRequired, true);
    assert.equal(s.requiredEnvironment.environmentId, 'pidlitacka-integration');
    for (const st of s.steps) {
      assert.match(st.request.path, /^\/v1\//);
      assert.doesNotMatch(st.request.path, /initiate|__harness|fixtures/);
      assert.doesNotMatch(JSON.stringify(st), /1145004|1145007|1145016|1145104/);
    }
  }
  assert.equal(scenario('catalog').requiresAuth, false);
});

test('environment guard checks the effective destination, including missing proxy metadata and changed URL', () => {
  const c = engine();
  assert.equal(c.getScenarioEnvironmentError(), '');
  c.elements.baseUrl.value = 'https://pidl2-backend.int.pidlitacka.cz';
  assert.equal(c.getScenarioEnvironmentError(), '');
  for (const url of ['http://pidl2-backend.int.pidlitacka.cz', 'https://other.example/', '/api-wrong', 'https://pidl2-backend.int.pidlitacka.cz/other']) {
    c.elements.baseUrl.value = url;
    assert.match(c.getScenarioEnvironmentError(), /požadavek nebyl odeslán/);
  }
  c.elements.baseUrl.value = '/api';
  c.state.harnessMeta.proxyTarget = '';
  assert.notEqual(c.getScenarioEnvironmentError(), '');
  c.state.harnessMeta.proxyTarget = 'https://pidl2-backend.int.pidlitacka.cz';
  c.state.currentEnvironmentId = 'pidlitacka-local';
  assert.notEqual(c.getScenarioEnvironmentError(), '');
  c.state.currentEnvironmentId = 'pidlitacka-integration';
  c.state.currentProject.id = 'tickets';
  assert.notEqual(c.getScenarioEnvironmentError(), '');
  assert.equal(c.getScenarioEnvironmentError({}), '', 'Existing unbound scenarios retain behavior');
});

test('direct form execution cannot skip the environment check or keep a stale success result', async () => {
  const c = engine();
  c.state.currentEnvironmentId = 'pidlitacka-local';
  c.state.stepResults[0] = { level: 'ok' };
  c.cancelAutoRetry = () => {};
  c.currentStep = () => step(scenario('prague-four'), 'activate');
  c.addLog = () => {};
  c.showResult = level => assert.equal(level, 'error');
  c.updateNextStepControl = () => {};
  c.findStepWarning = () => assert.fail('Guard must precede auth and request preparation');
  c.fetch = () => assert.fail('No network request allowed');
  load(c, 'runCurrentStep');
  await c.runCurrentStep();
  assert.equal(c.state.stepResults[0].level, 'error');
});

test('catalog assertions reject a missing product, old zone count and restricted zones', () => {
  const c = engine(scenario('catalog'));
  const st = scenario('catalog').steps[0];
  const body = read('test/fixtures/task-1145-int-catalog-20260916.json');
  assert.equal(c.evaluateStep(st, 200, body).level, 'ok');
  for (const mutate of [
    b => b.items.splice(b.items.findIndex(p => p.productId === 1004), 1),
    b => { b.items.find(p => p.productId === 1004).zoneCount = 5; },
    b => { b.items.find(p => p.productId === 1004).excludedZoneDetails = [{ id: 'P' }]; },
    b => { b.items.find(p => p.productId === 1004).zones = ['0', 'B', '1', '2']; },
  ]) {
    const changed = structuredClone(body); mutate(changed);
    assert.equal(c.evaluateStep(st, 200, changed).level, 'error');
  }
});

test('selected fulfillment must match product, status, zone count and have no preset flexible zones', () => {
  const s = scenario('prague-four'); const c = engine(s);
  const st = step(s, 'precondition');
  c.state.context[st.requiresContext[0]] = 'chosen';
  const ticket = { fulfillmentId: 'chosen', productId: 1004, zoneCount: 4, status: 'AVAILABLE' };
  for (const validZones of [undefined, null, []]) {
    assert.equal(c.evaluateStep(st, 200, detailBody({ ...ticket, validZones })).level, 'ok');
  }
  assert.equal(c.evaluateStep(st, 200, ticket).level, 'error', 'PID BE detail wraps the fulfillment; a flat fake is not the wire contract');
  for (const change of [{ fulfillmentId: 'other' }, { productId: 1007 }, { zoneCount: 7 },
    { status: 'FULFILLED' }, { validZones: ['P', '0', 'B', '1'] }]) {
    assert.equal(c.evaluateStep(st, 200, detailBody({ ...ticket, ...change })).level, 'error');
  }
  const selected = c.getSelectionItems(step(s, 'select'), { items: [ticket, { ...ticket, productId: 1007 }, { ...ticket, status: 'FULFILLED' }] });
  assert.equal(selected.length, 1);
  assert.equal(selected[0].fulfillmentId, 'chosen');
});

test('every negative activation is followed by a fresh assertion of the same AVAILABLE fulfillment', () => {
  const s = scenario('prague-four'); const c = engine(s);
  const negative = s.steps.filter(s => s.expected.status === 422);
  assert.equal(negative.length, 6);
  assert.deepEqual(negative.map(s => s.request.body.zones), [
    ['P', '0', 'B'], ['P', '0', 'B', '1', '2'], ['P', 'B', '1', '2'], ['P', 'P', '0', 'B'], ['P', '0', 'B', 'X'], null
  ]);
  for (const st of negative) {
    assert.equal(c.evaluateStep(st, 422, { title: 'Domain error' }).level, 'ok');
    assert.equal(c.evaluateStep(st, 200, {}).level, 'error');
    const next = s.steps[s.steps.indexOf(st) + 1];
    c.state.context[next.requiresContext[0]] = 'chosen';
    assert.equal(next.request.method, 'GET');
    const ticket = { fulfillmentId: 'chosen', productId: 1004, zoneCount: 4, status: 'AVAILABLE', validZones: [] };
    assert.equal(c.evaluateStep(next, 200, detailBody(ticket)).level, 'ok');
    assert.equal(c.evaluateStep(next, 200, detailBody({ ...ticket, status: 'FULFILLED' })).level, 'error');
  }
});

test('activation, retry and readback detect a wrong ETD or a different fulfillment', () => {
  for (const s of pack.scenarios.filter(s => s.tags.includes('Aktivace'))) {
    const c = engine(s); const activate = step(s, 'activate'); const retry = step(s, 'retry'); const readback = step(s, 'readback');
    const precondition = step(s, 'precondition'); const productId = precondition.expected.assertions.find(a => a.path === '$.fulfillment.productId').equals;
    const count = precondition.expected.assertions.find(a => a.path === '$.fulfillment.zoneCount')?.equals;
    const zones = activate.request.body.zones || ['P', '0', 'B'];
    const body = { fulfillmentId: 'chosen', productId, zoneCount: count, status: 'IN_PROTECTION_DELAY',
      validZones: productId === 1002 ? zones : undefined, validSince: '2026-09-16T10:00:00Z', validUntil: '2026-09-16T11:00:00Z', etd: `*VZ:${zones.join(',')}*signature` };
    c.state.context[precondition.requiresContext[0]] = 'chosen';
    c.state.context[Object.keys(activate.extract)[0]] = body.etd;
    assert.equal(c.evaluateStep(activate, 200, body).level, 'ok', s.id);
    assert.equal(c.evaluateStep(activate, 200, { ...body, etd: '*VZ:P,0,B*wrong' }).level, productId === 1002 ? 'ok' : 'error', s.id);
    for (const st of [retry, readback]) {
      const wire = b => st === readback ? detailBody(b) : b;
      assert.equal(c.evaluateStep(st, 200, wire(body)).level, 'ok', st.id);
      assert.equal(c.evaluateStep(st, 200, wire({ ...body, etd: body.etd + '-different' })).level, 'error', st.id);
      assert.equal(c.evaluateStep(st, 200, wire({ ...body, fulfillmentId: 'other' })).level, 'error', st.id);
      assert.equal(c.evaluateStep(st, 200, wire({ ...body, etd: undefined })).level, 'error', 'A device-mismatched detail hides ETD and must not pass');
    }
    assert.equal(readback.request.headers['X-Device-Id'], activate.request.body.deviceId,
      'Use the registered Tickets DeviceId, not the unrelated installation identifier');
    assert.deepEqual(retry.request.body, activate.request.body);
    const key = retry.request.headers['Idempotency-Key'].match(/context\.(\w+)/)[1];
    assert.equal(activate.remember[key], '{{form.idempotencyKey}}');
  }
});

test('offer and booking require exactly the four selected zones for the real product', () => {
  const s = scenario('offer-booking'); const c = engine(s); const offer = step(s, 'offer'); const booking = step(s, 'booking');
  const zones = ['P', '0', 'B', '1'];
  assert.equal(c.evaluateStep(offer, 200, { offers: [{ productId: 1004, admission: { zones } }] }).level, 'ok');
  assert.equal(c.evaluateStep(offer, 200, { offers: [{ productId: 1004, admission: { zones: zones.slice(0, 3) } }] }).level, 'error');
  const booked = { bookingId: 'reservation', bookedOffers: [{ productId: 1004, validZones: zones }] };
  assert.equal(c.evaluateStep(booking, 200, booked).level, 'ok');
  booked.bookedOffers[0].validZones = ['P', '0', 'B'];
  assert.equal(c.evaluateStep(booking, 200, booked).level, 'error');
  assert.equal(booking.request.body.activateAfterPayment, false);
});

test('guided FE workflow uses INT app and explicitly distinguishes observation from automatic proof', () => {
  const index = read('public/workflows/index.json');
  const w = index.workflows.find(w => w.id === 'pidlitacka-1145-int-emulator');
  assert.equal(w.requiredEnvironmentProfileId, 'be-integration-mos-pre');
  assert.equal(w.requiredBackendUrl, 'https://pidl2-backend.int.pidlitacka.cz/');
  const reset = index.emulatorSubscenarios.find(s => s.id === w.items[1].emulator.subscenarioId);
  assert.equal(reset.actions[0].packageName, 'cz.dpp.praguepublictransport.pidlitacka.int');
  assert.ok(w.items.every(i => i.instructions.some(s => s.startsWith('Uživatel provede:'))));
  assert.match(JSON.stringify(w), /NOT RUN \/ BLOCKED/);
  assert.match(JSON.stringify(w), /10,11,12,13/);
  assert.match(JSON.stringify(w), /9,10,11,12/);
});
