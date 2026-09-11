const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");
const { findNode, parseUiNodes } = require("../tools/emulator-bridge");

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

test("adult fare selector cannot click a ticket row containing the same label", () => {
  const selector = getSubscenario("pidlitacka-select-prague-30-minute-ticket").actions[1];
  const nodes = parseUiNodes('<hierarchy><node content-desc="Praha&#10;Dospělý&#10;30 min" clickable="true" enabled="true" bounds="[0,0][100,100]" /></hierarchy>');
  assert.equal(findNode(nodes, selector), null);
});

test("emulator card selection accepts an existing card without a previous workflow", () => {
  const state = { workflowContext: {}, workflowInputs: { savedCardLast4: "4321", savedCardCount: "3", savedCardPosition: "2" }, workflowIndex };
  const context = vm.createContext({state});
  for (const name of ["getEmulatorSubscenario", "resolvePresentationEmulatorExecution", "interpolateEmulatorTemplates"]) {
    const source = appSource.match(new RegExp(`function ${name}\\([^]*?\\n\\}`));
    assert.ok(source);
    vm.runInContext(source[0], context);
  }
  const selected = getItem(getWorkflow("pidlitacka-ticket-saved-card-emulator"), "ticket-saved-card-select-method");
  const result = context.resolvePresentationEmulatorExecution(selected);
  assert.equal(result.actions.find(a => a.type === "assertNode").contentDescription, "4321");
  assert.equal(result.actions[0].position, "2");
  assert.equal(result.actions[0].expectedCount, "3");
  state.workflowInputs = {};
  assert.throws(() => context.resolvePresentationEmulatorExecution(selected), /Chybí hodnota savedCardLast4/);
  for (const savedCardLast4 of ["4", "12345", "text"]) {
    state.workflowInputs = { savedCardLast4 };
    assert.throws(() => context.resolvePresentationEmulatorExecution(selected), /požadovaný formát/);
  }
  for (const name of ["savedCardCount", "savedCardPosition"]) {
    for (const value of ["", "0", "-1", "1.5", "100", "text"]) {
      state.workflowInputs = { savedCardLast4: "4321", savedCardCount: "3", savedCardPosition: "2", [name]: value };
      assert.throws(() => context.resolvePresentationEmulatorExecution(selected), /Chybí hodnota|požadovaný formát/);
    }
  }
});

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
    assert.ok(workflow.items.every(item => item.emulator || item.id === "ticket-save-card-clear-cards"));
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

  assert.match(savedCard.description, /samostatný mobilní test/i);
  assert.match(
    getItem(savedCard, "ticket-saved-card-open-purchase").instructions.join(" "),
    /žádný booking ID se mezi workflow nepřenáší/i
  );
});

