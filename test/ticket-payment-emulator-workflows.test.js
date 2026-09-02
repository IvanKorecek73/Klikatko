const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..");
const workflowIndex = JSON.parse(
  fs.readFileSync(path.join(root, "public", "workflows", "index.json"), "utf8")
);
const appSource = fs.readFileSync(path.join(root, "public", "app.js"), "utf8");

function getWorkflow(id) {
  const workflow = workflowIndex.workflows.find(item => item.id === id);
  assert.ok(workflow, `Missing workflow ${id}`);
  return workflow;
}

function getSubscenario(id) {
  const subscenario = workflowIndex.emulatorSubscenarios.find(item => item.id === id);
  assert.ok(subscenario, `Missing emulator subscenario ${id}`);
  return subscenario;
}

function getItem(workflow, id) {
  const item = workflow.items.find(candidate => candidate.id === id);
  assert.ok(item, `Missing workflow item ${id}`);
  return item;
}

function countActions(actions = []) {
  return actions.reduce(
    (count, action) => count + 1 + countActions(action.actions),
    0
  );
}

test("ticket payment workflows are manually stepped emulator regressions", () => {
  const workflows = [
    getWorkflow("pidlitacka-ticket-save-card-emulator"),
    getWorkflow("pidlitacka-ticket-saved-card-emulator")
  ];

  for (const workflow of workflows) {
    assert.equal(workflow.category, "ticket-payment");
    assert.equal(workflow.mode, "presentation");
    assert.ok(workflow.tags.includes("emulator"));
    assert.ok(workflow.tags.includes("regression"));
    assert.ok(workflow.items.length > 0);
    assert.ok(workflow.items.every(item => item.type === "presentation"));
    assert.ok(workflow.items.every(item => item.emulator));
  }

  assert.match(appSource, /case "ticket-payment":\s*return "Platby jízdenek";/);
});

test("both workflows start a fresh purchase under the dedicated payment account", () => {
  const saveCard = getWorkflow("pidlitacka-ticket-save-card-emulator");
  const savedCard = getWorkflow("pidlitacka-ticket-saved-card-emulator");

  for (const [workflow, prefix] of [
    [saveCard, "ticket-save-card"],
    [savedCard, "ticket-saved-card"]
  ]) {
    const login = getItem(workflow, `${prefix}-login`);
    const open = getItem(workflow, `${prefix}-open-purchase`);

    assert.equal(login.emulator.subscenarioId, "pidlitacka-login-saved-profile");
    assert.equal(login.emulator.profileEmail, "wijessibrouma-5506@yopmail.com");
    assert.equal(open.emulator.subscenarioId, "pidlitacka-open-ticket-purchase");
  }

  assert.match(savedCard.description, /samostatný nákup/i);
  assert.match(
    getItem(savedCard, "ticket-saved-card-open-purchase").instructions.join(" "),
    /žádný booking ID se mezi workflow nepřenáší/i
  );
});

test("both workflows begin by restarting the app into a reusable root state", () => {
  const reset = getSubscenario("pidlitacka-reset-to-root");
  const restart = reset.actions[0];

  assert.equal(reset.standalone, false);
  assert.equal(restart.type, "restartApp");
  assert.equal(restart.packageName, "cz.dpp.praguepublictransport.dev.pidlitacka");
  assert.deepEqual(restart.readyContentDescriptions, ["Vyhledávání", "Přihlaste se"]);

  for (const [workflowId, prepareId] of [
    ["pidlitacka-ticket-save-card-emulator", "ticket-save-card-prepare"],
    ["pidlitacka-ticket-saved-card-emulator", "ticket-saved-card-prepare"]
  ]) {
    const workflow = getWorkflow(workflowId);
    assert.equal(workflow.items[0].id, prepareId);
    assert.equal(workflow.items[0].emulator.subscenarioId, reset.id);
    assert.match(workflow.items[0].title, /^0\./);
  }
});

