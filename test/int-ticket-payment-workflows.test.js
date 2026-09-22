const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const index = JSON.parse(fs.readFileSync(path.join(root, 'public/workflows/index.json'), 'utf8'));
const projects = JSON.parse(fs.readFileSync(path.join(root, 'public/scenarios/index.json'), 'utf8'));
const source = fs.readFileSync(path.join(root, 'public/app.js'), 'utf8');
const workflows = ['save-card', 'saved-card'].map(method =>
  index.workflows.find(x => x.id === `pidlitacka-ticket-${method}-int-emulator`));

function contextFor(workflow = workflows[0]) {
  const context = vm.createContext({
    state: { projectIndex: structuredClone(projects), workflowIndex: index },
    selectedProfile: 'be-integration-mos-pre',
    selectedEnvironment: 'pidlitacka-integration',
    getSelectedWorkflow: () => workflow,
    getWorkflowEnvironmentProfiles: () => index.environmentProfiles,
    getSelectedWorkflowEnvironmentProfileId: () => context.selectedProfile,
    getPidLitackaEnvironmentId: () => context.selectedEnvironment,
  });
  load(context, 'getWorkflowEnvironmentError');
  return context;
}

function load(context, name) {
  const match = source.match(new RegExp(`(?:async )?function ${name}\\([^]*?\\n\\}`));
  assert.ok(match, name);
  vm.runInContext(match[0], context);
}

test('INT pair uses its own app, keeps cleanup before T01 and verifies the T01 card in T02', () => {
  assert.ok(workflows.every(Boolean));
  assert.deepEqual(workflows.map(w => w.items.length), [13, 9]);
  for (const workflow of workflows) {
    assert.equal(workflow.requiredEnvironmentProfileId, 'be-integration-mos-pre');
    assert.equal(workflow.requiredBackendUrl, 'https://pidl2-backend.int.pidlitacka.cz/');
    const reset = index.emulatorSubscenarios.find(s => s.id === workflow.items[0].emulator.subscenarioId);
    assert.equal(reset.actions[0].packageName, 'cz.dpp.praguepublictransport.pidlitacka.int');
    assert.notEqual(workflow.items[0].id, index.workflows.find(w => w.id === workflow.id.replace('-int-', '-')).items[0].id);
    assert.ok(workflow.items.every(i => i.instructions.some(line => /Uživatel provede:/.test(line))));
    assert.equal(contextFor(workflow).getWorkflowEnvironmentError(workflow), '');
  }
  const first = workflows[0];
  const cleanupIndex = first.items.findIndex(x => x.id.endsWith('-clear-cards'));
  assert.ok(cleanupIndex > first.items.findIndex(x => x.id.endsWith('-login')));
  assert.ok(cleanupIndex < first.items.findIndex(x => x.id.endsWith('-open-purchase')));
  assert.match(first.items[cleanupIndex].instructions.join(' '), /INTEGRAČNÍ prostředí/);
  assert.ok(!workflows[1].items.some(x => x.id.endsWith('-clear-cards')));
  assert.match(workflows[1].items.find(x => x.id.endsWith('-check-card')).instructions.join(' '), /přesné savedCardId/);
});

test('INT environment check rejects stale profile, identity environment and repointed URL', () => {
  const c = contextFor();
  c.selectedProfile = 'be-local-1109-mos-pre';
  assert.match(c.getWorkflowEnvironmentError(workflows[0]), /zvolte prostředí/);
  c.selectedProfile = 'be-integration-mos-pre';
  c.selectedEnvironment = 'pidlitacka-local-1109';
  assert.match(c.getWorkflowEnvironmentError(workflows[0]), /zvolte prostředí/);
  c.selectedEnvironment = 'pidlitacka-integration';
  c.state.projectIndex.projects.find(p => p.id === 'pidlitacka').environments
    .find(e => e.id === 'pidlitacka-integration').targetBaseUrl = 'http://localhost:18861';
  assert.match(c.getWorkflowEnvironmentError(workflows[0]), /Konfigurace prostředí/);
  assert.equal(c.getWorkflowEnvironmentError({ name: 'Existing unbound workflow' }), '');
  assert.match(c.getWorkflowEnvironmentError({ requiredEnvironmentProfileId: 'missing' }), /nedostupný profil/);
});

test('start and start-from-item do not create a run under a mismatched environment', async () => {
  for (const name of ['startSelectedWorkflow', 'startWorkflowFromItem']) {
    const c = contextFor();
    let messages = 0;
    c.selectedEnvironment = 'pidlitacka-local';
    c.selectWorkflowProfileForIdentityEnvironments = () => {};
    c.showWorkflowSummary = (level, message) => { assert.equal(level, 'error'); assert.match(message, /zvolte/); messages++; };
    c.prepareWorkflowRun = () => assert.fail('A blocked start must not mutate run state');
    load(c, name);
    await c[name](workflows[0].id, 3);
    assert.equal(messages, 1);
  }
});

test('correct INT environment permits normal start', async () => {
  const c = contextFor();
  let prepared = 0;
  let continued = 0;
  c.selectWorkflowProfileForIdentityEnvironments = () => {};
  c.prepareWorkflowRun = w => { assert.equal(w.id, workflows[0].id); prepared++; };
  c.addLog = () => {};
  c.continueWorkflowRun = async () => { continued++; };
  load(c, 'startSelectedWorkflow');
  await c.startSelectedWorkflow();
  assert.equal(prepared, 1);
  assert.equal(continued, 1);
});

test('changing environment while paused prevents recording the pending step as completed', async () => {
  const c = contextFor();
  c.state.workflowRun = { itemIndex: 2, presentationPendingItemIndex: 2, results: [] };
  c.selectedEnvironment = 'pidlitacka-local';
  let paused = false;
  c.pauseWorkflow = () => { paused = true; };
  c.syncCurrentStepFormValuesFromDom = () => assert.fail('No continuation allowed');
  load(c, 'continueWorkflowRun');
  await c.continueWorkflowRun();
  assert.equal(paused, true);
  assert.equal(c.state.workflowRun.results.length, 0);
});

test('a stale emulator action button cannot send actions after switching away from INT', async () => {
  const c = contextFor();
  c.selectedEnvironment = 'pidlitacka-local';
  c.document = { getElementById: () => null };
  c.elements = { resultCard: { querySelector: () => null } };
  c.resolvePresentationEmulatorExecution = () => assert.fail('No credential resolution or actions allowed');
  c.fetch = () => assert.fail('No ADB request allowed');
  let errors = 0;
  c.addLog = level => { assert.equal(level, 'error'); errors++; };
  load(c, 'runPresentationWorkflowItemInEmulator');
  await c.runPresentationWorkflowItemInEmulator(workflows[0].items[1], {
    dataset: { confirmed: 'true' }, classList: { add: value => assert.equal(value, 'error') }
  });
  assert.equal(errors, 1);
});
