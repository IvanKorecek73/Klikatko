const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..");
const workflowIndex = JSON.parse(fs.readFileSync(path.join(root, "public", "workflows", "index.json"), "utf8"));
const projectIndex = JSON.parse(fs.readFileSync(path.join(root, "public", "scenarios", "index.json"), "utf8"));
const appSource = fs.readFileSync(path.join(root, "public", "app.js"), "utf8");
const presentation = workflowIndex.workflows.find(workflow => workflow.id === "pidlitacka-fe-moderated-presentation");
const presentationWorkflows = workflowIndex.workflows.filter(workflow => workflow.sourceWorkflowId === presentation.id);

test("moderated FE presentation steps are split into standalone visible workflows", () => {
  assert.ok(presentation);
  assert.equal(presentation.hidden, true);
  assert.equal(presentation.mode, "presentation");
  assert.equal(presentation.items.length, 17);
  assert.equal(new Set(presentation.items.map(item => item.id)).size, presentation.items.length);
  assert.equal(presentationWorkflows.length, 6);

  const assignedItemIds = presentationWorkflows.flatMap(workflow => workflow.itemIds);
  assert.equal(assignedItemIds.length, presentation.items.length);
  assert.deepEqual(new Set(assignedItemIds), new Set(presentation.items.map(item => item.id)));
  assert.ok(presentationWorkflows.every(workflow => workflow.category === "presentation"));
  assert.match(appSource, /function resolveWorkflowIndex/);

  for (const item of presentation.items) {
    assert.equal(item.type, "presentation");
    assert.ok(item.id);
    assert.ok(item.section);
    assert.ok(item.title);
    assert.ok(item.message);
    assert.equal(item.projectId, undefined);
    assert.equal(item.scenarioId, undefined);
  }
});

test("workflow engine handles presentation items before API scenario execution", () => {
  const presentationBranch = appSource.indexOf("if (isPresentationWorkflowItem(item))", appSource.indexOf("async function continueWorkflowRun"));
  const redisBranch = appSource.indexOf("applyWorkflowRedisSession(item)", appSource.indexOf("async function continueWorkflowRun"));
  const scenarioBranch = appSource.indexOf("await openWorkflowItem(item)", appSource.indexOf("async function continueWorkflowRun"));

  assert.ok(presentationBranch > 0);
  assert.ok(presentationBranch < redisBranch);
  assert.ok(presentationBranch < scenarioBranch);
  assert.match(appSource, /presentationPendingItemIndex/);
  assert.match(appSource, /showPresentationWorkflowPauseResult/);
  assert.match(appSource, /id="presentationEmulatorPace"/);
  assert.match(appSource, /Maximální \(bez umělých prodlev\)/);
  assert.match(appSource, /pace,/);
  assert.match(appSource, /data-workflow-continue/);
  assert.match(appSource, /function bindWorkflowContinueButtons/);
  assert.match(appSource, /hasEmulatorActions \? "disabled"/);
  assert.match(appSource, /continueButton\.disabled = false/);
});

test("emulator subscenarios separate reusable login from embedded card filling", () => {
  const login = workflowIndex.emulatorSubscenarios.find(item => item.id === "pidlitacka-login-saved-profile");
  const payment = workflowIndex.emulatorSubscenarios.find(item => item.id === "gdpay-fill-test-card");
  const standaloneLogin = workflowIndex.workflows.find(item => item.id === "pidlitacka-fe-login-subscenarios");

  assert.equal(login.standalone, true);
  assert.equal(login.actions[0].type, "ifNode");
  assert.equal(login.actions[1].type, "ifNode");
  assert.equal(login.actions[2].contentDescription, "Přihlaste se");
  assert.equal(login.actions[2].exact, false);
  assert.equal(login.actions[0].contentDescription, "Nastavení aplikace a účtu");
  assert.ok(!login.actions.some(action => action.type === "tapNode" && action.exact === false && action.contentDescription === "Trasy"));
  assert.match(JSON.stringify(login.actions), /\{\{email\}\}/);
  assert.match(JSON.stringify(login.actions), /\{\{password\}\}/);
  assert.doesNotMatch(JSON.stringify(login.actions), /abc123|Test1234/);

  assert.equal(payment.standalone, false);
  assert.equal(payment.variables.cardNumber, "4000007000010006");
  assert.equal(standaloneLogin.items.length, 3);
  assert.ok(standaloneLogin.items.every(item => item.emulator.subscenarioId === login.id));

  const embeddedPayment = presentation.items.find(item => item.id === "coupon-pay-and-save-card");
  assert.equal(embeddedPayment.emulator.subscenarioId, payment.id);
});

test("every presentation login account is available independently of the selected scenario pack", () => {
  const pidlitacka = projectIndex.projects.find(project => project.id === "pidlitacka");
  const profiles = pidlitacka.auth.login.profiles;
  const profilesByEmail = new Map(profiles.map(profile => [profile.values?.email?.toLowerCase(), profile]));
  const requiredEmails = workflowIndex.workflows
    .flatMap(workflow => workflow.items || [])
    .map(item => item.emulator?.profileEmail)
    .filter(Boolean);

  for (const email of requiredEmails) {
    const profile = profilesByEmail.get(email.toLowerCase());
    assert.ok(profile, `Missing presentation auth profile for ${email}`);
    assert.ok(profile.values.password, `Missing presentation password for ${email}`);
  }
});

test("workflow catalog has stable primary categories for filtering", () => {
  const allowed = new Set([
    "presentation",
    "authentication",
    "client-setup",
    "coupon-purchase",
    "payment-diagnostics",
    "ticket-payment"
  ]);

  assert.ok(workflowIndex.workflows.every(workflow => allowed.has(workflow.category)));
  assert.equal(workflowIndex.workflows.filter(workflow => workflow.category === "payment-diagnostics").length, 4);
  assert.equal(workflowIndex.workflows.filter(workflow => workflow.category === "ticket-payment").length, 2);
  assert.match(appSource, /renderWorkflowCategoryFilters/);
  assert.match(appSource, /buildWorkflowSearchText/);
});