test("only the new-card workflow clears the dedicated account before purchase using the existing cleanup", () => {
  const workflow = getWorkflow("pidlitacka-ticket-save-card-emulator");
  const cleanup = getItem(workflow, "ticket-save-card-clear-cards");
  assert.ok(workflow.items.indexOf(cleanup) > workflow.items.indexOf(getItem(workflow, "ticket-save-card-login")));
  assert.ok(workflow.items.indexOf(cleanup) < workflow.items.indexOf(getItem(workflow, "ticket-save-card-open-purchase")));
  assert.equal(cleanup.emulator, undefined);
  assert.match(cleanup.instructions.join(" "), /stejné LOCAL prostředí/);
  assert.match(cleanup.instructions.join(" "), /prázdný seznam \[\]/);
  assert.match(cleanup.instructions.join(" "), /Při chybě mazání se nesmí zahájit platba/);
  const pack = JSON.parse(fs.readFileSync(path.join(root, "public/scenarios/pidlitacka/task-1111-ticket-saved-card.json"), "utf8"));
  const existing = pack.scenarios.find(item => item.id === "pidlitacka-ticket-1111-card-cleanup");
  assert.ok(cleanup.instructions.join(" ").includes(existing.title));
  assert.ok(existing.steps.some(step => step.request.method === "DELETE" && step.request.path.startsWith("/v1/accounts/me/saved-cards/")));
  assert.ok(!getWorkflow("pidlitacka-ticket-saved-card-emulator").items.some(item => item.id === cleanup.id));
  const verify = getItem(workflow, "ticket-save-card-verify-saved");
  assert.equal(verify.emulator.actions.at(-1).expectedCount, 1);
  assert.match(verify.instructions.join(" "), /savedCardId/);
  assert.match(verify.instructions.join(" "), /Cleanup mezi oběma nákupy neopakujte/);
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
  assert.equal(confirmation.hoverMs, undefined);
  assert.equal(confirmation.touchMs, undefined);
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
  assert.equal(continueAction.transitionTimeoutMs, 10000);
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
  assert.equal(select.actions[1].exact, true);
  assert.equal(select.actions[1].actions[0].type, "tapNode");
  assert.equal(select.actions[1].actions[0].contentDescription, "Dospělý");
  assert.equal(select.actions[1].actions[0].exact, true);
  assert.equal(select.actions[1].actions[0].waitFor.selected, true);
  assert.equal(select.actions[1].actions[0].waitFor.exact, true);
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

test("new-card workflow requires payment and saved-card registration with separate checks", () => {
  const workflow = getWorkflow("pidlitacka-ticket-save-card-emulator");
  const baseline = getItem(workflow, "ticket-save-card-card-baseline");
  const enable = getItem(workflow, "ticket-save-card-enable-save");
  const confirm = getItem(workflow, "ticket-save-card-confirm-save");
  const initiate = getItem(workflow, "ticket-save-card-initiate");
  const fill = getItem(workflow, "ticket-save-card-fill-gateway");
  const submit = getItem(workflow, "ticket-save-card-submit-gateway");
  const verify = getItem(workflow, "ticket-save-card-verify");
  const saved = getItem(workflow, "ticket-save-card-verify-saved");

  assert.deepEqual(baseline.emulator.actions[0].contentDescriptions, ["Nová karta", "Karta"]);
  assert.deepEqual(baseline.emulator.actions[0].waitFor, {
    contentDescription: "Potvrdit",
    exact: true
  });
  assert.ok(enable.emulator.actions.some(action => action.contentDescription === "Nová karta"));
  assert.ok(enable.emulator.actions.some(action => action.type === "assertNode" && action.contentDescription === "Uložit kartu pro příště"));
  assert.ok(!enable.emulator.actions.some(action => action.contentDescription === "Potvrdit"));
  for (const step of [baseline, enable, confirm]) {
    assert.ok(!step.emulator.actions.some(action => action.type === "tapNode" && /Uložit kartu|Zaplatit/.test(action.contentDescription)));
  }
  assert.ok(confirm.emulator.actions.some(action => action.type === "tapNode" && action.contentDescription === "Potvrdit"));
  assert.match(confirm.instructions.join(" "), /PŘED.*vizuálně.*zaškrtnuté/);
  const order = [baseline, enable, confirm, initiate, fill, submit, verify, saved].map(step => workflow.items.indexOf(step));
  assert.deepEqual(order, [...order].sort((a, b) => a - b));
  assert.equal(initiate.emulator.actions[0].type, "assertNode");
  assert.equal(initiate.emulator.actions[0].contentDescription, "Nová karta");
  assert.equal(initiate.emulator.actions[1].contentDescription, "Zaplatit");
  assert.deepEqual(initiate.emulator.actions[1].waitFor, {
    className: "android.widget.EditText",
    occurrence: 2
  });
  assert.equal(initiate.emulator.actions[1].transitionTimeoutMs, 30000);
  assert.equal(initiate.emulator.actions[2].className, "android.widget.EditText");
  assert.equal(initiate.emulator.actions[2].occurrence, 2);
  assert.equal(fill.emulator.subscenarioId, "gdpay-fill-test-card");
  const fillScenario = getSubscenario("gdpay-fill-test-card");
  assert.equal(fillScenario.actions.length, 1);
  assert.equal(fillScenario.actions[0].type, "inputTextGroup");
  assert.deepEqual(fillScenario.actions[0].fields.map(field => field.resourceId), ["cardnumber", "expiry", "cvc"]);
  assert.notEqual(fillScenario.actions[0].fields[0].keyByKey, true);
  assert.equal(fillScenario.actions[0].fields[0].expectedValue, "{{cardNumber}}");
  assert.equal(fillScenario.actions[0].fields[1].expectedValue, "08/28");
  assert.notEqual(fillScenario.actions[0].fields[1].keyByKey, true);
  assert.equal(fillScenario.actions[0].fields[2].expectedValue, "{{cvc}}");
  assert.equal(fillScenario.actions[0].fields[2].tapHorizontalRatio, 0.35);
  assert.match(submit.emulator.confirm, /vytvoří další jízdenku/i);
  assert.equal(submit.emulator.actions[0].type, "hideKeyboard");
  assert.deepEqual(submit.emulator.actions[1].waitFor, {
    contentDescriptions: ["Aktivace jízdenek", "Jízdné"],
    exact: false
  });
  assert.equal(submit.emulator.actions[1].transitionTimeoutMs, 60000);
  assert.match(workflow.description, /Úspěch vyžaduje.*A uložení/);
  assert.ok(!verify.emulator.actions.some(action => action.contentDescription === "Koupit jízdenku"));
  assert.match(verify.instructions.join(" "), /povinné Ověřit uložení/);
  const savedMatcher = saved.emulator.actions.at(-1);
  assert.equal(savedMatcher.type, "assertNode");
  assert.notEqual(savedMatcher.unique, true);
  assert.equal(savedMatcher.clickable, true);
  assert.equal(savedMatcher.contentDescription, getSubscenario("gdpay-fill-test-card").variables.cardNumber.slice(-4));
  assert.throws(() => findNode(parseUiNodes('<node content-desc="Nová karta" clickable="true" bounds="[0,0][100,20]" />'), savedMatcher), /očekáváno 1, nalezeno 0/);
  const repeatedSavedCards = parseUiNodes('<node content-desc="Karta ****0006" clickable="true" bounds="[0,0][100,40]" /><node content-desc="Karta ****0006" clickable="true" bounds="[0,50][100,90]" />');
  assert.throws(() => findNode(repeatedSavedCards, savedMatcher), /očekáváno 1, nalezeno 2/);
  assert.ok(findNode(parseUiNodes('<node content-desc="Karta ****0006" clickable="true" bounds="[0,0][100,40]" />'), savedMatcher));
  assert.match(saved.instructions.join(" "), /registraci.*bookingId\/paymentId.*savedCardId/);
  assert.match(saved.instructions.join(" "), /právě jednu aktivní kartu účtu.*samotná maska nestačí/);
  assert.match(saved.instructions.join(" "), /neoznačujte celý běh jako úspěšný/);
  assert.ok(!saved.emulator.actions.some(action => action.type === "tapNode" && action.contentDescription === "Zaplatit"));
});

test("saved-card workflow checks an existing card before payment and requires a real browser return", () => {
  const workflow = getWorkflow("pidlitacka-ticket-saved-card-emulator");
  const preflight = getItem(workflow, "ticket-saved-card-check-card");
  const challenge = getItem(workflow, "ticket-saved-card-complete-3ds");
  const select = getItem(workflow, "ticket-saved-card-select-method");
  const initiate = getItem(workflow, "ticket-saved-card-initiate");
  const verify = getItem(workflow, "ticket-saved-card-verify");
  const serialized = JSON.stringify(workflow);

  const assertIndex = select.emulator.actions.findIndex(
    action => action.type === "assertNode" && action.contentDescription === "{{savedCardLast4}}"
  );
  const tapIndex = select.emulator.actions.findIndex(
    action => action.type === "tapNode" && action.contentDescription === "{{savedCardLast4}}"
  );

  assert.ok(assertIndex >= 0);
  assert.ok(tapIndex > assertIndex);
  assert.ok(workflow.items.indexOf(preflight) < workflow.items.indexOf(select));
  assert.ok(workflow.items.indexOf(select) < workflow.items.indexOf(initiate));
  assert.equal(select.emulator.actions[0].type, "assertNode");
  assert.equal(select.emulator.actions[0].position, "{{savedCardPosition}}");
  assert.equal(select.emulator.actions[0].expectedCount, "{{savedCardCount}}");
  assert.equal(initiate.emulator.actions[0].unique, true);
  assert.equal(workflow.inputs[0].name, "savedCardLast4");
  assert.equal(workflow.inputs[0].value, undefined);
  assert.equal(initiate.emulator.actions[0].type, "assertNode");
  assert.equal(initiate.emulator.actions[0].contentDescription, "{{savedCardLast4}}");
  assert.equal(initiate.emulator.actions[1].contentDescription, "Zaplatit");
  assert.deepEqual(initiate.emulator.actions[1].waitFor, {
    text: "Enter 1234 for OK auth",
    exact: false
  });
  assert.equal(initiate.emulator.actions[1].transitionTimeoutMs, 30000);
  assert.equal(initiate.emulator.actions[1].retryCount, 0);
  assert.match(initiate.emulator.confirm, /uloženou kartou/i);
  assert.match(initiate.expected.join(" "), /HTTP 400/i);
  assert.deepEqual(challenge.emulator.actions.map(action => action.type), [
    "inputText",
    "hideKeyboard",
    "tapNode"
  ]);
  assert.equal(challenge.emulator.actions[0].resourceId, "otp");
  assert.equal(challenge.emulator.actions[0].value, "1234");
  assert.equal(challenge.emulator.actions[0].expectedValue, "1234");
  assert.equal(challenge.emulator.actions[0].retryCount, 0);
  assert.equal(challenge.emulator.actions[2].resourceId, "sendOtp");
  assert.deepEqual(challenge.emulator.actions[2].waitFor, {
    contentDescriptions: ["Aktivace jízdenek", "Jízdné"],
    exact: false
  });
  assert.deepEqual(verify.emulator.actions.map(action => action.type), ["ifNode", "assertNode"]);
  assert.equal(verify.emulator.actions[1].contentDescription, "Jízdné");
  assert.equal(verify.emulator.actions[1].timeoutMs, 30000);
  assert.doesNotMatch(serialized, /Unauthorized|Close tab|openDeepLink/);
  for (const required of ["PAID", "FULFILLED", "browserReturnReceived=true", "savedCardId"]) {
    assert.ok([...verify.instructions, ...verify.expected].join(" ").includes(required));
  }
  assert.doesNotMatch(serialized, /gdpay-fill-test-card/);
  assert.doesNotMatch(serialized, /T01|T02/);
});

test("saved-card preflight rejects missing, disabled and unexpected extra cards without a pay action", () => {
  const workflow = getWorkflow("pidlitacka-ticket-saved-card-emulator");
  const preflight = getItem(workflow, "ticket-saved-card-check-card");
  const matcher = { ...preflight.emulator.actions[1], contentDescription: "0006", position: "1", expectedCount: "1" };
  const node = (label, enabled = true) => `<node content-desc="${label}" clickable="true" enabled="${enabled}" bounds="[0,0][100,40]" />`;
  const newCard = parseUiNodes(node("Nová karta"));
  assert.throws(() => findNode(newCard, matcher), /očekáváno 1, nalezeno 0/);
  assert.throws(() => findNode(parseUiNodes(node("Karta ****0006", false)), matcher), /očekáváno 1, nalezeno 0/);
  assert.equal(findNode(parseUiNodes(node("Karta ****0006")), matcher).contentDescription, "Karta ****0006");
  assert.throws(() => findNode(parseUiNodes(node("Karta ****0006") + node("Karta **0006")), matcher), /očekáváno 1, nalezeno 2/);
  assert.ok(preflight.emulator.actions.every(action => action.type !== "tapNode" || !/Zaplatit/.test(JSON.stringify(action))));
  const paymentGuard = { ...getItem(workflow, "ticket-saved-card-initiate").emulator.actions[0], contentDescription: "0006" };
  assert.equal(findNode(newCard, paymentGuard), null);
  assert.throws(() => findNode(parseUiNodes(node("Karta ****0006") + node("Karta **0006")), paymentGuard), /není jednoznačný/);
});

test("duplicate saved cards require explicit count and position, consistently before checking and tapping", () => {
  const workflow = getWorkflow("pidlitacka-ticket-saved-card-emulator");
  // Three identical labels observed on the emulator after the successful T01.
  // Deliberately shuffled XML order verifies that the human-facing index is visual.
  const nodes = parseUiNodes([1639, 1292, 1466].map(top =>
    `<node content-desc="Karta *0006" clickable="true" enabled="true" bounds="[42,${top}][1038,${top + 168}]" />`
  ).join(""));
  const preflight = getItem(workflow, "ticket-saved-card-check-card").emulator.actions[1];
  const select = getItem(workflow, "ticket-saved-card-select-method");
  for (const action of [preflight, ...select.emulator.actions.slice(0, 2)]) {
    const matcher = { ...action, contentDescription: "0006", position: "2", expectedCount: "3" };
    assert.equal(findNode(nodes, matcher).bounds.top, 1466);
    assert.throws(() => findNode(nodes.slice(1), matcher), /očekáváno 3, nalezeno 2/);
    assert.throws(() => findNode([...nodes, nodes[0]], matcher), /očekáváno 3, nalezeno 4/);
    for (const invalid of [
      { position: undefined }, { expectedCount: undefined }, { position: "0" },
      { position: "4" }, { expectedCount: "1.5" }, { position: "1.5" },
      { position: "invalid" }, { expectedCount: "101" }, { occurrence: 0 }
    ]) {
      assert.throws(() => findNode(nodes, { ...matcher, ...invalid }), /Výběr podle pořadí vyžaduje/);
    }
  }
});

test("post-purchase checks accept the activation offer and close it without activating", () => {
  // Labels observed after the real T01 return on 2026-09-09. The modal hides
  // the Jízdné tab until dismissed, so waiting only for that tab is incorrect.
  const nodes = parseUiNodes(`<hierarchy>
    <node content-desc="Aktivace jízdenek" class="android.view.View" bounds="[0,0][100,20]" />
    <node content-desc="Zavřít" clickable="true" bounds="[100,0][120,20]" />
    <node content-desc="Děkujeme za váš nákup!" bounds="[0,20][120,40]" />
    <node content-desc="Aktivovat všechny jízdenky" clickable="true" bounds="[0,80][120,100]" />
  </hierarchy>`);
  const save = getWorkflow("pidlitacka-ticket-save-card-emulator");
  const saved = getWorkflow("pidlitacka-ticket-saved-card-emulator");
  for (const [returnAction, dismiss] of [
    [getItem(save, "ticket-save-card-submit-gateway").emulator.actions[1],
      getItem(save, "ticket-save-card-verify").emulator.actions[0]],
    [getItem(saved, "ticket-saved-card-complete-3ds").emulator.actions[2],
      getItem(saved, "ticket-saved-card-verify").emulator.actions[0]]
  ]) {
    assert.equal(findNode(nodes, {contentDescription: "Jízdné"}), null);
    assert.equal(findNode(nodes, returnAction.waitFor).contentDescription, "Aktivace jízdenek");
    assert.equal(dismiss.type, "ifNode");
    assert.equal(findNode(nodes, dismiss).contentDescription, "Aktivace jízdenek");
    assert.equal(dismiss.actions.length, 1);
    assert.equal(findNode(nodes, dismiss.actions[0]).contentDescription, "Zavřít");
    assert.equal(findNode(nodes.slice(0,1).concat(nodes.slice(2)), dismiss.actions[0]), null);
    const wallet = parseUiNodes('<node content-desc="Jízdné" clickable="true" bounds="[0,0][100,20]" />');
    assert.equal(findNode(wallet, dismiss), null);
    assert.equal(findNode(wallet, dismiss.actions[0].waitFor).contentDescription, "Jízdné");
  }
});

test("resuming T01 verification after manual gateway completion cannot send another payment", () => {
  const workflow = getWorkflow("pidlitacka-ticket-save-card-emulator");
  const verify = getItem(workflow, "ticket-save-card-verify");
  const flatten = actions => actions.flatMap(action => [action, ...flatten(action.actions || [])]);
  const actions = flatten(verify.emulator.actions);
  assert.equal(actions.filter(action => action.type === "inputText" || action.type === "inputTextGroup").length, 0);
  assert.ok(actions.filter(action => action.type === "tapNode").every(action =>
    !/Zaplatit|Aktivovat/.test([action.text, action.contentDescription, ...(action.contentDescriptions || [])].join(" "))));
  assert.match(getItem(workflow, "ticket-save-card-fill-gateway").instructions.join(" "), /Pokračovat odtud/);
});

test("resuming T02 after manual 3DS never submits another bank action", () => {
  const workflow = getWorkflow("pidlitacka-ticket-saved-card-emulator");
  const verify = getItem(workflow, "ticket-saved-card-verify");
  const flatten = actions => actions.flatMap(action => [action, ...flatten(action.actions || [])]);
  const actions = flatten(verify.emulator.actions);
  assert.ok(actions.every(action => !["inputText", "inputTextGroup"].includes(action.type)));
  assert.ok(actions.filter(action => action.type === "tapNode").every(action =>
    !/sendOtp|Zaplatit|Aktivovat|Ověřit předchozí/.test(JSON.stringify(action))));
  assert.match(verify.instructions.join(" "), /Pokračovat odtud/);
});

test("hybrid workflow keeps the app-owned payment and returns it to the same live booking", () => {
  const workflow = getWorkflow("pidlitacka-ticket-save-card-hybrid");
  const initiate = getItem(workflow, "hybrid-ticket-save-card-initiate");
  const desktop = getItem(workflow, "hybrid-ticket-save-card-desktop-payment");
  const callback = getItem(workflow, "hybrid-ticket-save-card-return");

  assert.ok(workflow.tags.includes("hybrid"));
  assert.deepEqual(initiate.emulator.actions.map(action => action.type), [
    "clearLogcat",
    "tapNode",
    "captureTicketCardPayment"
  ]);
  assert.equal(initiate.emulator.actions[1].waitFor, undefined);
  assert.match(initiate.expected.join(" "), /Emulátor zůstane v aplikaci/i);
  assert.equal(desktop.hybridPayment.kind, "ticket-card");
  assert.deepEqual(callback.emulator.actions[0], {
    type: "openDeepLink",
    uri: "pid-litacka-payment://ticket/{{hybridTicketBookingId}}",
    packageName: "cz.dpp.praguepublictransport.dev.pidlitacka",
    waitFor: { contentDescription: "Jízdné", exact: false },
    transitionTimeoutMs: 30000
  });
  assert.match(appSource, /paymentUrl:\s*"<ephemeral>"/);
  assert.match(appSource, /__desktop\/open-payment/);
});

test("all configured ticket-payment emulator actions fit the bridge safety limit", () => {
  const workflows = workflowIndex.workflows.filter(item => item.category === "ticket-payment");
  const referencedSubscenarioIds = workflows
    .flatMap(workflow => workflow.items)
    .map(item => item.emulator?.subscenarioId)
    .filter(Boolean);

  for (const workflow of workflows) {
    for (const item of workflow.items) {
      assert.ok(countActions(item.emulator?.actions) <= 24, `${workflow.id}/${item.id} exceeds action limit`);
    }
  }

  for (const id of referencedSubscenarioIds) {
    assert.ok(countActions(getSubscenario(id).actions) <= 24, `${id} exceeds action limit`);
  }
});