test("saved-profile login enters the password and keeps logout confirmation explicit", () => {
  const login = getSubscenario("pidlitacka-login-saved-profile");
  const passwordInput = login.actions.find(
    action => action.type === "inputText" && action.value === "{{password}}"
  );
  const logoutBranch = login.actions.find(action => action.type === "ifNode" && action.contentDescription === "Nastavení");
  const logoutTaps = logoutBranch.actions.filter(
    action => action.type === "tapNode" && action.contentDescription === "Odhlásit se"
  );
  const confirmation = logoutTaps[1];

  assert.ok(passwordInput);
  assert.equal(passwordInput.sensitive, true);
  assert.equal(confirmation.hoverMs, 140);
  assert.equal(confirmation.touchMs, 100);
  assert.equal(confirmation.waitAfterMs, 700);
});

test("saved-profile login verifies the email-to-password transition and retries a missed tap", () => {
  const login = getSubscenario("pidlitacka-login-saved-profile");
  const emailInput = login.actions.find(
    action => action.type === "inputText" && action.value === "{{email}}"
  );
  const continueAction = login.actions.find(
    action => action.type === "tapNode" && action.contentDescription === "Pokračovat"
  );
  const submitAction = login.actions.find(
    action => action.type === "tapNode" && action.contentDescription === "Přihlásit se"
  );

  assert.equal(emailInput.expectedValue, "{{email}}");
  assert.equal(emailInput.retryCount, 1);
  assert.deepEqual(continueAction.waitFor, { contentDescription: "Heslo" });
  assert.equal(continueAction.transitionTimeoutMs, 3000);
  assert.equal(continueAction.retryCount, 1);
  assert.deepEqual(submitAction.waitFor, { contentDescription: "Vyhledávání" });
  assert.equal(submitAction.transitionTimeoutMs, 15000);
});

test("ticket navigation and product selection use semantic labels instead of coordinates", () => {
  const open = getSubscenario("pidlitacka-open-ticket-purchase");
  const select = getSubscenario("pidlitacka-select-prague-30-minute-ticket");

  assert.equal(open.standalone, false);
  assert.equal(select.standalone, false);
  assert.deepEqual(
    open.actions.filter(action => action.type === "tapNode").map(action => action.contentDescription),
    ["Jízdné", "Koupit jízdenku"]
  );
  assert.equal(open.actions[0].exact, false);
  assert.deepEqual(open.actions[0].waitFor, { contentDescription: "Platné jízdné", exact: false });
  assert.equal(open.actions[1].type, "swipe");
  assert.equal(open.actions[1].repeat, 60);
  assert.deepEqual(open.actions[1].until, {
    contentDescription: "Koupit jízdenku",
    clickable: true
  });
  assert.deepEqual(open.actions[2].waitFor, { contentDescription: "Nákup jízdenek" });
  assert.equal(select.actions[1].type, "ifNode");
  assert.equal(select.actions[1].contentDescription, "Dospělý");
  assert.notEqual(select.actions[1].exact, false);
  assert.equal(select.actions[1].actions[0].type, "tapNode");
  assert.equal(select.actions[1].actions[0].contentDescription, "Dospělý");
  assert.notEqual(select.actions[1].actions[0].exact, false);
  assert.equal(select.actions[1].actions[0].waitFor.selected, true);
  assert.notEqual(select.actions[1].actions[0].waitFor.exact, false);
  assert.equal(select.actions[2].type, "swipe");
  assert.equal(select.actions[2].repeat, 20);
  assert.equal(select.actions[3].type, "swipe");
  assert.deepEqual(select.actions[3].until, {
    contentDescription: "Praha\nDospělý\n30 min",
    exact: false,
    clickable: true
  });
  assert.equal(select.actions[4].contentDescription, "Praha\nDospělý\n30 min");
  assert.equal(select.actions[4].exact, false);
  assert.deepEqual(select.actions[4].waitFor, {
    contentDescription: "Nová karta",
    exact: false
  });
  assert.equal(select.actions[5].contentDescription, "Zaplatit");
  assert.ok([...open.actions, ...select.actions].every(action => action.type !== "tap"));
});

