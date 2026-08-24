const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..");
const packPath = path.join(root, "public", "scenarios", "pidlitacka", "feature-966-oblibene-jizdenky.json");
const manifestPath = path.join(root, "public", "scenarios", "pidlitacka", "index.json");
const appPath = path.join(root, "public", "app.js");

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function scenarioSteps() {
  const scenario = readJson(packPath).scenarios[0];
  return { scenario, steps: new Map(scenario.steps.map(step => [step.id, step])) };
}

test("task 966 pack is registered as an authenticated manual scenario", () => {
  const manifest = readJson(manifestPath);
  const pack = readJson(packPath);
  const registration = manifest.packs.find(item => item.id === "pidlitacka-feature-966");
  const scenario = pack.scenarios[0];

  assert.equal(registration.file, "feature-966-oblibene-jizdenky.json");
  assert.equal(scenario.id, "pidlitacka-ticket-966-favorite-lifecycle");
  assert.equal(scenario.requiresAuth, true);
  assert.equal(scenario.smoke, false);
  assert.equal(scenario.manualInputRequired, true);
  assert.equal(scenario.autoTags, false);
  assert.deepEqual(scenario.tags, ["tickets", "favorites", "idempotence"]);
  assert.equal(scenario.app.section, "tickets");
});

test("task 966 starts clean and creates one reserved favorite", () => {
  const { steps } = scenarioSteps();
  const prepare = steps.get("ticket-966-prepare-favorite");
  const cleanup = steps.get("ticket-966-clean-previous-favorite");
  const create = steps.get("ticket-966-create-favorite");

  assert.deepEqual(prepare.expected.statusIn, [200, 201]);
  assert.equal(prepare.request.body.productId, 966001);
  assert.equal(prepare.extract.ticket966PreparationFavoriteId, "$.id");
  assert.match(cleanup.request.path, /ticket966PreparationFavoriteId/);
  assert.equal(cleanup.expected.status, 204);
  assert.equal(create.expected.status, 201);
  assert.equal(create.extract.ticket966FavoriteId, "$.id");
  assert.equal(create.extract.ticket966FavoriteCreatedAt, "$.createdAt");
});

test("task 966 verifies idempotence using the original id", () => {
  const { steps } = scenarioSteps();
  const repeat = steps.get("ticket-966-repeat-favorite");

  assert.equal(repeat.expected.status, 200);
  assert.equal(
    repeat.expected.assertions.find(item => item.path === "$.id").equals,
    "{{context.ticket966FavoriteId}}");
  assert.equal(
    repeat.expected.assertions.find(item => item.path === "$.createdAt").notEmpty,
    true);
});

test("task 966 lets the tester select the created favorite before deleting it", () => {
  const { steps } = scenarioSteps();
  const select = steps.get("ticket-966-select-favorite");
  const remove = steps.get("ticket-966-delete-favorite");
  const removeAgain = steps.get("ticket-966-delete-again");

  assert.equal(select.selection.sourcePath, "$");
  assert.equal(select.selection.buttonLabel, "Odebrat z oblíbených");
  assert.equal(select.selection.store.ticket966SelectedFavoriteId, "$.id");
  assert.deepEqual(select.expected.assertions[0].containsItem, {
    id: "{{context.ticket966FavoriteId}}",
    productId: 966001,
    createdAt: "{{context.ticket966FavoriteCreatedAt}}"
  });
  assert.match(remove.request.path, /ticket966SelectedFavoriteId/);
  assert.equal(remove.expected.status, 204);
  assert.equal(removeAgain.expected.status, 404);
  assert.equal(removeAgain.expected.outcome, "expectedError");
});

test("task 966 verifies cleanup at both ends", () => {
  const { steps } = scenarioSteps();
  const cleanStart = steps.get("ticket-966-verify-clean-start");
  const cleanFinish = steps.get("ticket-966-verify-clean-finish");

  for (const step of [cleanStart, cleanFinish]) {
    assert.equal(step.request.path, "/v1/accounts/me/favorite-tickets");
    assert.match(step.expected.assertions[0].regex, /productId/);
    assert.match(step.expected.assertions[0].regex, /966001/);
  }
});

test("Klikátko renders favorite tickets as dedicated selectable business cards", () => {
  const appSource = fs.readFileSync(appPath, "utf8");

  assert.match(appSource, /function renderFavoriteTicketsCardsHtml/);
  assert.match(appSource, /Oblíbená jízdenka – produkt/);
  assert.match(appSource, /isFavoriteTicketArray\(items, step\)/);
  assert.match(appSource, /\/v1\/accounts\/me\/favorite-tickets/);
  assert.match(appSource, /item\.autoTags === false/);
  assert.match(appSource, /case "favorites":/);
});