test("save-card workflow enables persistence before opening and submitting the gateway", () => {
  const workflow = getWorkflow("pidlitacka-ticket-save-card-emulator");
  const enable = getItem(workflow, "ticket-save-card-enable-save");
  const initiate = getItem(workflow, "ticket-save-card-initiate");
  const fill = getItem(workflow, "ticket-save-card-fill-gateway");
  const submit = getItem(workflow, "ticket-save-card-submit-gateway");
  const verify = getItem(workflow, "ticket-save-card-verify");

  assert.deepEqual(enable.emulator.actions[0].contentDescriptions, ["Nová karta", "0006"]);
  assert.deepEqual(enable.emulator.actions[0].waitFor, {
    contentDescription: "Uložit kartu pro příště",
    exact: false
  });
  assert.ok(enable.emulator.actions.some(action => action.contentDescription === "Uložit kartu pro příště"));
  assert.equal(initiate.emulator.actions[0].contentDescription, "Zaplatit");
  assert.deepEqual(initiate.emulator.actions[0].waitFor, {
    className: "android.widget.EditText",
    occurrence: 2
  });
  assert.equal(initiate.emulator.actions[0].transitionTimeoutMs, 30000);
  assert.equal(initiate.emulator.actions[1].className, "android.widget.EditText");
  assert.equal(initiate.emulator.actions[1].occurrence, 2);
  assert.equal(fill.emulator.subscenarioId, "gdpay-fill-test-card");
  const fillScenario = getSubscenario("gdpay-fill-test-card");
  assert.deepEqual(fillScenario.actions.map(action => action.resourceId), ["cardnumber", "expiry", "cvc"]);
  assert.equal(fillScenario.actions[0].keyByKey, true);
  assert.equal(fillScenario.actions[0].expectedValue, "{{cardNumber}}");
  assert.equal(fillScenario.actions[1].expectedValue, "11/30");
  assert.equal(fillScenario.actions[1].keyByKey, true);
  assert.equal(fillScenario.actions[2].expectedValue, "{{cvc}}");
  assert.equal(fillScenario.actions[2].tapHorizontalRatio, 0.35);
  assert.match(submit.emulator.confirm, /vytvoří další jízdenku/i);
  assert.deepEqual(submit.emulator.actions[0].waitFor, {
    contentDescription: "Jízdné",
    exact: false
  });
  assert.equal(submit.emulator.actions[0].transitionTimeoutMs, 30000);
  assert.ok(verify.emulator.actions.some(action => action.contentDescription === "0006"));
  assert.match(verify.instructions.join(" "), /První běh na čistém účtu/i);
});

test("saved-card workflow asserts card 0006 before initiating the opaque-token payment", () => {
  const workflow = getWorkflow("pidlitacka-ticket-saved-card-emulator");
  const select = getItem(workflow, "ticket-saved-card-select-method");
  const initiate = getItem(workflow, "ticket-saved-card-initiate");
  const serialized = JSON.stringify(workflow);

  const assertIndex = select.emulator.actions.findIndex(
    action => action.type === "assertNode" && action.contentDescription === "0006"
  );
  const tapIndex = select.emulator.actions.findIndex(
    action => action.type === "tapNode" && action.contentDescription === "0006"
  );

  assert.ok(assertIndex >= 0);
  assert.ok(tapIndex > assertIndex);
  assert.deepEqual(select.emulator.actions[0].contentDescriptions, ["Nová karta", "0006"]);
  assert.equal(initiate.emulator.actions[0].contentDescription, "Zaplatit");
  assert.match(initiate.emulator.confirm, /uloženou kartou/i);
  assert.match(initiate.expected.join(" "), /HTTP 400/i);
  assert.doesNotMatch(serialized, /gdpay-fill-test-card/);
});

test("all configured ticket-payment emulator actions fit the bridge safety limit", () => {
  const workflows = workflowIndex.workflows.filter(item => item.category === "ticket-payment");
  const referencedSubscenarioIds = workflows
    .flatMap(workflow => workflow.items)
    .map(item => item.emulator.subscenarioId)
    .filter(Boolean);

  for (const workflow of workflows) {
    for (const item of workflow.items) {
      assert.ok(countActions(item.emulator.actions) <= 24, `${workflow.id}/${item.id} exceeds action limit`);
    }
  }

  for (const id of referencedSubscenarioIds) {
    assert.ok(countActions(getSubscenario(id).actions) <= 24, `${id} exceeds action limit`);
  }
});
