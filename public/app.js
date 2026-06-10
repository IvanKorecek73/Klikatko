const state = {
  projectIndex: null,
  currentProject: null,
  currentProjectBasePath: "",
  currentEnvironmentId: null,
  packIndex: null,
  currentPackId: null,
  catalog: null,
  scenario: null,
  stepIndex: 0,
  context: {},
  secrets: {},
  values: {},
  dirty: false,
  freeForm: false,
  lastStepResult: null,
  stepResults: {},
  log: [],
  forms: [],
  scenarioSearch: "",
  formSearch: "",
  scenarioCategory: "all",
  formCategory: "all",
  selectedScenarioIds: new Set(),
  batchRunning: false,
  batchStopRequested: false,
  smokeResults: {},
  workflowIndex: null,
  selectedWorkflowId: null,
  workflowRun: null,
  workflowContext: {},
  workflowSecrets: {},
  workflowRunning: false,
  workflowStopRequested: false,
  workflowLastReport: null,
  harnessMeta: null,
  authSession: null,
  authFormValues: {},
  authProfileNotes: {},
  authCustomProfiles: [],
  identityFormValues: {},
  redisBridgeUrl: localStorage.getItem("demoHarness.redisBridgeUrl") || "/__redis",
  redisIdentityId: "",
  redisIdentityManual: false,
  redisLastSession: null,
  redisHealth: null,
  redisHealthCheckRunning: false,
  displayedResult: null,
  activeSelection: null,
  resultCountdownTimer: null,
  eventHandlersBound: false
};

const NEW_AUTH_PROFILE_ID = "__new_auth_profile__";
const LAST_SELECTION_STORAGE_KEY = "demoHarness.lastSelection.v1";

const elements = {
  scenarioList: document.querySelector("#scenarioList"),
  smokeList: document.querySelector("#smokeList"),
  formList: document.querySelector("#formList"),
  scenarioSearch: document.querySelector("#scenarioSearch"),
  formSearch: document.querySelector("#formSearch"),
  scenarioCategoryFilters: document.querySelector("#scenarioCategoryFilters"),
  formCategoryFilters: document.querySelector("#formCategoryFilters"),
  scenarioSelectionCount: document.querySelector("#scenarioSelectionCount"),
  selectAllScenarios: document.querySelector("#selectAllScenarios"),
  clearScenarioSelection: document.querySelector("#clearScenarioSelection"),
  runSelectedScenarios: document.querySelector("#runSelectedScenarios"),
  stopBatchRun: document.querySelector("#stopBatchRun"),
  batchRunProgress: document.querySelector("#batchRunProgress"),
  batchRunSummary: document.querySelector("#batchRunSummary"),
  projectSelect: document.querySelector("#projectSelect"),
  environmentSelect: document.querySelector("#environmentSelect"),
  scenarioPack: document.querySelector("#scenarioPack"),
  baseUrl: document.querySelector("#baseUrl"),
  targetUrl: document.querySelector("#targetUrl"),
  targetEnvironmentBadge: document.querySelector("#targetEnvironmentBadge"),
  targetHint: document.querySelector("#targetHint"),
  authPanel: document.querySelector("#authPanel"),
  authPanelTitle: document.querySelector("#authPanelTitle"),
  authSummaryStatus: document.querySelector("#authSummaryStatus"),
  authForm: document.querySelector("#authForm"),
  authJwtStatus: document.querySelector("#authJwtStatus"),
  authJwtDetails: document.querySelector("#authJwtDetails"),
  authLoginAction: document.querySelector("#authLoginAction"),
  authRefreshAction: document.querySelector("#authRefreshAction"),
  authSessionRenewAction: document.querySelector("#authSessionRenewAction"),
  authLogoutAction: document.querySelector("#authLogoutAction"),
  authResetAction: document.querySelector("#authResetAction"),
  brandTitle: document.querySelector("#brandTitle"),
  brandSubtitle: document.querySelector("#brandSubtitle"),
  modeBanner: document.querySelector("#modeBanner"),
  testerTitle: document.querySelector("#testerTitle"),
  testerDescription: document.querySelector("#testerDescription"),
  testerExpected: document.querySelector("#testerExpected"),
  stepCounter: document.querySelector("#stepCounter"),
  screenTitle: document.querySelector("#screenTitle"),
  screenDescription: document.querySelector("#screenDescription"),
  appNavPrimary: document.querySelector("#appNavPrimary"),
  appNavSecondary: document.querySelector("#appNavSecondary"),
  appNavTertiary: document.querySelector("#appNavTertiary"),
  stepForm: document.querySelector("#stepForm"),
  runStep: document.querySelector("#runStep"),
  previousStep: document.querySelector("#previousStep"),
  nextStep: document.querySelector("#nextStep"),
  resetScenario: document.querySelector("#resetScenario"),
  resultCard: document.querySelector("#resultCard"),
  clearLog: document.querySelector("#clearLog"),
  savePhoneScreenshot: document.querySelector("#savePhoneScreenshot"),
  saveFullLog: document.querySelector("#saveFullLog"),
  contextView: document.querySelector("#contextView"),
  logEntries: document.querySelector("#logEntries"),
  autoRunTarget: document.querySelector("#autoRunTarget"),
  autoRun: document.querySelector("#autoRun"),
  autoRunSummary: document.querySelector("#autoRunSummary"),
  scenariosTab: document.querySelector("#scenariosTab"),
  smokeTab: document.querySelector("#smokeTab"),
  formsTab: document.querySelector("#formsTab"),
  workflowsTab: document.querySelector("#workflowsTab"),
  redisTab: document.querySelector("#redisTab"),
  scenariosPane: document.querySelector("#scenariosPane"),
  smokePane: document.querySelector("#smokePane"),
  formsPane: document.querySelector("#formsPane"),
  workflowsPane: document.querySelector("#workflowsPane"),
  redisPane: document.querySelector("#redisPane"),
  workflowList: document.querySelector("#workflowList"),
  workflowStatus: document.querySelector("#workflowStatus"),
  workflowAutoStop: document.querySelector("#workflowAutoStop"),
  runWorkflow: document.querySelector("#runWorkflow"),
  continueWorkflow: document.querySelector("#continueWorkflow"),
  stopWorkflow: document.querySelector("#stopWorkflow"),
  workflowSummary: document.querySelector("#workflowSummary"),
  redisBridgeUrl: document.querySelector("#redisBridgeUrl"),
  redisIdentityId: document.querySelector("#redisIdentityId"),
  redisStatus: document.querySelector("#redisStatus"),
  identitySummary: document.querySelector("#identitySummary"),
  identityProfileSelect: document.querySelector("#identityProfileSelect"),
  identityProfileFields: document.querySelector("#identityProfileFields"),
  identityLoginAction: document.querySelector("#identityLoginAction"),
  identityRefreshAction: document.querySelector("#identityRefreshAction"),
  identityRenewMosAction: document.querySelector("#identityRenewMosAction"),
  identityLogoutAction: document.querySelector("#identityLogoutAction"),
  redisLoadSession: document.querySelector("#redisLoadSession"),
  redisUseSession: document.querySelector("#redisUseSession"),
  redisScanSessions: document.querySelector("#redisScanSessions"),
  redisResult: document.querySelector("#redisResult"),
  testerTab: document.querySelector("#testerTab"),
  logTab: document.querySelector("#logTab"),
  testerPane: document.querySelector("#testerPane"),
  logPane: document.querySelector("#logPane")
};

init();

async function init() {
  initResizablePanels();
  bindEventHandlers();

  try {
    state.projectIndex = await fetchJson("/scenarios/index.json");
    await loadWorkflowIndex();
    await loadHarnessMeta();
    populateProjectOptions();
    const lastSelection = loadLastSelection();
    await loadProject(getRestoredProjectId(lastSelection), {
      packId: lastSelection?.packId,
      scenarioId: lastSelection?.scenarioId,
      suppressLog: true
    });
    renderRedisViewer();
  } catch (error) {
    const recovered = await recoverStartupFromStoredSelection(error);
    if (!recovered) {
      showStartupError(error);
    }
  }
}

async function recoverStartupFromStoredSelection(originalError) {
  if (!state.projectIndex) {
    return false;
  }

  try {
    localStorage.removeItem(LAST_SELECTION_STORAGE_KEY);
    populateProjectOptions();
    await loadProject(getDefaultProjectId(), {
      suppressLog: true
    });
    renderRedisViewer();
    showBatchRunSummary("warn", "Klikatko ignorovalo ulozeny posledni vyber.", [
      originalError instanceof Error ? originalError.message : String(originalError),
      "Aplikace byla nactena z vychoziho projektu."
    ]);
    return true;
  } catch (recoveryError) {
    addLog("error", "Klikatko startup recovery failed", {
      original: originalError instanceof Error ? originalError.message : String(originalError),
      recovery: recoveryError instanceof Error ? recoveryError.message : String(recoveryError)
    });
    return false;
  }
}

function bindEventHandlers() {
  if (state.eventHandlersBound) {
    return;
  }

  state.eventHandlersBound = true;

  elements.runStep.addEventListener("click", runCurrentStep);
  elements.previousStep.addEventListener("click", previousStep);
  elements.nextStep.addEventListener("click", nextStep);
  elements.resetScenario.addEventListener("click", resetCurrentScenario);
  elements.autoRun.addEventListener("click", runScenarioToSelectedStep);
  elements.selectAllScenarios.addEventListener("click", selectAllScenarios);
  elements.clearScenarioSelection.addEventListener("click", clearScenarioSelection);
  elements.runSelectedScenarios.addEventListener("click", runSelectedScenarios);
  elements.stopBatchRun.addEventListener("click", requestStopBatchRun);
  elements.scenariosTab.addEventListener("click", () => activateLeftTab("scenarios"));
  elements.smokeTab.addEventListener("click", () => activateLeftTab("smoke"));
  elements.formsTab.addEventListener("click", () => activateLeftTab("forms"));
  elements.workflowsTab.addEventListener("click", () => activateLeftTab("workflows"));
  elements.redisTab.addEventListener("click", () => {
    renderRedisViewer();
    activateLeftTab("redis");
  });
  elements.runWorkflow.addEventListener("click", startSelectedWorkflow);
  elements.continueWorkflow.addEventListener("click", continueWorkflowRun);
  elements.stopWorkflow.addEventListener("click", requestStopWorkflowRun);
  elements.scenarioSearch.addEventListener("input", event => {
    state.scenarioSearch = event.target.value.trim().toLowerCase();
    renderScenarioList();
  });
  elements.projectSelect.addEventListener("change", async event => {
    try {
      await loadProject(event.target.value);
    } catch (error) {
      showStartupError(error);
    }
  });
  elements.environmentSelect.addEventListener("change", async event => {
    try {
      await applyProjectEnvironment(state.currentProject, event.target.value);
    } catch (error) {
      showStartupError(error);
    }
  });
  elements.scenarioPack.addEventListener("change", async event => {
    try {
      await loadScenarioPack(event.target.value);
    } catch (error) {
      showStartupError(error);
    }
  });
  elements.baseUrl.addEventListener("input", () => {
    if (!state.currentProject) {
      return;
    }

    localStorage.setItem(getBaseUrlStorageKey(state.currentProject.id), elements.baseUrl.value);
    renderTargetInfo();
  });
  elements.authForm.addEventListener("input", handleAuthFormInput);
  elements.authForm.addEventListener("click", handleAuthFormClick);
  elements.authLoginAction.addEventListener("click", executeAuthLogin);
  elements.authRefreshAction.addEventListener("click", executeAuthRefresh);
  elements.authSessionRenewAction.addEventListener("click", executeAuthSessionRenew);
  elements.authLogoutAction.addEventListener("click", executeAuthLogout);
  elements.authResetAction.addEventListener("click", resetAuthState);
  elements.identityProfileSelect.addEventListener("change", async event => {
    await applyIdentityProfileSelection(event.target.value);
    renderAuthPanel();
    renderRedisViewer();
    renderModeBanner();
  });
  elements.identityProfileFields.addEventListener("input", handleIdentityProfileFieldInput);
  elements.identityLoginAction.addEventListener("click", () => executeIdentityAuthAction("login"));
  elements.identityRefreshAction.addEventListener("click", () => executeIdentityAuthAction("refresh"));
  elements.identityRenewMosAction.addEventListener("click", () => executeIdentityAuthAction("mos"));
  elements.identityLogoutAction.addEventListener("click", () => executeIdentityAuthAction("logout"));
  elements.redisBridgeUrl.addEventListener("input", event => {
    state.redisBridgeUrl = event.target.value.trim() || "http://127.0.0.1:5097";
    localStorage.setItem("demoHarness.redisBridgeUrl", state.redisBridgeUrl);
  });
  elements.redisIdentityId.addEventListener("input", event => {
    state.redisIdentityId = event.target.value.trim();
    state.redisIdentityManual = true;
  });
  elements.redisLoadSession.addEventListener("click", loadRedisSessionFromViewer);
  elements.redisUseSession.addEventListener("click", useRedisSessionFromViewer);
  elements.redisScanSessions.addEventListener("click", scanRedisSessionsFromViewer);
  elements.formSearch.addEventListener("input", event => {
    state.formSearch = event.target.value.trim().toLowerCase();
    renderFormList();
  });
  elements.testerTab.addEventListener("click", () => activateRightTab("tester"));
  elements.logTab.addEventListener("click", () => activateRightTab("log"));
  elements.savePhoneScreenshot.addEventListener("click", savePhoneScreenshot);
  elements.saveFullLog.addEventListener("click", saveFullLog);
  elements.clearLog.addEventListener("click", () => {
    state.log = [];
    renderLog();
  });
}

function showStartupError(error) {
  const message = error instanceof Error ? error.message : String(error);
  addLog("error", "Klikatko startup failed", { message });
  elements.resultCard.className = "result-card error";
  elements.resultCard.innerHTML = `
    <strong class="result-title">Klikatko se nepodarilo nacist</strong>
    <div class="result-message">${escapeHtml(message)}</div>
    <div class="workflow-pause-next">Zkuste obnovit stranku. Pokud problem zustane, vymazte ulozeny stav Klikatka pro localhost:5096.</div>
  `;
  showBatchRunSummary("error", "Klikatko se nepodarilo nacist.", [
    message
  ]);
}

function populateProjectOptions() {
  elements.projectSelect.innerHTML = "";

  for (const project of sortByName(state.projectIndex.projects || [])) {
    const option = document.createElement("option");
    option.value = project.id;
    option.textContent = project.name;
    elements.projectSelect.appendChild(option);
  }
}

async function loadWorkflowIndex() {
  try {
    state.workflowIndex = await fetchJson("/workflows/index.json");
    state.selectedWorkflowId = state.workflowIndex.defaultWorkflowId
      || state.workflowIndex.workflows?.[0]?.id
      || null;
    renderWorkflowList();
    updateWorkflowControls();
  } catch (error) {
    state.workflowIndex = { version: 1, workflows: [] };
    state.selectedWorkflowId = null;
    renderWorkflowList();
    showWorkflowSummary("error", "Workflow katalog se nepodařilo načíst.", [
      error instanceof Error ? error.message : String(error)
    ]);
  }
}

function populateScenarioPackOptions() {
  elements.scenarioPack.innerHTML = "";

  for (const pack of sortByName(state.packIndex?.packs || [])) {
    const option = document.createElement("option");
    option.value = pack.id;
    option.textContent = pack.name;
    elements.scenarioPack.appendChild(option);
  }
}

function sortByName(items) {
  return [...(items || [])].sort((left, right) =>
    String(left?.name || "").localeCompare(String(right?.name || ""), "cs", {
      sensitivity: "base"
    }));
}

function populateEnvironmentOptions(project) {
  elements.environmentSelect.innerHTML = "";

  for (const environment of project?.environments || []) {
    const option = document.createElement("option");
    option.value = environment.id;
    option.textContent = environment.name;
    elements.environmentSelect.appendChild(option);
  }

  elements.environmentSelect.disabled = !(project?.environments?.length > 0);
}

function getDefaultProjectId() {
  return state.projectIndex?.defaultProjectId
    || state.projectIndex?.projects?.[0]?.id
    || null;
}

function loadLastSelection() {
  try {
    const saved = JSON.parse(localStorage.getItem(LAST_SELECTION_STORAGE_KEY) || "null");
    return saved && typeof saved === "object" ? saved : null;
  } catch {
    return null;
  }
}

function saveLastSelection(patch = {}) {
  const next = {
    projectId: state.currentProject?.id || null,
    packId: state.currentPackId || null,
    scenarioId: state.freeForm ? null : state.scenario?.id || null,
    ...patch
  };

  localStorage.setItem(LAST_SELECTION_STORAGE_KEY, JSON.stringify(next));
}

function getRestoredProjectId(selection) {
  const projectId = selection?.projectId;
  const exists = (state.projectIndex?.projects || []).some(project => project.id === projectId);
  return exists ? projectId : getDefaultProjectId();
}

function getDefaultPackId() {
  return state.packIndex?.defaultPackId
    || state.packIndex?.packs?.[0]?.id
    || null;
}

function getRestoredPackId(packId) {
  const exists = (state.packIndex?.packs || []).some(pack => pack.id === packId);
  return exists ? packId : getDefaultPackId();
}

function getDefaultEnvironmentId(project) {
  return project?.defaultEnvironmentId
    || project?.environments?.[0]?.id
    || "";
}

function isSmokeEligible(scenario) {
  return scenario?.formsOnly !== true && scenario?.smoke !== false;
}

function requiresManualInput(item) {
  return item?.manualInputRequired === true;
}

function requiresJwt(item) {
  return item?.requiresJwt === true;
}

function requiresAuth(item) {
  return item?.requiresAuth === true;
}

function requiresAnonymousAuth(item) {
  return item?.requiresAnonymousAuth === true;
}

function requiresAuthorization(item) {
  return requiresJwt(item) || requiresAuth(item) || requiresAnonymousAuth(item);
}

function getAuthorizationBadgeLabel() {
  const type = getProjectAuthConfig().type;

  if (type === "login") {
    return "Přihlášení";
  }

  if (type === "apiKey") {
    return "API klíč";
  }

  return "JWT";
}

async function loadProject(projectId, options = {}) {
  const project = (state.projectIndex?.projects || []).find(item => item.id === projectId);

  if (!project) {
    throw new Error(`Unknown project: ${projectId}`);
  }

  state.currentProject = project;
  state.currentProjectBasePath = getDirectoryPath(project.manifest);
  elements.projectSelect.value = project.id;
  populateEnvironmentOptions(project);
  state.packIndex = await fetchJson(`/scenarios/${project.manifest}`);
  populateScenarioPackOptions();
  applyProjectBranding(project);
  applyProjectBaseUrl(project);
  await applyProjectEnvironment(project, getSavedEnvironmentId(project) || getDefaultEnvironmentId(project));
  loadProjectAuth(project);
  await loadScenarioPack(getRestoredPackId(options.packId), {
    scenarioId: options.scenarioId,
    suppressLog: options.suppressLog
  });
  saveLastSelection();
}

async function loadScenarioPack(packId, options = {}) {
  const pack = (state.packIndex?.packs || []).find(item => item.id === packId);

  if (!pack) {
    throw new Error(`Unknown scenario pack: ${packId}`);
  }

  state.currentPackId = pack.id;
  elements.scenarioPack.value = pack.id;
  state.catalog = await fetchJson(resolvePackUrl(pack.file));
  state.scenario = null;
  state.stepIndex = 0;
  state.context = {};
  state.secrets = {};
  state.values = {};
  state.dirty = false;
  state.freeForm = false;
  state.lastStepResult = null;
  state.stepResults = {};
  state.displayedResult = null;
  state.activeSelection = null;
  state.scenarioSearch = "";
  state.formSearch = "";
  state.scenarioCategory = "all";
  state.formCategory = "all";
  elements.scenarioSearch.value = "";
  elements.formSearch.value = "";
  state.selectedScenarioIds = new Set(
    state.catalog.scenarios
      .filter(scenario => isSmokeEligible(scenario))
      .map(scenario => scenario.id));
  initializeSmokeResults();
  state.forms = collectForms();
  renderScenarioList();
  renderSmokeList();
  renderFormList();
  renderContext();
  clearAutoRunSummary();
  showBatchRunSummary("ok", `Načten test pack: ${pack.name}`, [
    pack.description || `${state.catalog.scenarios.length} sc\u00e9n\u00e1\u0159\u016f`
  ]);
  showBatchRunProgress({
    headline: pack.name,
    detail: pack.description || `Načteno ${state.catalog.scenarios.length} sc\u00e9n\u00e1\u0159\u016f.`
  });
  addLog("ok", "Harness pack loaded", {
    projectId: state.currentProject?.id,
    packId: pack.id,
    packName: pack.name,
    scenarios: state.catalog.scenarios.length,
    note: "Spusťte cílový backend a podle potřeby upravte API proxy."
  });
  if (options.scenarioId && state.catalog.scenarios.some(scenario => scenario.id === options.scenarioId)) {
    selectScenario(options.scenarioId, {
      preserveLog: true,
      suppressLog: options.suppressLog
    });
  } else {
    saveLastSelection({ scenarioId: null });
  }
}

function resolvePackUrl(file) {
  const relative = state.currentProjectBasePath
    ? `${state.currentProjectBasePath}/${file}`
    : file;

  return `/scenarios/${relative}`;
}

function getDirectoryPath(path) {
  const normalized = String(path || "").replace(/\\/g, "/");
  const index = normalized.lastIndexOf("/");

  return index >= 0 ? normalized.slice(0, index) : "";
}

function applyProjectBranding(project) {
  elements.brandTitle.textContent = "Scénáře";
  elements.brandSubtitle.textContent = project.name;
}

function applyProjectBaseUrl(project) {
  const storageKey = getBaseUrlStorageKey(project.id);
  const savedBaseUrl = localStorage.getItem(storageKey);
  const effectiveBaseUrl = savedBaseUrl || project.defaultBaseUrl || "/api";

  elements.baseUrl.value = effectiveBaseUrl;

  renderTargetInfo();
}

function getBaseUrlStorageKey(projectId) {
  return `demoHarness.baseUrl.${projectId}`;
}

function getEnvironmentStorageKey(projectId) {
  return `demoHarness.environment.${projectId}`;
}

function getAuthTokenStorageKey(projectId) {
  return `demoHarness.authJwt.${projectId}`;
}

function getAuthSessionStorageKey(projectId, environmentId) {
  return `demoHarness.authSession.${projectId}.${environmentId || "default"}`;
}

function getAuthFormStorageKey(projectId) {
  return `demoHarness.authForm.${projectId}`;
}

function getAuthProfileNotesStorageKey(projectId) {
  return `demoHarness.authProfileNotes.${projectId}`;
}

function getAuthCustomProfilesStorageKey(projectId) {
  return `demoHarness.authCustomProfiles.${projectId}`;
}

function getSavedEnvironmentId(project) {
  if (!project?.id) {
    return "";
  }

  return localStorage.getItem(getEnvironmentStorageKey(project.id)) || "";
}

function getProjectAuthConfig(project = state.currentProject) {
  return project?.auth || { type: "jwt" };
}

function createNewAuthProfile() {
  return {
    id: NEW_AUTH_PROFILE_ID,
    label: "+ Nový uživatel",
    isNewProfile: true,
    values: {}
  };
}

function createNewAuthProfileDraftValues() {
  const deviceNumber = Math.floor(1000 + Math.random() * 9000);
  const android = Math.random() > 0.5;

  return {
    email: "",
    password: "",
    deviceId: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${deviceNumber}`,
    deviceName: android ? `Test Android ${deviceNumber}` : `Test iPhone ${deviceNumber}`,
    platform: android ? "Android" : "iOS",
    osVersion: android ? "14" : "17.4",
    appVersion: "2.0.0",
    model: android ? "Pixel 8" : "iPhone 15 Pro",
    __newProfileNote: ""
  };
}

function getAuthProfiles(authConfig = getProjectAuthConfig()) {
  if (authConfig?.type !== "login") {
    return [];
  }

  const staticProfiles = authConfig.login?.profiles || [];
  const anonymousProfiles = staticProfiles.filter(profile => profile.authRequest === "anonymous");
  const regularProfiles = staticProfiles.filter(profile => profile.authRequest !== "anonymous");
  const customProfiles = (state.authCustomProfiles || []).map(profile => ({
    ...profile,
    custom: true
  }));

  return [
    ...regularProfiles,
    ...customProfiles,
    ...anonymousProfiles,
    createNewAuthProfile()
  ];
}

function getAuthProfileIdentityId(profile) {
  return String(profile?.values?.identityId || profile?.identityId || "").trim();
}

function getPidLitackaProject() {
  return state.projectIndex?.projects?.find(project => project.id === "pidlitacka") || null;
}

function getPidLitackaEnvironmentId(project = getPidLitackaProject()) {
  return project
    ? (getSavedEnvironmentId(project) || getDefaultEnvironmentId(project))
    : "";
}

function getPidLitackaAuthProfiles() {
  const project = getPidLitackaProject();
  const authConfig = getProjectAuthConfig(project);

  if (!project || authConfig.type !== "login") {
    return [];
  }

  const staticProfiles = authConfig.login?.profiles || [];
  const anonymousProfiles = staticProfiles.filter(profile => profile.authRequest === "anonymous");
  const regularProfiles = staticProfiles.filter(profile => profile.authRequest !== "anonymous");
  const customProfiles = loadSavedAuthCustomProfiles(project).map(profile => ({
    ...profile,
    custom: true
  }));

  return [
    ...regularProfiles,
    ...customProfiles,
    ...anonymousProfiles,
    createNewAuthProfile()
  ];
}

function getSelectedPidLitackaProfileId() {
  const project = getPidLitackaProject();
  const profiles = getPidLitackaAuthProfiles();
  const formValues = project ? loadSavedAuthFormValues(project) : {};
  const selectedId = formValues.__selectedProfileId || "";

  return profiles.some(profile => profile.id === selectedId)
    ? selectedId
    : profiles[0]?.id || "";
}

function getSelectedPidLitackaProfile() {
  const selectedId = getSelectedPidLitackaProfileId();
  return getPidLitackaAuthProfiles().find(profile => profile.id === selectedId) || null;
}

function getPidLitackaIdentityValues() {
  const project = getPidLitackaProject();
  const authConfig = getProjectAuthConfig(project);
  const selectedProfile = getSelectedPidLitackaProfile();
  const savedValues = project ? loadSavedAuthFormValues(project) : {};

  if (!project || authConfig.type !== "login" || !selectedProfile) {
    return {};
  }

  if (selectedProfile.isNewProfile) {
    if (state.identityFormValues.__selectedProfileId !== selectedProfile.id) {
      state.identityFormValues = {
        __selectedProfileId: selectedProfile.id,
        ...createNewAuthProfileDraftValues()
      };
    }

    return { ...state.identityFormValues };
  }

  if (state.identityFormValues.__selectedProfileId !== selectedProfile.id) {
    state.identityFormValues = {
      ...savedValues,
      ...(selectedProfile.values || {}),
      __selectedProfileId: selectedProfile.id
    };
  }

  return {
    ...savedValues,
    ...(selectedProfile.values || {}),
    ...state.identityFormValues,
    __selectedProfileId: selectedProfile.id
  };
}

function findAuthProfileByIdentityId(identityId, authConfig = getProjectAuthConfig()) {
  const normalizedIdentityId = String(identityId || "").trim().toLowerCase();

  if (!normalizedIdentityId) {
    return null;
  }

  const profiles = authConfig?.type === "login"
    ? getAuthProfiles(authConfig)
    : getPidLitackaAuthProfiles();

  return profiles.find(profile => {
    if (profile.isNewProfile || profile.authRequest === "anonymous") {
      return false;
    }

    return getAuthProfileIdentityId(profile).toLowerCase() === normalizedIdentityId;
  }) || null;
}

function getSelectedAuthProfileId(authConfig = getProjectAuthConfig()) {
  const profiles = getAuthProfiles(authConfig);

  if (profiles.length === 0) {
    return "";
  }

  return state.authFormValues?.__selectedProfileId
    || profiles[0].id
    || "";
}

function getSelectedAuthProfile(authConfig = getProjectAuthConfig()) {
  const selectedProfileId = getSelectedAuthProfileId(authConfig);
  return getAuthProfiles(authConfig).find(profile => profile.id === selectedProfileId) || null;
}

function getAuthProfileNote(profile) {
  if (!profile?.id) {
    return "";
  }

  if (profile.isNewProfile) {
    return state.authFormValues?.__newProfileNote || "";
  }

  return state.authProfileNotes?.[profile.id] ?? profile.note ?? "";
}

function getActiveLoginRequestConfig(authConfig = getProjectAuthConfig()) {
  const loginConfig = authConfig?.login || null;

  if (!loginConfig) {
    return null;
  }

  const selectedProfile = getSelectedAuthProfile(authConfig);
  const requestKey = selectedProfile?.authRequest;

  if (requestKey && loginConfig[requestKey]) {
    return loginConfig[requestKey];
  }

  return loginConfig;
}

function isAuthFieldVisibleForProfile(field, profile = getSelectedAuthProfile()) {
  if (!field?.name) {
    return false;
  }

  const hiddenFields = new Set(profile?.hiddenFields || []);
  return !hiddenFields.has(field.name);
}

function loadSavedAuthFormValues(project) {
  if (!project?.id) {
    return {};
  }

  try {
    return JSON.parse(localStorage.getItem(getAuthFormStorageKey(project.id)) || "{}");
  } catch {
    return {};
  }
}

function loadSavedAuthProfileNotes(project) {
  if (!project?.id) {
    return {};
  }

  try {
    return JSON.parse(localStorage.getItem(getAuthProfileNotesStorageKey(project.id)) || "{}");
  } catch {
    return {};
  }
}

function loadSavedAuthCustomProfiles(project) {
  if (!project?.id) {
    return [];
  }

  try {
    const savedProfiles = JSON.parse(localStorage.getItem(getAuthCustomProfilesStorageKey(project.id)) || "[]");
    return Array.isArray(savedProfiles) ? savedProfiles : [];
  } catch {
    return [];
  }
}

function saveAuthFormValues() {
  if (!state.currentProject?.id) {
    return;
  }

  const authConfig = getProjectAuthConfig();
  const persistedValues = { ...(state.authFormValues || {}) };

  if (authConfig.type === "login") {
    const nonPersisted = new Set(
      (authConfig.login?.fields || [])
        .filter(field => field.persist === false || field.type === "password")
        .map(field => field.name));

    for (const name of nonPersisted) {
      delete persistedValues[name];
    }

    delete persistedValues.__profileNote;
    delete persistedValues.__newProfileNote;
  }

  localStorage.setItem(
    getAuthFormStorageKey(state.currentProject.id),
    JSON.stringify(persistedValues));

  if (authConfig.type === "jwt") {
    localStorage.setItem(getAuthTokenStorageKey(state.currentProject.id), state.authFormValues.jwtToken || "");
  }
}

function syncAuthFormValuesFromDom() {
  if (!elements.authForm) {
    return;
  }

  const fields = elements.authForm.querySelectorAll("input[name], select[name], textarea[name]");
  fields.forEach(field => {
    if (!field.name) {
      return;
    }

    if (field.type === "checkbox") {
      state.authFormValues[field.name] = field.checked;
      return;
    }

    state.authFormValues[field.name] = field.value;
  });
}

function saveAuthCustomProfiles() {
  if (!state.currentProject?.id) {
    return;
  }

  localStorage.setItem(
    getAuthCustomProfilesStorageKey(state.currentProject.id),
    JSON.stringify(state.authCustomProfiles || []));
}

function saveAuthProfileNotes() {
  if (!state.currentProject?.id) {
    return;
  }

  localStorage.setItem(
    getAuthProfileNotesStorageKey(state.currentProject.id),
    JSON.stringify(state.authProfileNotes || {}));
}

function loadSavedAuthSession(project, environmentId) {
  if (!project?.id) {
    return null;
  }

  try {
    return JSON.parse(localStorage.getItem(getAuthSessionStorageKey(project.id, environmentId)) || "null");
  } catch {
    return null;
  }
}

function saveAuthSession() {
  if (!state.currentProject?.id || !state.currentEnvironmentId) {
    return;
  }

  const key = getAuthSessionStorageKey(state.currentProject.id, state.currentEnvironmentId);

  if (state.authSession) {
    localStorage.setItem(key, JSON.stringify(state.authSession));
  } else {
    localStorage.removeItem(key);
  }
}

function loadProjectAuth(project) {
  const authConfig = getProjectAuthConfig(project);
  state.authFormValues = loadSavedAuthFormValues(project);
  state.authProfileNotes = loadSavedAuthProfileNotes(project);
  state.authCustomProfiles = loadSavedAuthCustomProfiles(project);
  state.authSession = loadSavedAuthSession(project, state.currentEnvironmentId);

  if (authConfig.type === "jwt" && !state.authFormValues.jwtToken) {
    state.authFormValues.jwtToken = project?.id
      ? (localStorage.getItem(getAuthTokenStorageKey(project.id)) || "")
      : "";
  }

  applyAuthFieldDefaults(authConfig);

  renderAuthPanel();
}

function applyAuthFieldDefaults(authConfig) {
  if (authConfig.type === "login") {
    const profiles = getAuthProfiles(authConfig);
    const selectedProfileExists = profiles.some(profile => profile.id === state.authFormValues.__selectedProfileId);

    if ((!state.authFormValues.__selectedProfileId || !selectedProfileExists) && profiles.length > 0) {
      state.authFormValues.__selectedProfileId = profiles[0].id;
    }

    const selectedProfile = getSelectedAuthProfile(authConfig);

    if (selectedProfile?.values) {
      for (const [name, value] of Object.entries(selectedProfile.values)) {
        if ((state.authFormValues?.[name] ?? "") === "" && value !== undefined) {
          state.authFormValues[name] = value;
        }
      }
    }

    for (const field of authConfig.login?.fields || []) {
      if ((state.authFormValues?.[field.name] ?? "") === "" && field.value !== undefined) {
        state.authFormValues[field.name] = field.value;
      }
    }
  } else if (authConfig.type === "jwt") {
    if ((state.authFormValues?.jwtToken ?? "") === "" && authConfig.jwtDefaultValue) {
      state.authFormValues.jwtToken = authConfig.jwtDefaultValue;
    }
  }
}

function applyAuthProfileSelection(profileId, options = {}) {
  const authConfig = getProjectAuthConfig();
  const profile = getAuthProfiles(authConfig).find(item => item.id === profileId);

  if (!profile) {
    return;
  }

  state.authFormValues.__selectedProfileId = profile.id;

  if (profile.isNewProfile) {
    const draftValues = createNewAuthProfileDraftValues();
    for (const field of authConfig.login?.fields || []) {
      delete state.authFormValues[field.name];
    }

    Object.assign(state.authFormValues, draftValues);
    return;
  }

  for (const [name, value] of Object.entries(profile.values || {})) {
    if (options.overwrite || (state.authFormValues?.[name] ?? "") === "") {
      state.authFormValues[name] = value;
    }
  }

  saveAuthFormValues();
}

async function applyProjectEnvironment(project, environmentId) {
  if (!project) {
    return;
  }

  const environment = (project.environments || []).find(item => item.id === environmentId)
    || (project.environments || [])[0]
    || null;

  state.currentEnvironmentId = environment?.id || null;
  elements.environmentSelect.value = environment?.id || "";

  if (!environment) {
    renderTargetInfo();
    return;
  }

  localStorage.setItem(getEnvironmentStorageKey(project.id), environment.id);

  try {
    await updateHarnessProxyTarget(environment.targetBaseUrl);
    await loadHarnessMeta();
  } catch (error) {
    addLog("warn", "Přepnutí prostředí se nepodařilo", {
      projectId: project.id,
      environmentId: environment.id,
      targetBaseUrl: environment.targetBaseUrl,
      error: error instanceof Error ? error.message : String(error)
    });
  }

  state.authSession = loadSavedAuthSession(project, state.currentEnvironmentId);
  renderTargetInfo();
  renderAuthPanel();
}

function renderTargetInfo() {
  const rawBaseUrl = (elements.baseUrl.value || "").trim() || "/";
  const targetInfo = getEffectiveTargetInfo(rawBaseUrl);
  const environment = detectTargetEnvironment(targetInfo.environmentSource);
  elements.targetUrl.textContent = targetInfo.displayUrl;
  elements.targetHint.textContent = targetInfo.hint || "";
  elements.targetEnvironmentBadge.textContent = environment.label;
  elements.targetEnvironmentBadge.className = `target-environment ${environment.kind}`;
}

function renderAuthPanel() {
  const authConfig = getProjectAuthConfig();
  const activeLoginConfig = getActiveLoginRequestConfig(authConfig);
  elements.authPanelTitle.textContent = authConfig.panelTitle || (authConfig.type === "login"
    ? "Přihlášení"
    : authConfig.type === "apiKey"
      ? "Přístup (API klíč)"
      : "Přístup (JWT)");
  renderAuthForm();
  renderAuthPanelStatus();
  elements.authLoginAction.textContent = activeLoginConfig?.buttonText || authConfig.login?.buttonText || (authConfig.type === "login" ? "Přihlásit" : "Uložit");
  elements.authRefreshAction.textContent = authConfig.refresh?.buttonText || "Obnovit";
  elements.authSessionRenewAction.textContent = authConfig.sessionRenew?.buttonText || "Obnovit MOS session";
  elements.authLogoutAction.textContent = authConfig.logout?.buttonText || "Odhlásit";
  elements.authResetAction.textContent = authConfig.type === "login" ? "Vymazat" : "Vyčistit";
  elements.authLoginAction.disabled = !["login", "jwt", "apiKey"].includes(authConfig.type);
  elements.authRefreshAction.disabled = !(authConfig.type === "login" && authConfig.refresh && state.authSession?.refreshToken);
  elements.authSessionRenewAction.disabled = !(authConfig.type === "login" && authConfig.sessionRenew && state.authSession?.accessToken && !state.authSession?.isAnonymous);
  elements.authLogoutAction.disabled = !(authConfig.type === "login" && authConfig.logout && state.authSession?.accessToken);
  renderIdentityActions(authConfig);
}

function renderIdentityActions(authConfig = getProjectAuthConfig()) {
  if (!elements.identityLoginAction) {
    return;
  }

  const project = getPidLitackaProject();
  const pidAuthConfig = getProjectAuthConfig(project);
  const session = project ? loadSavedAuthSession(project, getPidLitackaEnvironmentId(project)) : null;

  elements.identityLoginAction.disabled = !(project && pidAuthConfig.type === "login");
  elements.identityRefreshAction.disabled = !(project && pidAuthConfig.refresh && session?.refreshToken);
  elements.identityRenewMosAction.disabled = !(project && pidAuthConfig.sessionRenew && session?.accessToken && !session?.isAnonymous);
  elements.identityLogoutAction.disabled = !(project && pidAuthConfig.logout && session?.accessToken);
}

async function applyIdentityProfileSelection(profileId) {
  const project = getPidLitackaProject();
  const profile = getPidLitackaAuthProfiles().find(item => item.id === profileId);

  if (!project || !profile) {
    return;
  }

  if (state.currentProject?.id === project.id) {
    applyAuthProfileSelection(profile.id, { overwrite: true });
    state.identityFormValues = {
      ...state.authFormValues,
      __selectedProfileId: profile.id
    };
    return;
  }

  const authConfig = getProjectAuthConfig(project);
  const formValues = loadSavedAuthFormValues(project);
  formValues.__selectedProfileId = profile.id;

  if (profile.isNewProfile) {
    Object.assign(formValues, createNewAuthProfileDraftValues());
  } else {
    for (const [name, value] of Object.entries(profile.values || {})) {
      if (value !== undefined) {
        formValues[name] = value;
      }
    }
  }

  state.identityFormValues = { ...formValues };
  saveAuthFormValuesForProject(project, authConfig, formValues);
}

function saveAuthFormValuesForProject(project, authConfig, formValues) {
  const persistedValues = { ...(formValues || {}) };

  if (authConfig.type === "login") {
    const nonPersisted = new Set(
      (authConfig.login?.fields || [])
        .filter(field => field.persist === false || field.type === "password")
        .map(field => field.name));

    for (const name of nonPersisted) {
      delete persistedValues[name];
    }

    delete persistedValues.__profileNote;
    delete persistedValues.__newProfileNote;
  }

  localStorage.setItem(getAuthFormStorageKey(project.id), JSON.stringify(persistedValues));
}

function saveIdentityFormValues() {
  const project = getPidLitackaProject();

  if (!project) {
    return;
  }

  saveAuthFormValuesForProject(project, getProjectAuthConfig(project), state.identityFormValues);
}

function getIdentityProfileLabel(profile, values = {}) {
  const email = String(values.email || profile?.label || "").trim();
  const device = String(values.deviceName || values.deviceId || "").trim();

  if (!email) {
    return profile?.label || "Novy uzivatel";
  }

  return device ? `${email} / ${device}` : email;
}

function handleIdentityProfileFieldInput(event) {
  const target = event.target;

  if (!target?.name) {
    return;
  }

  state.identityFormValues = {
    ...getPidLitackaIdentityValues(),
    [target.name]: target.value
  };

  saveIdentityFormValues();
  renderIdentitySummary();
}

async function executeIdentityAuthAction(action) {
  const project = getPidLitackaProject();

  if (!project) {
    showRedisResult("error", "PidLitacka projekt neni dostupny.", "Nelze provest prihlaseni testovaci identity.");
    return;
  }

  if (state.currentProject?.id === project.id) {
    if (action === "login") {
      await executeAuthLogin();
    } else if (action === "refresh") {
      await executeAuthRefresh();
    } else if (action === "mos") {
      await executeAuthSessionRenew();
    } else if (action === "logout") {
      await executeAuthLogout();
    }
    renderRedisViewer();
    return;
  }

  await withPidLitackaIdentityContext(async authConfig => {
    if (action === "login") {
      await performAuthRequest("login", getActiveLoginRequestConfig(authConfig));
    } else if (action === "refresh") {
      await performAuthRequest("refresh", authConfig.refresh);
    } else if (action === "mos") {
      const result = await renewMosSessionIfPossible();
      if (!result.ok) {
        throw new Error(result.message);
      }
    } else if (action === "logout") {
      await executeAuthLogout();
    }
  });

  renderRedisViewer();
}

async function withPidLitackaIdentityContext(action) {
  const project = getPidLitackaProject();
  const environmentId = getPidLitackaEnvironmentId(project);
  const environment = project?.environments?.find(item => item.id === environmentId) || project?.environments?.[0] || null;
  const previous = {
    currentProject: state.currentProject,
    currentEnvironmentId: state.currentEnvironmentId,
    authSession: state.authSession,
    authFormValues: state.authFormValues,
    authProfileNotes: state.authProfileNotes,
    authCustomProfiles: state.authCustomProfiles,
    proxyTarget: state.harnessMeta?.proxyTarget || "",
    baseUrl: elements.baseUrl.value
  };

  try {
    state.currentProject = project;
    state.currentEnvironmentId = environmentId;
    state.authFormValues = {
      ...loadSavedAuthFormValues(project),
      ...getPidLitackaIdentityValues()
    };
    state.authProfileNotes = loadSavedAuthProfileNotes(project);
    state.authCustomProfiles = loadSavedAuthCustomProfiles(project);
    applyAuthFieldDefaults(getProjectAuthConfig(project));
    state.authSession = loadSavedAuthSession(project, environmentId);
    elements.baseUrl.value = project.defaultBaseUrl || "/api";

    if (environment?.targetBaseUrl) {
      await updateHarnessProxyTarget(environment.targetBaseUrl);
      await loadHarnessMeta();
    }

    return await action(getProjectAuthConfig(project));
  } finally {
    if (previous.proxyTarget) {
      await updateHarnessProxyTarget(previous.proxyTarget);
      await loadHarnessMeta();
    }

    state.currentProject = previous.currentProject;
    state.currentEnvironmentId = previous.currentEnvironmentId;
    state.authSession = previous.authSession;
    state.authFormValues = previous.authFormValues;
    state.authProfileNotes = previous.authProfileNotes;
    state.authCustomProfiles = previous.authCustomProfiles;
    elements.baseUrl.value = previous.baseUrl;
    renderAuthPanel();
    renderModeBanner();
  }
}

function renderAuthPanelStatus() {
  const info = getAuthorizationInfo();
  elements.authJwtStatus.textContent = info.message;
  elements.authJwtStatus.className = `auth-status ${info.level}`;
  elements.authJwtDetails.textContent = describeAuthorizationInfo(info);
  elements.authSummaryStatus.textContent = getAuthorizationSummary(info);
  elements.authSummaryStatus.className = `auth-summary-status ${info.level}`;
}

function getAuthorizationSummary(info) {
  const authConfig = getProjectAuthConfig();

  if (authConfig.type === "login") {
    if (info.valid && state.authSession?.isAnonymous) {
      return "Přihlášen: anonymní uživatel";
    }

    if (info.valid && state.authSession?.displayName) {
      return `Přihlášen: ${state.authSession.displayName}`;
    }

    if (info.valid && state.authSession?.email) {
      return `Přihlášen: ${state.authSession.email}`;
    }

    if (info.expired) {
      return "Přihlášení expirovalo";
    }

    return "Nepřihlášen";
  }

  if (authConfig.type === "apiKey") {
    return info.valid ? "API klíč připraven" : "API klíč chybí";
  }

  if (info.valid) {
    return "JWT připraven";
  }

  if (info.expired) {
    return "JWT expiroval";
  }

  return "JWT chybí";
}

function renderAuthForm() {
  const authConfig = getProjectAuthConfig();
  elements.authForm.innerHTML = "";

  if (authConfig.type === "login") {
    const profiles = getAuthProfiles(authConfig);

    if (profiles.length > 0) {
      elements.authForm.appendChild(createAuthProfileSelector(authConfig));
    }

    const selectedProfile = getSelectedAuthProfile(authConfig);

    for (const field of authConfig.login?.fields || []) {
      if (!isAuthFieldVisibleForProfile(field, selectedProfile)) {
        continue;
      }

      elements.authForm.appendChild(createAuthField(field));
    }

      return;
  }

  if (authConfig.type === "apiKey") {
    elements.authForm.appendChild(createAuthField({
      name: "apiKey",
      label: authConfig.apiKeyLabel || "API klíč",
      type: "password",
      placeholder: authConfig.apiKeyPlaceholder || "Vložte API klíč pro cílové API"
    }));
    return;
  }

  const field = {
    name: "jwtToken",
    label: authConfig.jwtLabel || "Bearer token",
    type: "textarea",
    rows: 4,
    placeholder: authConfig.jwtPlaceholder || "Vložte platný JWT bearer token"
  };
  elements.authForm.appendChild(createAuthField(field));
}

function createAuthProfileSelector(authConfig) {
  const wrapper = document.createElement("div");
  wrapper.className = "auth-profile-group";

  const selectWrapper = document.createElement("label");
  selectWrapper.className = "base-url";
  selectWrapper.textContent = "Testovací účet";

  const select = document.createElement("select");
  select.name = "__selectedProfileId";

  for (const profile of getAuthProfiles(authConfig)) {
    const option = document.createElement("option");
    option.value = profile.id;
    option.textContent = profile.custom
      ? `${profile.label || profile.id} (uložený)`
      : profile.label || profile.id;
    select.appendChild(option);
  }

  select.value = getSelectedAuthProfileId(authConfig);
  selectWrapper.appendChild(select);
  wrapper.appendChild(selectWrapper);

  const selectedProfile = getSelectedAuthProfile(authConfig);

  if (selectedProfile?.noteDisabled) {
    const hint = document.createElement("div");
    hint.className = "auth-profile-hint anonymous";
    hint.textContent = "Anonymní session bez e-mailu a hesla";
    wrapper.appendChild(hint);
    return wrapper;
  }

  if (selectedProfile?.isNewProfile) {
    const hint = document.createElement("div");
    hint.className = "auth-profile-hint new-profile";
    hint.textContent = "Nový účet se uloží do rychlého výběru až po úspěšném přihlášení.";
    wrapper.appendChild(hint);
  }

  const noteWrapper = document.createElement("label");
  noteWrapper.className = "base-url auth-profile-note";
  noteWrapper.textContent = "Poznámka k účtu";

  const noteInput = document.createElement("textarea");
  noteInput.name = "__profileNote";
  noteInput.rows = 3;
  noteInput.placeholder = "Např. má 3 uložená auta, 2 oblíbené zóny...";
  noteInput.value = getAuthProfileNote(selectedProfile);
  noteWrapper.appendChild(noteInput);
  wrapper.appendChild(noteWrapper);

  if (selectedProfile?.custom) {
    const removeButton = document.createElement("button");
    removeButton.type = "button";
    removeButton.className = "auth-remove-profile";
    removeButton.dataset.authProfileRemove = "true";
    removeButton.textContent = "Odebrat uživatele ze seznamu";
    removeButton.title = "Odebere jen lokální rychlý výběr v Klikátku. Účet v cílové aplikaci nemaže.";
    wrapper.appendChild(removeButton);
  }

  return wrapper;
}

function createAuthField(field) {
  const wrapper = document.createElement("label");
  wrapper.className = "base-url";
  wrapper.textContent = field.label;

  let input;
  if (field.type === "textarea") {
    input = document.createElement("textarea");
    input.rows = field.rows || 4;
  } else if (field.type === "select") {
    input = document.createElement("select");
    for (const option of field.options || []) {
      const optionElement = document.createElement("option");
      optionElement.value = String(option.value);
      optionElement.textContent = option.text;
      input.appendChild(optionElement);
    }
  } else {
    input = document.createElement("input");
    input.type = field.type || "text";
  }

  input.name = field.name;
  input.spellcheck = false;
  input.placeholder = field.placeholder || "";
  if (field.type !== "select") {
    input.value = state.authFormValues?.[field.name] ?? field.value ?? "";
  } else {
    input.value = String(state.authFormValues?.[field.name] ?? field.value ?? "");
  }

  wrapper.appendChild(input);
  return wrapper;
}

function handleAuthFormInput(event) {
  const target = event.target;
  if (!target?.name || !state.currentProject) {
    return;
  }

  if (target.name === "__selectedProfileId") {
    applyAuthProfileSelection(target.value, { overwrite: true });
    renderAuthPanel();
    renderModeBanner();
    return;
  }

  if (target.name === "__profileNote") {
    const selectedProfile = getSelectedAuthProfile();

    if (selectedProfile?.isNewProfile) {
      state.authFormValues.__newProfileNote = target.value;
      return;
    }

    const selectedProfileId = selectedProfile?.id;

    if (selectedProfileId) {
      state.authProfileNotes[selectedProfileId] = target.value;
      saveAuthProfileNotes();
    }

    return;
  }

  state.authFormValues[target.name] = target.value;
  if (getSelectedAuthProfile()?.isNewProfile) {
    renderAuthPanelStatus();
    renderModeBanner();
    return;
  }

  saveAuthFormValues();
  renderAuthPanelStatus();
  renderModeBanner();
}

function handleAuthFormClick(event) {
  const removeButton = event.target?.closest?.("[data-auth-profile-remove]");
  if (!removeButton) {
    return;
  }

  removeSelectedAuthProfile();
}

function removeSelectedAuthProfile() {
  const selectedProfile = getSelectedAuthProfile();

  if (!selectedProfile?.custom) {
    return;
  }

  state.authCustomProfiles = (state.authCustomProfiles || [])
    .filter(profile => profile.id !== selectedProfile.id);
  delete state.authProfileNotes[selectedProfile.id];
  saveAuthCustomProfiles();
  saveAuthProfileNotes();

  const firstProfile = getAuthProfiles().find(profile => !profile.custom && !profile.isNewProfile);
  if (firstProfile) {
    applyAuthProfileSelection(firstProfile.id, { overwrite: true });
  } else {
    state.authFormValues.__selectedProfileId = "";
    saveAuthFormValues();
  }

  renderAuthPanel();
  renderRedisViewer();
  renderModeBanner();
}

async function executeAuthLogin() {
  const authConfig = getProjectAuthConfig();

  if (authConfig.type === "jwt" || authConfig.type === "apiKey") {
    saveAuthFormValues();
    renderAuthPanelStatus();
    renderModeBanner();
    return;
  }

  if (authConfig.type !== "login" || !authConfig.login) {
    return;
  }

  await performAuthRequest("login", getActiveLoginRequestConfig(authConfig));
}

async function executeAuthRefresh() {
  const authConfig = getProjectAuthConfig();
  if (authConfig.type !== "login" || !authConfig.refresh) {
    return;
  }

  await performAuthRequest("refresh", authConfig.refresh);
}

async function executeAuthSessionRenew() {
  const authConfig = getProjectAuthConfig();
  if (authConfig.type !== "login" || !authConfig.sessionRenew) {
    return;
  }

  syncAuthFormValuesFromDom();
  const result = await renewMosSessionIfPossible();

  if (!result.ok) {
    elements.authJwtStatus.textContent = result.message || "MOS session se nepodarilo obnovit.";
    elements.authJwtStatus.className = "auth-status error";
    elements.authPanel.open = true;
    return;
  }

  elements.authJwtStatus.textContent = "MOS session obnovena. Kontroluji Redis...";
  elements.authJwtStatus.className = "auth-status ok";
  renderAuthPanelStatus();
  renderRedisViewer();

  if (state.authSession?.identityId) {
    state.redisIdentityId = state.authSession.identityId;
    state.redisIdentityManual = false;
    const session = await loadRedisSessionFromViewer({ quiet: true });

    if (!isUsableRedisSession(session)) {
      const key = `mos:session:user:${state.authSession.identityId}`;
      elements.authJwtStatus.textContent = `BE obnovu MOS session potvrdil, ale v Redis nebyl nalezen klíč ${key}.`;
      elements.authJwtStatus.className = "auth-status error";
      elements.authPanel.open = true;
      showRedisResult(
        "error",
        "MOS session po obnově není v Redis.",
        `Očekávaný klíč: ${key}`
      );
      return;
    }

    elements.authJwtStatus.textContent = `MOS session obnovena a nalezena v Redis pro ${state.authSession.identityId}.`;
    elements.authJwtStatus.className = "auth-status ok";
  }
}

async function executeAuthLogout() {
  const authConfig = getProjectAuthConfig();
  if (authConfig.type !== "login" || !authConfig.logout) {
    return;
  }

  try {
    await performAuthRequest("logout", authConfig.logout);
  } finally {
    state.authSession = null;
    saveAuthSession();
    renderAuthPanel();
    renderModeBanner();
  }
}

function resetAuthState() {
  if (!state.currentProject?.id) {
    return;
  }

  state.authFormValues = {};
  state.authProfileNotes = loadSavedAuthProfileNotes(state.currentProject);
  state.authCustomProfiles = loadSavedAuthCustomProfiles(state.currentProject);
  state.authSession = null;
  localStorage.removeItem(getAuthFormStorageKey(state.currentProject.id));
  localStorage.removeItem(getAuthTokenStorageKey(state.currentProject.id));
  if (state.currentEnvironmentId) {
    localStorage.removeItem(getAuthSessionStorageKey(state.currentProject.id, state.currentEnvironmentId));
  }
  applyAuthFieldDefaults(getProjectAuthConfig());
  renderAuthPanel();
  renderModeBanner();
}

async function performAuthRequest(kind, config) {
  syncAuthFormValuesFromDom();
  const request = buildAuthRequest(config);
  const startedAt = performance.now();

  try {
    const response = await fetch(request.url, request.options);
    const durationMs = Math.round(performance.now() - startedAt);
    const body = response.status === 204 ? null : await readResponseBody(response);

    if (!response.ok) {
      addLog("error", `Auth ${kind} failed`, {
        request: request.debug,
        response: {
          status: response.status,
          durationMs,
          body
        }
      });
      throw new Error(body?.detail || body?.title || `HTTP ${response.status}`);
    }

    if (kind === "login" || kind === "refresh") {
      updateSessionFromAuthResponse(body, config, kind);
      saveAuthSession();
    }

    if (kind === "login") {
      updateAuthProfileAfterSuccessfulLogin();
    }

    addLog("ok", `Auth ${kind} ok`, {
      request: request.debug,
      response: {
        status: response.status,
        durationMs,
        body
      }
    });
    renderAuthPanel();
    if (kind === "login" || kind === "refresh") {
      elements.authPanel.open = false;
    }
    renderModeBanner();
    return body;
  } catch (error) {
    elements.authJwtStatus.textContent = error instanceof Error ? error.message : String(error);
    elements.authJwtStatus.className = "auth-status error";
    elements.authPanel.open = true;
    throw error;
  }
}

function updateAuthProfileAfterSuccessfulLogin() {
  const selectedProfile = getSelectedAuthProfile();

  if (selectedProfile?.isNewProfile) {
    saveNewAuthProfileAfterSuccessfulLogin();
    return;
  }

  if (selectedProfile?.custom) {
    updateCustomAuthProfilePasswordAfterSuccessfulLogin(selectedProfile);
  }
}

function saveNewAuthProfileAfterSuccessfulLogin(options = {}) {
  const email = String(state.authFormValues?.email || "").trim();
  const password = String(state.authFormValues?.password || "");

  if (!email || !password) {
    return;
  }

  const note = String(options.note ?? state.authFormValues?.__newProfileNote ?? "").trim();
  const deviceId = String(state.authFormValues?.deviceId || "").trim();
  const idParts = [email, deviceId || String(Date.now())].join("-");
  const id = `custom-${idParts.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}-${Date.now()}`;
  const profile = {
    id,
    label: email,
    note,
    values: {
      email,
      password,
      identityId: state.authSession?.identityId || state.authFormValues?.identityId || "",
      deviceId: state.authFormValues?.deviceId || "",
      deviceName: state.authFormValues?.deviceName || "",
      platform: state.authFormValues?.platform || "",
      osVersion: state.authFormValues?.osVersion || "",
      appVersion: state.authFormValues?.appVersion || "",
      model: state.authFormValues?.model || "",
      deviceLanguage: state.authFormValues?.deviceLanguage || "",
      deviceMessagingToken: state.authFormValues?.deviceMessagingToken || ""
    }
  };

  const nextProfileKey = getAuthProfilePersistenceKey(profile);
  state.authCustomProfiles = [
    ...(state.authCustomProfiles || []).filter(item => getAuthProfilePersistenceKey(item) !== nextProfileKey),
    profile
  ];
  state.authProfileNotes[profile.id] = note;
  state.authFormValues.__selectedProfileId = profile.id;
  delete state.authFormValues.__newProfileNote;
  saveAuthCustomProfiles();
  saveAuthProfileNotes();
  saveAuthFormValues();
}

function updateCustomAuthProfilePasswordAfterSuccessfulLogin(selectedProfile) {
  const password = String(state.authFormValues?.password || "");
  const identityId = String(state.authSession?.identityId || state.authFormValues?.identityId || "").trim();
  const persistedFields = [
    "email",
    "deviceId",
    "deviceName",
    "platform",
    "osVersion",
    "appVersion",
    "model",
    "deviceLanguage",
    "deviceMessagingToken"
  ];

  const hasPersistedFieldValue = persistedFields.some(field => state.authFormValues?.[field] !== undefined);

  if (!password && !identityId && !hasPersistedFieldValue) {
    return;
  }

  let changed = false;
  state.authCustomProfiles = (state.authCustomProfiles || []).map(profile => {
    if (profile.id !== selectedProfile.id) {
      return profile;
    }

    const nextValues = {
      ...(profile.values || {})
    };
    let profileChanged = false;

    if (password && nextValues.password !== password) {
      nextValues.password = password;
      profileChanged = true;
    }

    if (identityId && nextValues.identityId !== identityId) {
      nextValues.identityId = identityId;
      profileChanged = true;
    }

    for (const field of persistedFields) {
      const value = state.authFormValues?.[field];
      if (value !== undefined && nextValues[field] !== value) {
        nextValues[field] = value;
        profileChanged = true;
      }
    }

    if (!profileChanged) {
      return profile;
    }

    changed = true;
    return {
      ...profile,
      values: nextValues
    };
  });

  if (changed) {
    saveAuthCustomProfiles();
  }
}

function buildAuthRequest(config) {
  const method = config.method || "POST";
  const path = resolveAuthTemplate(config.path || "");
  const headers = { ...(config.headers || {}) };
  const debugHeaders = { ...headers };
  let body;
  let visibleBody = null;

  if (config.attachAccessToken && state.authSession?.accessToken) {
    headers.Authorization = `Bearer ${state.authSession.accessToken}`;
    debugHeaders.Authorization = "Bearer ***";
  }

  if (config.body !== undefined) {
    const resolvedBody = resolveAuthValue(config.body);
    body = JSON.stringify(resolvedBody);
    visibleBody = resolvedBody;
    headers["Content-Type"] = "application/json";
  }

  const baseUrl = elements.baseUrl.value.replace(/\/$/, "");
  const url = `${baseUrl}${path}`;

  return {
    url,
    options: {
      method,
      headers,
      body
    },
    debug: {
      method,
      url,
      resolvedUrl: resolveDisplayedRequestUrl(url),
      headers: debugHeaders,
      body: visibleBody
    }
  };
}

function updateSessionFromAuthResponse(body, config, kind = "login") {
  const responseConfig = config.response || {};
  const accessTokenPath = responseConfig.accessTokenPath || "$.accessToken";
  const refreshTokenPath = responseConfig.refreshTokenPath || "$.refreshToken";
  const expiresAtPath = responseConfig.expiresAtPath || "$.expiresAt";
  const emailPath = responseConfig.emailPath || "$.email";
  const displayNamePath = responseConfig.displayNamePath || "$.displayName";
  const identityIdPath = responseConfig.identityIdPath || "$.identityId";
  const deviceIdField = responseConfig.deviceIdField || "deviceId";
  const isAnonymousSession = config.sessionKind === "anonymous" || (kind === "refresh" && Boolean(state.authSession?.isAnonymous));

  state.authSession = {
    accessToken: getPath(body, accessTokenPath) || state.authSession?.accessToken || "",
    refreshToken: getPath(body, refreshTokenPath) || state.authSession?.refreshToken || "",
    expiresAt: getPath(body, expiresAtPath) || state.authSession?.expiresAt || "",
    email: isAnonymousSession ? "" : (getPath(body, emailPath) || state.authSession?.email || ""),
    displayName: isAnonymousSession ? "" : (getPath(body, displayNamePath) || state.authSession?.displayName || ""),
    identityId: getPath(body, identityIdPath) || state.authSession?.identityId || "",
    deviceId: state.authFormValues?.[deviceIdField] || state.authSession?.deviceId || "",
    isAnonymous: isAnonymousSession
  };

  applyAuthSessionContext();
}

function getAuthProfilePersistenceKey(profile) {
  const email = String(profile?.values?.email || profile?.label || "").trim().toLowerCase();
  const deviceId = String(profile?.values?.deviceId || "").trim().toLowerCase();
  return `${email}|${deviceId}`;
}

function resolveAuthTemplate(template) {
  return String(template)
    .replace(/\{\{auth\.([a-zA-Z0-9_]+)\}\}/g, (_, name) => state.authFormValues?.[name] ?? "")
    .replace(/\{\{session\.([a-zA-Z0-9_]+)\}\}/g, (_, name) => state.authSession?.[name] ?? "");
}

function resolveAuthValue(value) {
  if (Array.isArray(value)) {
    return value.map(item => resolveAuthValue(item));
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, resolveAuthValue(item)]));
  }

  if (typeof value === "string") {
    return resolveAuthTemplate(value);
  }

  return value;
}

async function loadHarnessMeta() {
  try {
    state.harnessMeta = await fetchJson("/__harness/meta");
  } catch {
    state.harnessMeta = null;
  }
}

function getEffectiveTargetInfo(baseUrl) {
  const normalized = String(baseUrl || "").trim();
  const selectedEnvironment = (state.currentProject?.environments || [])
    .find(item => item.id === state.currentEnvironmentId);
  const expectedProxyTarget = String(selectedEnvironment?.targetBaseUrl || "").trim();
  const actualProxyTarget = String(state.harnessMeta?.proxyTarget || "").trim();

  if (normalized.startsWith("/") && actualProxyTarget) {
    const proxyTarget = actualProxyTarget.replace(/\/$/, "");
    const expectedTargetNormalized = expectedProxyTarget.replace(/\/$/, "");
    const isMismatch = expectedTargetNormalized && expectedTargetNormalized !== proxyTarget;

    return {
      displayUrl: `${normalized} -> ${proxyTarget}`,
      environmentSource: proxyTarget,
      hint: isMismatch
        ? `Běžící harness proxy teď míří na ${proxyTarget}, ale pro projekt ${state.currentProject?.name || ""} a prostředí ${selectedEnvironment?.name || ""} očekáváme ${expectedTargetNormalized}.`
        : "Browser volá lokální proxy. Harness požadavek přepošle na backend uvedený výše."
    };
  }

  if (normalized.startsWith("/") && expectedProxyTarget) {
    const expectedTargetNormalized = expectedProxyTarget.replace(/\/$/, "");

    return {
      displayUrl: `${normalized} -> ${expectedTargetNormalized} (očekáváno)`,
      environmentSource: expectedTargetNormalized,
      hint: "Skutečný proxy target se nepodařilo načíst z běžícího harnessu."
    };
  }

  return {
    displayUrl: normalized || "/",
    environmentSource: normalized || "/",
    hint: normalized.startsWith("http://") || normalized.startsWith("https://")
      ? "Browser volá backend přímo bez lokální proxy."
      : ""
  };
}

function resolveDisplayedRequestUrl(url) {
  const normalized = String(url || "").trim();

  if (normalized.startsWith("/api/") && state.harnessMeta?.proxyTarget) {
    const proxyTarget = String(state.harnessMeta.proxyTarget).replace(/\/$/, "");
    const relativePath = normalized.replace(/^\/api/, "");
    return `${proxyTarget}${relativePath}`;
  }

  return normalized;
}

function getCurrentJwtToken() {
  return String(state.authFormValues?.jwtToken || "").trim();
}

function getCurrentApiKey() {
  return String(state.authFormValues?.apiKey || "").trim();
}

function getAuthorizationInfo() {
  const authConfig = getProjectAuthConfig();

  if (authConfig.type === "login") {
    return getLoginSessionInfo();
  }

  if (authConfig.type === "apiKey") {
    return getApiKeyInfo();
  }

  return getJwtInfo(getCurrentJwtToken());
}

function getApiKeyInfo() {
  return getCurrentApiKey()
    ? {
        level: "ok",
        valid: true,
        expired: false,
        message: "API klíč je vyplněn."
      }
    : {
        level: "warn",
        valid: false,
        expired: false,
        message: "API klíč není vyplněn."
      };
}

function getJwtInfo(token) {
  const normalized = String(token || "").trim();

  if (!normalized) {
    return {
      level: "warn",
      valid: false,
      expired: false,
      message: "JWT není vyplněn."
    };
  }

  const claims = parseJwtClaims(normalized);

  if (!claims) {
    return {
      level: "error",
      valid: false,
      expired: false,
      message: "JWT se nepodařilo přečíst. Zkontrolujte formát tokenu."
    };
  }

  const expiresAtMs = typeof claims.exp === "number" ? claims.exp * 1000 : null;
  const expiresAt = expiresAtMs ? new Date(expiresAtMs) : null;
  const isExpired = expiresAt ? expiresAt.getTime() <= Date.now() : false;
  const subject = claims.sub ? ` sub ${claims.sub}` : "";
  const audience = Array.isArray(claims.aud) ? claims.aud.join(", ") : claims.aud;
  const issuer = claims.iss || "";
  const scope = claims.scope || "";
  const realmRoles = Array.isArray(claims.realm_access?.roles) ? claims.realm_access.roles.join(", ") : "";

  if (isExpired) {
    return {
      level: "error",
      valid: false,
      expired: true,
      claims,
      message: `JWT expiroval ${formatDate(expiresAt.toISOString())}.${subject}`
    };
  }

  return {
    level: "ok",
    valid: true,
    expired: false,
    claims,
    message: expiresAt
      ? `JWT je platný do ${formatDate(expiresAt.toISOString())}.${subject}${audience ? ` aud ${audience}` : ""}${issuer ? ` iss ${issuer}` : ""}${scope ? ` scope ${scope}` : ""}${realmRoles ? ` role ${realmRoles}` : ""}`
      : `JWT je vyplněn, ale neobsahuje claim exp.${subject}${audience ? ` aud ${audience}` : ""}${issuer ? ` iss ${issuer}` : ""}${scope ? ` scope ${scope}` : ""}${realmRoles ? ` role ${realmRoles}` : ""}`
  };
}

function getLoginSessionInfo() {
  if (!state.authSession?.accessToken) {
    return {
      level: "warn",
      valid: false,
      expired: false,
      message: "Nejste přihlášen."
    };
  }

  const tokenInfo = getJwtInfo(state.authSession.accessToken);
  const expiresAt = state.authSession.expiresAt || "";
  const userLabel = state.authSession.isAnonymous
    ? "anonymní uživatel"
    : (state.authSession.displayName || state.authSession.email || "");
  const refreshState = state.authSession.refreshToken ? "refresh token uložen" : "bez refresh tokenu";

  return {
    ...tokenInfo,
    message: tokenInfo.valid
      ? `Přihlášeno${userLabel ? ` jako ${userLabel}` : ""}. Access token platný do ${expiresAt ? formatDate(expiresAt) : "?"}. ${refreshState}.`
      : tokenInfo.expired
        ? `Přihlášení expirovalo${userLabel ? ` pro ${userLabel}` : ""}. ${refreshState}.`
        : tokenInfo.message,
    session: state.authSession
  };
}

function describeAuthorizationInfo(info) {
  if (getProjectAuthConfig().type === "login" && info?.session) {
    const session = info.session;
    const sessionLines = [
      session.email ? `e-mail: ${session.email}` : "",
      session.identityId ? `identityId: ${session.identityId}` : "",
      session.deviceId ? `deviceId: ${session.deviceId}` : ""
    ].filter(Boolean);

    return [describeJwtInfo(info), ...sessionLines].filter(Boolean).join("\n");
  }

  return describeJwtInfo(info);
}

function describeJwtInfo(info) {
  if (!info?.claims) {
    return "";
  }

  const claims = info.claims;
  const audience = Array.isArray(claims.aud) ? claims.aud.join(", ") : claims.aud;
  const issuer = claims.iss || "";
  const subject = claims.sub || "";
  const scope = claims.scope || "";
  const realmRoles = Array.isArray(claims.realm_access?.roles) ? claims.realm_access.roles.join(", ") : "";
  const clientRoles = Object.entries(claims.resource_access || {})
    .flatMap(([clientId, value]) => Array.isArray(value?.roles) ? value.roles.map(role => `${clientId}:${role}`) : [])
    .join(", ");

  return [
    subject ? `sub: ${subject}` : "",
    audience ? `aud: ${audience}` : "",
    issuer ? `iss: ${issuer}` : "",
    scope ? `scope: ${scope}` : "",
    realmRoles ? `realm role: ${realmRoles}` : "",
    clientRoles ? `client role: ${clientRoles}` : ""
  ].filter(Boolean).join("\n");
}

function parseJwtClaims(token) {
  try {
    const parts = String(token).split(".");

    if (parts.length < 2) {
      return null;
    }

    const base64 = parts[1]
      .replace(/-/g, "+")
      .replace(/_/g, "/")
      .padEnd(Math.ceil(parts[1].length / 4) * 4, "=");
    const json = atob(base64);
    return JSON.parse(json);
  } catch {
    return null;
  }
}

function hasUsableAuthorization() {
  const authConfig = getProjectAuthConfig();

  if (authConfig.type === "login") {
    if (state.authSession?.accessToken && !isSessionExpired(state.authSession)) {
      return true;
    }

    return Boolean(state.authSession?.refreshToken && authConfig.refresh);
  }

  if (authConfig.type === "apiKey") {
    return getCurrentApiKey() !== "";
  }

  return getJwtInfo(getCurrentJwtToken()).valid;
}

function hasRequiredAuthorizationFor(item) {
  if (!requiresAuthorization(item)) {
    return true;
  }

  if (!hasUsableAuthorization()) {
    return false;
  }

  if (requiresAnonymousAuth(item)) {
    return Boolean(state.authSession?.isAnonymous);
  }

  return true;
}

function requiresAuthorizationForStep(step) {
  return requiresAuthorization(step) || requiresAuthorization(state.scenario);
}

function requiresAnonymousAuthForStep(step) {
  return requiresAnonymousAuth(step) || requiresAnonymousAuth(state.scenario);
}

function isSessionExpired(session) {
  if (!session?.expiresAt) {
    return true;
  }

  const expiresAtMs = Date.parse(session.expiresAt);
  return !Number.isFinite(expiresAtMs) || expiresAtMs <= Date.now();
}

async function ensureAuthorizationReady() {
  const authConfig = getProjectAuthConfig();

  if (authConfig.type === "login") {
    if (state.authSession?.accessToken && !isSessionExpired(state.authSession)) {
      if (requiresAnonymousAuthForStep(currentStep()) && !state.authSession.isAnonymous) {
        return {
          ok: false,
          message: "Tento scénář vyžaduje anonymní přihlášení. V panelu Přihlášení vyberte Anonymní uživatel."
        };
      }

      return { ok: true };
    }

    if (state.authSession?.refreshToken && authConfig.refresh) {
      try {
        await performAuthRequest("refresh", authConfig.refresh);
        if (requiresAnonymousAuthForStep(currentStep()) && !state.authSession?.isAnonymous) {
          return {
            ok: false,
            message: "Tento scénář vyžaduje anonymní přihlášení. V panelu Přihlášení vyberte Anonymní uživatel."
          };
        }

        return { ok: true, refreshed: true };
      } catch (error) {
        return {
          ok: false,
          message: error instanceof Error ? error.message : String(error)
        };
      }
    }

    return { ok: false, message: "Nejste přihlášen." };
  }

  if (authConfig.type === "apiKey") {
    const info = getApiKeyInfo();
    return {
      ok: info.valid,
      message: info.message
    };
  }

  const info = getJwtInfo(getCurrentJwtToken());
  return {
    ok: info.valid,
    message: info.message
  };
}

function isMosSessionExpiredResponse(status, body) {
  const title = String(body?.title || "").toLowerCase();
  const detail = String(body?.detail || "").toLowerCase();

  return status === 401
    && (title.includes("mos session expired") || detail.includes("mos session"));
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function renewMosSessionIfPossible() {
  const authConfig = getProjectAuthConfig();
  const sessionConfig = authConfig?.sessionRenew;

  if (authConfig.type !== "login" || !sessionConfig || !state.authSession?.accessToken) {
    return {
      ok: false,
      message: "Backend oznámil vypršení MOS session, ale projekt nemá nastavenou její obnovu."
    };
  }

  if (state.authSession?.isAnonymous) {
    return {
      ok: false,
      message: "MOS session nelze obnovit pro anonymního uživatele. Přihlaste se běžným účtem."
    };
  }

  const email = String(state.authFormValues?.email || state.authSession?.email || "").trim();
  const password = String(state.authFormValues?.password || "");

  if (!email || !password) {
    return {
      ok: false,
      message: "MOS session vypršela. Pro její obnovu je potřeba e-mail a heslo v panelu Přihlášení."
    };
  }

  try {
    const body = await performAuthRequest("session", sessionConfig);
    const status = String(body?.status || "").toUpperCase();

    if (status === "LOCK_BUSY") {
      const retryAfterMs = Number(body?.retryAfterMs || 500);
      await delay(Math.max(100, retryAfterMs));
      await performAuthRequest("session", sessionConfig);
    }

    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : String(error)
    };
  }
}

function detectTargetEnvironment(baseUrl) {
  const normalized = String(baseUrl || "").trim();

  if (!normalized) {
    return { kind: "unknown", label: "UNKNOWN" };
  }

  if (normalized.startsWith("/")) {
    return { kind: "relative", label: "RELATIVE" };
  }

  try {
    const url = new URL(normalized);
    const host = url.hostname.toLowerCase();
    const full = url.href.toLowerCase();

    if (host === "localhost" || host === "127.0.0.1" || host === "::1") {
      return { kind: "local", label: "LOCAL" };
    }

    if (full.includes(".int.") || host.startsWith("int.") || full.includes("integration")) {
      return { kind: "int", label: "INT" };
    }

    if (full.includes("pre-parking") || host.startsWith("pre.") || host.startsWith("pre-")) {
      return { kind: "int", label: "PRE" };
    }

    if (full.includes("test") || full.includes("stage") || full.includes("staging") || full.includes("uat") || full.includes("dev")) {
      return { kind: "test", label: "TEST" };
    }

    return { kind: "prod", label: "PROD" };
  } catch {
    return { kind: "unknown", label: "UNKNOWN" };
  }
}

function activateLeftTab(tab) {
  const showScenarios = tab === "scenarios";
  const showSmoke = tab === "smoke";
  const showForms = tab === "forms";
  const showWorkflows = tab === "workflows";
  const showRedis = tab === "redis";
  document.querySelector(".scenario-panel")?.classList.toggle("identity-tab-active", showRedis);

  elements.scenariosTab.classList.toggle("active", showScenarios);
  elements.smokeTab.classList.toggle("active", showSmoke);
  elements.formsTab.classList.toggle("active", showForms);
  elements.workflowsTab.classList.toggle("active", showWorkflows);
  elements.redisTab.classList.toggle("active", showRedis);
  elements.scenariosTab.setAttribute("aria-selected", String(showScenarios));
  elements.smokeTab.setAttribute("aria-selected", String(showSmoke));
  elements.formsTab.setAttribute("aria-selected", String(showForms));
  elements.workflowsTab.setAttribute("aria-selected", String(showWorkflows));
  elements.redisTab.setAttribute("aria-selected", String(showRedis));
  elements.scenariosPane.classList.toggle("active", showScenarios);
  elements.smokePane.classList.toggle("active", showSmoke);
  elements.formsPane.classList.toggle("active", showForms);
  elements.workflowsPane.classList.toggle("active", showWorkflows);
  elements.redisPane.classList.toggle("active", showRedis);
}

function activateRightTab(tab) {
  const showTester = tab === "tester";

  elements.testerTab.classList.toggle("active", showTester);
  elements.logTab.classList.toggle("active", !showTester);
  elements.testerTab.setAttribute("aria-selected", String(showTester));
  elements.logTab.setAttribute("aria-selected", String(!showTester));
  elements.testerPane.classList.toggle("active", showTester);
  elements.logPane.classList.toggle("active", !showTester);
}

function initResizablePanels() {
  const savedLeft = Number(localStorage.getItem("demoHarness.leftPanelWidth"));
  const savedRight = Number(localStorage.getItem("demoHarness.rightPanelWidth"));
  const defaultLeft = 300;
  const defaultRight = 430;
  const maxSideWidth = Math.max(320, Math.floor(window.innerWidth * 0.42));

  setPanelWidth(
    "left",
    Number.isFinite(savedLeft) && savedLeft >= 240
      ? clamp(savedLeft, 240, Math.max(240, maxSideWidth))
      : defaultLeft);

  setPanelWidth(
    "right",
    Number.isFinite(savedRight) && savedRight >= 320
      ? clamp(savedRight, 320, Math.max(320, maxSideWidth))
      : defaultRight);

  document.querySelectorAll(".resize-handle").forEach(handle => {
    handle.addEventListener("dblclick", () => {
      localStorage.removeItem("demoHarness.leftPanelWidth");
      localStorage.removeItem("demoHarness.rightPanelWidth");
      setPanelWidth("left", 300);
      setPanelWidth("right", 430);
    });

    handle.addEventListener("pointerdown", event => {
      event.preventDefault();
      const side = handle.dataset.resize;
      const startX = event.clientX;
      const startLeft = getPanelWidth("left");
      const startRight = getPanelWidth("right");

      handle.setPointerCapture(event.pointerId);
      handle.classList.add("dragging");

      const onMove = moveEvent => {
        const delta = moveEvent.clientX - startX;

        if (side === "left") {
          setPanelWidth("left", clamp(startLeft + delta, 240, 520));
        } else {
          setPanelWidth("right", clamp(startRight - delta, 320, 760));
        }
      };

      const onUp = () => {
        handle.classList.remove("dragging");
        localStorage.setItem("demoHarness.leftPanelWidth", String(getPanelWidth("left")));
        localStorage.setItem("demoHarness.rightPanelWidth", String(getPanelWidth("right")));
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
      };

      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
    });
  });
}

function setPanelWidth(side, width) {
  document.documentElement.style.setProperty(
    side === "left" ? "--left-panel-width" : "--right-panel-width",
    `${Math.round(width)}px`);
}

function getPanelWidth(side) {
  const value = getComputedStyle(document.documentElement)
    .getPropertyValue(side === "left" ? "--left-panel-width" : "--right-panel-width")
    .trim();

  return Number.parseInt(value, 10);
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function renderFormList() {
  elements.formList.innerHTML = "";
  renderTagFilters(elements.formCategoryFilters, state.forms, state.formCategory, category => {
    state.formCategory = category;
    renderFormList();
  });

  const items = filterCatalogItems(state.forms, state.formSearch, state.formCategory, buildFormSearchText);
  renderFlatCatalog(elements.formList, items, form => createFormCard(form), "Nenalezen \u017e\u00e1dn\u00fd formul\u00e1\u0159 pro zadan\u00fd filtr.");
}

function collectForms() {
  const forms = [];
  const seen = new Set();

  for (const scenario of state.catalog.scenarios) {
    for (const step of scenario.steps) {
      if (!step.request?.path) {
        continue;
      }

      const key = [
        step.request.method || "GET",
        step.request.path,
        step.request.contentType || "application/json",
        JSON.stringify(step.request.body || {}),
        JSON.stringify(step.request.headers || {})
      ].join("|");

      if (seen.has(key)) {
        continue;
      }

      seen.add(key);
      forms.push({
        id: `form-${forms.length + 1}`,
        scenarioId: scenario.id,
        scenarioTitle: scenario.title,
        description: step.description || scenario.description || "",
        manualInputRequired: requiresManualInput(scenario) || requiresManualInput(step),
        requiresAuth: requiresAuthorization(scenario) || requiresAuthorization(step),
        requiresAnonymousAuth: requiresAnonymousAuth(scenario) || requiresAnonymousAuth(step),
        tags: deriveScenarioTags({
          id: step.id,
          title: step.title,
          description: step.description || "",
          tags: scenario.tags || [],
          steps: [step]
        }),
        step
      });
    }
  }

  return forms;
}

function renderScenarioList() {
  elements.scenarioList.innerHTML = "";
  const scenarios = state.catalog.scenarios
    .filter(scenario => scenario.formsOnly !== true)
    .map(scenario => ({
      ...scenario,
      tags: deriveScenarioTags(scenario)
    }));

  renderTagFilters(elements.scenarioCategoryFilters, scenarios, state.scenarioCategory, category => {
    state.scenarioCategory = category;
    renderScenarioList();
  });

  const items = filterCatalogItems(scenarios, state.scenarioSearch, state.scenarioCategory, buildScenarioSearchText);
  renderFlatCatalog(elements.scenarioList, items, scenario => createScenarioCard(scenario), "Nenalezen \u017e\u00e1dn\u00fd sc\u00e9n\u00e1\u0159 pro zadan\u00fd filtr.");
}

function initializeSmokeResults() {
  state.smokeResults = Object.fromEntries(
    state.catalog.scenarios.map(scenario => [scenario.id, createIdleSmokeResult(scenario)]));
}

function createIdleSmokeResult(scenario) {
  return {
    id: scenario.id,
    title: scenario.title,
    state: "idle",
    currentStepIndex: null,
    totalSteps: scenario.steps.length,
    failedSteps: [],
    warningSteps: [],
    detailLines: []
  };
}

function renderSmokeList() {
  elements.smokeList.innerHTML = "";
  elements.smokeList.className = "scenario-list smoke-list";
  renderScenarioSelectionSummary();

  for (const scenario of state.catalog.scenarios) {
    elements.smokeList.appendChild(createSmokeCard(scenario));
  }
}

function renderRedisViewer() {
  if (!elements.redisBridgeUrl) {
    return;
  }

  elements.redisBridgeUrl.value = state.redisBridgeUrl || "/__redis";

  const currentPidLitackaIdentityId = getCurrentPidLitackaIdentityId();
  if (!state.redisIdentityManual && currentPidLitackaIdentityId) {
    state.redisIdentityId = currentPidLitackaIdentityId;
  } else if (!state.redisIdentityId && currentPidLitackaIdentityId) {
    state.redisIdentityId = currentPidLitackaIdentityId;
  }

  elements.redisIdentityId.value = state.redisIdentityId || "";
  elements.redisUseSession.disabled = !isUsableRedisSession(state.redisLastSession);
  renderIdentityProfileSelect();
  renderIdentitySummary();
  renderRedisHealthStatus();
  checkRedisHealth();
}

function renderIdentityProfileSelect() {
  if (!elements.identityProfileSelect) {
    return;
  }

  const profiles = getPidLitackaAuthProfiles();

  if (profiles.length === 0) {
    elements.identityProfileSelect.innerHTML = "";
    elements.identityProfileSelect.disabled = true;
    return;
  }

  elements.identityProfileSelect.disabled = false;
  elements.identityProfileSelect.innerHTML = "";

  for (const profile of profiles) {
    const option = document.createElement("option");
    option.value = profile.id;
    const label = getIdentityProfileLabel(profile, profile.values || {});
    option.textContent = profile.custom
      ? `${label} (ulozeny)`
      : label;
    elements.identityProfileSelect.appendChild(option);
  }

  elements.identityProfileSelect.value = getSelectedPidLitackaProfileId();
  renderIdentityProfileFields();
}

function renderIdentityProfileFields() {
  if (!elements.identityProfileFields) {
    return;
  }

  const project = getPidLitackaProject();
  const authConfig = getProjectAuthConfig(project);
  const profile = getSelectedPidLitackaProfile();
  const values = getPidLitackaIdentityValues();

  elements.identityProfileFields.innerHTML = "";

  if (!project || authConfig.type !== "login" || !profile) {
    return;
  }

  const fields = (authConfig.login?.fields || []).filter(field => isAuthFieldVisibleForProfile(field, profile));

  if (profile.isNewProfile) {
    const noteField = createIdentityProfileField({
      name: "__newProfileNote",
      label: "Poznamka",
      placeholder: "Např. nový účet pro test přesunu kupónů"
    }, values);
    elements.identityProfileFields.appendChild(noteField);
  }

  for (const field of fields) {
    elements.identityProfileFields.appendChild(createIdentityProfileField(field, values));
  }
}

function createIdentityProfileField(field, values) {
  const wrapper = document.createElement("label");
  wrapper.className = "base-url identity-profile-field";
  wrapper.textContent = field.label;

  let input;
  if (field.type === "textarea") {
    input = document.createElement("textarea");
    input.rows = field.rows || 3;
  } else if (field.type === "select") {
    input = document.createElement("select");
    for (const option of field.options || []) {
      const optionElement = document.createElement("option");
      optionElement.value = String(option.value);
      optionElement.textContent = option.text;
      input.appendChild(optionElement);
    }
  } else {
    input = document.createElement("input");
    input.type = field.type || "text";
  }

  input.name = field.name;
  input.spellcheck = false;
  input.placeholder = field.placeholder || "";
  input.value = String(values?.[field.name] ?? field.value ?? "");
  wrapper.appendChild(input);
  return wrapper;
}

function renderIdentitySummary() {
  if (!elements.identitySummary) {
    return;
  }

  const project = getPidLitackaProject();
  const profile = getSelectedPidLitackaProfile();
  const values = getPidLitackaIdentityValues();
  const session = project ? loadSavedAuthSession(project, getPidLitackaEnvironmentId(project)) : null;
  const tokenInfo = session?.accessToken ? getJwtInfo(session.accessToken) : { valid: false, message: "Nejste prihlasen." };
  const identityId = String(session?.identityId || state.redisIdentityId || "").trim();
  const redisSession = state.redisLastSession;
  const hasMosSession = isUsableRedisSession(redisSession);
  const mosSessionId = String(redisSession?.sessionId || redisSession?.payload?.sessionId || redisSession?.payload?.SessionId || "").trim();
  const ttl = Number(redisSession?.ttlSeconds);
  const ttlText = Number.isFinite(ttl) && ttl >= 0 ? `${ttl} s` : "-";
  const expiresAtText = session?.expiresAt ? formatDate(session.expiresAt) : "-";
  const profileLabel = profile?.isNewProfile
    ? "Novy uzivatel"
    : getIdentityProfileLabel(profile, values) || session?.email || "Nezvoleno";
  const authState = tokenInfo.valid
    ? (session?.isAnonymous ? "Anonymni session" : "BE JWT aktivni")
    : tokenInfo.message || "Neprihlasen";
  const mosState = hasMosSession
    ? `MOS SessionID aktivni, TTL ${ttlText}`
    : `MOS SessionID chybi${redisSession ? ` (${getRedisSessionProblem(redisSession) || "nepouzitelne"})` : ""}`;

  elements.identitySummary.innerHTML = `
    <div class="identity-summary-row">
      <span>Ucet</span>
      <strong>${escapeHtml(profileLabel)}</strong>
    </div>
    <div class="identity-summary-row">
      <span>BE PidLitacka</span>
      <strong class="${tokenInfo.valid ? "ok" : "warn"}">${escapeHtml(authState)}</strong>
    </div>
    <div class="identity-summary-row">
      <span>Platnost JWT</span>
      <code>${escapeHtml(expiresAtText)}</code>
    </div>
    <div class="identity-summary-row">
      <span>IdentityId</span>
      <code>${escapeHtml(identityId || "-")}</code>
    </div>
    <div class="identity-summary-row">
      <span>Zarizeni</span>
      <code>${escapeHtml(values.deviceName || "-")}</code>
    </div>
    <div class="identity-summary-row">
      <span>Device ID</span>
      <code>${escapeHtml(values.deviceId || "-")}</code>
    </div>
    <div class="identity-summary-row">
      <span>MOS</span>
      <strong class="${hasMosSession ? "ok" : "warn"}">${escapeHtml(mosState)}</strong>
    </div>
    <div class="identity-summary-row">
      <span>SessionID</span>
      <code>${escapeHtml(mosSessionId ? maskSessionId(mosSessionId) : "-")}</code>
    </div>
  `;
}

function renderRedisHealthStatus() {
  if (!elements.redisStatus) {
    return;
  }

  if (state.redisHealth?.ok) {
    const redis = state.redisHealth.body?.redis;
    elements.redisStatus.textContent = redis?.host
      ? `Připojeno: ${redis.host}:${redis.port ?? ""}`.replace(/:$/, "")
      : "Připojeno";
    return;
  }

  elements.redisStatus.textContent = state.redisHealth?.checked ? "Nepřipojeno" : "Ověřuji...";
}

async function checkRedisHealth() {
  if (state.redisHealthCheckRunning) {
    return;
  }

  state.redisHealthCheckRunning = true;
  try {
    const body = await fetchRedisBridgeJson("/health");
    state.redisHealth = {
      checked: true,
      ok: String(body?.status || "").toUpperCase() === "OK",
      body
    };
  } catch (error) {
    state.redisHealth = {
      checked: true,
      ok: false,
      message: error instanceof Error ? error.message : String(error)
    };
  } finally {
    state.redisHealthCheckRunning = false;
    renderRedisHealthStatus();
  }
}

async function loadRedisSessionFromViewer(options = {}) {
  const identityId = getRedisViewerIdentityId();

  if (!identityId) {
    if (options.quiet) {
      return null;
    }
    showRedisResult("error", "Chybí identityId.", "Přihlaste se do BE PidLitacka nebo identityId vyplňte ručně.");
    return null;
  }

  try {
    if (!options.quiet) {
      showRedisResult("warn", "Načítám Redis session...", identityId);
    }
    await checkRedisHealth();
    const session = await fetchRedisSession(identityId);
    state.redisLastSession = session;
    renderRedisSession(session, options.note || "");
    return session;
  } catch (error) {
    state.redisLastSession = null;
    if (!options.quiet) {
      showRedisResult("error", "Redis bridge neodpověděl.", error instanceof Error ? error.message : String(error));
    }
    return null;
  }

}

function useRedisSessionFromViewer() {
  const sessionId = state.redisLastSession?.sessionId;

  if (!isUsableRedisSession(state.redisLastSession)) {
    showRedisResult("error", "SessionID není k dispozici.", "Nejprve načtěte existující MOS session z Redis.");
    return;
  }

  state.context.mosCouponSessionId = sessionId;
  state.workflowContext.mosCouponSessionId = sessionId;
  renderContext();
  addLog("ok", "Redis MOS session applied manually", {
    key: state.redisLastSession.key,
    ttlSeconds: state.redisLastSession.ttlSeconds,
    contextKey: "mosCouponSessionId"
  });
  renderRedisSession(state.redisLastSession, "SessionID bylo vloženo do kontextu jako mosCouponSessionId.");
}

async function scanRedisSessionsFromViewer() {
  try {
    showRedisResult("warn", "Hledám MOS session klíče...", "pattern: mos:session:user:*");
    await checkRedisHealth();
    const body = await fetchRedisBridgeJson(`/scan?pattern=${encodeURIComponent("mos:session:user:*")}&count=50`);
    const items = await Promise.all((body.keys || []).map(async key => {
      const identityId = getIdentityIdFromRedisKey(key);
      let session = null;
      let error = "";

      try {
        session = identityId ? await fetchRedisSession(identityId) : null;
      } catch (sessionError) {
        error = sessionError instanceof Error ? sessionError.message : String(sessionError);
      }

      return {
        key,
        identityId,
        session,
        error,
        profile: findAuthProfileByIdentityId(identityId)
      };
    }));

    showRedisResult("ok", `Nalezeno ${body.keys?.length || 0} session klíčů`, `
      <div class="redis-key-list">
        ${items.map(renderRedisSessionSearchItem).join("")}
      </div>
    `, { html: true });

    renderRedisViewer();
    elements.redisResult.querySelectorAll("[data-redis-key]").forEach(button => {
      button.addEventListener("click", () => {
        const key = button.dataset.redisKey || "";
        const identityId = getIdentityIdFromRedisKey(key);
        state.redisIdentityId = identityId;
        state.redisIdentityManual = true;
        renderRedisViewer();
        loadRedisSessionFromViewer();
      });
    });
    elements.redisResult.querySelectorAll("[data-auth-profile-id]").forEach(button => {
      button.addEventListener("click", async () => {
        const profileId = button.dataset.authProfileId || "";
        const identityId = button.dataset.identityId || "";
        const key = button.dataset.redisProfileKey || "";
        state.redisIdentityId = identityId;
        state.redisIdentityManual = true;
        applyAuthProfileSelection(profileId, { overwrite: true });
        renderAuthPanel();
        renderRedisViewer();
        await loadRedisSessionFromViewer({
          quiet: true,
          note: `Zvolen ulozeny ucet pro ${key}.`
        });

        try {
          await executeAuthLogin();
          showRedisResult("ok", "Ucet zvolen a prihlasen", `Profil byl zvolen podle ${key}. BE JWT je obnovene, MOS session se pouzije z Redis.`);
        } catch (error) {
          showRedisResult("error", "Ucet zvolen, prihlaseni selhalo", error instanceof Error ? error.message : String(error));
        }
      });
    });
  } catch (error) {
    showRedisResult("error", "Redis scan selhal.", error instanceof Error ? error.message : String(error));
  }
}

async function fetchRedisSession(identityId) {
  return await fetchRedisBridgeJson(`/session/${encodeURIComponent(identityId)}`);
}

function renderRedisSessionSearchItem(item) {
  const session = item.session || {};
  const usable = isUsableRedisSession(session);
  const problem = item.error || getRedisSessionProblem(session);
  const ttl = Number(session.ttlSeconds);
  const ttlText = Number.isFinite(ttl) && ttl >= 0 ? `${ttl} s` : "bez TTL / nenalezeno";
  const sessionId = String(session.sessionId || session.payload?.sessionId || session.payload?.SessionId || "");
  const mosLoginId = session.payload?.mosLoginId ?? session.payload?.MosLoginId ?? "-";
  const profile = item.profile;

  return `
    <div class="redis-session-item ${usable ? "ok" : "warn"}">
      <button type="button" data-redis-key="${escapeHtml(item.key)}">
        <strong>${escapeHtml(profile?.label || item.identityId || item.key)}</strong>
        <span>${escapeHtml(item.key)}</span>
      </button>
      <div class="redis-session-meta">
        <span>${usable ? "MOS session OK" : escapeHtml(problem || "MOS session neni pouzitelna")}</span>
        <span>TTL ${escapeHtml(ttlText)}</span>
        <span>MOS LoginID ${escapeHtml(mosLoginId)}</span>
        <span>SessionID ${escapeHtml(sessionId || "-")}</span>
      </div>
      ${profile
        ? `<button class="redis-profile-action" type="button" data-auth-profile-id="${escapeHtml(profile.id)}" data-identity-id="${escapeHtml(item.identityId)}" data-redis-profile-key="${escapeHtml(item.key)}">Zvolit a prihlasit</button>`
        : `<div class="redis-profile-missing">Neznamy ucet v Klikatku. Pouzitelne jen pro prime MOS volani.</div>`}
    </div>
  `;
}

function getIdentityIdFromRedisKey(key) {
  return String(key || "").replace(/^mos:session:user:/, "").trim();
}

function getRedisViewerIdentityId() {
  const currentPidLitackaIdentityId = getCurrentPidLitackaIdentityId();
  state.redisIdentityId = String(elements.redisIdentityId?.value || state.redisIdentityId || currentPidLitackaIdentityId || "").trim();
  return state.redisIdentityId;
}

function getRedisBridgeBaseUrl() {
  return String(state.redisBridgeUrl || elements.redisBridgeUrl?.value || "/__redis").replace(/\/$/, "");
}

function isUsableRedisSession(session) {
  const sessionId = String(session?.sessionId || session?.payload?.sessionId || session?.payload?.SessionId || "").trim();
  return Boolean(session?.exists && sessionId && !isEmptyGuid(sessionId));
}

function isEmptyGuid(value) {
  return String(value || "").trim().toLowerCase() === "00000000-0000-0000-0000-000000000000";
}

function getRedisSessionProblem(session) {
  const sessionId = String(session?.sessionId || session?.payload?.sessionId || session?.payload?.SessionId || "").trim();

  if (!session?.exists) {
    return "MissingRedisKey";
  }

  if (!sessionId) {
    return "MissingSessionId";
  }

  if (isEmptyGuid(sessionId)) {
    return "EmptySessionId";
  }

  return "";
}

function getRedisBridgeBaseUrls() {
  const configured = getRedisBridgeBaseUrl();
  return [...new Set([configured, "/__redis", "http://127.0.0.1:5097"].filter(Boolean))];
}

async function fetchRedisBridgeJson(path) {
  const errors = [];

  for (const baseUrl of getRedisBridgeBaseUrls()) {
    const url = `${baseUrl}${path}`;
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 1500);

    try {
      const response = await fetch(url, { signal: controller.signal });
      const text = await response.text();
      let body = null;

      try {
        body = text ? JSON.parse(text) : null;
      } catch {
        throw new Error(`HTTP ${response.status}: Redis bridge nevratil JSON (${text.slice(0, 120) || "prazdna odpoved"}).`);
      }

      if (!response.ok) {
        throw new Error(body.message || body.error || `HTTP ${response.status}`);
      }

      if (baseUrl !== state.redisBridgeUrl) {
        state.redisBridgeUrl = baseUrl;
        localStorage.setItem("demoHarness.redisBridgeUrl", baseUrl);
      }

      return body;
    } catch (error) {
      errors.push(`${url}: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      window.clearTimeout(timeoutId);
    }
  }

  throw new Error(errors.join("\n"));
}

function renderRedisSession(session, note = "") {
  const payload = session.payload || {};
  const sessionId = session.sessionId || "";
  const exists = isUsableRedisSession(session);
  const identityId = getIdentityIdFromRedisKey(session.key || state.redisIdentityId || "");
  const profile = findAuthProfileByIdentityId(identityId);
  const ttl = Number(session.ttlSeconds);
  const ttlText = ttl < 0 ? "bez TTL / nenalezeno" : `${ttl} s`;
  elements.redisStatus.textContent = exists ? "Session nalezena" : "Redis připojeno, session nenalezena";
  elements.redisUseSession.disabled = !exists;
  renderIdentitySummary();

  showRedisResult(exists ? "ok" : "error", exists ? "MOS session v Redis" : "MOS session nebyla nalezena", `
    ${note ? `<p>${escapeHtml(note)}</p>` : ""}
    ${!exists ? `<p>${escapeHtml(getRedisSessionProblem(session) || "Session nelze pouzit pro prime MOS volani.")}</p>` : ""}
    <div class="redis-detail-row"><span>Key</span><code>${escapeHtml(session.key || "")}</code></div>
    <div class="redis-detail-row"><span>TTL</span><code>${escapeHtml(ttlText)}</code></div>
    <div class="redis-detail-row"><span>Ulozeny ucet</span><code>${escapeHtml(profile?.label || "nenalezen v Klikatku")}</code></div>
    <div class="redis-detail-row"><span>SessionID</span><code>${escapeHtml(sessionId || "-")}</code></div>
    <div class="redis-detail-row"><span>MOS LoginID</span><code>${escapeHtml(payload.mosLoginId ?? payload.MosLoginId ?? "-")}</code></div>
    <pre>${escapeHtml(JSON.stringify(payload, null, 2))}</pre>
  `, { html: true });
}

function showRedisResult(level, title, detail, options = {}) {
  elements.redisStatus.textContent = level === "ok" ? "OK" : level === "warn" ? "Pracuji" : "Chyba";
  elements.redisResult.className = `redis-result auto-run-summary ${level}`;
  elements.redisResult.innerHTML = `
    <strong>${escapeHtml(title)}</strong>
    ${options.html ? String(detail || "") : `<p>${escapeHtml(detail || "")}</p>`}
  `;
}

function renderWorkflowList() {
  if (!elements.workflowList) {
    return;
  }

  elements.workflowList.innerHTML = "";
  const workflows = state.workflowIndex?.workflows || [];

  if (workflows.length === 0) {
    elements.workflowList.innerHTML = `<div class="empty-state">Žádné workflow není nakonfigurované.</div>`;
    updateWorkflowControls();
    return;
  }

  for (const workflow of workflows) {
    elements.workflowList.appendChild(createWorkflowCard(workflow));
  }

  updateWorkflowControls();
}

function createWorkflowCard(workflow) {
  const card = document.createElement("article");
  const activeRun = state.workflowRun?.workflowId === workflow.id ? state.workflowRun : null;
  const expanded = Boolean(activeRun && state.selectedWorkflowId === workflow.id);
  card.className = "scenario-card";
  card.dataset.workflowId = workflow.id;
  card.innerHTML = `
    <button class="scenario-main" type="button" ${state.workflowRunning ? "disabled" : ""}>
      <strong>${escapeHtml(workflow.name)}</strong>
      <p>${escapeHtml(workflow.description || "")}</p>
      <div class="form-meta">
        ${renderTagChips(workflow.tags)}
        <span class="meta-badge">${escapeHtml(`${workflow.items?.length || 0} scénářů`)}</span>
      </div>
    </button>
    <button class="scenario-toggle" type="button" aria-expanded="${String(expanded)}" ${state.workflowRunning ? "disabled" : ""}>${expanded ? "Skrýt kroky" : `Kroky (${workflow.items?.length || 0})`}</button>
    <ol class="scenario-steps ${expanded ? "" : "hidden"}">
      ${(workflow.items || []).map((item, index) => {
        const visualState = getWorkflowItemVisualState(workflow, index);

        return `
        <li class="workflow-step-item ${escapeHtml(visualState.className)}">
          <span>${index + 1}</span>
          <div>
            <div class="workflow-step-title">
              <strong>${escapeHtml(item.title || item.scenarioId)}</strong>
              <small>${escapeHtml(visualState.label)}</small>
            </div>
            <p>${escapeHtml(`${item.projectId} / ${item.packId} / ${item.scenarioId}`)}</p>
          </div>
          <div class="workflow-step-actions">
            <button class="workflow-open-source" type="button" data-workflow-step-index="${index}" ${state.workflowRunning ? "disabled" : ""}>Otevřít</button>
            <button class="workflow-start-at" type="button" data-workflow-step-index="${index}" ${state.workflowRunning ? "disabled" : ""}>Pokra\u010dovat odtud</button>
          </div>
        </li>`;
      }).join("")}
    </ol>
  `;

  card.querySelector(".scenario-main").addEventListener("click", () => selectWorkflow(workflow.id));
  card.querySelector(".scenario-toggle").addEventListener("click", event => {
    event.stopPropagation();
    const steps = card.querySelector(".scenario-steps");
    const toggle = card.querySelector(".scenario-toggle");
    const expanded = steps.classList.toggle("hidden") === false;
    toggle.setAttribute("aria-expanded", String(expanded));
    toggle.textContent = expanded ? "Skrýt kroky" : `Kroky (${workflow.items?.length || 0})`;
  });
  card.querySelectorAll(".workflow-start-at").forEach(button => {
    button.addEventListener("click", event => {
      event.stopPropagation();
      startWorkflowFromItem(workflow.id, Number(button.dataset.workflowStepIndex));
    });
  });
  card.querySelectorAll(".workflow-open-source").forEach(button => {
    button.addEventListener("click", event => {
      event.stopPropagation();
      openWorkflowSourceItem(workflow.id, Number(button.dataset.workflowStepIndex));
    });
  });
  card.classList.toggle("active", state.selectedWorkflowId === workflow.id);
  return card;
}

function getWorkflowItemVisualState(workflow, itemIndex) {
  const run = state.workflowRun?.workflowId === workflow.id ? state.workflowRun : null;

  if (!run) {
    return {
      className: "workflow-step-waiting",
      label: "Čeká"
    };
  }

  const itemResults = getWorkflowItemResults(workflow, itemIndex);
  const hasError = itemResults.some(result => result.level === "error");

  if (hasError) {
    return {
      className: "workflow-step-error",
      label: "Chyba"
    };
  }

  if (itemIndex === run.itemIndex && run.status !== "completed") {
    return {
      className: run.status === "paused" ? "workflow-step-paused" : "workflow-step-current",
      label: run.status === "paused" ? "Pozastaveno" : "Probíhá"
    };
  }

  if (itemResults.length > 0 && (itemIndex < run.itemIndex || run.status === "completed")) {
    return {
      className: "workflow-step-completed",
      label: "Hotovo"
    };
  }

  return {
    className: "workflow-step-waiting",
    label: "Čeká"
  };
}

function getWorkflowItemResults(workflow, itemIndex) {
  const run = state.workflowRun?.workflowId === workflow.id ? state.workflowRun : null;
  const item = workflow.items?.[itemIndex];

  if (!run || !item) {
    return [];
  }

  return (run.results || []).filter(result => getWorkflowResultItemIndex(workflow, result) === itemIndex);
}

function selectWorkflow(workflowId) {
  state.selectedWorkflowId = workflowId;
  state.workflowRun = null;
  state.workflowContext = {};
  state.workflowSecrets = {};
  renderWorkflowList();
  clearWorkflowSummary();
  updateWorkflowControls();
}

async function openWorkflowSourceItem(workflowId, itemIndex) {
  const workflow = (state.workflowIndex?.workflows || []).find(item => item.id === workflowId);
  const item = workflow?.items?.[itemIndex];

  if (!workflow || !item) {
    showWorkflowSummary("error", "Workflow krok se nepodařilo otevřít.", [
      workflowId || "Neznámé workflow",
      `Krok ${Number.isFinite(itemIndex) ? itemIndex + 1 : "?"}`
    ]);
    return;
  }

  try {
    state.selectedWorkflowId = workflow.id;
    await loadWorkflowItemCatalog(item, { suppressLog: true });

    const openedForm = openWorkflowItemForm(item);
    if (openedForm) {
      activateLeftTab("forms");
      showWorkflowSummary("ok", "Otevřen formulář z workflow.", [
        item.title || item.scenarioId,
        `${item.projectId} / ${item.packId}`
      ]);
      renderWorkflowList();
      return;
    }

    if (state.catalog.scenarios.some(scenario => scenario.id === item.scenarioId)) {
      activateLeftTab("scenarios");
      selectScenario(item.scenarioId, { preserveLog: true });
      showWorkflowSummary("ok", "Otevřen scénář z workflow.", [
        item.title || item.scenarioId,
        `${item.projectId} / ${item.packId}`
      ]);
      renderWorkflowList();
      return;
    }

    showWorkflowSummary("error", "Scénář z workflow nebyl nalezen.", [
      `${item.projectId} / ${item.packId} / ${item.scenarioId}`
    ]);
  } catch (error) {
    showWorkflowSummary("error", "Scénář z workflow se nepodařilo otevřít.", [
      error.message || String(error)
    ]);
  } finally {
    updateWorkflowControls();
  }
}

async function loadWorkflowItemCatalog(item, options = {}) {
  if (state.currentProject?.id !== item.projectId) {
    await loadProject(item.projectId, {
      packId: item.packId,
      suppressLog: options.suppressLog
    });
  } else if (state.currentPackId !== item.packId) {
    await loadScenarioPack(item.packId, {
      suppressLog: options.suppressLog
    });
  }
}

function openWorkflowItemForm(item) {
  const scenario = state.catalog.scenarios.find(candidate => candidate.id === item.scenarioId);
  const preferForm = item.formId || item.stepId || scenario?.formsOnly === true || item.openAs === "form";

  if (!preferForm) {
    return false;
  }

  const form = state.forms.find(candidate =>
    (item.formId && candidate.id === item.formId)
    || (candidate.scenarioId === item.scenarioId && item.stepId && candidate.step?.id === item.stepId)
    || (candidate.scenarioId === item.scenarioId && scenario?.formsOnly === true))
    || state.forms.find(candidate => candidate.scenarioId === item.scenarioId);

  if (!form) {
    return false;
  }

  selectFreeForm(form.id, { preserveLog: true });
  return true;
}

function selectScenario(scenarioId, options = {}) {
  const preserveLog = options.preserveLog === true;
  const suppressLog = options.suppressLog === true;
  state.scenario = state.catalog.scenarios.find(scenario => scenario.id === scenarioId);

  if (!state.scenario) {
    return;
  }

  state.stepIndex = 0;
  state.context = {};
  state.secrets = {};
  state.values = {};
  state.dirty = false;
  state.freeForm = false;
  state.lastStepResult = null;
  state.stepResults = {};
  state.displayedResult = null;
  state.activeSelection = null;
  if (!preserveLog) {
    state.log = [];
  }

  document.querySelectorAll(".scenario-card").forEach(card => {
    card.classList.toggle("active", card.dataset.scenarioId === scenarioId);
  });

  if (!suppressLog) {
    addLog("ok", "Sc\u00e9n\u00e1\u0159 vybr\u00e1n", {
      id: state.scenario.id,
      expectedMode: "Re\u017eim sc\u00e9n\u00e1\u0159e"
    });
  }
  if (options.persistSelection !== false) {
    saveLastSelection({ scenarioId: state.scenario.id });
  }
  renderAutoRunOptions();
  clearAutoRunSummary();
  renderStep();
}

function selectFreeForm(formId, options = {}) {
  const preserveLog = options.preserveLog === true;
  const suppressLog = options.suppressLog === true;
  const form = state.forms.find(item => item.id === formId);

  if (!form) {
    return;
  }

  state.scenario = {
    id: form.id,
    title: form.step.title,
    description: `Voln\u00fd formul\u00e1\u0159 z: ${form.scenarioTitle}`,
    requiresAuth: form.requiresAuth,
    requiresAnonymousAuth: form.requiresAnonymousAuth,
    steps: [form.step]
  };
  state.stepIndex = 0;
  state.context = {};
  state.secrets = {};
  state.values = {};
  state.dirty = true;
  state.freeForm = true;
  state.lastStepResult = null;
  state.stepResults = {};
  state.displayedResult = null;
  state.activeSelection = null;
  if (!preserveLog) {
    state.log = [];
  }

  document.querySelectorAll(".scenario-card").forEach(card => {
    card.classList.toggle("active", card.dataset.formId === formId);
  });

  if (!suppressLog) {
    addLog("ok", "Formul\u00e1\u0159 vybr\u00e1n", {
      title: form.step.title,
      sourceScenario: form.scenarioId,
      mode: "Voln\u00fd formul\u00e1\u0159"
    });
  }
  renderAutoRunOptions();
  clearAutoRunSummary();
  renderStep();
}

function resetCurrentScenario() {
  if (state.freeForm && state.scenario) {
    selectFreeForm(state.scenario.id);
  } else if (state.scenario) {
    selectScenario(state.scenario.id);
  }
}

function renderStep(options = {}) {
  const preserveValues = options.preserveValues === true;

  if (state.scenario) {
    state.stepIndex = findNextRunnableStepIndex(state.stepIndex);
  }

  const step = currentStep();
  if (preserveValues) {
    syncCurrentStepFormValuesFromDom();
  }

  const scenarioRequiresManualInput = requiresManualInput(state.scenario);
  const stepRequiresAuth = requiresAuthorizationForStep(step);
  const missingContextKeys = getMissingContextKeys(step);
  const currentStepResult = getCurrentStepResult();
  elements.resetScenario.disabled = !state.scenario;
  elements.runStep.disabled = !step || state.batchRunning || missingContextKeys.length > 0 || (stepRequiresAuth && (!hasRequiredAuthorizationFor(step) || !hasRequiredAuthorizationFor(state.scenario)));
  elements.previousStep.disabled = !state.scenario || state.batchRunning || findPreviousRunnableStepIndex(state.stepIndex) === null;
  elements.autoRun.disabled = !state.scenario || state.freeForm || state.batchRunning || scenarioRequiresManualInput || !hasRequiredAuthorizationFor(state.scenario);
  elements.autoRunTarget.disabled = !state.scenario || state.freeForm || state.batchRunning || scenarioRequiresManualInput || !hasRequiredAuthorizationFor(state.scenario);
  elements.runStep.textContent = currentStepResult ? "Zopakovat krok" : "Spustit krok";
  updateNextStepControl();

  if (!step) {
    const app = getMobileAppConfig(step);
    elements.stepCounter.textContent = "";
    elements.screenTitle.textContent = state.scenario ? (app.title || "Dokončeno") : "Jízdenky";
    elements.screenDescription.textContent = state.scenario
      ? "V\u0161echny kroky sc\u00e9n\u00e1\u0159e jsou hotov\u00e9."
      : "P\u0159ehled dostupn\u00fdch slu\u017eeb pro cestuj\u00edc\u00ed.";
    elements.testerTitle.textContent = state.scenario ? "Sc\u00e9n\u00e1\u0159 dokon\u010den" : "Vyberte sc\u00e9n\u00e1\u0159";
    elements.testerDescription.textContent = state.scenario
      ? "Flow dob\u011bhl na konec dostupn\u00fdch krok\u016f."
      : "Technick\u00fd popis krok\u016f a o\u010dek\u00e1v\u00e1n\u00ed se zobraz\u00ed zde.";
    delete elements.stepForm.dataset.scenarioId;
    delete elements.stepForm.dataset.stepIndex;
    elements.stepForm.innerHTML = "";
    state.displayedResult = null;
    state.activeSelection = null;
    updateNextStepControl();
    renderAppNav(step);
    showResult("ok", "Sc\u00e9n\u00e1\u0159 je dokon\u010den.");
    renderContext();
    return;
  }

  elements.stepCounter.textContent = state.freeForm
    ? "Voln\u00fd formul\u00e1\u0159"
    : `Krok ${state.stepIndex + 1} z ${state.scenario.steps.length}`;
  elements.screenTitle.textContent = getMobileTitle(step);
  elements.screenDescription.textContent = getMobileDescription(step);
  renderAppNav(step);
  elements.testerTitle.textContent = step.title;
  elements.testerDescription.textContent = buildTesterDescription(step);
  elements.testerExpected.textContent = formatExpected(step);
  elements.stepForm.dataset.scenarioId = state.scenario.id;
  elements.stepForm.dataset.stepIndex = String(state.stepIndex);
  elements.stepForm.innerHTML = "";
  elements.resultCard.className = "result-card hidden";
  state.lastStepResult = currentStepResult;
  state.displayedResult = null;
  state.activeSelection = null;
  const visibleFields = getVisibleFields(step);

  elements.stepForm.appendChild(renderMobileActionHeader(step));

  for (const field of step.fields || []) {
    if (field.type === "info") {
      elements.stepForm.appendChild(renderInfoField(field));
      continue;
    }

    const hasCurrentValue = Object.prototype.hasOwnProperty.call(state.values, field.name);
    const resolvedDefaultValue = resolveFieldDefaultValue(field);
    const shouldRefillEmptyValue = preserveValues
      && hasCurrentValue
      && isEmpty(state.values[field.name])
      && !isEmpty(resolvedDefaultValue);
    const defaultValue = preserveValues && hasCurrentValue && !shouldRefillEmptyValue
      ? state.values[field.name]
      : resolvedDefaultValue;
    state.values[field.name] = defaultValue;

    if (!field.hidden) {
      elements.stepForm.appendChild(renderField(field, defaultValue));
    }
  }

  if (visibleFields.length === 0) {
    elements.stepForm.appendChild(renderNoInputStepCard(step));
  }

  renderModeBanner();
  renderContext();
}

function syncCurrentStepFormValuesFromDom() {
  if (!state.scenario || !elements.stepForm) {
    return;
  }

  if (elements.stepForm.dataset.scenarioId !== state.scenario.id
    || elements.stepForm.dataset.stepIndex !== String(state.stepIndex)) {
    return;
  }

  const controls = elements.stepForm.querySelectorAll("input[name], select[name], textarea[name]");

  for (const control of controls) {
    if (control.type === "file") {
      continue;
    }

    state.values[control.name] = control.type === "checkbox"
      ? String(control.checked)
      : control.value;
  }
}

function renderAutoRunOptions() {
  elements.autoRunTarget.innerHTML = "";

  if (!state.scenario || state.freeForm || requiresManualInput(state.scenario)) {
    return;
  }

  state.scenario.steps.forEach((step, index) => {
    const option = document.createElement("option");
    option.value = String(index);
    option.textContent = `${index + 1}. ${step.title}`;
    elements.autoRunTarget.appendChild(option);
  });

  elements.autoRunTarget.value = String(state.scenario.steps.length - 1);
}

function renderAppNav(step) {
  const nav = getMobileNavigation(step);
  const items = [
    { element: elements.appNavPrimary, label: nav.items[0], active: nav.activeIndex === 0 },
    { element: elements.appNavSecondary, label: nav.items[1], active: nav.activeIndex === 1 },
    { element: elements.appNavTertiary, label: nav.items[2], active: nav.activeIndex === 2 }
  ];

  for (const item of items) {
    if (!item.element) {
      continue;
    }

    item.element.textContent = item.label;
    item.element.classList.toggle("active", item.active);
  }
}

function getMobileNavigation(step) {
  const app = getMobileAppConfig(step);
  const text = step
    ? [step.id, step.title, step.request?.path].filter(Boolean).join(" ").toLowerCase()
    : "";

  if (!step) {
    return {
      items: ["Jízdenky", "Platby", "Profil"],
      activeIndex: 0
    };
  }

  if (app.section === "coupons" || isCouponStepText(text)) {
    return {
      items: ["Kupóny", "Identifikátory", "MOS"],
      activeIndex: text.includes("token") || text.includes("identifik") ? 1 : 0
    };
  }

  if (isParkingStepText(text)) {
    if (text.includes("payment") || text.includes("gateway")) {
      return {
        items: ["Parkování", "Platba", "Profil"],
        activeIndex: 1
      };
    }

    return {
      items: ["Parkování", "Platba", "Profil"],
      activeIndex: 0
    };
  }

  if (text.includes("client/status")) {
    return {
      items: ["Profil", "Údaje", "Nastavení"],
      activeIndex: 1
    };
  }

  if (isAccountStepText(text)) {
    if (text.includes("complete") || text.includes("activation")) {
      return {
        items: ["Registrace", "Aktivace", "Profil"],
        activeIndex: 1
      };
    }

    return {
      items: ["Registrace", "Aktivace", "Profil"],
      activeIndex: 0
    };
  }

  if (text.includes("card")) {
    return {
      items: ["Jízdenky", "Karty", "Profil"],
      activeIndex: 1
    };
  }

  if (text.includes("device") || text.includes("firebase")) {
    return {
      items: ["Zařízení", "Oznámení", "Profil"],
      activeIndex: text.includes("firebase") ? 1 : 0
    };
  }

  if (text.includes("payment") || text.includes("gdpay") || text.includes("webhook")) {
    return {
      items: ["Jízdenky", "Platby", "Profil"],
      activeIndex: 1
    };
  }

  if (text.includes("booking") || text.includes("offer") || text.includes("product") || text.includes("zone")) {
    return {
      items: ["Jízdenky", "Platby", "Profil"],
      activeIndex: 0
    };
  }

  return {
    items: ["Jízdenky", "Platby", "Profil"],
    activeIndex: 0
  };
}

function isAccountStepText(text) {
  return includesAny(text, [
    "account",
    "client/status",
    "klient",
    "klientsk",
    "auth/register",
    "auth/password",
    "password-recovery",
    "password-change",
    "obnova hesla",
    "změna hesla",
    "zmena hesla",
    "resetovat heslo"
  ]);
}

function isParkingStepText(text) {
  return text.includes("parking") || text.includes("parkov");
}

function isCouponStepText(text) {
  return includesAny(text, [
    "coupon",
    "kupón",
    "kupon",
    "additemtoorder",
    "setorderpaid",
    "movecoupon"
  ]);
}

function getMobileActionTitle(step) {
  const text = getStepSearchText(step);
  const path = step.request?.path || "";
  const pathLower = path.toLowerCase();
  const method = step.request?.method || (step.customAction ? "AKCE" : "GET");

  if (path.includes("/v1/parking/cards")) {
    return path.includes("last-used")
      ? "Poslední použitá karta"
      : method === "DELETE"
        ? "Odstranění uložené karty"
        : "Uložené platební karty";
  }

  if (path.includes("/v1/parking/my-vehicles")) {
    return method === "DELETE" ? "Odstranění vozidla" : method === "POST" ? "Uložení vozidla" : "Uložená vozidla";
  }

  if (path.includes("/v1/accounts/me/favorite-zones")) {
    return method === "DELETE" ? "Odstranění oblíbené zóny" : method === "POST" ? "Uložení oblíbené zóny" : "Oblíbené zóny";
  }

  if (path.includes("/v1/parking/sessions/active")) {
    return "Aktivní parkování";
  }

  if (path.includes("/v1/parking/sessions/history")) {
    return "Historie parkování";
  }

  if (path.includes("/v1/parking/suggest")) {
    return "Návrh lokalit";
  }

  if (path.includes("/v1/parking/calculate-price/street-parking/multi") || pathLower.includes("/api/v1/tickets/streetparking/calculateprice/multi")) {
    return "Výpočet ceny parkování";
  }

  if (path.includes("/v1/parking/payment/gateway-result")) {
    return "Výsledek platební brány";
  }

  if (path.includes("/v1/parking/payment/card-token/process")) {
    return "Platba uloženou kartou";
  }

  if (path.includes("/v1/client/status")) {
    return "Stav klientských dat";
  }

  if (path.includes("/v1/client/identifiers/inkarta/registration")) {
    return path.includes("/complete") ? "Kompletace tokenizace InKarty" : "Tokenizace InKarty";
  }

  if (path.includes("/v1/client/identifiers/opus-card/registration")) {
    return path.includes("/complete") ? "Kompletace tokenizace OpusCard" : "Tokenizace OpusCard";
  }

  if (path.includes("/v1/client/identifiers/litacka/registration")) {
    return path.includes("/complete") ? "Kompletace tokenizace Lítačky" : "Tokenizace Lítačky";
  }

  if (path.includes("/v1/client/identifiers/bank-card/registration")) {
    return path.includes("/complete") ? "Kompletace tokenizace karty" : "Tokenizace platební karty";
  }

  if (path.includes("/v1/client/identifiers/mobile/") && path.includes("/personalization")) {
    return "Personalizace telefonu";
  }

  if (path.includes("/v1/client/identifiers/bank-card/") && path.includes("/personalization")) {
    return "Personalizace platební karty";
  }

  if (path.includes("/v1/client/identifiers/registration/")) {
    return "Stav tokenizace karty";
  }

  if (path.includes("/v1/client/identifiers")) {
    return method === "POST" ? "Tokenizace telefonu" : "Identifikátory klienta";
  }

  if (path.includes("/v1/client/data")) {
    return method === "GET" ? "Detail klientských dat" : "Uložení klientských dat";
  }

  if (path.includes("/v1/client/photo")) {
    return "Uložení fotografie klienta";
  }

  if (path.includes("/v1/parking/tickets/street-parking")) {
    if (text.includes("prodlou") || text.includes("extension") || text.includes("saved-card")) {
      return "Prodloužení parkování";
    }

    return "Založení parkování";
  }

  if (path.includes("/v1/auth/login")) {
    return "Přihlášení";
  }

  if (path.includes("/v1/auth/anonymous")) {
    return "Anonymní přihlášení";
  }

  if (path.includes("/v1/auth/register/check")) {
    return "Ověření e-mailu";
  }

  if (path.includes("/v1/auth/register/initialize")) {
    return "Založení účtu";
  }

  if (path.includes("/v1/auth/register/resend-activation")) {
    return "Nový aktivační e-mail";
  }

  if (path.includes("/v1/auth/register/complete")) {
    return "Dokončení aktivace";
  }

  if (path.includes("/v1/auth/password/recovery")) {
    return "Obnova hesla";
  }

  if (path.includes("/v1/auth/password/change")) {
    return "Změna hesla";
  }

  if (path.includes("/v1/auth/password/complete")) {
    return "Nastavení nového hesla";
  }

  if (text.includes("active")) {
    return "Aktivní položky";
  }

  return step.title || "Připravená akce";
}

function getMobileActionSubtitle(step) {
  const path = step.request?.path || "";

  if (path.includes("/v1/parking/cards")) {
    return "Seznam karet uložených k aktuálnímu uživateli.";
  }

  if (path.includes("/v1/parking/my-vehicles")) {
    return "Vozidla uložená k aktuálnímu uživateli.";
  }

  if (path.includes("/v1/accounts/me/favorite-zones")) {
    return "Parkovací zóny uložené mezi oblíbenými.";
  }

  if (path.includes("/v1/parking/sessions/active")) {
    return "Právě běžící nebo nedávno založené parkovací relace.";
  }

  if (path.includes("/v1/parking/sessions/history")) {
    return "Dřívější parkovací relace aktuálního uživatele.";
  }

  if (path.includes("/v1/parking/payment/")) {
    return "Zpracování platebního kroku pro parkování.";
  }

  if (path.includes("/v1/parking/tickets/street-parking")) {
    return "Uliční parkování v zadané zóně.";
  }

  if (path.includes("/v1/client/status")) {
    return "Stav klientského profilu aktuálního uživatele.";
  }

  if (path.includes("/v1/client/identifiers/mobile/") && path.includes("/personalization")) {
    return "Volitelně označí MobApp identifikátor jako personalizovaný.";
  }

  if (path.includes("/v1/client/identifiers/bank-card/") && path.includes("/personalization")) {
    return "Volitelně označí platební kartu jako personalizovaný identifikátor.";
  }

  if (path.includes("/v1/client/identifiers")) {
    return (step.request?.method || "GET") === "POST"
      ? "Registrace telefonního MobApp identifikátoru k aktuálnímu klientovi."
      : "Nosiče a identifikátory dostupné pro aktuálního klienta.";
  }

  if (path.includes("/v1/client/data")) {
    return (step.request?.method || "GET") === "GET"
      ? "Kompletní klientská data aktuálního uživatele."
      : "Uložení osobních údajů klienta.";
  }

  if (path.includes("/v1/auth/password/change")) {
    return "Změna hesla aktuálně přihlášeného uživatele.";
  }

  if (path.includes("/v1/auth/")) {
    return "Účet uživatele v PidLitacka.";
  }

  return "";
}

function getStepSearchText(step) {
  return [step?.id, step?.title, step?.description, step?.request?.path]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function renderField(field, value) {
  const wrapper = document.createElement("div");
  wrapper.className = "field";

  const label = document.createElement("label");
  label.htmlFor = `field-${field.name}`;
  label.textContent = field.label || field.name;
  wrapper.appendChild(label);

  if (field.type === "tag-list") {
    return renderTagListField(wrapper, field, value);
  }

  if (field.type === "image-file") {
    return renderImageFileField(wrapper, field, value);
  }

  const input = field.type === "textarea"
    ? document.createElement("textarea")
    : field.type === "select"
      ? document.createElement("select")
      : document.createElement("input");

  input.id = `field-${field.name}`;
  input.name = field.name;
  input.dataset.defaultValue = typeof value === "string" ? value : JSON.stringify(value);
  input.rows = field.rows || 4;
  input.spellcheck = false;

  if (field.type === "select") {
    for (const option of field.options || []) {
      const optionElement = document.createElement("option");
      optionElement.value = String(option.value);
      optionElement.textContent = option.text ?? String(option.value);
      input.appendChild(optionElement);
    }

    input.value = String(value ?? "");
  } else if (field.type === "checkbox") {
    input.checked = value === true || value === "true";
    input.value = "true";
  } else {
    input.value = value;
  }

  if (field.type && field.type !== "textarea" && field.type !== "select") {
    input.type = field.type;
  }

  if (field.min !== undefined) {
    input.min = String(field.min);
  }

  if (field.max !== undefined) {
    input.max = String(field.max);
  }

  if (field.step !== undefined) {
    input.step = String(field.step);
  }

  if (field.placeholder) {
    input.placeholder = field.placeholder;
  }

  input.addEventListener(field.type === "checkbox" ? "change" : "input", () => {
    state.values[field.name] = field.type === "checkbox" ? String(input.checked) : input.value;

    if (shouldTrackDirty(field) && state.values[field.name] !== input.dataset.defaultValue) {
      state.dirty = true;
      renderModeBanner();
    }
  });

  wrapper.appendChild(input);

  if (field.help) {
    const help = document.createElement("small");
    help.textContent = field.help;
    wrapper.appendChild(help);
  }

  return wrapper;
}

function renderImageFileField(wrapper, field, value) {
  const initialValue = normalizeImageFileValue(value, field);
  state.values[field.name] = initialValue;
  wrapper.classList.add("image-file-field");

  const preview = document.createElement("img");
  preview.className = "image-file-preview";
  preview.alt = field.label || field.name;

  const meta = document.createElement("div");
  meta.className = "image-file-meta";

  const actions = document.createElement("div");
  actions.className = "image-file-actions";

  const input = document.createElement("input");
  input.id = `field-${field.name}`;
  input.name = field.name;
  input.type = "file";
  input.accept = field.accept || "image/*";

  const removeButton = document.createElement("button");
  removeButton.type = "button";
  removeButton.className = "secondary image-file-remove";
  removeButton.textContent = "Odebrat";

  const restoreButton = document.createElement("button");
  restoreButton.type = "button";
  restoreButton.className = "secondary image-file-restore";
  restoreButton.textContent = "Vrátit výchozí";
  restoreButton.hidden = true;

  const updatePreview = image => {
    const normalized = normalizeImageFileValue(image, field);
    const hasImage = Boolean(normalized.base64);

    wrapper.classList.toggle("is-empty", !hasImage);
    removeButton.hidden = !hasImage;
    restoreButton.hidden = hasImage || !field.base64;

    if (!hasImage) {
      preview.removeAttribute("src");
      meta.textContent = "Fotografie nebude odeslána.";
      return;
    }

    const size = normalized.size || base64ToBytes(normalized.base64).byteLength;

    preview.src = `data:${normalized.contentType || "image/png"};base64,${normalized.base64}`;
    meta.textContent = `${normalized.fileName || "obrázek"} · ${normalized.contentType || "image/png"} · ${formatBytes(size)}`;
  };

  input.addEventListener("change", () => {
    const file = input.files?.[0];

    if (!file) {
      return;
    }

    const reader = new FileReader();
    reader.addEventListener("load", () => {
      const dataUrl = String(reader.result || "");
      const base64 = dataUrl.includes(",") ? dataUrl.split(",").pop() : "";
      const nextValue = {
        fileName: file.name,
        contentType: file.type || "application/octet-stream",
        base64,
        size: file.size
      };

      state.values[field.name] = nextValue;
      updatePreview(nextValue);

      if (shouldTrackDirty(field)) {
        state.dirty = true;
        renderModeBanner();
      }
    });
    reader.readAsDataURL(file);
  });

  removeButton.addEventListener("click", () => {
    state.values[field.name] = {
      fileName: "",
      contentType: "",
      base64: "",
      size: 0,
      removed: true
    };
    input.value = "";
    updatePreview(state.values[field.name]);

    if (shouldTrackDirty(field)) {
      state.dirty = true;
      renderModeBanner();
    }
  });

  restoreButton.addEventListener("click", () => {
    const restored = normalizeImageFileValue(null, field);
    state.values[field.name] = restored;
    input.value = "";
    updatePreview(restored);

    if (shouldTrackDirty(field)) {
      state.dirty = true;
      renderModeBanner();
    }
  });

  updatePreview(initialValue);
  wrapper.appendChild(preview);
  wrapper.appendChild(meta);
  actions.appendChild(removeButton);
  actions.appendChild(restoreButton);
  wrapper.appendChild(actions);
  wrapper.appendChild(input);

  if (field.help) {
    const help = document.createElement("small");
    help.textContent = field.help;
    wrapper.appendChild(help);
  }

  return wrapper;
}

function normalizeImageFileValue(value, field) {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    if (value.removed || value.base64 === "") {
      return {
        fileName: "",
        contentType: "",
        base64: "",
        size: 0,
        removed: true
      };
    }

    return {
      fileName: value.fileName || field.fileName || `${field.name}.png`,
      contentType: value.contentType || field.contentType || "image/png",
      base64: value.base64 || field.base64 || "",
      size: value.size || null
    };
  }

  return {
    fileName: field.fileName || `${field.name}.png`,
    contentType: field.contentType || "image/png",
    base64: field.base64 || "",
    size: null
  };
}

function formatBytes(size) {
  const value = Number(size);

  if (!Number.isFinite(value)) {
    return "";
  }

  if (value < 1024) {
    return `${value} B`;
  }

  return `${(value / 1024).toFixed(1)} kB`;
}

function renderInfoField(field) {
  const wrapper = document.createElement("section");
  wrapper.className = "mobile-info-field";

  const items = (field.items || [])
    .map(item => `<span>${escapeHtml(item)}</span>`)
    .join("");

  wrapper.innerHTML = `
    <strong>${escapeHtml(field.label || "Informace")}</strong>
    ${field.text ? `<p>${escapeHtml(field.text)}</p>` : ""}
    ${items ? `<div class="mobile-info-items">${items}</div>` : ""}
  `;

  return wrapper;
}

function renderMobileActionHeader(step) {
  const wrapper = document.createElement("section");
  wrapper.className = "mobile-action-header";

  const title = getMobileActionTitle(step);
  const subtitle = getMobileActionSubtitle(step);
  const method = step.request?.method || (step.customAction ? "AKCE" : "GET");

  wrapper.innerHTML = `
    <div>
      <strong>${escapeHtml(title)}</strong>
      ${subtitle ? `<p>${escapeHtml(subtitle)}</p>` : ""}
    </div>
    <span class="request-preview-method">${escapeHtml(method)}</span>
  `;

  return wrapper;
}

function getVisibleFields(step) {
  return (step.fields || []).filter(field => !field.hidden && field.type !== "info");
}

function renderTagListField(wrapper, field, value) {
  const defaultValue = Array.isArray(value) ? [...value] : [];
  const listState = [...defaultValue];
  state.values[field.name] = listState;

  const picker = document.createElement("div");
  picker.className = "tag-list-picker";

  const select = document.createElement("select");
  select.id = `field-${field.name}`;
  select.name = field.name;

  const addButton = document.createElement("button");
  addButton.type = "button";
  addButton.className = "tag-list-add";
  addButton.textContent = "P\u0159idat";

  const chipList = document.createElement("div");
  chipList.className = "tag-list-chips";

  const updateDirty = () => {
    if (shouldTrackDirty(field) && !deepEqual(listState, defaultValue)) {
      state.dirty = true;
      renderModeBanner();
    }
  };

  const renderOptions = () => {
    const options = field.options || [];
    select.innerHTML = "";

    for (const option of options) {
      if (listState.includes(String(option.value))) {
        continue;
      }

      const optionElement = document.createElement("option");
      optionElement.value = String(option.value);
      optionElement.textContent = option.text ?? String(option.value);
      select.appendChild(optionElement);
    }

    select.disabled = select.options.length === 0;
    addButton.disabled = select.options.length === 0;
  };

  const renderChips = () => {
    chipList.innerHTML = "";

    if (listState.length === 0) {
      const empty = document.createElement("div");
      empty.className = "tag-list-empty";
      empty.textContent = field.emptyText || "Zat\u00edm nen\u00ed vybran\u00e1 \u017e\u00e1dn\u00e1 polo\u017eka.";
      chipList.appendChild(empty);
      return;
    }

    for (const item of listState) {
      const option = (field.options || []).find(candidate => String(candidate.value) === item);
      const chip = document.createElement("button");
      chip.type = "button";
      chip.className = "tag-chip";
      chip.innerHTML = `<span>${escapeHtml(option?.text ?? item)}</span><strong aria-hidden="true">×</strong>`;
      chip.addEventListener("click", () => {
        const index = listState.indexOf(item);

        if (index >= 0) {
          listState.splice(index, 1);
          state.values[field.name] = [...listState];
          renderChips();
          renderOptions();
          updateDirty();
        }
      });
      chipList.appendChild(chip);
    }
  };

  addButton.addEventListener("click", () => {
    if (!select.value) {
      return;
    }

    listState.push(select.value);
    state.values[field.name] = [...listState];
    renderChips();
    renderOptions();
    updateDirty();
  });

  picker.appendChild(select);
  picker.appendChild(addButton);
  wrapper.appendChild(picker);
  wrapper.appendChild(chipList);

  renderOptions();
  renderChips();

  if (field.help) {
    const help = document.createElement("small");
    help.textContent = field.help;
    wrapper.appendChild(help);
  }

  return wrapper;
}

function renderRequestPreviewCard(step) {
  const preview = buildRequest(step);
  const card = document.createElement("section");
  card.className = "request-preview";

  const method = step.request?.method || (step.customAction ? "AKCE" : "GET");
  const targetUrl = preview.resolvedUrl || preview.url || step.request.path;
  const hasHeaders = Object.keys(preview.visibleHeaders || {}).length > 0;
  const hasBody = preview.visibleBody !== null && preview.visibleBody !== undefined && preview.visibleBody !== "";

  card.innerHTML = `
    <div class="request-preview-head">
      <strong>P\u0159ipraven\u00fd po\u017eadavek</strong>
      <span class="request-preview-method">${escapeHtml(method)}</span>
    </div>
    <div class="request-preview-path">${escapeHtml(targetUrl)}</div>
    ${hasHeaders ? `
      <div class="request-preview-section">
        <span>Hlavičky</span>
        <pre>${escapeHtml(JSON.stringify(preview.visibleHeaders, null, 2))}</pre>
      </div>` : ""}
    ${hasBody ? `
      <div class="request-preview-section">
        <span>Data</span>
        <pre>${escapeHtml(typeof preview.visibleBody === "string"
          ? preview.visibleBody
          : JSON.stringify(preview.visibleBody, null, 2))}</pre>
      </div>` : `
      <div class="request-preview-empty">Tento krok ode\u0161le po\u017eadavek bez formul\u00e1\u0159e.</div>`}
  `;

  return card;
}

function renderNoInputStepCard(step) {
  if (step?.readonlyContext?.kind === "couponMoveTargetIdentifier") {
    return renderReadonlyCouponMoveTargetCard(step);
  }

  const card = document.createElement("section");
  card.className = "request-preview";

  const method = step.request?.method || (step.customAction ? "AKCE" : "GET");
  const requestKind = step.customAction
    ? "vlastní akce Klikátka"
    : method === "GET"
    ? "načtení dat"
    : "odeslání požadavku";

  card.innerHTML = `
    <div class="request-preview-head">
      <strong>Bez vstupních parametrů</strong>
      <span class="request-preview-method">${escapeHtml(method)}</span>
    </div>
    <div class="request-preview-empty">
      Tento krok nevyžaduje žádné ruční zadání. Po spuštění proběhne ${escapeHtml(requestKind)} pomocí připravené metody.
    </div>
  `;

  return card;
}

function renderReadonlyCouponMoveTargetCard(step) {
  const card = document.createElement("section");
  card.className = "app-card app-card-readonly-target";
  const config = step.readonlyContext || {};
  const identifierId = state.context?.[config.idKey] || "";
  const identifier = {
    identifierId,
    name: state.context?.[config.nameKey] || "",
    type: state.context?.[config.typeKey] || "",
    maskedPan: state.context?.[config.maskedValueKey] || ""
  };
  const label = getKnownIdentifierLabel(identifierId) || getIdentifierDisplayName(identifier);
  const value = identifier.maskedPan || identifier.name || "-";

  card.innerHTML = `
    <strong>${escapeHtml(config.title || "Vybraný identifikátor")}</strong>
    <p>${escapeHtml(config.text || "Hodnota je převzatá z předchozího výběru a v tomto kroku se needituje.")}</p>
    <div class="app-card-meta">
      ${renderAppChip(getIdentifierTypeLabel(identifier))}
      ${renderAppChip("readonly")}
    </div>
    <div class="app-card-details">
      <div class="app-detail-row"><span>Cíl</span><span>${escapeHtml(label || "-")}</span></div>
      <div class="app-detail-row"><span>ID</span><span>${escapeHtml(identifierId || "-")}</span></div>
      <div class="app-detail-row"><span>Hodnota</span><span>${escapeHtml(value)}</span></div>
    </div>
  `;

  return card;
}

function getMobileTitle(step) {
  const app = getMobileAppConfig(step);

  if (app.title) {
    return app.title;
  }

  const text = [step.id, step.title, step.request?.path].filter(Boolean).join(" ").toLowerCase();

  if (isCouponStepText(text)) {
    return "Kupóny";
  }

  if (isParkingStepText(text)) {
    return "Parkování";
  }

  if (isAccountStepText(text)) {
    return "Profil";
  }

  if (text.includes("module")) {
    return "Stav slu\u017eby";
  }

  if (text.includes("products") || text.includes("zones") || text.includes("product")) {
    return "Nab\u00eddka j\u00edzdenek";
  }

  if (text.includes("offer")) {
    return "V\u00fdb\u011br j\u00edzdenky";
  }

  if (text.includes("card")) {
    return "Platebn\u00ed karty";
  }

  if (text.includes("device") || text.includes("firebase")) {
    return "Za\u0159\u00edzen\u00ed";
  }

  if (text.includes("booking") || text.includes("cancel")) {
    return "Rezervace";
  }

  if (text.includes("payment") || text.includes("gdpay") || text.includes("webhook")) {
    return "Platba";
  }

  return "J\u00edzdenky";
}

function getMobileDescription(step) {
  const app = getMobileAppConfig(step);

  if (app.subtitle) {
    return app.subtitle;
  }

  const text = [step.id, step.title, step.request?.path].filter(Boolean).join(" ").toLowerCase();

  if (isCouponStepText(text)) {
    return "Nákup, přesun a kontrola kupónů v Core MOS.";
  }

  if (isParkingStepText(text)) {
    return "Založení, prodloužení a přehled parkovacích relací.";
  }

  if (isAccountStepText(text)) {
    if (text.includes("client/status")) {
      return "Klientská data a osobní údaje.";
    }

    return "Založení a správa účtu.";
  }

  if (text.includes("module")) {
    return "Ov\u011b\u0159en\u00ed, \u017ee slu\u017eba pro j\u00edzdenky je dostupn\u00e1.";
  }

  if (text.includes("products") || text.includes("zones") || text.includes("product")) {
    return "Prohl\u00e9dn\u011bte si dostupn\u00e9 produkty a z\u00f3ny.";
  }

  if (text.includes("offer")) {
    return "Vyberte parametry j\u00edzdenky a p\u0159ipravte nab\u00eddku.";
  }

  if (text.includes("card")) {
    return "Spr\u00e1va ulo\u017een\u00fdch platebn\u00edch karet.";
  }

  if (text.includes("device") || text.includes("firebase")) {
    return "Registrace za\u0159\u00edzen\u00ed a p\u0159\u00edprava notifika\u010dn\u00edho tokenu.";
  }

  if (text.includes("booking")) {
    return "Potvr\u010fte vybranou nab\u00eddku.";
  }

  if (text.includes("cancel")) {
    return "Zru\u0161en\u00ed rozpracovan\u00e9 rezervace.";
  }

  if (text.includes("payment") || text.includes("gdpay")) {
    return "Pokra\u010dujte platebn\u00edm krokem.";
  }

  return "Pokra\u010dujte v n\u00e1kupu j\u00edzdenky.";
}

function getMobileAppConfig(step) {
  return step?.app || state.scenario?.app || {};
}

function formatExpected(step) {
  if (!step.expected) {
    return "";
  }

  const expectedStatusText = Array.isArray(step.expected.statusIn)
    ? step.expected.statusIn.join(" nebo ")
    : (step.expected.status ?? "any");
  const parts = [`O\u010dek\u00e1van\u00e9 HTTP: ${expectedStatusText}`];

  if (step.expected.outcome) {
    parts.push(`V\u00fdsledek: ${step.expected.outcome}`);
  }

  for (const warning of step.expected.warnings || []) {
    parts.push(warning.message || "Mezistav bude označen upozorněním.");
  }

  for (const assertion of step.expected.assertions || []) {
    if (assertion.equals !== undefined) {
      const expectedValue = resolveExpectedValue(assertion.equals, step);
      parts.push(`${assertion.path} = ${JSON.stringify(expectedValue)}`);
    } else if (assertion.regex !== undefined) {
      parts.push(`${assertion.label || "$"} odpovídá regulárnímu výrazu`);
    } else if (assertion.notEmpty) {
      parts.push(`${assertion.path} nen\u00ed pr\u00e1zdn\u00e9`);
    } else if (assertion.lengthEquals !== undefined) {
      parts.push(`${assertion.path} po\u010det = ${assertion.lengthEquals}`);
    } else if (assertion.lengthAtLeast !== undefined) {
      parts.push(`${assertion.path} po\u010det >= ${assertion.lengthAtLeast}`);
    } else if (assertion.atLeast !== undefined) {
      parts.push(`${assertion.path} >= ${assertion.atLeast}`);
    }
  }

  return parts.join("\n");
}

function buildTesterDescription(step) {
  const parts = [];

  if (step.description) {
    parts.push(step.description);
  } else if (state.scenario?.description) {
    parts.push(state.scenario.description);
  }

  const instructions = [
    ...(state.scenario?.instructions || []),
    ...(step.instructions || [])
  ].filter(Boolean);

  if (instructions.length > 0) {
    parts.push(`Instrukce:\n- ${instructions.join("\n- ")}`);
  }

  return parts.join("\n\n");
}

function shouldTrackDirty(field) {
  if (field?.trackDirty === false) {
    return false;
  }

  return !requiresManualInput(state.scenario);
}
async function runCurrentStep() {
  const step = currentStep();
  const runningStepIndex = state.stepIndex;

  if (!step) {
    return;
  }

  const stepWarning = findStepWarning(step);
  if (stepWarning) {
    clearStepResultsFrom(runningStepIndex);

    const messages = [
      stepWarning.message || "Provedení tohoto kroku je v aktuálním stavu nežádoucí.",
      stepWarning.detail || ""
    ].filter(Boolean);
    const result = {
      level: "warn",
      appMessage: stepWarning.appMessage || messages[0],
      messages
    };

    state.lastStepResult = result;
    state.stepResults[runningStepIndex] = result;
    addLog("warn", `${step.title} skipped by scenario guard`, {
      reason: "ScenarioGuardWarning",
      warning: stepWarning,
      context: state.context
    });
    showResult("warn", result.appMessage || result.messages.join(" "), null, step);
    renderContext();
    updateNextStepControl();
    elements.runStep.textContent = "Zopakovat krok";
    elements.previousStep.disabled = !state.scenario || findPreviousRunnableStepIndex(state.stepIndex) === null;
    return;
  }

  if (requiresAuthorizationForStep(step)) {
    const authCheck = await ensureAuthorizationReady();
    if (!authCheck.ok) {
      const info = getAuthorizationInfo();
      state.lastStepResult = { level: "error", messages: [authCheck.message || info.message] };
      addLog("error", `${step.title} blocked`, {
        error: authCheck.message || info.message,
        reason: "MissingOrExpiredAuthorization"
      });
      showResult("error", authCheck.message || info.message);
      renderModeBanner();
      return;
    }
  }

  const missingContextKeys = getMissingContextKeys(step);

  if (missingContextKeys.length > 0) {
    const message = `Tomuto kroku chyb\u00ed data z p\u0159edchoz\u00edho v\u00fdb\u011bru: ${missingContextKeys.join(", ")}.`;
    state.lastStepResult = { level: "error", messages: [message] };
    addLog("error", `${step.title} blocked`, {
      error: message,
      reason: "MissingScenarioContext"
    });
    showResult("error", message);
    renderModeBanner();
    return;
  }

  const mosSessionCheck = validateMosSessionContextForStep(step);
  if (!mosSessionCheck.ok) {
    state.lastStepResult = { level: "error", messages: [mosSessionCheck.message] };
    addLog("error", `${step.title} blocked`, {
      error: mosSessionCheck.message,
      reason: "InvalidMosSessionContext",
      contextKeys: mosSessionCheck.keys
    });
    showResult("error", mosSessionCheck.message);
    elements.nextStep.disabled = true;
    elements.nextStep.classList.remove("ready");
    renderModeBanner();
    return;
  }

  clearStepResultsFrom(runningStepIndex);
  elements.runStep.disabled = true;
  elements.runStep.textContent = "Pracuji...";
  elements.previousStep.disabled = true;
  elements.nextStep.disabled = true;
  elements.nextStep.textContent = "Další";
  elements.nextStep.title = "";
  elements.nextStep.classList.remove("ready");
  showResult("warn", "Pracuji na požadavku...");
  let request = null;

  try {
    if (step.customAction) {
      await runCustomStep(step, runningStepIndex);
      return;
    }

    request = buildRequest(step);
    const startedAt = performance.now();
    let response = await fetch(request.url, request.options);
    let durationMs = Math.round(performance.now() - startedAt);
    let body = await readResponseBody(response);
    let mosSessionRenewed = false;

    if (isMosSessionExpiredResponse(response.status, body)) {
      const renewResult = await renewMosSessionIfPossible();

      if (renewResult.ok) {
        mosSessionRenewed = true;
        addLog("warn", "MOS session renewed", {
          reason: "MosSessionExpired",
          originalResponse: {
            status: response.status,
            body
          }
        });
        request = buildRequest(step);
        response = await fetch(request.url, request.options);
        durationMs = Math.round(performance.now() - startedAt);
        body = await readResponseBody(response);
      } else {
        addLog("error", "MOS session renew failed", {
          reason: "MosSessionExpired",
          message: renewResult.message,
          originalResponse: {
            status: response.status,
            body
          }
        });
      }
    }

    const result = evaluateStep(step, response.status, body);

    if (mosSessionRenewed && result.level !== "error") {
      result.messages = [
        "MOS session byla obnovena a krok byl automaticky zopakován.",
        ...(result.messages || [])
      ];
    }

    applyExtracts(step, body, response.status);
    applyRemember(step);
    applyRememberSecrets(step);
    const authSessionMessage = applyAuthSessionFromStep(step, body, result);

    if (authSessionMessage) {
      result.messages = [
        authSessionMessage,
        ...(result.messages || [])
      ];
      result.appMessage = authSessionMessage;
    }

    prepareSelection(step, body, response.status);
    state.lastStepResult = result;
    state.stepResults[runningStepIndex] = result;

    addLog(result.level, `${step.title} -> HTTP ${response.status}`, {
      request: {
        method: request.options.method,
        url: request.url,
        resolvedUrl: request.resolvedUrl,
        headers: request.visibleHeaders,
        body: request.visibleBody
      },
      response: {
        status: response.status,
        durationMs,
        contentType: response.headers.get("content-type") || "",
        body
      },
      expected: step.expected || null,
      mode: state.dirty ? "exploratory" : "scenario",
      notes: result.messages
    });

    showResult(result.level, result.appMessage || result.messages.join(" "), body, step);
    renderContext();
    updateNextStepControl();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    state.lastStepResult = { level: "error", messages: [message] };
    state.stepResults[runningStepIndex] = state.lastStepResult;
    addLog("error", `${step.title} failed`, {
      error: message,
      request: request ? {
        method: request.options.method,
        url: request.url,
        resolvedUrl: request.resolvedUrl,
        headers: request.visibleHeaders,
        body: request.visibleBody
      } : null
    });
    showResult("error", message);
  } finally {
    if (state.batchRunning) {
      elements.runStep.disabled = true;
      elements.runStep.textContent = "Spou\u0161t\u00edm...";
    } else {
      elements.runStep.disabled = false;
      elements.runStep.textContent = "Zopakovat krok";
      elements.previousStep.disabled = !state.scenario || findPreviousRunnableStepIndex(state.stepIndex) === null;
    }
  }
}

async function runCustomStep(step, runningStepIndex) {
  if (step.customAction === "loadMosSessionFromRedis") {
    const startedAt = performance.now();
    const loaded = await loadMosSessionFromRedisStep(step);
    const durationMs = Math.round(performance.now() - startedAt);
    const result = {
      level: "ok",
      appMessage: "MOS SessionID bylo načteno z Redis.",
      messages: [
        `SessionID je připraveno v kontextu jako ${loaded.contextKey}.`,
        `IdentityId: ${loaded.identityId}`
      ]
    };

    state.lastStepResult = result;
    state.stepResults[runningStepIndex] = result;
    addLog("ok", `${step.title} -> Redis`, {
      request: {
        action: step.customAction,
        identityId: loaded.identityId,
        key: loaded.key,
        contextKey: loaded.contextKey
      },
      response: {
        durationMs,
        ttlSeconds: loaded.ttlSeconds,
        mosLoginId: loaded.mosLoginId
      },
      expected: step.expected || null,
      mode: state.dirty ? "exploratory" : "scenario",
      notes: result.messages
    });
    showResult("ok", result.appMessage, loaded, step);
    renderContext();
    updateNextStepControl();
    return;
  }

  if (step.customAction === "mosTokenCouponsOverview") {
    const startedAt = performance.now();
    const overview = await loadMosTokenCouponsOverview(step);
    const durationMs = Math.round(performance.now() - startedAt);
    const level = overview.errors.length > 0 ? "warn" : "ok";
    const result = {
      level,
      appMessage: overview.errors.length > 0
        ? "Přehled identifikátorů a kupónů je částečný."
        : "Přehled identifikátorů a kupónů byl načten.",
      messages: overview.errors.length > 0
        ? ["Některé kupóny se nepodařilo načíst.", ...overview.errors]
        : [`Načteno ${overview.tokens.length} identifikátorů a ${overview.totalCoupons} kupónů.`]
    };

    state.lastStepResult = result;
    state.stepResults[runningStepIndex] = result;

    addLog(level, `${step.title} -> MOS přehled`, {
      request: {
        action: step.customAction,
        tokenRequests: overview.tokens.length,
        loadAllCoupons: overview.loadAllCoupons
      },
      response: {
        durationMs,
        body: overview
      },
      expected: step.expected || null,
      mode: state.dirty ? "exploratory" : "scenario",
      notes: result.messages
    });

    showResult(level, result.appMessage, overview, step);
    renderContext();
    updateNextStepControl();
    return;
  }

  if (step.customAction === "couponMoveTargetOverview") {
    const startedAt = performance.now();
    const overview = await loadCouponMoveTargetOverview(step);
    const durationMs = Math.round(performance.now() - startedAt);
    const level = overview.errors.length > 0 ? "warn" : "ok";
    const result = {
      level,
      appMessage: overview.errors.length > 0
        ? "Přehled identifikátorů a kupónů je částečný."
        : "Přehled identifikátorů a kupónů byl načten.",
      messages: overview.errors.length > 0
        ? ["Některé preview volání se nepodařilo načíst.", ...overview.errors]
        : [`Načteno ${overview.identifiers.length} identifikátorů a ${overview.totalCoupons} kupónů.`]
    };

    prepareSelection(step, overview, 200);
    state.lastStepResult = result;
    state.stepResults[runningStepIndex] = result;

    addLog(level, `${step.title} -> přehled kupónů`, {
      request: {
        action: step.customAction,
        previewRequests: overview.previewRequests
      },
      response: {
        durationMs,
        body: overview
      },
      expected: step.expected || null,
      mode: state.dirty ? "exploratory" : "scenario",
      notes: result.messages
    });

    showResult(level, result.appMessage, overview, step);
    renderContext();
    updateNextStepControl();
    return;
  }

  throw new Error(`Neznámá vlastní akce kroku: ${step.customAction}`);
}

async function loadMosSessionFromRedisStep(step) {
  const contextKey = step.redisSession?.contextKey || "mosCouponSessionId";
  const identityContextKey = step.redisSession?.identityContextKey || "pidLitackaIdentityId";
  const identityId = getPidLitackaIdentityIdForRedis(identityContextKey);

  if (!identityId) {
    throw new Error("Chybí PidLitacka IdentityId pro načtení MOS SessionID z Redis. Nejdříve se přihlaste do projektu PidLitacka nebo spusťte workflow od kroku, který PidLitacka uživatele přihlásí.");
  }

  let session = await fetchRedisSession(identityId);

  if (!isUsableRedisSession(session)) {
    const renewResult = await renewPidLitackaMosSessionForWorkflow();

    if (!renewResult.ok) {
      throw new Error(`Redis session pro identityId ${identityId} není použitelná: ${getRedisSessionProblem(session) || "UnknownRedisSessionProblem"}. Obnova MOS session selhala: ${renewResult.message}`);
    }

    await delay(300);
    session = await fetchRedisSession(identityId);

    if (!isUsableRedisSession(session)) {
      throw new Error(`Redis session pro identityId ${identityId} není použitelná ani po obnově: ${getRedisSessionProblem(session) || "UnknownRedisSessionProblem"}.`);
    }
  }

  const sessionId = session.sessionId || session.payload?.sessionId || session.payload?.SessionId;
  state.context[contextKey] = sessionId;
  state.context[identityContextKey] = identityId;
  state.redisLastSession = session;

  return {
    kind: "mosSessionFromRedis",
    identityId,
    contextKey,
    key: session.key,
    ttlSeconds: session.ttlSeconds,
    mosLoginId: session.payload?.mosLoginId ?? session.payload?.MosLoginId ?? "",
    sessionIdMasked: maskSessionId(sessionId)
  };
}

function getPidLitackaIdentityIdForRedis(identityContextKey = "pidLitackaIdentityId") {
  const currentPidLitackaIdentityId = getCurrentPidLitackaIdentityId();

  return String(
    currentPidLitackaIdentityId
    || state.context?.[identityContextKey]
    || state.workflowContext?.[identityContextKey]
    || state.context?.pidLitackaIdentityId
    || state.context?.authIdentityId
    || ""
  ).trim();
}

function getCurrentPidLitackaIdentityId() {
  return String(getCurrentPidLitackaAuthSession()?.identityId || "").trim();
}

function getCurrentPidLitackaAuthSession() {
  if (state.currentProject?.id === "pidlitacka" && state.authSession?.identityId) {
    return state.authSession;
  }

  return loadLastPidLitackaAuthSession();
}

function loadLastPidLitackaAuthSession() {
  const project = state.projectIndex?.projects?.find(item => item.id === "pidlitacka");
  const environments = project?.environments || [];
  const preferredEnvironmentIds = [
    getSavedEnvironmentId(project),
    project?.defaultEnvironmentId,
    ...environments.map(environment => environment.id)
  ].filter(Boolean);

  for (const environmentId of [...new Set(preferredEnvironmentIds)]) {
    const session = loadSavedAuthSession(project, environmentId);
    if (session?.identityId) {
      return session;
    }
  }

  return null;
}

function maskSessionId(sessionId) {
  const value = String(sessionId || "");
  return value.length > 12
    ? `${value.slice(0, 8)}...${value.slice(-4)}`
    : value;
}

async function loadMosTokenCouponsOverview(step) {
  const serviceKey = getCurrentApiKey();
  const sessionId = state.context.mosCouponSessionId;
  const loadAllCoupons = String(state.values.loadAllCoupons ?? "true");

  if (!serviceKey) {
    throw new Error("Chybí Core MOS ServiceKey v panelu Přístup.");
  }

  if (!sessionId) {
    throw new Error("Chybí MOS SessionID. Nejdříve spusťte krok přihlášení.");
  }

  const tokensResponse = await callMosSoap("GetTokens", `
    <GetTokens xmlns="globdata">
      <ServiceKey>${escapeXml(serviceKey)}</ServiceKey>
      <SessionID>${escapeXml(sessionId)}</SessionID>
      <GetOnlyAvailableTokens>true</GetOnlyAvailableTokens>
    </GetTokens>`);

  const tokensResultId = getXmlElementText(tokensResponse.body, "ID");
  const tokensResultText = getXmlElementText(tokensResponse.body, "Text");

  if (tokensResponse.status !== 200 || tokensResultId !== "0") {
    throw new Error(`MOS nevrátil seznam tokenů. HTTP ${tokensResponse.status}, Result.ID ${tokensResultId || "-"}. ${tokensResultText || ""}`.trim());
  }

  const tokens = parseMosTokenItems(tokensResponse.body);
  const errors = [];

  for (const token of tokens) {
    const couponsResponse = await callMosSoap("GetCoupons", `
      <GetCoupons xmlns="globdata">
        <ServiceKey>${escapeXml(serviceKey)}</ServiceKey>
        <SessionID>${escapeXml(sessionId)}</SessionID>
        <TokenID>${escapeXml(token.tokenId)}</TokenID>
        <LoadAllCoupons>${escapeXml(loadAllCoupons)}</LoadAllCoupons>
      </GetCoupons>`);

    token.couponsHttpStatus = couponsResponse.status;
    token.couponsResultId = getXmlOperationResultId(couponsResponse.body, "GetCouponsResult");
    token.couponsResultText = getXmlOperationResultText(couponsResponse.body, "GetCouponsResult");
    token.coupons = parseMosCouponItems(couponsResponse.body);

    if (couponsResponse.status !== 200 || token.couponsResultId !== "0") {
      errors.push(`Token ${token.tokenId}: HTTP ${couponsResponse.status}, Result.ID ${token.couponsResultId || "-"} ${token.couponsResultText || ""}`.trim());
    }
  }

  return {
    kind: "mosTokenCouponsOverview",
    loadAllCoupons: loadAllCoupons === "true",
    totalTokens: tokens.length,
    totalCoupons: tokens.reduce((sum, token) => sum + token.coupons.length, 0),
    tokens,
    errors
  };
}

async function loadCouponMoveTargetOverview(step) {
  const identifiersResponse = await callPidLitackaJson("/v1/client/identifiers");
  const identifiers = Array.isArray(identifiersResponse.body?.identifiers)
    ? identifiersResponse.body.identifiers
    : [];
  const couponMap = new Map();
  const previewByTarget = new Map();
  const errors = [];

  for (const identifier of identifiers) {
    const targetIdentifierId = identifier.identifierId;

    if (isEmpty(targetIdentifierId)) {
      continue;
    }

    try {
      const previewResponse = await callPidLitackaJson(`/v1/client/coupons/move-preview?targetIdentifierId=${encodeURIComponent(targetIdentifierId)}`);
      const preview = previewResponse.body || {};
      previewByTarget.set(String(targetIdentifierId), preview);

      for (const source of preview.sources || []) {
        const sourceIdentifier = source.identifier || {};
        const sourceIdentifierId = sourceIdentifier.identifierId;

        if (isEmpty(sourceIdentifierId)) {
          continue;
        }

        const key = String(sourceIdentifierId);
        const existing = couponMap.get(key) || {
          identifier: sourceIdentifier,
          coupons: []
        };

        existing.identifier = {
          ...existing.identifier,
          ...sourceIdentifier
        };
        existing.coupons = mergeCouponsById(existing.coupons, source.coupons || []);
        couponMap.set(key, existing);
      }
    } catch (error) {
      errors.push(`Target ${targetIdentifierId}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  const enrichedIdentifiers = identifiers.map(identifier => {
    const key = String(identifier.identifierId);
    const couponInfo = couponMap.get(key);
    const preview = previewByTarget.get(key);

    return {
      ...identifier,
      coupons: couponInfo?.coupons || [],
      moveCandidateCouponCount: Number(preview?.couponCount || 0),
      moveCandidateSourceCount: Array.isArray(preview?.sources) ? preview.sources.length : 0,
      movePreviewStatus: preview?.status || "",
      movePreviewWarnings: preview?.warnings || []
    };
  });
  state.context.pidCouponIdentifierLabels = Object.fromEntries(
    enrichedIdentifiers
      .filter(identifier => !isEmpty(identifier.identifierId))
      .map(identifier => [String(identifier.identifierId), getIdentifierDisplayName(identifier)])
  );

  return {
    kind: "couponMoveTargetOverview",
    identifiers: enrichedIdentifiers,
    totalIdentifiers: enrichedIdentifiers.length,
    totalCoupons: enrichedIdentifiers.reduce((sum, identifier) => sum + (identifier.coupons?.length || 0), 0),
    previewRequests: previewByTarget.size,
    errors
  };
}

function mergeCouponsById(existing, incoming) {
  const result = [...(existing || [])];
  const keys = new Set(result.map(coupon => String(coupon.couponId ?? JSON.stringify(coupon))));

  for (const coupon of incoming || []) {
    const key = String(coupon.couponId ?? JSON.stringify(coupon));

    if (!keys.has(key)) {
      keys.add(key);
      result.push(coupon);
    }
  }

  return result;
}

async function callPidLitackaJson(path) {
  const baseUrl = elements.baseUrl.value.replace(/\/$/, "");
  const url = `${baseUrl}${path}`;
  const headers = {};

  if (state.authSession?.accessToken) {
    headers.Authorization = `Bearer ${state.authSession.accessToken}`;
  }

  const response = await fetch(url, {
    method: "GET",
    headers
  });
  const body = response.status === 204 ? null : await readResponseBody(response);

  if (!response.ok) {
    throw new Error(body?.detail || body?.title || `HTTP ${response.status}`);
  }

  return {
    status: response.status,
    body
  };
}

async function callMosSoap(operation, bodyContent) {
  const baseUrl = elements.baseUrl.value.replace(/\/$/, "");
  const url = `${baseUrl}/services/MOSservice.asmx`;
  const body = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>${bodyContent}
  </soap:Body>
</soap:Envelope>`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "text/xml; charset=utf-8",
      "SOAPAction": `"globdata/${operation}"`
    },
    body
  });

  return {
    status: response.status,
    contentType: response.headers.get("content-type") || "",
    body: await readResponseBody(response)
  };
}

async function runScenarioToSelectedStep() {
  if (!state.scenario) {
    return;
  }

  const scenarioId = state.scenario.id;
  const targetIndex = Number(elements.autoRunTarget.value);

  selectScenario(scenarioId);
  setAutoRunControls(true);
  showAutoRunSummary("warn", "Sc\u00e9n\u00e1\u0159 b\u011b\u017e\u00ed...", []);

  const results = [];

  for (let index = 0; index <= targetIndex; index += 1) {
    state.stepIndex = index;
    renderStep();
    setAutoRunControls(true);

    await runCurrentStep();

    results.push({
      index,
      title: state.scenario.steps[index].title,
      level: state.lastStepResult?.level || "error",
      messages: state.lastStepResult?.messages || ["Krok nevr\u00e1til v\u00fdsledek."]
    });
  }

  showAutoRunSummaryFromResults(results);
  addLog("ok", "Auto run finished", {
    scenario: state.scenario.id,
    targetStep: targetIndex + 1,
    failedSteps: results
      .filter(result => result.level === "error")
      .map(result => result.index + 1)
  });
  setAutoRunControls(false);
}

async function startSelectedWorkflow() {
  const workflow = getSelectedWorkflow();

  if (!workflow) {
    return;
  }

  prepareWorkflowRun(workflow, 0, {
    keepContext: false,
    keepPreviousResults: false
  });
  state.log = [];
  addLog("ok", "Workflow started", {
    id: workflow.id,
    name: workflow.name,
    items: workflow.items?.length || 0
  });
  await continueWorkflowRun();
}

async function startWorkflowFromItem(workflowId, itemIndex) {
  const workflow = (state.workflowIndex?.workflows || []).find(item => item.id === workflowId);

  if (!workflow || !workflow.items?.[itemIndex]) {
    return;
  }

  const keepContext = state.workflowRun?.workflowId === workflow.id;
  state.selectedWorkflowId = workflow.id;
  prepareWorkflowRun(workflow, itemIndex, {
    keepContext,
    keepPreviousResults: keepContext,
    skipInitialSync: true
  });
  clearOpenWorkflowItemProgress(workflow.items[itemIndex]);
  addLog("ok", "Workflow restarted from selected item", {
    id: workflow.id,
    name: workflow.name,
    itemIndex,
    item: workflow.items[itemIndex]?.title || workflow.items[itemIndex]?.scenarioId
  });
  showWorkflowSummary("warn", "Workflow bude pokra\u010dovat od vybran\u00e9 \u010d\u00e1sti.", [
    workflow.name,
    workflow.items[itemIndex]?.title || workflow.items[itemIndex]?.scenarioId
  ]);
  await continueWorkflowRun();
}

function prepareWorkflowRun(workflow, itemIndex, options = {}) {
  const keepContext = options.keepContext === true;
  const keepPreviousResults = options.keepPreviousResults === true;
  const skipInitialSync = options.skipInitialSync === true;
  const previousResults = keepPreviousResults
    ? (state.workflowRun?.results || []).filter(result => {
        const resultItemIndex = getWorkflowResultItemIndex(workflow, result);
        return resultItemIndex >= 0 && resultItemIndex < itemIndex;
      })
    : [];

  if (!keepContext) {
    state.workflowContext = {};
    state.workflowSecrets = {};
  }

  state.workflowRun = {
    workflowId: workflow.id,
    itemIndex,
    stepIndex: 0,
    results: previousResults,
    startedAt: new Date().toISOString(),
    status: "running",
    skipInitialSync
  };
  state.workflowLastReport = null;
}

function clearOpenWorkflowItemProgress(item) {
  if (!item || !isWorkflowItemOpen(item)) {
    return;
  }

  state.stepIndex = 0;
  state.stepResults = {};
  state.lastStepResult = null;
  state.displayedResult = null;
  state.activeSelection = null;
}

function getWorkflowResultItemIndex(workflow, result) {
  return (workflow.items || []).findIndex(item =>
    item.projectId === result.projectId
    && item.packId === result.packId
    && item.scenarioId === result.scenarioId);
}

async function continueWorkflowRun() {
  const workflow = getSelectedWorkflow();

  if (!workflow || !state.workflowRun) {
    return;
  }

  syncCurrentStepFormValuesFromDom();
  if (state.workflowRun.skipInitialSync) {
    state.workflowRun.skipInitialSync = false;
  } else {
    synchronizeWorkflowRunFromCurrentScenario(workflow);
  }
  state.workflowRun.status = "running";
  state.workflowRunning = true;
  state.workflowStopRequested = false;
  state.batchRunning = true;
  setWorkflowControls(true);
  activateRightTab("tester");
  showWorkflowSummary("warn", "Workflow běží...", [
    workflow.name
  ]);

  try {
    while (state.workflowRun.itemIndex < (workflow.items || []).length) {
      if (state.workflowStopRequested) {
        pauseWorkflow("Workflow byl zastaven uživatelem.", "warn");
        return;
      }

      const item = workflow.items[state.workflowRun.itemIndex];
      await applyWorkflowRedisSession(item);
      await openWorkflowItem(item);
      const scenario = state.scenario;

      if (!scenario) {
        pauseWorkflow(`Scénář ${item.scenarioId} nebyl nalezen.`, "error");
        return;
      }

      while (state.workflowRun.stepIndex < scenario.steps.length) {
        if (state.workflowStopRequested) {
          pauseWorkflow("Workflow byl zastaven uživatelem.", "warn");
          return;
        }

        applyWorkflowContextToScenario();
        const runnableStepIndex = findNextRunnableStepIndex(state.workflowRun.stepIndex);
        if (runnableStepIndex !== state.workflowRun.stepIndex) {
          state.workflowRun.stepIndex = runnableStepIndex;
        }

        if (state.workflowRun.stepIndex >= scenario.steps.length) {
          break;
        }

        const step = scenario.steps[state.workflowRun.stepIndex];
        state.stepIndex = state.workflowRun.stepIndex;
        renderStep({ preserveValues: true });
        setWorkflowControls(true);

        const beforeStop = getWorkflowStopBeforeStep(step);
        if (elements.workflowAutoStop.checked && beforeStop) {
          pauseWorkflow(beforeStop.message, "warn", beforeStop.lines);
          return;
        }

        await runCurrentStep();
        syncWorkflowContextFromScenario();

        const result = {
          projectId: item.projectId,
          packId: item.packId,
          scenarioId: item.scenarioId,
          scenarioTitle: scenario.title,
          stepId: step.id,
          stepTitle: step.title,
          level: state.lastStepResult?.level || "error",
          messages: state.lastStepResult?.messages || []
        };
        state.workflowRun.results.push(result);

        if (result.level === "error") {
          pauseWorkflow(`Workflow se zastavil na chybě kroku: ${step.title}`, "error");
          return;
        }

        applyWorkflowAutoSelection(item, step);

        const selectionStop = getWorkflowSelectionStopAfterStep(step);
        if (elements.workflowAutoStop.checked && selectionStop) {
          pauseWorkflow(selectionStop.message, "warn", selectionStop.lines, { preserveResult: true });
          return;
        }

        state.workflowRun.stepIndex += 1;

        const afterStop = getWorkflowStopAfterStep(item, step);
        if (elements.workflowAutoStop.checked && afterStop) {
          pauseWorkflow(afterStop.message, "warn", afterStop.lines, {
            preserveResult: afterStop.preserveResult === true
          });
          return;
        }
      }

      addLog("ok", "Workflow scenario finished", {
        projectId: item.projectId,
        packId: item.packId,
        scenarioId: item.scenarioId,
        title: item.title || scenario.title
      });
      state.workflowRun.itemIndex += 1;
      state.workflowRun.stepIndex = 0;
    }

    finishWorkflow(workflow);
  } catch (error) {
    pauseWorkflow("Workflow se zastavil na neočekávané chybě.", "error", [
      error instanceof Error ? error.message : String(error)
    ]);
  } finally {
    const paused = state.workflowRun?.status === "paused";
    const completed = state.workflowRun?.status === "completed";
    state.workflowRunning = false;
    state.batchRunning = false;
    setWorkflowControls(false);
    if (completed) {
      showWorkflowCompletionResult(state.workflowLastReport || buildWorkflowReport(workflow));
    } else if (!paused) {
      renderStep();
    }
    renderWorkflowList();
  }
}

function synchronizeWorkflowRunFromCurrentScenario(workflow) {
  const run = state.workflowRun;

  if (!run || !state.scenario) {
    return;
  }

  const currentItem = workflow.items?.[run.itemIndex];

  if (!currentItem || !isWorkflowItemOpen(currentItem)) {
    return;
  }

  syncWorkflowContextFromScenario();
  syncCompletedWorkflowStepResults(currentItem, state.scenario);

  const firstIncompleteStepIndex = findFirstIncompleteWorkflowStepIndex(state.scenario);
  if (firstIncompleteStepIndex === null) {
    addLog("ok", "Workflow progress synchronized", {
      reason: "Current scenario was completed manually",
      scenarioId: state.scenario.id,
      completedItemIndex: run.itemIndex,
      nextItemIndex: run.itemIndex + 1
    });
    run.itemIndex += 1;
    run.stepIndex = 0;
    return;
  }

  if (firstIncompleteStepIndex !== run.stepIndex) {
    addLog("ok", "Workflow progress synchronized", {
      reason: "Scenario steps were advanced manually",
      scenarioId: state.scenario.id,
      previousStepIndex: run.stepIndex,
      nextStepIndex: firstIncompleteStepIndex
    });
    run.stepIndex = firstIncompleteStepIndex;
  }
}

function syncCompletedWorkflowStepResults(item, scenario) {
  const run = state.workflowRun;

  if (!run) {
    return;
  }

  for (let index = 0; index < scenario.steps.length; index += 1) {
    const result = state.stepResults[String(index)];

    if (!result || result.level === "error") {
      continue;
    }

    const step = scenario.steps[index];
    const alreadyTracked = run.results.some(existing =>
      existing.projectId === item.projectId
      && existing.packId === item.packId
      && existing.scenarioId === item.scenarioId
      && existing.stepId === step.id);

    if (alreadyTracked) {
      continue;
    }

    run.results.push({
      projectId: item.projectId,
      packId: item.packId,
      scenarioId: item.scenarioId,
      scenarioTitle: scenario.title,
      stepId: step.id,
      stepTitle: step.title,
      level: result.level,
      messages: result.messages || [],
      mode: "manual"
    });
  }
}

function isWorkflowItemOpen(item) {
  return state.currentProject?.id === item.projectId
    && state.currentPackId === item.packId
    && state.scenario?.id === item.scenarioId;
}

function findFirstIncompleteWorkflowStepIndex(scenario) {
  for (let index = 0; index < scenario.steps.length; index += 1) {
    const step = scenario.steps[index];
    if (shouldSkipStep(step)) {
      continue;
    }

    const result = state.stepResults[String(index)];

    if (!result || result.level === "error") {
      return index;
    }

    if (step?.selection && state.activeSelection?.stepId === step.id && state.activeSelection.selectedIndex === null) {
      return index;
    }
  }

  return null;
}

function requestStopWorkflowRun() {
  state.workflowStopRequested = true;
  updateWorkflowStatus("Zastavuji...");
}

async function openWorkflowItem(item) {
  if (state.currentProject?.id !== item.projectId) {
    await loadProject(item.projectId, {
      packId: item.packId,
      scenarioId: item.scenarioId,
      suppressLog: true
    });
  } else if (state.currentPackId !== item.packId) {
    await loadScenarioPack(item.packId, {
      scenarioId: item.scenarioId,
      suppressLog: true
    });
  } else if (state.scenario?.id !== item.scenarioId) {
    selectScenario(item.scenarioId, {
      preserveLog: true,
      suppressLog: true,
      persistSelection: false
    });
  }

  applyWorkflowContextToScenario();
  renderStep({ preserveValues: true });
  addLog("ok", "Workflow scenario selected", {
    projectId: item.projectId,
    packId: item.packId,
    scenarioId: item.scenarioId,
    title: item.title || state.scenario?.title
  });
}

function applyWorkflowContextToScenario() {
  state.context = {
    ...state.workflowContext,
    ...state.context
  };
  state.secrets = {
    ...state.workflowSecrets,
    ...state.secrets
  };
}

function syncWorkflowContextFromScenario() {
  applyAuthSessionContext();
  state.workflowContext = {
    ...state.workflowContext,
    ...state.context
  };
  state.workflowSecrets = {
    ...state.workflowSecrets,
    ...state.secrets
  };
}

async function applyWorkflowRedisSession(item) {
  const config = item?.redisSession;

  if (!config || !isEmpty(state.workflowContext?.[config.contextKey || "mosCouponSessionId"])) {
    return;
  }

  const identityContextKey = config.identityContextKey || "pidLitackaIdentityId";
  const identityId = getPidLitackaIdentityIdForRedis(identityContextKey);

  if (!identityId) {
    addLog("warn", "Redis MOS session skipped", {
      reason: "MissingIdentityId",
      identityContextKey
    });
    return;
  }

  try {
    let session = await fetchRedisSession(identityId);

    if (!isUsableRedisSession(session)) {
      addLog("warn", "Redis MOS session not found", {
        identityId,
        key: session.key,
        exists: session.exists,
        reason: getRedisSessionProblem(session)
      });

      const renewResult = await renewPidLitackaMosSessionForWorkflow();
      if (!renewResult.ok) {
        addLog("warn", "Redis MOS session renewal skipped", {
          identityId,
          message: renewResult.message
        });
        return;
      }

      await delay(300);
      session = await fetchRedisSession(identityId);

      if (!isUsableRedisSession(session)) {
        addLog("warn", "Redis MOS session still missing after renewal", {
          identityId,
          key: session.key,
          exists: session.exists,
          reason: getRedisSessionProblem(session)
        });
        return;
      }
    }

    const sessionId = session.sessionId || session.payload?.sessionId || session.payload?.SessionId;
    const contextKey = config.contextKey || "mosCouponSessionId";
    state.workflowContext[contextKey] = sessionId;
    state.context[contextKey] = sessionId;
    state.redisLastSession = session;
    addLog("ok", "Redis MOS session applied", {
      identityId,
      key: session.key,
      ttlSeconds: session.ttlSeconds,
      contextKey
    });
  } catch (error) {
    addLog("warn", "Redis MOS session failed", {
      identityId,
      message: error instanceof Error ? error.message : String(error)
    });
  }
}

async function renewPidLitackaMosSessionForWorkflow() {
  const pidLitackaProject = state.projectIndex?.projects?.find(project => project.id === "pidlitacka");

  if (!pidLitackaProject) {
    return {
      ok: false,
      message: "Projekt PidLitacka neni v katalogu dostupny."
    };
  }

  const environmentId = getSavedEnvironmentId(pidLitackaProject) || getDefaultEnvironmentId(pidLitackaProject);
  const previous = {
    currentProject: state.currentProject,
    currentEnvironmentId: state.currentEnvironmentId,
    authSession: state.authSession,
    authFormValues: state.authFormValues,
    authProfileNotes: state.authProfileNotes,
    authCustomProfiles: state.authCustomProfiles
  };

  try {
    state.currentProject = pidLitackaProject;
    state.currentEnvironmentId = environmentId;
    state.authFormValues = loadSavedAuthFormValues(pidLitackaProject);
    state.authProfileNotes = loadSavedAuthProfileNotes(pidLitackaProject);
    state.authCustomProfiles = loadSavedAuthCustomProfiles(pidLitackaProject);
    applyAuthFieldDefaults(getProjectAuthConfig(pidLitackaProject));
    state.authSession = loadSavedAuthSession(pidLitackaProject, environmentId);

    return await renewMosSessionIfPossible();
  } finally {
    state.currentProject = previous.currentProject;
    state.currentEnvironmentId = previous.currentEnvironmentId;
    state.authSession = previous.authSession;
    state.authFormValues = previous.authFormValues;
    state.authProfileNotes = previous.authProfileNotes;
    state.authCustomProfiles = previous.authCustomProfiles;
  }
}

function getWorkflowStopBeforeStep(step) {
  const needsInput = stepNeedsWorkflowInput(step);

  if (step.workflowStop && needsInput) {
    return normalizeWorkflowStop(step.workflowStop, `Čeká se na ruční doplnění kroku: ${step.title}`);
  }

  if ((step.manualStop || step.interaction) && needsInput) {
    return {
      message: `Čeká se na ruční doplnění kroku: ${step.title}`,
      lines: getStepInstructionLines(step)
    };
  }

  if (needsInput) {
    return {
      message: `Čeká se na ruční doplnění kroku: ${step.title}`,
      lines: getStepInstructionLines(step)
    };
  }

  return null;
}

function stepNeedsWorkflowInput(step) {
  const fields = step.fields || [];
  const hasWorkflowFields = fields.some(field =>
    field
    && field.workflowAutoStop !== false
    && field.type !== "info"
    && field.type !== "image-file");

  if (!hasWorkflowFields) {
    return Boolean(step.workflowStop || step.manualStop || step.interaction);
  }

  return fields.some(field => workflowFieldNeedsInput(field));
}

function workflowFieldNeedsInput(field) {
  if (!field || field.workflowAutoStop === false || field.type === "info") {
    return false;
  }

  if (field.type === "image-file") {
    return false;
  }

  const value = state.values[field.name];
  return isEmpty(value);
}

function getWorkflowStopAfterStep(item, step) {
  const stopAfter = (item.stopAfter || []).find(stop => stop.stepId === step.id);

  if (stopAfter) {
    return normalizeWorkflowStop(stopAfter, `Čeká se na navazující ruční akci po kroku: ${step.title}`);
  }

  if ((item.stopAfterStepIds || []).includes(step.id)) {
    return {
      message: `Čeká se na navazující ruční akci po kroku: ${step.title}`,
      lines: getStepInstructionLines(step)
    };
  }

  return null;
}

function getWorkflowSelectionStopAfterStep(step) {
  if (state.activeSelection?.stepId === step.id && state.activeSelection.selectedIndex === null) {
    const buttonLabel = state.activeSelection.config?.buttonLabel || "Vybrat";
    return {
      message: `Čeká se na výběr z odpovědi kroku: ${step.title}`,
      lines: [`V náhledu mobilu klikněte na „${buttonLabel}“ u požadované položky a potom pokračujte ve workflow.`]
    };
  }

  return null;
}

function applyWorkflowAutoSelection(item, step) {
  if (!state.activeSelection || state.activeSelection.stepId !== step.id || state.activeSelection.selectedIndex !== null) {
    return false;
  }

  const rule = getWorkflowAutoSelectionRule(item, step);

  if (!rule) {
    return false;
  }

  const selectedIndex = resolveWorkflowAutoSelectionIndex(state.activeSelection.items, rule);

  if (selectedIndex === null) {
    addLog("warn", "Workflow automatic selection skipped", {
      stepId: step.id,
      reason: "No selectable item matched the workflow rule.",
      rule
    });
    return false;
  }

  applySelection(selectedIndex);
  syncWorkflowContextFromScenario();
  addLog("ok", "Workflow automatic selection applied", {
    stepId: step.id,
    selectedIndex,
    rule
  });
  return true;
}

function getWorkflowAutoSelectionRule(item, step) {
  const rules = Array.isArray(item?.autoSelect) ? item.autoSelect : [];
  return rules.find(rule => rule?.stepId === step.id) || null;
}

function resolveWorkflowAutoSelectionIndex(items, rule) {
  if (!Array.isArray(items) || items.length === 0) {
    return null;
  }

  for (const match of asArray(rule.preferredMatches)) {
    const index = findWorkflowSelectionMatchIndex(items, match);

    if (index !== null) {
      return index;
    }
  }

  if (rule.match) {
    const index = findWorkflowSelectionMatchIndex(items, rule.match);

    if (index !== null) {
      return index;
    }
  }

  if (rule.strategy === "random") {
    return Math.floor(Math.random() * items.length);
  }

  if (rule.fallback === false) {
    return null;
  }

  return 0;
}

function findWorkflowSelectionMatchIndex(items, match) {
  if (!match || typeof match !== "object") {
    return null;
  }

  const entries = Object.entries(match);

  if (entries.length === 0) {
    return null;
  }

  const index = items.findIndex(item => entries.every(([key, expected]) =>
    String(item?.[key] ?? "") === String(expected ?? "")));

  return index >= 0 ? index : null;
}

function normalizeWorkflowStop(stop, fallbackMessage) {
  if (typeof stop === "string") {
    return {
      message: stop || fallbackMessage,
      lines: [],
      preserveResult: false
    };
  }

  return {
    message: stop.message || stop.title || fallbackMessage,
    preserveResult: stop.preserveResult === true,
    lines: [
      ...(stop.instructions || []),
      ...(stop.contextKeys || [])
        .filter(key => !isEmpty(state.workflowContext[key] ?? state.context[key]))
        .map(key => `${key}: ${formatWorkflowValue(state.workflowContext[key] ?? state.context[key])}`)
    ]
  };
}

function getStepInstructionLines(step) {
  return [
    ...(step.instructions || []),
    ...(step.fields || [])
      .filter(field => workflowFieldNeedsInput(field))
      .map(field => `Vyplňte pole: ${field.label || field.name}`)
  ];
}

function pauseWorkflow(message, level = "warn", extraLines = [], options = {}) {
  state.workflowRunning = false;
  state.batchRunning = false;
  if (state.workflowRun) {
    state.workflowRun.status = "paused";
  }
  addLog(level, "Workflow paused", {
    message,
    workflow: state.workflowRun
      ? {
          workflowId: state.workflowRun.workflowId,
          itemIndex: state.workflowRun.itemIndex,
          stepIndex: state.workflowRun.stepIndex
        }
      : null,
    context: state.workflowContext
  });
  showWorkflowSummary(level, message, [
    ...extraLines,
    ...buildWorkflowProgressLines()
  ]);
  setWorkflowControls(false);
  updateWorkflowStatus("Pozastaveno");
  if (!options.preserveResult) {
    syncVisibleStepFromWorkflowRun();
    renderStep({ preserveValues: true });
    showWorkflowPauseResult(level, message, extraLines);
  } else {
    showWorkflowPauseNoticeInCurrentResult(level, message, extraLines);
  }
}

function syncVisibleStepFromWorkflowRun() {
  const workflow = getSelectedWorkflow();
  const run = state.workflowRun;

  if (!workflow || !run || !state.scenario) {
    return;
  }

  const item = workflow.items?.[run.itemIndex];

  if (!item || !isWorkflowItemOpen(item)) {
    return;
  }

  state.stepIndex = run.stepIndex;
}

function showWorkflowPauseResult(level, message, lines = []) {
  clearResultCountdown();
  state.displayedResult = {
    level,
    message,
    body: null,
    step: currentStep(),
    workflowPaused: true
  };
  elements.resultCard.className = `result-card ${level} workflow-pause-result`;
  elements.resultCard.innerHTML = `
    <strong class="result-title">Workflow pozastaveno</strong>
    <div class="result-message">${escapeHtml(message)}</div>
    ${lines.length > 0 ? `<ul class="workflow-pause-lines">${lines.map(line => `<li>${escapeHtml(line)}</li>`).join("")}</ul>` : ""}
    <div class="workflow-pause-next">Po dokončení ruční akce klikněte na <strong>Pokračovat ve workflow</strong>.</div>
  `;
}

function showWorkflowPauseNoticeInCurrentResult(level, message, lines = []) {
  const existing = elements.resultCard.querySelector("[data-workflow-pause-notice]");

  if (existing) {
    existing.remove();
  }

  const notice = document.createElement("section");
  notice.dataset.workflowPauseNotice = "true";
  notice.className = `workflow-pause-inline ${level}`;
  notice.innerHTML = `
    <strong>Workflow pozastaveno</strong>
    <p>${escapeHtml(message)}</p>
    ${lines.length > 0 ? `<ul>${lines.map(line => `<li>${escapeHtml(line)}</li>`).join("")}</ul>` : ""}
    <div>Po dokončení ruční akce klikněte na <strong>Pokračovat ve workflow</strong>.</div>
  `;
  elements.resultCard.prepend(notice);
}

function finishWorkflow(workflow) {
  if (state.workflowRun) {
    state.workflowRun.status = "completed";
    state.workflowRun.completedAt = new Date().toISOString();
    state.workflowRun.itemIndex = workflow.items?.length || state.workflowRun.itemIndex;
    state.workflowRun.stepIndex = 0;
  }

  const report = buildWorkflowReport(workflow);
  state.workflowLastReport = report;
  addLog("ok", "Workflow finished", report);
  showWorkflowSummary("ok", "Workflow dokončen.", report.lines);
  updateWorkflowStatus("Dokončeno");
}

function showWorkflowCompletionResult(report) {
  clearResultCountdown();
  state.displayedResult = {
    level: "ok",
    message: "Workflow dokončeno.",
    body: report,
    step: null,
    workflowCompleted: true
  };
  elements.screenTitle.textContent = "Workflow dokončeno";
  elements.screenDescription.textContent = report.workflowName || "Běh workflow doběhl do konce.";
  elements.testerTitle.textContent = "Workflow dokončeno";
  elements.testerDescription.textContent = "Souhrn provedených scénářů a uloženého kontextu.";
  elements.testerExpected.textContent = "";
  elements.stepCounter.textContent = "";
  elements.stepForm.innerHTML = "";
  elements.resultCard.className = "result-card ok workflow-complete-result";
  elements.resultCard.innerHTML = buildWorkflowCompletionHtml(report);
  elements.nextStep.disabled = true;
  elements.nextStep.textContent = "Další";
  elements.nextStep.title = "";
  elements.nextStep.classList.remove("ready");
  renderContext();
}

function buildWorkflowCompletionHtml(report) {
  const results = Array.isArray(report.results) ? report.results : [];
  const failed = results.filter(result => result.level === "error");
  const warnings = results.filter(result => result.level === "warn");
  const grouped = groupWorkflowResults(results);
  const contextEntries = Object.entries(report.context || {})
    .filter(([, value]) => !isEmpty(value))
    .slice(0, 12);

  return `
    <strong class="result-title">Workflow dokončeno</strong>
    <div class="result-message">${escapeHtml(report.workflowName || "Workflow doběhl do konce.")}</div>
    <div class="app-card-list">
      <article class="app-card">
        <strong>Výsledek</strong>
        <p>${escapeHtml(failed.length > 0
          ? "Workflow doběhlo, ale některé kroky selhaly."
          : warnings.length > 0
            ? "Workflow doběhlo s upozorněními."
            : "Workflow doběhlo bez chyb.")}</p>
        <div class="app-card-meta">
          ${renderAppChip(report.status || "Completed")}
          ${renderAppChip(`${results.length} kroků`)}
          ${warnings.length > 0 ? renderAppChip(`${warnings.length} upozornění`) : ""}
          ${failed.length > 0 ? renderAppChip(`${failed.length} chyb`) : ""}
        </div>
      </article>
      ${grouped.map(group => `
        <article class="app-card">
          <strong>${escapeHtml(group.title)}</strong>
          <p>${escapeHtml(formatCount(group.results.length, "krok proběhl", "kroky proběhly", "kroků proběhlo"))}</p>
          <div class="app-card-details">
            ${group.results.map(result => `
              <div class="app-detail-row">
                <span>${escapeHtml(result.stepTitle || result.stepId || "Krok")}</span>
                <span>${escapeHtml(getWorkflowResultLabel(result))}</span>
              </div>
            `).join("")}
          </div>
        </article>
      `).join("")}
      ${contextEntries.length > 0 ? `
        <article class="app-card">
          <strong>Uložené hodnoty</strong>
          <p>Vybrané hodnoty z workflow kontextu.</p>
          <div class="app-card-details">
            ${contextEntries.map(([key, value]) => `
              <div class="app-detail-row">
                <span>${escapeHtml(key)}</span>
                <span>${escapeHtml(formatWorkflowValue(value))}</span>
              </div>
            `).join("")}
          </div>
        </article>
      ` : ""}
    </div>
  `;
}

function groupWorkflowResults(results) {
  const groups = [];

  for (const result of results) {
    const key = `${result.projectId || ""}|${result.packId || ""}|${result.scenarioId || ""}`;
    let group = groups.find(item => item.key === key);

    if (!group) {
      group = {
        key,
        title: result.scenarioTitle || result.scenarioId || "Scénář",
        results: []
      };
      groups.push(group);
    }

    group.results.push(result);
  }

  return groups;
}

function getWorkflowResultLabel(result) {
  const level = result.level === "ok"
    ? "Hotovo"
    : result.level === "warn"
      ? "Upozornění"
      : "Chyba";
  const message = Array.isArray(result.messages) && result.messages.length > 0
    ? result.messages[0]
    : "";

  return [level, message].filter(Boolean).join(" | ");
}

function buildWorkflowProgressLines() {
  const workflow = getSelectedWorkflow();
  const run = state.workflowRun;

  if (!workflow || !run) {
    return [];
  }

  const item = workflow.items?.[run.itemIndex];
  return [
    `Workflow: ${workflow.name}`,
    item ? `Aktuální část: ${item.title || item.scenarioId}` : "",
    `Dokončené kroky: ${run.results.length}`
  ].filter(Boolean);
}

function buildWorkflowReport(workflow) {
  const run = state.workflowRun || { results: [] };
  const failed = run.results.filter(result => result.level === "error");
  const warnings = run.results.filter(result => result.level === "warn");
  const contextKeys = workflow.report?.contextKeys || Object.keys(state.workflowContext);
  const contextLines = contextKeys
    .filter(key => !isEmpty(state.workflowContext[key]))
    .map(key => `${key}: ${formatWorkflowValue(state.workflowContext[key])}`);
  const lines = [
    `Workflow: ${workflow.name}`,
    `Scénáře: ${workflow.items?.length || 0}`,
    `Kroky: ${run.results.length}`,
    `Chyby: ${failed.length}`,
    `Upozornění: ${warnings.length}`,
    ...contextLines
  ];

  return {
    workflowId: workflow.id,
    workflowName: workflow.name,
    startedAt: run.startedAt,
    completedAt: new Date().toISOString(),
    status: failed.length > 0 ? "Failed" : warnings.length > 0 ? "Warning" : "Completed",
    lines,
    context: state.workflowContext,
    results: run.results
  };
}

function formatWorkflowValue(value) {
  if (typeof value === "string") {
    return value.length > 160 ? `${value.slice(0, 157)}...` : value;
  }

  return JSON.stringify(value);
}

function getSelectedWorkflow() {
  return (state.workflowIndex?.workflows || []).find(workflow => workflow.id === state.selectedWorkflowId) || null;
}

function setWorkflowControls(isRunning) {
  state.workflowRunning = isRunning;
  updateWorkflowControls();
  renderWorkflowList();
}

function updateWorkflowControls() {
  if (!elements.runWorkflow) {
    return;
  }

  const hasWorkflow = Boolean(getSelectedWorkflow());
  const hasPausedRun = Boolean(state.workflowRun?.status === "paused" && !state.workflowRunning);
  const hasCompletedRun = Boolean(state.workflowRun?.status === "completed");
  elements.runWorkflow.disabled = !hasWorkflow || state.workflowRunning || hasPausedRun;
  elements.continueWorkflow.disabled = !hasWorkflow || !hasPausedRun || state.workflowRunning;
  elements.stopWorkflow.disabled = !state.workflowRunning;
  updateWorkflowStatus(state.workflowRunning
    ? "Běží"
    : hasPausedRun
      ? "Pozastaveno"
      : hasCompletedRun
        ? "Dokončeno"
      : hasWorkflow
        ? "Připraven"
        : "Nenakonfigurováno");
}

function updateWorkflowStatus(status) {
  if (elements.workflowStatus) {
    elements.workflowStatus.textContent = status;
  }
}

function showWorkflowSummary(level, headline, lines = []) {
  elements.workflowSummary.className = `auto-run-summary ${level}`;
  elements.workflowSummary.innerHTML = `
    <strong>${escapeHtml(headline)}</strong>
    ${lines.length > 0 ? `<ul>${lines.map(line => `<li>${escapeHtml(line)}</li>`).join("")}</ul>` : ""}
  `;
}

function clearWorkflowSummary() {
  elements.workflowSummary.className = "auto-run-summary hidden";
  elements.workflowSummary.innerHTML = "";
}

function setAutoRunControls(isRunning) {
  elements.runStep.disabled = isRunning || !currentStep();
  elements.previousStep.disabled = isRunning || !state.scenario || findPreviousRunnableStepIndex(state.stepIndex) === null;
  if (isRunning) {
    elements.nextStep.disabled = true;
    elements.nextStep.textContent = "Další";
    elements.nextStep.title = "";
    elements.nextStep.classList.remove("ready");
  } else {
    updateNextStepControl();
  }
  elements.resetScenario.disabled = isRunning || !state.scenario;
  elements.autoRun.disabled = isRunning || !state.scenario || requiresManualInput(state.scenario);
  elements.autoRunTarget.disabled = isRunning || !state.scenario || requiresManualInput(state.scenario);
  elements.autoRun.textContent = isRunning ? "Spou\u0161t\u00edm..." : "Spustit do krok\u016f";
}

function applyRemember(step) {
  if (!step.remember) {
    return;
  }

  for (const [key, template] of Object.entries(step.remember)) {
    state.context[key] = resolveObject(template, state.values, step);
  }
}

function applyRememberSecrets(step) {
  if (!step.rememberSecret) {
    return;
  }

  for (const [key, template] of Object.entries(step.rememberSecret)) {
    state.secrets[key] = resolveObject(template, state.values, step);
  }
}

function applyAuthSessionFromStep(step, body, result) {
  if (!step.authSession || result.level === "error") {
    return "";
  }

  const authConfig = getProjectAuthConfig();
  const loginConfig = authConfig?.login || null;

  if (authConfig.type !== "login" || !loginConfig) {
    return "";
  }

  for (const [name, template] of Object.entries(step.authSession.formValues || {})) {
    state.authFormValues[name] = resolveTemplate(String(template), { fieldValues: state.values });
  }

  const sessionConfig = {
    ...loginConfig,
    response: {
      ...(loginConfig.response || {}),
      ...(step.authSession.response || {})
    },
    sessionKind: step.authSession.sessionKind || loginConfig.sessionKind
  };

  updateSessionFromAuthResponse(body, sessionConfig, "login");
  applyAuthSessionContext();
  if (sessionConfig.sessionKind !== "anonymous" && step.authSession.saveProfile !== false) {
    saveNewAuthProfileAfterSuccessfulLogin({
      note: step.authSession.profileNote || "Ulozeno po prihlaseni ze scenare."
    });
  }
  saveAuthFormValues();
  saveAuthSession();
  renderAuthPanel();
  renderModeBanner();

  return step.authSession.message || "Uživatel je přihlášený a připravený pro další scénáře.";
}

function applyAuthSessionContext() {
  if (!state.authSession) {
    return;
  }

  if (state.authSession.identityId) {
    state.context.authIdentityId = state.authSession.identityId;
    state.context.pidLitackaIdentityId = state.authSession.identityId;

    if (state.currentProject?.id === "pidlitacka") {
      state.redisIdentityId = state.authSession.identityId;
      state.redisIdentityManual = false;
    }
  }

  if (state.authSession.email) {
    state.context.authEmail = state.authSession.email;
    state.context.pidLitackaUserName = state.authSession.email;
  }
}

function showAutoRunSummaryFromResults(results) {
  const failed = results.filter(result => result.level === "error");
  const warnings = results.filter(result => result.level === "warn");
  const successful = results.length - failed.length - warnings.length;
  const headline = failed.length === 0
    ? `Hotovo: ${successful}/${results.length} krok\u016f pro\u0161lo.`
    : `Hotovo: ${failed.length} z ${results.length} krok\u016f selhalo.`;
  const items = failed.map(result =>
    `Krok ${result.index + 1}: ${result.title} - ${result.messages.join(" ")}`);

  showAutoRunSummary(failed.length === 0 ? "ok" : "error", headline, items);
}

function showAutoRunSummary(level, headline, items) {
  elements.autoRunSummary.className = `auto-run-summary ${level}`;
  elements.autoRunSummary.innerHTML = `
    <strong>${escapeHtml(headline)}</strong>
    ${items.length > 0 ? `<ul>${items.map(item => `<li>${escapeHtml(item)}</li>`).join("")}</ul>` : ""}
  `;
}

function clearAutoRunSummary() {
  elements.autoRunSummary.className = "auto-run-summary hidden";
  elements.autoRunSummary.innerHTML = "";
}

function renderScenarioSelectionSummary() {
  const total = (state.catalog?.scenarios || []).filter(scenario => isSmokeEligible(scenario)).length;
  const selected = state.selectedScenarioIds.size;

  elements.scenarioSelectionCount.textContent = `Vybr\u00e1no ${selected}/${total}`;
  elements.runSelectedScenarios.disabled = selected === 0 || state.batchRunning;
  elements.selectAllScenarios.disabled = state.batchRunning;
  elements.clearScenarioSelection.disabled = state.batchRunning;
  elements.stopBatchRun.disabled = !state.batchRunning;
}

function selectAllScenarios() {
  state.selectedScenarioIds = new Set(
    state.catalog.scenarios
      .filter(scenario => isSmokeEligible(scenario))
      .map(scenario => scenario.id));
  renderSmokeList();
}

function clearScenarioSelection() {
  state.selectedScenarioIds = new Set();
  renderSmokeList();
}

function toggleScenarioSelection(scenarioId, checked) {
  if (checked) {
    state.selectedScenarioIds.add(scenarioId);
  } else {
    state.selectedScenarioIds.delete(scenarioId);
  }

  renderScenarioSelectionSummary();
  renderSmokeList();
}

async function runSelectedScenarios() {
  const selectedScenarios = state.catalog.scenarios.filter(scenario =>
    isSmokeEligible(scenario) && state.selectedScenarioIds.has(scenario.id));

  if (selectedScenarios.some(scenario => requiresAuthorization(scenario))) {
    const authCheck = await ensureAuthorizationReady();
    if (!authCheck.ok) {
      const info = getAuthorizationInfo();
      showBatchRunSummary("warn", "Smoke run nemůže začít bez platného přihlášení.", [authCheck.message || info.message]);
      return;
    }
  }

  if (selectedScenarios.length === 0) {
    const hasSmokeScenarios = (state.catalog.scenarios || []).some(scenario => isSmokeEligible(scenario));
    showBatchRunSummary(
      "warn",
      hasSmokeScenarios
        ? "Nejsou vybran\u00e9 \u017e\u00e1dn\u00e9 sc\u00e9n\u00e1\u0159e."
        : "V tomto packu zat\u00edm nejsou \u017e\u00e1dn\u00e9 smoke sc\u00e9n\u00e1\u0159e.",
      []);
    return;
  }

  state.batchRunning = true;
  state.batchStopRequested = false;
  initializeSmokeResults();
  state.log = [];
  renderLog();
  activateRightTab("log");
  activateLeftTab("smoke");
  setBatchControls(true);
  showBatchRunSummary("warn", "Smoke run b\u011b\u017e\u00ed...", []);
  showBatchRunProgress({
    headline: `P\u0159ipravuji ${selectedScenarios.length} sc\u00e9n\u00e1\u0159\u016f.`,
    detail: "\u010cek\u00e1m na prvn\u00ed krok..."
  });

  const scenarioResults = [];

  try {
    for (let scenarioIndex = 0; scenarioIndex < selectedScenarios.length; scenarioIndex += 1) {
      if (state.batchStopRequested) {
        break;
      }

      const scenario = selectedScenarios[scenarioIndex];
      selectScenario(scenario.id, { preserveLog: true, suppressLog: true, persistSelection: false });
      setBatchControls(true);
      const stepResults = [];
      updateSmokeResult(scenario.id, {
        state: "running",
        currentStepIndex: 0,
        failedSteps: [],
        warningSteps: [],
        detailLines: []
      });

      addLog("ok", "Smoke scenario started", {
        scenario: scenario.id,
        title: scenario.title,
        steps: scenario.steps.length
      });

      for (let index = 0; index < scenario.steps.length; index += 1) {
        if (state.batchStopRequested) {
          break;
        }

        state.stepIndex = index;
        renderStep();
        setBatchControls(true);
        updateSmokeResult(scenario.id, {
          state: "running",
          currentStepIndex: index
        });
        showBatchRunProgress({
          headline: `Sc\u00e9n\u00e1\u0159 ${scenarioIndex + 1} z ${selectedScenarios.length}: ${scenario.title}`,
          detail: `B\u011b\u017e\u00ed krok ${index + 1} z ${scenario.steps.length}: ${scenario.steps[index].title}`
        });

        await runCurrentStep();

        stepResults.push({
          index,
          title: scenario.steps[index].title,
          level: state.lastStepResult?.level || "error",
          messages: state.lastStepResult?.messages || ["Krok nevr\u00e1til v\u00fdsledek."]
        });
      }

      const failedSteps = stepResults.filter(result => result.level === "error");
      const warningSteps = stepResults.filter(result => result.level === "warn");
      const stopped = state.batchStopRequested && stepResults.length < scenario.steps.length;

      scenarioResults.push({
        id: scenario.id,
        title: scenario.title,
        totalSteps: stepResults.length,
        failedSteps,
        warningSteps,
        stopped
      });

      updateSmokeResult(scenario.id, {
        state: stopped ? "stopped" : failedSteps.length > 0 ? "failed" : warningSteps.length > 0 ? "warning" : "passed",
        currentStepIndex: stopped ? Math.max(stepResults.length - 1, 0) : null,
        failedSteps,
        warningSteps,
        detailLines: buildSmokeDetailLines(stepResults)
      });

      addLog(stopped ? "warn" : failedSteps.length === 0 ? "ok" : "error", "Smoke scenario finished", {
        scenario: scenario.id,
        title: scenario.title,
        failedSteps: failedSteps.map(result => result.index + 1),
        warningSteps: warningSteps.map(result => result.index + 1),
        stopped
      });
    }
  } finally {
    state.batchRunning = false;
    setBatchControls(false);
    showBatchRunSummaryFromResults(scenarioResults);
    showBatchRunProgressFromResults(selectedScenarios.length, scenarioResults);
    renderStep();
  }
}

function setBatchControls(isRunning) {
  state.batchRunning = isRunning;
  renderScenarioList();
  renderSmokeList();
  setAutoRunControls(isRunning);
}

function showBatchRunSummaryFromResults(results) {
  const failed = results.filter(result => result.failedSteps.length > 0);
  const warnings = results.filter(result => result.failedSteps.length === 0 && result.warningSteps.length > 0);
  const stopped = results.filter(result => result.stopped);
  const passed = results.length - failed.length - warnings.length - stopped.length;
  const headline = stopped.length > 0
    ? `Smoke run zastaven: ${results.length} sc\u00e9n\u00e1\u0159\u016f se stihlo zpracovat.`
    : failed.length === 0
      ? `Smoke run hotov: ${passed}/${results.length} sc\u00e9n\u00e1\u0159\u016f pro\u0161lo.`
      : `Smoke run hotov: ${failed.length} z ${results.length} sc\u00e9n\u00e1\u0159\u016f selhalo.`;
  const items = [];

  for (const result of failed) {
    items.push(`${result.title}: selhaly kroky ${result.failedSteps.map(step => step.index + 1).join(", ")}`);
  }

  for (const result of warnings) {
    items.push(`${result.title}: upozorn\u011bn\u00ed v kroc\u00edch ${result.warningSteps.map(step => step.index + 1).join(", ")}`);
  }

  for (const result of stopped) {
    items.push(`${result.title}: b\u011bh byl zastaven po kroku ${result.totalSteps}.`);
  }

  showBatchRunSummary(stopped.length > 0 ? "warn" : failed.length === 0 ? "ok" : "error", headline, items);
}

function showBatchRunSummary(level, headline, items) {
  elements.batchRunSummary.className = `auto-run-summary ${level}`;
  elements.batchRunSummary.innerHTML = `
    <strong>${escapeHtml(headline)}</strong>
    ${items.length > 0 ? `<ul>${items.map(item => `<li>${escapeHtml(item)}</li>`).join("")}</ul>` : ""}
  `;
}

function showBatchRunProgress({ headline, detail }) {
  elements.batchRunProgress.className = "batch-run-progress";
  elements.batchRunProgress.innerHTML = `
    <strong>${escapeHtml(headline)}</strong>
    <span>${escapeHtml(detail)}</span>
  `;
}

function showBatchRunProgressFromResults(selectedCount, results) {
  if (state.batchStopRequested) {
    const processed = results.length;
    const last = results[results.length - 1];
    showBatchRunProgress({
      headline: "Smoke run zastaven",
      detail: last
        ? `Zpracov\u00e1no ${processed} z ${selectedCount} sc\u00e9n\u00e1\u0159\u016f. Posledn\u00ed sc\u00e9n\u00e1\u0159: ${last.title}.`
        : `Nebyl dokon\u010den \u017e\u00e1dn\u00fd sc\u00e9n\u00e1\u0159 z ${selectedCount}.`
    });
    return;
  }

  showBatchRunProgress({
    headline: "Smoke run dokon\u010den",
    detail: `Zpracov\u00e1no ${results.length} z ${selectedCount} vybran\u00fdch sc\u00e9n\u00e1\u0159\u016f.`
  });
}

function requestStopBatchRun() {
  if (!state.batchRunning) {
    return;
  }

  state.batchStopRequested = true;
  elements.stopBatchRun.disabled = true;
  showBatchRunProgress({
    headline: "Zastavuji smoke run...",
    detail: "Aktu\u00e1ln\u00ed krok dob\u011bhne a pak se b\u011bh bezpe\u010dn\u011b ukon\u010d\u00ed."
  });
}

function updateSmokeResult(scenarioId, patch) {
  const current = state.smokeResults[scenarioId] || {};
  state.smokeResults[scenarioId] = {
    ...current,
    ...patch
  };
  renderSmokeList();
}

function buildSmokeDetailLines(stepResults) {
  const details = [];

  for (const result of stepResults) {
    if (result.level === "error" || result.level === "warn") {
      details.push(`Krok ${result.index + 1}: ${result.title} - ${result.messages.join(" ")}`);
    }
  }

  return details;
}

function buildRequest(step) {
  if (!step?.request) {
    throw new Error(`Krok '${step?.title || step?.id || "bez nazvu"}' nema HTTP request. Pokud jde o vlastni akci, musi byt obslouzena pres customAction.`);
  }

  const method = step.request.method || "GET";
  const baseUrl = elements.baseUrl.value.replace(/\/$/, "");
  const path = resolveTemplate(step.request.path, { fieldValues: state.values });
  const headers = {};
  const visibleHeaders = {};
  let body;
  let visibleBody = null;

  for (const [name, template] of Object.entries(step.request.headers || {})) {
    const value = resolveTemplate(template, { fieldValues: state.values });

    if (value !== "") {
      headers[name] = value;
      visibleHeaders[name] = value;
    }
  }

  if (requiresAuthorizationForStep(step) && !headers.Authorization) {
    const authConfig = getProjectAuthConfig();

    if (authConfig.type === "apiKey") {
      const apiKey = getCurrentApiKey();
      const headerName = authConfig.apiKeyHeader || "apiKey";

      if (apiKey && authConfig.apiKeyInHeader !== false) {
        headers[headerName] = apiKey;
        visibleHeaders[headerName] = "***";
      }
    } else {
      const token = authConfig.type === "login"
      ? state.authSession?.accessToken
      : getCurrentJwtToken();

      if (token) {
        headers.Authorization = `Bearer ${token}`;
        visibleHeaders.Authorization = "Bearer ***";
      }
    }
  }

  if (step.request.body !== undefined) {
    if (step.request.contentType && typeof step.request.body === "string") {
      body = resolveTemplate(String(step.request.body), { fieldValues: state.values });
      visibleBody = body;
      headers["Content-Type"] = step.request.contentType;
    } else if (step.request.contentType === "multipart/form-data") {
      const multipart = buildMultipartBody(step);
      body = multipart.body;
      visibleBody = multipart.visibleBody;
    } else if (step.request.contentType === "application/x-www-form-urlencoded") {
      const form = new URLSearchParams();

      for (const [name, template] of Object.entries(step.request.body)) {
        form.set(name, resolveTemplate(template, { fieldValues: state.values }));
      }

      body = form.toString();
      visibleBody = Object.fromEntries(form.entries());
      headers["Content-Type"] = "application/x-www-form-urlencoded";
    } else {
      const jsonBody = resolveObject(step.request.body, state.values, step);
      body = JSON.stringify(jsonBody);
      visibleBody = jsonBody;
      headers["Content-Type"] = "application/json";
    }
  }

  return {
    url: `${baseUrl}${path}`,
    resolvedUrl: resolveDisplayedRequestUrl(`${baseUrl}${path}`),
    options: { method, headers, body },
    visibleHeaders,
    visibleBody
  };
}

function validateMosSessionContextForStep(step) {
  if (!step?.request || requiresAnonymousAuthForStep(step)) {
    return { ok: true };
  }

  const keys = getMosSessionContextKeysForStep(step);
  const invalidKeys = keys.filter(key => {
    const value = String(state.context?.[key] ?? state.workflowContext?.[key] ?? "").trim();
    return !value || isEmptyGuid(value);
  });

  if (invalidKeys.length === 0) {
    return { ok: true, keys };
  }

  return {
    ok: false,
    keys: invalidKeys,
    message: `Krok vyzaduje platne MOS SessionID, ale ${invalidKeys.join(", ")} je prazdne nebo nulove. Nactete/obnovte MOS session z Redis a krok zopakujte.`
  };
}

function getMosSessionContextKeysForStep(step) {
  const requestText = JSON.stringify(step?.request || {});
  const keys = new Set();
  const pattern = /\{\{\s*context\.([a-zA-Z0-9_]*SessionI?D[a-zA-Z0-9_]*)\s*\}\}/gi;
  let match;

  while ((match = pattern.exec(requestText)) !== null) {
    keys.add(match[1]);
  }

  for (const key of step?.requiresContext || []) {
    if (/sessioni?d/i.test(key)) {
      keys.add(key);
    }
  }

  return [...keys];
}

function buildMultipartBody(step) {
  const form = new FormData();
  const visibleBody = {};

  for (const [name, template] of Object.entries(step.request.body || {})) {
    const value = resolveObject(template, state.values, step);

    if (isRemovedMultipartFilePart(value)) {
      visibleBody[name] = "neodesílá se";
      continue;
    }

    if (isMultipartFilePart(value)) {
      const bytes = base64ToBytes(value.base64);
      const contentType = value.contentType || "application/octet-stream";
      const fileName = value.fileName || `${name}.bin`;
      const blob = new Blob([bytes], { type: contentType });

      form.set(name, blob, fileName);
      visibleBody[name] = {
        fileName,
        contentType,
        size: bytes.byteLength
      };
    } else {
      form.set(name, value == null ? "" : String(value));
      visibleBody[name] = value;
    }
  }

  return {
    body: form,
    visibleBody
  };
}

function isMultipartFilePart(value) {
  return value
    && typeof value === "object"
    && !Array.isArray(value)
    && !value.removed
    && typeof value.base64 === "string";
}

function isRemovedMultipartFilePart(value) {
  return value
    && typeof value === "object"
    && !Array.isArray(value)
    && (value.removed || value.base64 === "");
}

function base64ToBytes(base64) {
  const binary = atob(String(base64).replace(/\s/g, ""));
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes;
}

async function readResponseBody(response) {
  const contentType = response.headers.get("content-type") || "";

  if (contentType.toLowerCase().includes("application/pdf")) {
    const bytes = await response.arrayBuffer();
    const blob = new Blob([bytes], { type: "application/pdf" });
    const downloadUrl = URL.createObjectURL(blob);

    return {
      contentType: "application/pdf",
      size: bytes.byteLength,
      downloadUrl
    };
  }

  const raw = await response.text();

  return parseResponse(raw);
}

function evaluateStep(step, status, body) {
  const expected = step.expected || {};
  const messages = [];
  const failures = [];
  const warnings = [];

  if (body?.error === "ProxyError") {
    return {
      level: "error",
      appMessage: "Služba teď není dostupná.",
      messages: [
        body.message || "Backend není dostupný.",
        body.detail ? `Detail: ${body.detail}` : "",
        body.target ? `Cíl: ${body.target}` : ""
      ].filter(Boolean)
    };
  }

  if (requiresAuthorizationForStep(step) && (status === 401 || status === 403)) {
    const authInfo = getAuthorizationInfo();
    return {
      level: "error",
      appMessage: "Přihlášení je neplatné nebo expirované.",
      messages: [
        "Autorizační hlavička byla do požadavku vložena, ale backend ji odmítl. Zkontrolujte nebo obnovte přihlášení.",
        describeAuthorizationInfo(authInfo),
        body?.detail || body?.title || ""
      ].filter(Boolean)
    };
  }

  if (expected.status !== undefined && expected.status !== status) {
    failures.push(`Očekáván HTTP ${expected.status}, backend vrátil HTTP ${status}.`);
  }

  if (Array.isArray(expected.statusIn) && !expected.statusIn.includes(status)) {
    failures.push(`Očekáván HTTP ${expected.statusIn.join(" nebo ")}, backend vrátil HTTP ${status}.`);
  }

  for (const warning of expected.warnings || []) {
    if (evaluateExpectedWarning(warning, body, step)) {
      warnings.push(warning);
    }
  }

  if (warnings.length > 0 && failures.length === 0) {
    messages.push(...warnings.map(warning => warning.message || "Krok je ve validním mezistavu a je potřeba jej zopakovat."));
    return {
      level: "warn",
      appMessage: warnings[0].appMessage || warnings[0].message || makeAppMessage(body, status, "warn"),
      messages
    };
  }

  for (const assertion of expected.assertions || []) {
    const actual = assertion.regex !== undefined
      ? getRegexAssertionSource(body, assertion)
      : getPath(body, assertion.path);
    const expectedValue = assertion.equals !== undefined
      ? resolveExpectedValue(assertion.equals, step)
      : undefined;

    if (assertion.equals !== undefined && !deepEqual(actual, expectedValue)) {
      failures.push(`Očekáváno ${assertion.path} = ${JSON.stringify(expectedValue)}, vráceno ${JSON.stringify(actual)}.`);
    }

    if (assertion.notEmpty && isEmpty(actual)) {
      failures.push(`Očekáváno, že ${assertion.path} nebude prázdné.`);
    }

    if (assertion.regex !== undefined && !(new RegExp(assertion.regex, "is")).test(String(actual || ""))) {
      failures.push(assertion.message || `Odpověď neodpovídá očekávanému tvaru: ${assertion.label || assertion.regex}.`);
    }

    if (assertion.lengthEquals !== undefined && (!Array.isArray(actual) || actual.length !== assertion.lengthEquals)) {
      failures.push(`Očekáváno, že ${assertion.path} bude mít ${assertion.lengthEquals} položek, vráceno ${Array.isArray(actual) ? actual.length : JSON.stringify(actual)}.`);
    }

    if (assertion.lengthAtLeast !== undefined && (!Array.isArray(actual) || actual.length < assertion.lengthAtLeast)) {
      failures.push(`Očekáváno, že ${assertion.path} bude mít alespoň ${assertion.lengthAtLeast} položek.`);
    }

    if (assertion.atLeast !== undefined && (typeof actual !== "number" || actual < assertion.atLeast)) {
      failures.push(`Očekáváno ${assertion.path} >= ${assertion.atLeast}, vráceno ${JSON.stringify(actual)}.`);
    }
  }

  if (state.dirty) {
    if (failures.length > 0) {
      messages.push("Opustili jste připravený scénář. Aplikace dál reaguje podle vámi zadaných dat.");
      messages.push(...failures);
      return {
        level: "warn",
        appMessage: makeAppMessage(body, status, "warn"),
        messages
      };
    }

    return {
      level: status >= 400 ? "warn" : "ok",
      appMessage: makeAppMessage(body, status, status >= 400 ? "warn" : "ok"),
      messages: ["Opustili jste připravený scénář. Výsledek odpovídá aktuálně zadaným datům."]
    };
  }

  if (failures.length > 0) {
    messages.push("Scénář neproběhl podle očekávání.");
    messages.push(...failures);
    return {
      level: "error",
      appMessage: "Výsledek neodpovídá očekávanému scénáři.",
      messages
    };
  }

  if (expected.outcome === "expectedError") {
    messages.push("Očekávaná chyba byla vrácena.");
    messages.push(...describeExpectedErrorBody(body));
    return {
      level: "ok",
      appMessage: "Aplikace správně upozornila na problém.",
      messages
    };
  }

  messages.push(status >= 400 ? "Backend vrátil očekávanou chybu." : "Krok odpovídá očekávání.");
  return {
    level: "ok",
    appMessage: makeAppMessage(body, status, "ok"),
    messages
  };
}

function describeExpectedErrorBody(body) {
  if (!body || typeof body !== "object") {
    return [];
  }

  const messages = [];

  if (body.title) {
    messages.push(`Název chyby: ${body.title}`);
  }

  if (body.detail) {
    messages.push(`Detail chyby: ${body.detail}`);
  }

  const validationMessages = Object.entries(body.errors || {})
    .flatMap(([field, values]) => Array.isArray(values)
      ? values.map(value => `${field}: ${value}`)
      : [`${field}: ${values}`]);

  if (validationMessages.length > 0) {
    messages.push(`Validace: ${validationMessages.join(" | ")}`);
  }

  for (const key of ["createLoginResult", "notificationAccountRegistrationResult", "createNewPasswordResult", "changePasswordResult"]) {
    const result = body[key];
    if (result?.type === "Error" && result.text) {
      messages.push(`${key}: ${result.text}`);
    }
  }

  return messages;
}

function makeAppMessage(body, status, level) {
  if (level === "warn") {
    return status >= 400
      ? "Zadané údaje vedly k upozornění."
      : "Pokračujeme podle upravených údajů.";
  }

  if (!body || typeof body !== "object") {
    return status >= 400 ? "Aplikace vrátila očekávané upozornění." : "Požadavek byl zpracován.";
  }

  if (Array.isArray(body)) {
    if (isPaymentCardsStep(currentStep()) && body.length === 0) {
      return "Uživatel nemá žádné uložené platební karty.";
    }

    if (isDocumentArray(body)) {
      return `K j\u00edzdence je dostupn\u00fdch ${body.length} doklad\u016f.`;
    }

    if (isPaymentCardArray(body)) {
      return body.length === 1
        ? "Našli jsme 1 uloženou kartu."
        : `Našli jsme ${body.length} uložených karet.`;
    }

    if (isVehicleArray(body)) {
      return `Na\u0161li jsme ${body.length} ulo\u017een\u00fdch vozidel.`;
    }

    if (isFavoriteZoneArray(body)) {
      return `Našli jsme ${body.length} oblíbených zón.`;
    }

    if (isParkingSuggestArray(body)) {
      return body.length === 1
        ? "Našli jsme 1 návrh lokality."
        : `Našli jsme ${body.length} návrhů lokalit.`;
    }

    return isZoneArray(body)
      ? `Našli jsme ${body.length} zón.`
      : `Našli jsme ${body.length} dostupných položek.`;
  }

  if (isParkingSessionsResponse(body)) {
    const count = body.sessions.length;
    return count === 1
      ? "Našli jsme 1 parkovací relaci."
      : `Našli jsme ${count} parkovací relace.`;
  }

  if (isParkingSuggestResultsResponse(body)) {
    const count = body.results.length;
    return count === 1
      ? "Našli jsme 1 návrh lokality."
      : `Našli jsme ${count} návrhů lokalit.`;
  }

  if (isParkingPriceMultiResponse(body)) {
    const count = getParkingPriceCalculations(body).length;
    return count === 1
      ? "Našli jsme 1 cenovou variantu parkování."
      : `Našli jsme ${count} cenových variant parkování.`;
  }

  if (isClientIdentifiersResponse(body)) {
    const count = body.identifiers.length;
    return count === 0
      ? "Klient zatím nemá žádné dostupné identifikátory."
      : count === 1
        ? "Našli jsme 1 identifikátor klienta."
        : `Našli jsme ${count} identifikátorů klienta.`;
  }

  if (isPersonalizeIdentifierResponse(body)) {
    return body.isPersonalized
      ? "Identifikátor byl úspěšně personalizován."
      : "Personalizace identifikátoru nebyla dokončena.";
  }

  if (isTokenizeMobileIdentifierResponse(body)) {
    return body.status === "Completed"
      ? "Telefonní identifikátor byl úspěšně tokenizován."
      : body.status === "PartiallyCompleted"
        ? "Tokenizace telefonu proběhla jen částečně."
        : "Tokenizace telefonu nebyla dokončena.";
  }

  if (isCompleteIdentifierRegistrationResponse(body)) {
    const kind = getGatewayIdentifierKindLabel(currentStep(), body);
    return body.status === "Completed"
      ? `Tokenizace ${kind.genitiveLower} byla dokončena a token byl přiřazen klientovi.`
      : `Kompletace tokenizace ${kind.genitiveLower} nebyla dokončena.`;
  }

  if (isStartIdentifierRegistrationResponse(body)) {
    const kind = getGatewayIdentifierKindLabel(currentStep(), body);
    return body.status === "Completed"
      ? `Registrace ${kind.genitiveLower} byla zahájena. Pokračujte v tokenizační bráně.`
      : `Registraci ${kind.genitiveLower} se nepodařilo zahájit.`;
  }

  if (isIdentifierRegistrationStateResponse(body)) {
    const kind = getGatewayIdentifierKindLabel(currentStep(), body);
    return isCompletedIdentifierRegistrationState(body)
      ? `Tokenizace ${kind.genitiveLower} je dokončená.`
      : `Tokenizace ${kind.genitiveLower} je ve stavu ${body.registrationState || body.status}.`;
  }

  if (isClientDataResponse(body) || isClientDataStep(currentStep())) {
    const view = getClientDataViewModel(body);
    const photoCount = getClientPhotoDataItems(view.photoData).length;

    if (!view.exists) {
      return "Přihlášený uživatel zatím nemá založený klientský profil.";
    }

    if (!view.hasPersonalData) {
      return "Klientský profil existuje, ale osobní údaje zatím nejsou uložené.";
    }

    return photoCount > 0
      ? `Klientská data jsou načtena včetně ${photoCount} fotografií.`
      : "Klientská data jsou načtena, fotografie nejsou k dispozici.";
  }

  if (isClientStatusResponse(body)) {
    if (body.isUserActive === false) {
      return "Přihlášený uživatel není aktivní a nemůže pokračovat v založení klienta.";
    }

    if (!body.exists) {
      return "Přihlášený uživatel zatím nemá založený klientský profil.";
    }

    if (!body.hasPersonalData) {
      return "Klientský profil existuje, ale osobní údaje zatím nejsou uložené.";
    }

    return "Klientský profil i osobní údaje jsou k dispozici.";
  }

  if (isSaveClientDataResponse(body)) {
    if (body.created) {
      return "Klient byl založen a osobní údaje byly uloženy.";
    }

    return "Osobní údaje existujícího klienta byly uloženy.";
  }

  if (isSaveClientPhotoResponse(body)) {
    return body.status === "Completed"
      ? "Fotografie klienta byla uložena."
      : `Uložení fotografie je ve stavu ${body.status}.`;
  }

  if (body.moduleName && body.status) {
    return `Služba ${body.moduleName} je ve stavu ${body.status}.`;
  }

  if (Array.isArray(body.items)) {
    return `Našli jsme ${body.items.length} dostupných položek.`;
  }

  if (Array.isArray(body.offers)) {
    return `Nabídka je připravena. Počet nabídek: ${body.offers.length}.`;
  }

  if (body.bookingId && body.status) {
    return `Rezervace je ve stavu ${body.status}.`;
  }

  if (body.ticketSuccessfullyCreated && body.ticket) {
    return "Parkování je připraveno k zaplacení.";
  }

  if (isSavedCardPaymentResponse(body)) {
    return body.paymentSuccessful === false
      ? "Platba uloženou kartou zatím nebyla dokončena."
      : body.paymentSuccessful === true
        ? "Platba uloženou kartou byla zpracována."
        : "Výsledek platby uloženou kartou je k dispozici.";
  }

  if (isFavoriteZoneResponse(body)) {
    return `Oblíbená zóna ${body.zoneId} je připravena.`;
  }

  if (isDeletePaymentCardResponse(body)) {
    return "Uložená platební karta byla odstraněna ze seznamu.";
  }

  if (isDeleteFavoriteZoneResponse(body)) {
    const zoneCode = state.context.selectedFavoriteZoneCode || "Vybraná zóna";
    return `${zoneCode} byla odstraněna z oblíbených zón.`;
  }

  if ((body.paymentId || body.paymentAttemptId) && (body.state || body.status)) {
    return `Platba je ve stavu ${body.state || body.status}.`;
  }

  if (body.messageType && body.status === "DISPATCHED") {
    return "Krok na pozadí byl zpracován.";
  }

  if (body.downloadUrl && body.contentType === "application/pdf") {
    return "PDF doklad je p\u0159ipraven k otev\u0159en\u00ed.";
  }

  if (body.commandId && body.status) {
    return `Platební výsledek byl přijat ke zpracování.`;
  }

  return status >= 400 ? "Aplikace vrátila očekávané upozornění." : "Požadavek byl zpracován.";
}

function applyExtracts(step, body, status) {
  state.context.lastStatus = status;

  for (const [name, selector] of Object.entries(step.extract || {})) {
    state.context[name] = getPath(body, selector);
  }

  for (const [name, pattern] of Object.entries(step.extractRegex || {})) {
    const rawSource = typeof body === "string" ? body : JSON.stringify(body ?? "");
    const source = normalizeXmlPrefixes(rawSource);
    const match = source.match(new RegExp(pattern, "is"));
    state.context[name] = match?.[1] ?? "";
  }
}

function nextStep() {
  if (!state.scenario || !canAdvanceFromCurrentStep()) {
    return;
  }

  state.stepIndex += 1;
  renderStep();
}

function evaluateExpectedWarning(warning, body, step) {
  const conditions = warning.when || warning.conditions || [];

  if (conditions.length === 0) {
    return false;
  }

  return conditions.every(condition => evaluateBodyCondition(condition, body, step));
}

function evaluateBodyCondition(condition, body, step) {
  const actual = getPath(body, condition.path);

  if (condition.equals !== undefined) {
    return deepEqual(actual, resolveExpectedValue(condition.equals, step));
  }

  if (condition.notEquals !== undefined) {
    return !deepEqual(actual, resolveExpectedValue(condition.notEquals, step));
  }

  if (condition.notEmpty) {
    return !isEmpty(actual);
  }

  return false;
}

function getRegexAssertionSource(body, assertion) {
  const source = assertion.sourcePath
    ? getPath(body, assertion.sourcePath)
    : body;

  return typeof source === "string"
    ? normalizeXmlPrefixes(source)
    : JSON.stringify(source ?? "");
}

function previousStep() {
  if (!state.scenario) {
    return;
  }

  const previousIndex = findPreviousRunnableStepIndex(state.stepIndex);

  if (previousIndex === null) {
    return;
  }

  state.stepIndex = previousIndex;
  renderStep();
}

function currentStep() {
  return state.scenario?.steps[state.stepIndex] || null;
}

function getCurrentStepResult() {
  return state.stepResults[String(state.stepIndex)] || null;
}

function canAdvanceFromCurrentStep() {
  const result = getCurrentStepResult();

  if (!state.scenario || !currentStep() || !result || result.level === "error") {
    return false;
  }

  const nextIndex = findNextRunnableStepIndex(state.stepIndex + 1);
  const next = state.scenario.steps[nextIndex];

  if (!next) {
    return true;
  }

  return getMissingContextKeys(next).length === 0;
}

function updateNextStepControl() {
  const waitingForSelection = isCurrentStepWaitingForSelection();
  const canAdvance = canAdvanceFromCurrentStep();
  elements.nextStep.disabled = state.batchRunning || waitingForSelection || !canAdvance;
  elements.nextStep.textContent = waitingForSelection
    ? getSelectionNextButtonLabel()
    : "Další";
  elements.nextStep.title = waitingForSelection
    ? "Nejdříve v mobilním náhledu vyberte položku tlačítkem u karty."
    : "";
  elements.nextStep.classList.toggle("ready", !elements.nextStep.disabled);
}

function isCurrentStepWaitingForSelection() {
  const step = currentStep();
  return Boolean(step
    && state.activeSelection?.stepId === step.id
    && state.activeSelection.selectedIndex === null);
}

function getSelectionNextButtonLabel() {
  const buttonLabel = state.activeSelection?.config?.buttonLabel || "Vybrat";
  const normalized = buttonLabel.toLowerCase();

  if (normalized.includes("cíl")) {
    return "Vyberte cíl";
  }

  return "Vyberte položku";
}

function clearStepResultsFrom(startIndex) {
  for (const key of Object.keys(state.stepResults)) {
    if (Number(key) >= startIndex) {
      delete state.stepResults[key];
    }
  }
}

function findNextRunnableStepIndex(startIndex) {
  const steps = state.scenario?.steps || [];

  for (let index = startIndex; index < steps.length; index += 1) {
    if (!shouldSkipStep(steps[index])) {
      return index;
    }
  }

  return steps.length;
}

function findPreviousRunnableStepIndex(startIndex) {
  const steps = state.scenario?.steps || [];
  const start = Math.min(startIndex - 1, steps.length - 1);

  for (let index = start; index >= 0; index -= 1) {
    if (!shouldSkipStep(steps[index])) {
      return index;
    }
  }

  return null;
}

function shouldSkipStep(step) {
  if (!step?.skipWhen) {
    return false;
  }

  const conditions = Array.isArray(step.skipWhen) ? step.skipWhen : [step.skipWhen];
  return conditions.some(condition => evaluateStepCondition(condition));
}

function findStepWarning(step) {
  for (const warning of step?.warningWhen || []) {
    const conditions = warning.conditions || warning.when || [];
    const normalizedConditions = Array.isArray(conditions) ? conditions : [conditions];

    if (normalizedConditions.length > 0 && normalizedConditions.every(condition => evaluateStepCondition(condition))) {
      return warning;
    }
  }

  return null;
}

function evaluateStepCondition(condition) {
  if (!condition || typeof condition !== "object") {
    return false;
  }

  if (condition.contextExists) {
    return asArray(condition.contextExists).every(key => !isEmpty(state.context[key]));
  }

  if (condition.contextMissing) {
    return asArray(condition.contextMissing).every(key => isEmpty(state.context[key]));
  }

  if (condition.contextEquals) {
    const expected = condition.contextEquals.value;
    return state.context[condition.contextEquals.key] === expected;
  }

  if (condition.formEquals) {
    const expected = condition.formEquals.value;
    return state.values[condition.formEquals.key] === expected;
  }

  return false;
}

function asArray(value) {
  return Array.isArray(value) ? value : [value];
}

function getMissingContextKeys(step) {
  if (!step?.requiresContext) {
    return [];
  }

  return step.requiresContext.filter(key => isEmpty(state.context[key]));
}

function renderModeBanner() {
  if (!state.scenario) {
    elements.modeBanner.className = "mode-banner hidden";
    return;
  }

  if (requiresAnonymousAuth(state.scenario) && hasUsableAuthorization() && !state.authSession?.isAnonymous) {
    elements.modeBanner.textContent = "Tento scénář vyžaduje anonymní přihlášení. V panelu Přihlášení vyberte Anonymní uživatel.";
    elements.modeBanner.className = "mode-banner";
    return;
  }

  if (requiresAuthorization(state.scenario) && !hasUsableAuthorization()) {
    const authType = getProjectAuthConfig().type;
    elements.modeBanner.textContent = authType === "login"
      ? "Tento scénář vyžaduje platné přihlášení v panelu Přístup."
      : authType === "apiKey"
        ? "Tento scénář vyžaduje API klíč v panelu Přístup."
        : "Tento scénář vyžaduje platný JWT bearer token v panelu Přístup.";
    elements.modeBanner.className = "mode-banner";
    return;
  }

  if (state.freeForm) {
    elements.modeBanner.textContent = "Volný formulář: nejste v připraveném scénáři. Aplikace reaguje podle aktuálně vyplněných dat a skutečné odpovědi backendu.";
    elements.modeBanner.className = "mode-banner";
    return;
  }

  if (requiresManualInput(state.scenario)) {
    elements.modeBanner.textContent = "Ruční scénář: doplňte vlastní testovací data podle instrukcí. Tento scénář se záměrně nespouští ve smoke runu.";
    elements.modeBanner.className = "mode-banner";
    return;
  }

  const missingContextKeys = getMissingContextKeys(currentStep());

  if (missingContextKeys.length > 0) {
    elements.modeBanner.textContent = `Tento krok čeká na výběr z předchozího seznamu: ${missingContextKeys.join(", ")}.`;
    elements.modeBanner.className = "mode-banner";
    return;
  }

  if (state.dirty) {
    elements.modeBanner.textContent = "Opustili jste připravený scénář. Dále aplikace reaguje podle vámi zadaných dat a skutečných odpovědí backendu.";
    elements.modeBanner.className = "mode-banner";
    return;
  }

  elements.modeBanner.textContent = "Režim scénáře: vstupy odpovídají připravenému scénáři a výsledky se vyhodnocují proti očekávání.";
  elements.modeBanner.className = "mode-banner";
}

function renderContext() {
  elements.contextView.textContent = JSON.stringify(state.context, null, 2);
}

function addLog(level, title, details) {
  state.log.unshift({
    at: new Date().toLocaleTimeString(),
    level,
    title,
    details
  });
  renderLog();
}

function renderLog() {
  elements.logEntries.innerHTML = "";
  elements.saveFullLog.disabled = state.log.length === 0;

  for (const entry of state.log) {
    const item = document.createElement("article");
    item.className = `log-entry ${entry.level}`;
    const detailsText = JSON.stringify(entry.details, null, 2);
    item.innerHTML = `
      <strong>${escapeHtml(entry.at)} ${escapeHtml(entry.title)}</strong>
      <pre>${escapeHtml(detailsText)}</pre>
      <button class="log-copy-button" type="button" aria-label="Kopírovat log" title="Kopírovat log">Kopírovat</button>
    `;
    item.querySelector(".log-copy-button")?.addEventListener("click", async () => {
      const copied = await copyTextToClipboard(detailsText);

      if (!copied) {
        addLog("warn", "Kopírování logu selhalo", {
          title: entry.title,
          reason: "Clipboard API není dostupné."
        });
        return;
      }

      const button = item.querySelector(".log-copy-button");

      if (button) {
        const originalLabel = button.textContent;
        button.textContent = "Zkopírováno";
        window.setTimeout(() => {
          button.textContent = originalLabel;
        }, 1200);
      }
    });
    elements.logEntries.appendChild(item);
  }
}

function saveFullLog() {
  if (state.log.length === 0) {
    return;
  }

  const entries = [...state.log].reverse();
  const payload = {
    exportedAt: new Date().toISOString(),
    project: state.project?.name || state.projectId,
    environment: state.environment?.name || state.environmentId,
    pack: state.selectedPack?.name || state.selectedPackId,
    scenario: state.scenario
      ? {
          id: state.scenario.id,
          title: state.scenario.title
        }
      : null,
    entries
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  link.href = url;
  link.download = `klikatko-log-${timestamp}.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

async function savePhoneScreenshot() {
  const phone = document.querySelector(".phone");
  const button = elements.savePhoneScreenshot;

  if (!phone || !button) {
    return;
  }

  const originalText = button.textContent;
  button.disabled = true;
  button.textContent = "Ukládám...";

  try {
    const blob = await renderPhoneToPngBlob(phone);
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");

    link.href = url;
    link.download = `klikatko-screen-${timestamp}.png`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  } catch (error) {
    addLog("error", "Uložení obrazovky selhalo", {
      message: error instanceof Error ? error.message : String(error)
    });
  } finally {
    button.disabled = false;
    button.textContent = originalText;
  }
}

async function renderPhoneToPngBlob(phone) {
  const html2canvas = await loadHtml2Canvas();

  if (typeof html2canvas === "function") {
    return renderPhoneToPngBlobWithHtml2Canvas(phone, html2canvas);
  }

  return renderPhoneToPngBlobWithSvg(phone);
}

async function loadHtml2Canvas() {
  if (typeof window.html2canvas === "function") {
    return window.html2canvas;
  }

  await new Promise((resolve, reject) => {
    const existingScript = document.querySelector("script[data-html2canvas-loader]");

    if (existingScript) {
      existingScript.addEventListener("load", resolve, { once: true });
      existingScript.addEventListener("error", reject, { once: true });
      return;
    }

    const script = document.createElement("script");
    script.src = "/vendor/html2canvas.min.js?v=1.4.1";
    script.async = true;
    script.dataset.html2canvasLoader = "true";
    script.addEventListener("load", resolve, { once: true });
    script.addEventListener("error", () => reject(new Error("html2canvas se nepodařilo načíst.")), { once: true });
    document.head.appendChild(script);
  }).catch(error => {
    addLog("warn", "Načtení html2canvas selhalo", {
      message: error instanceof Error ? error.message : String(error)
    });
  });

  return typeof window.html2canvas === "function" ? window.html2canvas : null;
}

async function renderPhoneToPngBlobWithHtml2Canvas(phone, html2canvas) {
  const capture = preparePhoneScreenshotClone(phone);

  try {
    if (document.fonts?.ready) {
      await document.fonts.ready;
    }

    await nextAnimationFrame();
    const clone = capture.clone;
    const width = Math.ceil(clone.getBoundingClientRect().width);
    const height = Math.ceil(clone.scrollHeight);
    const canvas = await html2canvas(clone, {
      backgroundColor: null,
      scale: Math.min(window.devicePixelRatio || 1, 2),
      width,
      height,
      windowWidth: width,
      windowHeight: height,
      scrollX: 0,
      scrollY: 0,
      useCORS: true,
      logging: false
    });

    return await canvasToPngBlob(canvas);
  } finally {
    capture.cleanup();
  }
}

async function renderPhoneToPngBlobWithSvg(phone) {
  const capture = preparePhoneScreenshotClone(phone);

  try {
    if (document.fonts?.ready) {
      await document.fonts.ready;
    }

    await nextAnimationFrame();
    const clone = capture.clone;
    const width = Math.ceil(clone.getBoundingClientRect().width);
    const height = Math.ceil(clone.scrollHeight);
    const styleText = `${collectDocumentCssText()}\n${capture.overrideCss}`;
    const html = serializePhoneScreenshotMarkup(clone, styleText, width, height);
    const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
        <foreignObject width="100%" height="100%">${html}</foreignObject>
      </svg>
    `;

    return await svgToPngBlob(svg, width, height);
  } finally {
    capture.cleanup();
  }
}

function preparePhoneScreenshotClone(phone) {
  const overrideCss = `
    .phone.phone-screenshot-capture {
      height: auto !important;
      max-height: none !important;
      min-height: 0 !important;
      overflow: visible !important;
    }
    .phone.phone-screenshot-capture .phone-content {
      flex: none !important;
      height: auto !important;
      max-height: none !important;
      overflow: visible !important;
    }
  `;
  const tempStyle = document.createElement("style");
  tempStyle.textContent = overrideCss;
  document.head.appendChild(tempStyle);

  const offscreen = document.createElement("div");
  offscreen.style.position = "fixed";
  offscreen.style.left = "-10000px";
  offscreen.style.top = "0";
  offscreen.style.width = `${Math.ceil(phone.getBoundingClientRect().width)}px`;
  offscreen.style.pointerEvents = "none";
  offscreen.style.zIndex = "-1";

  const clone = phone.cloneNode(true);
  clone.classList.add("phone-screenshot-capture");
  clone.style.width = `${Math.ceil(phone.getBoundingClientRect().width)}px`;
  clone.style.height = "auto";
  clone.style.maxHeight = "none";
  clone.style.minHeight = "0";
  clone.style.overflow = "visible";

  const cloneContent = clone.querySelector(".phone-content");
  if (cloneContent) {
    cloneContent.style.height = "auto";
    cloneContent.style.maxHeight = "none";
    cloneContent.style.overflow = "visible";
    cloneContent.style.flex = "none";
    cloneContent.scrollTop = 0;
  }

  offscreen.appendChild(clone);
  document.body.appendChild(offscreen);

  return {
    clone,
    overrideCss,
    cleanup() {
      offscreen.remove();
      tempStyle.remove();
    }
  };
}

function serializePhoneScreenshotMarkup(phoneClone, styleText, width, height) {
  const wrapper = document.createElement("div");
  wrapper.setAttribute("xmlns", "http://www.w3.org/1999/xhtml");
  wrapper.style.width = `${width}px`;
  wrapper.style.minHeight = `${height}px`;

  const style = document.createElement("style");
  style.textContent = styleText;
  wrapper.appendChild(style);
  wrapper.appendChild(phoneClone.cloneNode(true));

  return new XMLSerializer().serializeToString(wrapper);
}

function collectDocumentCssText() {
  return [...document.styleSheets]
    .map(sheet => {
      try {
        return [...sheet.cssRules].map(rule => rule.cssText).join("\n");
      } catch {
        return "";
      }
    })
    .filter(Boolean)
    .join("\n");
}

function svgToPngBlob(svg, width, height) {
  return new Promise((resolve, reject) => {
    const svgUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
    const image = new Image();
    const scale = Math.min(window.devicePixelRatio || 1, 2);

    image.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = Math.ceil(width * scale);
        canvas.height = Math.ceil(height * scale);
        const context = canvas.getContext("2d");

        if (!context) {
          throw new Error("Canvas context není dostupný.");
        }

        context.scale(scale, scale);
        context.drawImage(image, 0, 0, width, height);
        canvasToPngBlob(canvas).then(resolve, reject);
      } catch (error) {
        reject(error);
      }
    };
    image.onerror = () => {
      reject(new Error("SVG náhled obrazovky se nepodařilo načíst."));
    };
    image.src = svgUrl;
  });
}

function canvasToPngBlob(canvas) {
  return new Promise((resolve, reject) => {
    try {
      canvas.toBlob(blob => {
        if (!blob) {
          reject(new Error("PNG se nepodařilo vytvořit."));
          return;
        }

        resolve(blob);
      }, "image/png");
    } catch (error) {
      reject(error);
    }
  });
}

function nextAnimationFrame() {
  return new Promise(resolve => window.requestAnimationFrame(() => resolve()));
}

function showResult(level, message, body = null, step = currentStep()) {
  state.displayedResult = { level, message, body, step };
  clearResultCountdown();
  elements.resultCard.innerHTML = buildResultHtml(level, message, body, step);
  elements.resultCard.className = `result-card ${level}`;
  startResultCountdownIfNeeded(message);
  bindResultCardActions();
}

function buildResultHtml(level, message, body = null, step = currentStep()) {
  const title = level === "ok"
    ? "Hotovo"
    : level === "warn"
      ? "Upozornění"
      : "Nelze pokračovat";
  const rows = summarizeBody(body);

  return `
    <strong class="result-title">${escapeHtml(title)}</strong>
    <div class="result-message"${shouldShowResultCountdown(level, message, body, step) ? ' data-result-countdown="30"' : ""}>${escapeHtml(message)}</div>
    ${rows.length > 0 ? `<div class="result-grid">${rows.map(row => `
      <div class="result-row">
        <span>${escapeHtml(row.label)}</span>
        <span>${escapeHtml(row.value)}</span>
      </div>`).join("")}</div>` : ""}
    ${buildAppCardsHtml(body, step)}
  `;
}

function shouldShowResultCountdown(level, message, body, step) {
  return level === "warn"
    && step?.id === "parking-process-saved-card-payment"
    && body?.paymentInProgress === true
    && body?.paymentSuccessful === false
    && /30 sekund|30 vteřin|30 s/i.test(message);
}

function clearResultCountdown() {
  if (state.resultCountdownTimer) {
    window.clearInterval(state.resultCountdownTimer);
    state.resultCountdownTimer = null;
  }
}

function startResultCountdownIfNeeded(message) {
  const countdown = elements.resultCard.querySelector("[data-result-countdown]");

  if (!countdown) {
    return;
  }

  const initialSeconds = Number(countdown.dataset.resultCountdown) || 30;
  let remainingSeconds = initialSeconds;
  const baseMessage = message.replace(/\s*\([^)]*\)\s*$/, "");
  const update = () => {
    countdown.textContent = remainingSeconds > 0
      ? `${baseMessage} (${remainingSeconds} s)`
      : "Platbu můžete zkusit ověřit znovu spuštěním tohoto kroku.";
  };

  update();
  state.resultCountdownTimer = window.setInterval(() => {
    remainingSeconds -= 1;

    if (remainingSeconds <= 0) {
      remainingSeconds = 0;
      update();
      clearResultCountdown();
      return;
    }

    update();
  }, 1000);
}

function buildAppCardsHtml(body, step = currentStep()) {
  if (isMosTokenCouponsOverviewResponse(body)) {
    return renderMosTokenCouponsOverviewCardHtml(body);
  }

  if (isCouponMoveTargetOverviewResponse(body)) {
    return renderCouponMoveTargetOverviewCardHtml(body, step);
  }

  if (isCouponMovePreviewResponse(body)) {
    return renderCouponMovePreviewCardHtml(body);
  }

  if (isMoveCouponsResponse(body)) {
    return renderMoveCouponsReportCardHtml(body);
  }

  if (step?.selection?.sourceRegex) {
    const items = state.activeSelection?.stepId === step.id && Array.isArray(state.activeSelection.items)
      ? state.activeSelection.items
      : parseRegexSelectionItems(body, step.selection.sourceRegex);

    if (items.length > 0) {
      return renderSelectionItemsCardsHtml(step, items);
    }

    return renderEmptyAppCardHtml(
      step.selection.emptyTitle || "Žádné položky",
      step.selection.emptyText || "Odpověď neobsahuje žádné položky k zobrazení."
    );
  }

  if (step?.selection?.sourcePath) {
    const items = state.activeSelection?.stepId === step.id && Array.isArray(state.activeSelection.items)
      ? state.activeSelection.items
      : getSelectionItems(step, body);

    if (Array.isArray(items) && items.length > 0) {
      return renderSelectionItemsCardsHtml(step, items);
    }

    return renderEmptyAppCardHtml(
      step.selection.emptyTitle || "Žádné položky",
      step.selection.emptyText || "Odpověď neobsahuje žádné položky k výběru."
    );
  }

  if (!body || typeof body !== "object") {
    return "";
  }

  if (isPaymentCardsStep(step) && Number(body.status) === 404) {
    return renderEmptyAppCardHtml(
      "Žádné uložené karty",
      "Uživatel nemá žádné uložené platební karty. To je pro první průchod scénářem v pořádku."
    );
  }

  if (isSavedVehiclesStep(step) && Number(body.status) === 404) {
    return renderEmptyAppCardHtml(
      "Žádné uložené vozidlo",
      "Uživatel zatím nemá uložené vozidlo. Pokračujte dál a SPZ zadejte ručně."
    );
  }

  if (isSavedCardPaymentResponse(body)) {
    return renderSavedCardPaymentCardHtml(body);
  }

  if (isProblemDetailsResponse(body)) {
    return renderProblemDetailsCardHtml(body);
  }

  if (isParkingSessionsResponse(body)) {
    return renderParkingSessionsCardsHtml(body.sessions, body.activeParkingLookbackWindowInMinutes, {
      selection: getSelectionDescriptor(step, body.sessions)
    });
  }

  if (isParkingSuggestResultsResponse(body)) {
    const items = step?.selection ? body.results : body.results.slice(0, 6);

    return buildCardListHtml(items, item => ({
      title: item.name || "Návrh lokality",
      text: item.address || "Doporučená parkovací lokalita",
      chips: [
        item.type || null,
        item.photonType || null,
        item.latitude !== undefined && item.longitude !== undefined
          ? { type: "map", label: `${item.latitude}, ${item.longitude}`, latitude: item.latitude, longitude: item.longitude }
          : null
      ]
    }), {
      selection: getSelectionDescriptor(step, body.results)
    });
  }

  if (isParkingPriceMultiResponse(body)) {
    const calculations = getParkingPriceCalculations(body);
    const calculationSuccessful = getParkingPriceSuccessful(body);
    const tariffId = body.tariffId || body.tariffID;

    return `
      <div class="app-card-list">
        <article class="app-card">
          <strong>Výpočet ceny parkování</strong>
          <p>${calculationSuccessful ? "Kalkulace proběhla úspěšně." : "Kalkulace se nepodařila plně dokončit."}</p>
          <div class="app-card-meta">
            ${renderAppChip(calculationSuccessful ? "Úspěšné" : "Neúplné")}
            ${renderAppChip(calculations.length === 1 ? "1 varianta" : `${calculations.length} variant`)}
          </div>
          <div class="app-card-details">
            <div class="app-detail-row"><span>Parkování od</span><span>${escapeHtml(formatDate(body.parkingFrom))}</span></div>
            ${tariffId ? `<div class="app-detail-row"><span>Tarif</span><span>${escapeHtml(shortId(tariffId))}</span></div>` : ""}
          </div>
        </article>
        ${calculations.map((item, index) => `
          <article class="app-card">
            <strong>${escapeHtml(item.acceptedMinutesFormatted || `Varianta ${index + 1}`)}</strong>
            <p>${escapeHtml(item.acceptedMinutesFormatted || `${item.acceptedMinutes || "-"} minut`)}</p>
            <div class="app-card-meta">
              ${renderAppChip(item.totalPrice !== undefined ? `${item.totalPrice} CZK` : "")}
              ${renderAppChip(item.acceptedMinutes !== undefined ? `${item.acceptedMinutes} min` : "")}
              ${renderAppChip(item.acceptedMinutesDuringParkingHours !== undefined ? `${item.acceptedMinutesDuringParkingHours} min v režimu` : "")}
            </div>
            <div class="app-card-details">
              <div class="app-detail-row"><span>Parkování do</span><span>${escapeHtml(formatDate(item.parkingTo))}</span></div>
              <div class="app-detail-row"><span>Cena</span><span>${escapeHtml(item.totalPrice !== undefined ? `${item.totalPrice} CZK` : "-")}</span></div>
              <div class="app-detail-row"><span>Původní cena</span><span>${escapeHtml(item.originalPrice !== undefined ? `${item.originalPrice} CZK` : "-")}</span></div>
              <div class="app-detail-row"><span>Sleva</span><span>${escapeHtml(item.appliedDiscount !== undefined ? `${item.appliedDiscount} CZK` : "-")}</span></div>
            </div>
          </article>
        `).join("")}
      </div>
    `;
  }

  if (Array.isArray(body)) {
    if (isPaymentCardsStep(step) && body.length === 0) {
      return renderEmptyAppCardHtml(
        "Žádné uložené karty",
        "Uživatel nemá žádné uložené platební karty. To je pro první průchod scénářem v pořádku."
      );
    }

    if (isSavedVehiclesStep(step) && body.length === 0) {
      return renderEmptyAppCardHtml(
        "Žádné uložené vozidlo",
        "Uživatel zatím nemá uložené vozidlo. Pokračujte dál a SPZ zadejte ručně."
      );
    }

    if (isPaymentCardArray(body)) {
      return buildCardListHtml(body, card => ({
        title: card.cardholderName || card.name || "Platební karta",
        text: getPaymentCardMaskedNumber(card)
          ? `Karta ${getPaymentCardMaskedNumber(card)}`
          : "Uložená karta",
        chips: [
          getPaymentCardExpiration(card),
          card.isDefault ? "výchozí" : null,
          card.status || (card.registrationUrl ? "čekající registrace" : "aktivní")
        ]
      }), {
        selection: getSelectionDescriptor(step, body)
      });
    }

    if (isVehicleArray(body)) {
      return buildCardListHtml(body, vehicle => ({
        title: vehicle.licensePlate || "Vozidlo",
        text: vehicle.name || "Uložené vozidlo",
        chips: [
          vehicle.color ? { type: "color", value: vehicle.color, label: "Barva" } : null,
          vehicle.status || null,
          vehicle.createdAt ? formatDate(vehicle.createdAt) : null
        ]
      }), {
        selection: getSelectionDescriptor(step, body)
      });
    }

    if (isFavoriteZoneArray(body)) {
      return buildCardListHtml(body, zone => ({
        title: `Zóna ${zone.zoneId || shortId(zone.id)}`,
        text: "Oblíbená parkovací zóna",
        chips: [
          zone.status || null,
          zone.createdAt ? formatDate(zone.createdAt) : null
        ]
      }), {
        selection: getSelectionDescriptor(step, body)
      });
    }

    if (isParkingSuggestArray(body)) {
      return buildCardListHtml(body, item => ({
        title: item.name || "Návrh lokality",
        text: item.address || "Doporučená parkovací lokalita",
        chips: [
          item.type || null,
          item.photonType || null
        ]
      }), {
        selection: getSelectionDescriptor(step, body)
      });
    }

    if (isDocumentArray(body)) {
      return buildCardListHtml(body, document => ({
        title: document.type === "USE_CONFIRMATION" ? "Potvrzen\u00ed o u\u017eit\u00ed" : "Doklad",
        text: `Doklad ${shortId(document.documentId)} pro rezervaci ${shortId(document.bookingId)}`,
        chips: [document.mediaType, formatDate(document.createdAt)]
      }), {
        selection: getSelectionDescriptor(step, body)
      });
    }

    if (isZoneArray(body)) {
      return buildCardListHtml(body, zone => ({
        title: getLocalizedTitle(zone.name) || `Zóna ${zone.id}`,
        text: zone.id ? `Kód zóny ${zone.id}` : "Dostupná zóna",
        chips: [
          zone.status || zone.state || "Dostupná",
          zone.type || zone.category || null
        ]
      }), {
        selection: getSelectionDescriptor(step, body)
      });
    }

    const items = step?.selection ? body : body.slice(0, 6);

    return buildCardListHtml(items, item => ({
      title: item.name || item.id || "Položka",
      text: "Dostupná položka služby",
      chips: [item.status || item.state || item.type]
    }), {
      selection: getSelectionDescriptor(step, body)
    });
  }

  if (Array.isArray(body.items)) {
    const items = step?.selection ? body.items : body.items.slice(0, 6);

    return buildCardListHtml(items, item => ({
      title: getLocalizedTitle(item.title) || `Produkt ${item.productId}`,
      text: `${item.productType || "Produkt"} pro zóny ${(item.zones || []).join(", ") || "dle výběru"}`,
      chips: [
        item.price ? `${item.price.amount} ${item.price.currency}` : null,
        item.duration ? `${item.duration} min` : null,
        item.state
      ]
    }), {
      selection: getSelectionDescriptor(step, body.items)
    });
  }

  if (Array.isArray(body.offers)) {
    const offers = step?.selection ? body.offers : body.offers.slice(0, 6);

    return buildCardListHtml(offers, offer => ({
      title: `Nabídka ${offer.productId}`,
      text: `Platnost od ${formatDate(offer.admission?.validFrom)} pro zóny ${(offer.admission?.zones || []).join(", ")}`,
      chips: [
        offer.price ? `${offer.price.amount} ${offer.price.currency}` : null,
        offer.admission?.duration ? `${offer.admission.duration} min` : null,
        "Připraveno"
      ]
    }), {
      selection: getSelectionDescriptor(step, body.offers)
    });
  }

  if (body.products && body.database) {
    return buildCardListHtml([body], info => ({
      title: "Persistence",
      text: `Backend běží nad ${info.products.repositoryProvider}. Produktů v katalogu: ${info.products.count}.`,
      chips: [
        info.database.providerName || "bez DbContextu",
        info.database.isRelational ? "relační DB" : "lokální test DB",
        info.database.canConnect === false ? "nelze se připojit" : "připraveno"
      ]
    }));
  }

  if (isFavoriteZoneResponse(body)) {
    return buildCardListHtml([body], zone => ({
      title: `Zóna ${zone.zoneId}`,
      text: "Oblíbená parkovací zóna",
      chips: [
        zone.status || null,
        zone.createdAt ? formatDate(zone.createdAt) : null
      ]
    }));
  }

  if (isDeletePaymentCardResponse(body)) {
    return buildCardListHtml([body], card => ({
      title: "Karta odstraněna",
      text: "Uložená platební karta byla odebrána ze seznamu aktuálního uživatele.",
      chips: [
        card.status || "Deleted",
        card.undoPossible ? `Obnova ${card.undoExpiresInMinutes} min` : null,
        card.deletedAt ? formatDate(card.deletedAt) : null
      ]
    }));
  }

  if (isDeleteFavoriteZoneResponse(body)) {
    const zoneCode = state.context.selectedFavoriteZoneCode || "Vybraná zóna";
    return buildCardListHtml([body], zone => ({
      title: zoneCode,
      text: "Zóna byla odstraněna z oblíbených položek.",
      chips: [
        zone.status || null,
        zone.undoPossible ? `Obnova ${zone.undoExpiresInMinutes} min` : null,
        zone.deletedAt ? formatDate(zone.deletedAt) : null
      ]
    }));
  }

  if (body.ticketSuccessfullyCreated && body.ticket) {
    const ticket = body.ticket;
    return `
      <div class="app-card-list">
        <article class="app-card">
          <strong>Parkování připraveno</strong>
          <p>${escapeHtml((ticket.licensePlate || body.licensePlate || "Vozidlo"))} můžete dokončit přes platební bránu.</p>
          <div class="app-card-meta">
            ${renderAppChip(ticket.parkingSectionCode ? `Zóna ${ticket.parkingSectionCode}` : "Parkování")}
            ${renderAppChip(ticket.acceptedMinutes ? `${ticket.acceptedMinutes} min` : "")}
            ${renderAppChip(ticket.totalPrice !== undefined ? `${ticket.totalPrice} CZK` : "")}
            ${renderAppChip(ticket.paymentStatus || "")}
          </div>
          <div class="app-card-details">
            <div class="app-detail-row"><span>SPZ</span><span>${escapeHtml(ticket.licensePlate || body.licensePlate || "-")}</span></div>
            <div class="app-detail-row"><span>Od</span><span>${escapeHtml(formatDate(ticket.parkingFrom))}</span></div>
            <div class="app-detail-row"><span>Do</span><span>${escapeHtml(formatDate(ticket.parkingTo))}</span></div>
            <div class="app-detail-row"><span>Doklad</span><span>${escapeHtml(ticket.formattedReceiptNumber || ticket.ticketId || "-")}</span></div>
            <div class="app-detail-row"><span>Reference</span><span>${escapeHtml(body.paymentGatewayReference || "-")}</span></div>
          </div>
          ${body.paymentGatewayRedirectUrl ? `
            <div class="app-card-actions">
              <a class="app-card-link" href="${escapeHtml(body.paymentGatewayRedirectUrl)}" target="_blank" rel="noopener">Otevřít platební bránu</a>
            </div>` : ""}
        </article>
      </div>
    `;
  }

  if (isMosParkingOrderResponse(body)) {
    return renderMosParkingOrderCardHtml(body);
  }

  if (isMosSavedCardPaymentResponse(body)) {
    return renderMosSavedCardPaymentCardHtml(body);
  }

  if (isMosTicketInfoResponse(body)) {
    return renderMosTicketInfoCardHtml(body);
  }

  if (isClientIdentifiersResponse(body)) {
    return renderClientIdentifiersCardHtml(body, step);
  }

  if (isStartIdentifierRegistrationResponse(body)) {
    return renderStartIdentifierRegistrationCardHtml(body, step);
  }

  if (isIdentifierRegistrationStateResponse(body)) {
    return renderIdentifierRegistrationStateCardHtml(body, step);
  }

  if (isCompleteIdentifierRegistrationResponse(body)) {
    return renderCompleteIdentifierRegistrationCardHtml(body, step);
  }

  if (isPersonalizeIdentifierResponse(body)) {
    return renderPersonalizeIdentifierCardHtml(body, step);
  }

  if (isTokenizeMobileIdentifierResponse(body)) {
    return renderTokenizeMobileIdentifierCardHtml(body);
  }

  if (isClientDataResponse(body) || isClientDataStep(step)) {
    return renderClientDataCardHtml(body);
  }

  if (isClientStatusResponse(body)) {
    return renderClientStatusCardHtml(body);
  }

  if (isSaveClientDataResponse(body)) {
    return renderSaveClientDataCardHtml(body);
  }

  if (isSaveClientPhotoResponse(body)) {
    return renderSaveClientPhotoCardHtml(body);
  }

  if (typeof body.exists === "boolean" && typeof body.isActive === "boolean") {
    return buildCardListHtml([body], item => ({
      title: "Stav účtu",
      text: !item.exists
        ? "Zadaný e-mail v systému ještě neexistuje."
        : item.isActive
          ? "Účet už existuje a je aktivní."
          : "Účet existuje, ale zatím není aktivní.",
      chips: [
        item.exists ? "existuje" : "neexistuje",
        item.isActive ? "aktivní" : "neaktivní"
      ]
    }));
  }

  if (body.expiresAtUtc && body.createLoginResult && body.notificationAccountRegistrationResult) {
    return buildCardListHtml([body], item => ({
      title: "Aktivační e-mail odeslán",
      text: `Aktivační odkaz byl připraven s expirací ${formatDate(item.expiresAtUtc)}.`,
      chips: [
        item.createLoginResult?.type || "CreateLogin",
        item.notificationAccountRegistrationResult?.type || "Notification"
      ]
    }));
  }

  if (body.expiresAtUtc) {
    return buildCardListHtml([body], item => ({
      title: "E-mail pro obnovu hesla odeslán",
      text: `Odkaz pro obnovu hesla je platný do ${formatDate(item.expiresAtUtc)}.`,
      chips: [
        "obnova hesla",
        item.expiresAtUtc ? `platnost ${formatDate(item.expiresAtUtc)}` : null
      ]
    }));
  }

  if (typeof body.passwordChanged === "boolean") {
    return buildCardListHtml([body], item => ({
      title: item.passwordChanged ? "Heslo změněno" : "Heslo nebylo změněno",
      text: item.passwordChanged
        ? "Nové heslo bylo úspěšně nastaveno."
        : "Backend nevrátil potvrzení o změně hesla.",
      chips: [
        item.passwordChanged ? "změněno" : "nezměněno",
        item.createNewPasswordResult?.type || null
      ]
    }));
  }

  if (body.sent === true) {
    return buildCardListHtml([body], () => ({
      title: "Aktivace znovu odeslána",
      text: "Uživateli byl znovu poslán aktivační e-mail.",
      chips: ["odesláno"]
    }));
  }

  if (body.finalStatus && body.userName) {
    return buildCardListHtml([body], item => ({
      title: "Účet připraven",
      text: `Uživatel ${item.userName} byl zpracován ve stavu ${item.finalStatus}.`,
      chips: [
        item.activateLoginCalled ? "aktivováno nyní" : "už aktivní",
        item.loginId ? `login ${item.loginId}` : null
      ]
    }));
  }

  if (Array.isArray(body.fulfillments) && body.fulfillments.length > 0) {
    return buildCardListHtml(body.fulfillments, fulfillment => ({
      title: "Jízdenka",
      text: `Produkt ${fulfillment.productId}, zóny ${(fulfillment.validZones || []).join(", ")}`,
      chips: [fulfillment.state, fulfillment.amount ? `${fulfillment.amount} ks` : null]
    }), {
      selection: getSelectionDescriptor(step, body.fulfillments)
    });
  }

  if (body.bookingId) {
    return buildCardListHtml([body], booking => ({
      title: "Rezervace",
      text: `Rezervace ${shortId(booking.bookingId)} je připravena pro další krok.`,
      chips: [booking.status, booking.provisionalPrice ? `${booking.provisionalPrice.amount} ${booking.provisionalPrice.currency}` : null]
    }));
  }

  if (body.paymentId || body.paymentAttemptId) {
    return buildCardListHtml([body], payment => ({
      title: "Platba",
      text: `Platebn\u00ed po\u017eadavek byl zalo\u017een jako ${getPaymentFlowLabel(payment).toLowerCase()}.`,
      chips: [
        payment.state || payment.status,
        getPaymentFlowLabel(payment),
        shortId(payment.paymentId || payment.paymentAttemptId)
      ]
    }));
  }

  if (isPaymentCardResponse(body)) {
    return buildCardListHtml([body], card => ({
      title: card.cardholderName || card.name || "Platebn\u00ed karta",
      text: getPaymentCardMaskedNumber(card)
        ? `Karta ${getPaymentCardMaskedNumber(card)} je připravena k použití.`
        : "Karta byla zalo\u017eena a je p\u0159ipravena k dal\u0161\u00ed spr\u00e1v\u011b.",
      chips: [
        getPaymentCardExpiration(card),
        card.isDefault ? "výchozí" : null,
        shortId(card.cardId || card.id)
      ]
    }));
  }

  if (body.deviceId) {
    return buildCardListHtml([body], device => ({
      title: "Za\u0159\u00edzen\u00ed",
      text: `${device.deviceModel || "Mobiln\u00ed aplikace"} je p\u0159ipraveno pro dal\u0161\u00ed kroky.`,
      chips: [device.platform, shortId(device.deviceId)]
    }));
  }

  if (body.messageType) {
    return buildCardListHtml([body], command => ({
      title: "Zpracov\u00e1n\u00ed na pozad\u00ed",
      text: command.messageType,
      chips: [command.status, command.pendingCount !== undefined ? `${command.pendingCount} \u010dek\u00e1` : null]
    }));
  }

  if (body.downloadUrl && body.contentType === "application/pdf") {
    return `
      <div class="app-card-list">
        <article class="app-card">
          <strong>PDF doklad</strong>
          <p>Soubor byl vracen backendem jako application/pdf.</p>
          <div class="app-card-meta">
            <span class="app-chip">${escapeHtml(`${body.size} B`)}</span>
            <a class="app-chip app-link-chip" href="${escapeHtml(body.downloadUrl)}" target="_blank" rel="noopener">Otev\u0159\u00edt PDF</a>
          </div>
        </article>
      </div>
    `;
  }

  return "";
}

function isProblemDetailsResponse(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return false;
  }

  const hasBusinessError = ["createLoginResult", "notificationAccountRegistrationResult", "createNewPasswordResult", "changePasswordResult"]
    .some(key => body[key]?.type === "Error");

  return Number(body.status) >= 400 || Boolean(body.errors) || hasBusinessError;
}

function renderProblemDetailsCardHtml(body) {
  const hiddenErrorFields = new Set(["step", "coreMosResult"]);
  const validationMessages = Object.entries(body.errors || {})
    .filter(([field]) => !hiddenErrorFields.has(field))
    .flatMap(([field, values]) => Array.isArray(values)
      ? values.map(value => ({ field, value }))
      : [{ field, value: values }])
    .filter(item => !isEmpty(item.value));
  const businessMessages = ["createLoginResult", "notificationAccountRegistrationResult", "createNewPasswordResult", "changePasswordResult"]
    .map(key => body[key])
    .filter(result => result?.type === "Error" && result.text)
    .map(result => result.text);
  const chips = [
    body.status ? `HTTP ${body.status}` : null,
    businessMessages.length > 0 ? "business pravidlo" : null
  ].filter(Boolean);

  return `
    <div class="app-card-list">
      <article class="app-card">
        <strong>${escapeHtml(body.title || "Očekávané upozornění")}</strong>
        <p>${escapeHtml(body.detail || "Backend vrátil očekávanou chybovou odpověď.")}</p>
        ${chips.length > 0 ? `<div class="app-card-meta">${chips.map(renderAppChip).join("")}</div>` : ""}
        ${validationMessages.length > 0 || businessMessages.length > 0 ? `
          <div class="app-card-details">
            ${validationMessages.map(item => `
              <div class="app-detail-row"><span>${escapeHtml(item.field)}</span><span>${escapeHtml(item.value)}</span></div>
            `).join("")}
            ${businessMessages.map((message, index) => `
              <div class="app-detail-row"><span>Pravidlo ${index + 1}</span><span>${escapeHtml(message)}</span></div>
            `).join("")}
          </div>
        ` : ""}
      </article>
    </div>
  `;
}

function renderSavedCardPaymentCardHtml(body) {
  const ticket = body.parkingTicket;
  const inProgress = body.paymentInProgress === true;
  const statusText = inProgress
    ? "Platba čeká na dokončení"
    : body.paymentSuccessful === true
      ? "Platba proběhla"
      : "Výsledek platby uloženou kartou";

  return `
    <div class="app-card-list">
      <article class="app-card">
        <strong>${escapeHtml(statusText)}</strong>
        <p>${escapeHtml(inProgress
          ? "Platba je stále zpracovávána. Za chvíli spusťte tento krok znovu."
          : `${ticket.licensePlate || "Vozidlo"} má připravené navazující parkování.`)}</p>
        <div class="app-card-meta">
          ${renderAppChip(ticket.parkingSectionCode ? `Zóna ${ticket.parkingSectionCode}` : "Parkování")}
          ${renderAppChip(ticket.acceptedMinutes ? `${ticket.acceptedMinutes} min` : "")}
          ${renderAppChip(ticket.totalPrice !== undefined ? `${ticket.totalPrice} CZK` : "")}
          ${renderAppChip(ticket.paymentStatus || "")}
        </div>
        <div class="app-card-details">
          <div class="app-detail-row"><span>SPZ</span><span>${escapeHtml(ticket.licensePlate || "-")}</span></div>
          <div class="app-detail-row"><span>Od</span><span>${escapeHtml(formatDate(ticket.parkingFrom))}</span></div>
          <div class="app-detail-row"><span>Do</span><span>${escapeHtml(formatDate(ticket.parkingTo))}</span></div>
          <div class="app-detail-row"><span>Délka</span><span>${escapeHtml(ticket.acceptedMinutes ? `${ticket.acceptedMinutes} min` : "-")}</span></div>
          <div class="app-detail-row"><span>Cena</span><span>${escapeHtml(ticket.totalPrice !== undefined ? `${ticket.totalPrice} CZK` : "-")}</span></div>
          <div class="app-detail-row"><span>Doklad</span><span>${escapeHtml(ticket.formattedReceiptNumber || "-")}</span></div>
          <div class="app-detail-row"><span>Stav platby</span><span>${escapeHtml(ticket.paymentStatus || "-")}</span></div>
          <div class="app-detail-row"><span>PaymentInProgress</span><span>${escapeHtml(formatBooleanAnswer(body.paymentInProgress))}</span></div>
          <div class="app-detail-row"><span>PaymentSuccessful</span><span>${escapeHtml(formatBooleanAnswer(body.paymentSuccessful))}</span></div>
        </div>
      </article>
    </div>
  `;
}

function renderMosParkingOrderCardHtml(body) {
  const ticket = body.ticket || {};
  return `
    <div class="app-card-list">
      <article class="app-card">
        <strong>${escapeHtml(body.success ? "Parkování založeno" : "Parkování se nepodařilo založit")}</strong>
        <p>${escapeHtml(ticket.licensePlate || body.licensePlate || "Vozidlo")} má připravený MOS ticket.</p>
        <div class="app-card-meta">
          ${renderAppChip(ticket.sectionCode ? `Zóna ${ticket.sectionCode}` : "MOS")}
          ${renderAppChip(ticket.acceptedMinutes ? `${ticket.acceptedMinutes} min` : "")}
          ${renderAppChip(ticket.priceTotal !== undefined ? `${ticket.priceTotal} CZK` : "")}
          ${renderAppChip(formatMosPaymentStatus(ticket.paymentStatus))}
        </div>
        <div class="app-card-details">
          <div class="app-detail-row"><span>SPZ</span><span>${escapeHtml(ticket.licensePlate || body.licensePlate || "-")}</span></div>
          <div class="app-detail-row"><span>Od</span><span>${escapeHtml(formatDate(ticket.parkingFrom))}</span></div>
          <div class="app-detail-row"><span>Do</span><span>${escapeHtml(formatDate(ticket.parkingTo))}</span></div>
          <div class="app-detail-row"><span>Ticket GUID</span><span>${escapeHtml(ticket.ticketGUID || "-")}</span></div>
          <div class="app-detail-row"><span>Doklad</span><span>${escapeHtml(ticket.formattedReceiptNumber || "-")}</span></div>
          <div class="app-detail-row"><span>Reference</span><span>${escapeHtml(body.paymentGWReference || "-")}</span></div>
        </div>
        ${body.paymentGWRedirectURL ? `
          <div class="app-card-actions">
            <a class="app-card-link" href="${escapeHtml(body.paymentGWRedirectURL)}" target="_blank" rel="noopener">Otevřít platební bránu</a>
          </div>` : ""}
      </article>
    </div>
  `;
}

function renderMosSavedCardPaymentCardHtml(body) {
  const ticket = body.ticket || {};
  const browserChallenge = body.actions?.authenticate?.browserChallenge || null;

  return `
    <div class="app-card-list">
      <article class="app-card">
        <strong>${escapeHtml(body.paymentSuccessful ? "Platba uloženou kartou proběhla" : "Výsledek platby uloženou kartou")}</strong>
        <p>${escapeHtml(body.paymentInProgress ? "Platba je stále ve zpracování." : (body.resultMessage || "MOS vrátil výsledek tokenové platby."))}</p>
        <div class="app-card-meta">
          ${renderAppChip(ticket.sectionCode ? `Zóna ${ticket.sectionCode}` : "MOS")}
          ${renderAppChip(ticket.acceptedMinutes ? `${ticket.acceptedMinutes} min` : "")}
          ${renderAppChip(ticket.priceTotal !== undefined ? `${ticket.priceTotal} CZK` : "")}
          ${renderAppChip(formatMosPaymentStatus(ticket.paymentStatus))}
        </div>
        <div class="app-card-details">
          <div class="app-detail-row"><span>SPZ</span><span>${escapeHtml(ticket.licensePlate || "-")}</span></div>
          <div class="app-detail-row"><span>Od</span><span>${escapeHtml(formatDate(ticket.parkingFrom))}</span></div>
          <div class="app-detail-row"><span>Do</span><span>${escapeHtml(formatDate(ticket.parkingTo))}</span></div>
          <div class="app-detail-row"><span>Ticket GUID</span><span>${escapeHtml(ticket.ticketGUID || "-")}</span></div>
          <div class="app-detail-row"><span>Stav platby</span><span>${escapeHtml(formatMosPaymentStatus(ticket.paymentStatus))}</span></div>
          <div class="app-detail-row"><span>PaymentInProgress</span><span>${escapeHtml(formatBooleanAnswer(body.paymentInProgress))}</span></div>
          <div class="app-detail-row"><span>PaymentSuccessful</span><span>${escapeHtml(formatBooleanAnswer(body.paymentSuccessful))}</span></div>
          ${browserChallenge?.url ? `<div class="app-detail-row"><span>Další ověření</span><span>${escapeHtml(browserChallenge.method || "3DS")}</span></div>` : ""}
        </div>
        ${browserChallenge?.url ? `
          <div class="app-card-actions">
            <a class="app-card-link" href="${escapeHtml(browserChallenge.url)}" target="_blank" rel="noopener">Otevřít ověření platby</a>
          </div>` : ""}
      </article>
    </div>
  `;
}

function renderMosTicketInfoCardHtml(ticket) {
  return `
    <div class="app-card-list">
      <article class="app-card">
        <strong>${escapeHtml(ticket.licensePlate || "MOS ticket")}</strong>
        <p>${escapeHtml(ticket.sectionCode || ticket.parkMachineCode || "Parkovací ticket")}</p>
        <div class="app-card-meta">
          ${renderAppChip(ticket.priceTotal !== undefined ? `${ticket.priceTotal} CZK` : "")}
          ${renderAppChip(ticket.acceptedMinutes ? `${ticket.acceptedMinutes} min` : "")}
          ${renderAppChip(formatMosPaymentStatus(ticket.paymentStatus))}
        </div>
        <div class="app-card-details">
          <div class="app-detail-row"><span>Ticket GUID</span><span>${escapeHtml(ticket.ticketGUID || "-")}</span></div>
          <div class="app-detail-row"><span>Od</span><span>${escapeHtml(formatDate(ticket.parkingFrom))}</span></div>
          <div class="app-detail-row"><span>Do</span><span>${escapeHtml(formatDate(ticket.parkingTo))}</span></div>
          <div class="app-detail-row"><span>Doklad</span><span>${escapeHtml(ticket.formattedReceiptNumber || "-")}</span></div>
        </div>
      </article>
    </div>
  `;
}

function renderMosTokenCouponsOverviewCardHtml(body) {
  const tokens = Array.isArray(body.tokens) ? body.tokens : [];

  if (tokens.length === 0) {
    return renderEmptyAppCardHtml(
      "Žádné identifikátory",
      "Core MOS pro aktuální login nevrátil žádný identifikátor."
    );
  }

  return `
    <div class="app-card-list">
      <article class="app-card">
        <strong>Identifikátory a kupóny</strong>
        <p>Načteno ${escapeHtml(body.totalTokens)} identifikátorů a ${escapeHtml(body.totalCoupons)} kupónů.</p>
        <div class="app-card-meta">
          ${renderAppChip(body.loadAllCoupons ? "všechny kupóny" : "jen platné kupóny")}
          ${renderAppChip(`${body.totalTokens} identifikátorů`)}
          ${renderAppChip(`${body.totalCoupons} kupónů`)}
        </div>
      </article>
      ${tokens.map(token => `
        <article class="app-card">
          <strong>${escapeHtml(getMosTokenTitle(token))}</strong>
          <p>${escapeHtml(getMosTokenDescription(token))}</p>
          <div class="app-card-meta">
            ${renderAppChip(token.identifierType || "identifikátor")}
            ${renderAppChip(token.isPersonalized === "true" ? "personalizovaný" : token.isPersonalized === "false" ? "nepersonalizovaný" : "personalizace neznámá")}
            ${renderAppChip(token.active === "true" ? "aktivní" : token.active === "false" ? "neaktivní" : null)}
            ${renderAppChip(token.coupons.length === 1 ? "1 kupón" : `${token.coupons.length} kupónů`)}
          </div>
          <div class="app-card-details">
            <div class="app-detail-row"><span>TokenID</span><span>${escapeHtml(token.tokenId || "-")}</span></div>
            <div class="app-detail-row"><span>Typ</span><span>${escapeHtml([token.identifierType, token.identifierSubtype].filter(Boolean).join(" / ") || "-")}</span></div>
            <div class="app-detail-row"><span>Hodnota</span><span>${escapeHtml(token.maskedPan || token.cln || token.token || "-")}</span></div>
            <div class="app-detail-row"><span>CustomerID</span><span>${escapeHtml(token.customerId || "-")}</span></div>
            ${token.validTo ? `<div class="app-detail-row"><span>Platný do</span><span>${escapeHtml(formatDate(token.validTo))}</span></div>` : ""}
          </div>
          ${renderMosCouponSubformHtml(token.coupons)}
        </article>
      `).join("")}
    </div>
  `;
}

function renderMosCouponSubformHtml(coupons) {
  if (!Array.isArray(coupons) || coupons.length === 0) {
    return `
      <div class="app-coupon-empty">
        <strong>Žádné kupóny</strong>
        <span>Na tomto identifikátoru nejsou žádné kupóny.</span>
      </div>
    `;
  }

  return `
    <div class="app-coupon-list">
      <strong class="app-coupon-list-title">Přiřazené kupóny</strong>
      ${coupons.map(coupon => `
        <section class="app-coupon-item">
          <div class="app-coupon-item-head">
            <strong>${escapeHtml(coupon.tariffName || coupon.name || (coupon.couponId ? `Kupón ${coupon.couponId}` : "Kupón"))}</strong>
            <span>${escapeHtml(coupon.customStatusName || coupon.status || "stav neznámý")}</span>
          </div>
          <div class="app-coupon-item-meta">
            ${[
              coupon.zones ? `zóny ${coupon.zones}` : null,
              coupon.price ? `${coupon.price} Kč` : null,
              coupon.couponId ? `ID ${coupon.couponId}` : null
            ].filter(Boolean).map(renderAppChip).join("")}
          </div>
          <div class="app-coupon-item-details">
            <div><span>Platnost od</span><span>${escapeHtml(formatDate(coupon.dateTimeFrom) || "-")}</span></div>
            <div><span>Platnost do</span><span>${escapeHtml(formatDate(coupon.dateTimeTo) || "-")}</span></div>
            <div><span>Tarif</span><span>${escapeHtml(coupon.tariffId || "-")}</span></div>
            <div><span>Objednávka</span><span>${escapeHtml(coupon.orderId || "-")}</span></div>
          </div>
        </section>
      `).join("")}
    </div>
  `;
}

function getMosTokenTitle(token) {
  return token.name
    || token.maskedPan
    || token.cln
    || (token.tokenId ? `Token ${token.tokenId}` : "Identifikátor");
}

function getMosTokenDescription(token) {
  return [
    token.identifierType ? `typ ${token.identifierType}` : null,
    token.tokenId ? `TokenID ${token.tokenId}` : null,
    token.customerId ? `CustomerID ${token.customerId}` : null
  ].filter(Boolean).join(", ") || "Identifikátor v Core MOS.";
}

function getMosCouponSummary(coupon) {
  return [
    coupon.tariffName || coupon.name || (coupon.tariffId ? `Tarif ${coupon.tariffId}` : null),
    coupon.zones ? `zóny ${coupon.zones}` : null,
    coupon.dateTimeFrom && coupon.dateTimeTo ? `${formatDate(coupon.dateTimeFrom)} - ${formatDate(coupon.dateTimeTo)}` : null,
    coupon.status || coupon.customStatusName || null,
    coupon.price ? `${coupon.price} Kč` : null
  ].filter(Boolean).join(", ") || "Kupón bez detailu.";
}

function renderCouponMoveTargetOverviewCardHtml(body, step = currentStep()) {
  const identifiers = Array.isArray(body.identifiers) ? body.identifiers : [];
  const selection = getSelectionDescriptor(step, identifiers);

  if (identifiers.length === 0) {
    return renderEmptyAppCardHtml(
      "Žádné identifikátory",
      "Aktuální klient nemá žádný identifikátor. Pro přesun kupónů je potřeba alespoň jeden cíl."
    );
  }

  return buildCardListHtml(identifiers, identifier => {
    const coupons = Array.isArray(identifier.coupons) ? identifier.coupons : [];
    const moveCandidateCouponCount = Number(identifier.moveCandidateCouponCount || 0);

    return {
      title: getIdentifierDisplayName(identifier),
      text: coupons.length > 0
        ? `Na tomto identifikátoru jsou ${formatCount(coupons.length, "kupón", "kupóny", "kupónů")}.`
        : "Na tomto identifikátoru nejsou žádné kupóny.",
      chips: [
        getIdentifierTypeLabel(identifier),
        identifier.isPersonalized === true ? "personalizovaný" : identifier.isPersonalized === false ? "nepersonalizovaný" : null,
        coupons.length > 0 ? formatCount(coupons.length, "kupón", "kupóny", "kupónů") : "bez kupónů",
        moveCandidateCouponCount > 0 ? `po výběru cíle se přesune ${moveCandidateCouponCount}` : "po výběru cíle nic k přesunu",
        identifier.movePreviewStatus || null
      ],
      details: [
        { label: "Identifikátor", value: getIdentifierDisplayName(identifier) },
        { label: "ID", value: identifier.identifierId },
        { label: "Hodnota", value: identifier.maskedPan || identifier.name },
        { label: "Kupóny na identifikátoru", value: coupons.length },
        { label: "Kupóny k přesunu při volbě tohoto cíle", value: moveCandidateCouponCount },
        { label: "Zdrojů při volbě tohoto cíle", value: identifier.moveCandidateSourceCount }
      ].filter(item => !isEmpty(item.value)),
      extraHtml: renderPidCouponSubformHtml(coupons, "Kupóny na tomto identifikátoru")
    };
  }, { selection });
}

function renderCouponMovePreviewCardHtml(body) {
  const target = body.targetIdentifier || {};
  const sources = Array.isArray(body.sources) ? body.sources : [];
  const warnings = Array.isArray(body.warnings) ? body.warnings : [];
  const couponCount = Number(body.couponCount || 0);

  return `
    <div class="app-card-list">
      <article class="app-card">
        <strong>${escapeHtml(couponCount > 0 ? "Preview přesunu kupónů" : "Žádné kupóny k přesunu")}</strong>
        <p>${escapeHtml(couponCount > 0
          ? `Na cíl ${getIdentifierDisplayName(target)} se bude přesouvat ${formatCount(couponCount, "kupón", "kupóny", "kupónů")}.`
          : `Pro cíl ${getIdentifierDisplayName(target)} nejsou na ostatních identifikátorech žádné kupóny k přesunu.`)}</p>
        <div class="app-card-meta">
          ${renderAppChip(body.status || "status neznámý")}
          ${renderAppChip(formatCount(sources.length, "zdroj", "zdroje", "zdrojů"))}
          ${renderAppChip(formatCount(couponCount, "kupón", "kupóny", "kupónů"))}
          ${warnings.length > 0 ? renderAppChip(`${warnings.length} varování`) : ""}
        </div>
        <div class="app-card-details">
          <div class="app-detail-row"><span>Cíl</span><span>${escapeHtml(getIdentifierDisplayName(target))}</span></div>
          <div class="app-detail-row"><span>Cílové ID</span><span>${escapeHtml(target.identifierId || "-")}</span></div>
          <div class="app-detail-row"><span>Kupóny k přesunu</span><span>${escapeHtml(couponCount)}</span></div>
        </div>
      </article>
      ${sources.map(source => renderCouponMoveSourceCardHtml(source)).join("")}
      ${warnings.length > 0 ? renderCouponMoveWarningsCardHtml(warnings) : ""}
    </div>
  `;
}

function renderMoveCouponsReportCardHtml(body) {
  const moved = Array.isArray(body.moved) ? body.moved : [];
  const failed = Array.isArray(body.failed) ? body.failed : [];
  const steps = Array.isArray(body.steps) ? body.steps : [];
  const skipped = steps.filter(step => String(step.status || "").toLowerCase() === "skipped");
  const completed = String(body.status || "").toLowerCase() === "completed" && failed.length === 0;

  return `
    <div class="app-card-list">
      <article class="app-card">
        <strong>${escapeHtml(completed ? "Přesun proběhl úspěšně" : "Výsledek přesunu kupónů")}</strong>
        <p>${escapeHtml(getMoveCouponsSummaryText(body, moved, failed, skipped))}</p>
        <div class="app-card-meta">
          ${renderAppChip(body.status || "status neznámý")}
          ${renderAppChip(`přesunuto: ${sumCouponCounts(moved)}`)}
          ${renderAppChip(`selhalo: ${sumCouponCounts(failed)}`)}
          ${skipped.length > 0 ? renderAppChip(`přeskočeno: ${skipped.length}`) : ""}
        </div>
        <div class="app-card-details">
          <div class="app-detail-row"><span>Cílové ID</span><span>${escapeHtml(body.targetIdentifierId || "-")}</span></div>
          <div class="app-detail-row"><span>Zdroje přesunuty</span><span>${escapeHtml(moved.length)}</span></div>
          <div class="app-detail-row"><span>Zdroje selhaly</span><span>${escapeHtml(failed.length)}</span></div>
          <div class="app-detail-row"><span>Kroky přeskočeny</span><span>${escapeHtml(skipped.length)}</span></div>
        </div>
      </article>
      ${moved.length > 0 ? renderMoveCouponsResultListHtml("Přesunuto", moved) : ""}
      ${failed.length > 0 ? renderMoveCouponsResultListHtml("Selhalo", failed) : ""}
      ${renderMoveCouponsStepsCardHtml(steps)}
    </div>
  `;
}

function renderCouponMoveSourceCardHtml(source) {
  const identifier = source.identifier || {};
  const coupons = Array.isArray(source.coupons) ? source.coupons : [];

  return `
    <article class="app-card">
      <strong>${escapeHtml(getIdentifierDisplayName(identifier))}</strong>
      <p>${escapeHtml(formatCount(coupons.length, "kupón bude přesunut", "kupóny budou přesunuty", "kupónů bude přesunuto"))}</p>
      <div class="app-card-meta">
        ${renderAppChip(getIdentifierTypeLabel(identifier))}
        ${renderAppChip(formatCount(coupons.length, "kupón", "kupóny", "kupónů"))}
        ${identifier.isPersonalized === true ? renderAppChip("personalizovaný") : ""}
      </div>
      <div class="app-card-details">
        <div class="app-detail-row"><span>Zdroj</span><span>${escapeHtml(getIdentifierDisplayName(identifier))}</span></div>
        <div class="app-detail-row"><span>Zdrojové ID</span><span>${escapeHtml(identifier.identifierId || "-")}</span></div>
      </div>
      ${renderPidCouponSubformHtml(coupons)}
    </article>
  `;
}

function renderPidCouponSubformHtml(coupons, title = "Kupóny") {
  if (!Array.isArray(coupons) || coupons.length === 0) {
    return `
      <div class="app-coupon-empty">
        Na tomto identifikátoru nejsou žádné kupóny.
      </div>
    `;
  }

  return `
    <div class="app-coupon-list">
      <strong class="app-coupon-list-title">${escapeHtml(title)}</strong>
      ${coupons.map(coupon => `
        <section class="app-coupon-item">
          <div class="app-coupon-item-head">
            <strong>${escapeHtml(coupon.tariffName || coupon.name || (coupon.couponId ? `Kupón ${coupon.couponId}` : "Kupón"))}</strong>
            <span>${escapeHtml(coupon.couponId ? `ID ${coupon.couponId}` : "")}</span>
          </div>
          <div class="app-coupon-item-meta">
            ${[
              coupon.zones ? `zóny ${coupon.zones}` : null,
              coupon.price !== undefined ? `${coupon.price} Kč` : null,
              coupon.customerProfileName || null
            ].filter(Boolean).map(renderAppChip).join("")}
          </div>
          <div class="app-coupon-item-details">
            <div><span>Platnost od</span><span>${escapeHtml(formatDate(coupon.validFrom || coupon.dateTimeFrom) || "-")}</span></div>
            <div><span>Platnost do</span><span>${escapeHtml(formatDate(coupon.validTo || coupon.dateTimeTo) || "-")}</span></div>
            <div><span>Tarif</span><span>${escapeHtml(coupon.tariffName || coupon.name || "-")}</span></div>
          </div>
        </section>
      `).join("")}
    </div>
  `;
}

function renderCouponMoveWarningsCardHtml(warnings) {
  return `
    <article class="app-card">
      <strong>Varování</strong>
      <p>Backend vrátil doplňující upozornění k přesunu.</p>
      <div class="app-card-details">
        ${warnings.map((warning, index) => `
          <div class="app-detail-row"><span>${escapeHtml(warning.code || `Varování ${index + 1}`)}</span><span>${escapeHtml(warning.message || JSON.stringify(warning))}</span></div>
        `).join("")}
      </div>
    </article>
  `;
}

function renderMoveCouponsResultListHtml(title, items) {
  return `
    <article class="app-card">
      <strong>${escapeHtml(title)}</strong>
      <p>${escapeHtml(formatCount(items.length, "zdroj", "zdroje", "zdrojů"))}</p>
      <div class="app-card-details">
        ${items.map(item => {
          const sourceLabel = getKnownIdentifierLabel(item.sourceIdentifierId) || (item.sourceIdentifierId ? `Zdroj ${item.sourceIdentifierId}` : "Zdroj");

          return `
            <div class="app-detail-row">
              <span>${escapeHtml(sourceLabel)}</span>
              <span>${escapeHtml([
              formatCount(Number(item.couponCount || 0), "kupón", "kupóny", "kupónů"),
              item.resultText || item.reason || item.message || null,
              item.resultType || null,
              item.resultId !== undefined ? `Result ${item.resultId}` : null
              ].filter(Boolean).join(" | "))}</span>
            </div>
          `;
        }).join("")}
      </div>
    </article>
  `;
}

function renderMoveCouponsStepsCardHtml(steps) {
  if (!Array.isArray(steps) || steps.length === 0) {
    return "";
  }

  return `
    <article class="app-card">
      <strong>Kroky BE/MOS</strong>
      <p>Diagnostika jednotlivých částí operace.</p>
      <div class="app-card-details">
        ${steps.map(step => `
          <div class="app-detail-row"><span>${escapeHtml(step.name || "Krok")}</span><span>${escapeHtml([
            step.status || "-",
            step.message || null,
            step.resultType || null,
            step.resultId !== undefined ? `Result ${step.resultId}` : null
          ].filter(Boolean).join(" | "))}</span></div>
        `).join("")}
      </div>
    </article>
  `;
}

function getMoveCouponsSummaryText(body, moved, failed, skipped) {
  if (String(body.status || "").toLowerCase() === "completed" && failed.length === 0) {
    const movedCoupons = sumCouponCounts(moved);
    return movedCoupons > 0
      ? `Hotovo: přesunuto ${formatCount(movedCoupons, "kupón", "kupóny", "kupónů")} na cílový identifikátor ${body.targetIdentifierId}.`
      : "Hotovo: nebyly nalezeny žádné kupóny k přesunu.";
  }

  if (failed.length > 0) {
    return `Přesun není kompletní: selhalo ${formatCount(sumCouponCounts(failed), "kupón", "kupóny", "kupónů")} na ${formatCount(failed.length, "zdroji", "zdrojích", "zdrojích")}.`;
  }

  if (skipped.length > 0) {
    return "Operace byla dokončena, ale některé kroky byly přeskočeny.";
  }

  return `Business status: ${body.status || "neznámý"}.`;
}

function sumCouponCounts(items) {
  return (items || []).reduce((sum, item) => sum + Number(item.couponCount || 0), 0);
}

function getKnownIdentifierLabel(identifierId) {
  if (isEmpty(identifierId)) {
    return "";
  }

  return state.context?.pidCouponIdentifierLabels?.[String(identifierId)] || "";
}

function getIdentifierDisplayName(identifier) {
  const typeLabel = getIdentifierTypeLabel(identifier);
  const value = identifier?.maskedPan
    || identifier?.name
    || identifier?.tokenValue
    || identifier?.guid
    || identifier?.identifierGuid
    || identifier?.tokenGuid
    || identifier?.identifierId
    || "";
  const guid = identifier?.guid || identifier?.identifierGuid || identifier?.tokenGuid || "";

  if (guid && String(value) !== String(guid)) {
    return `${typeLabel} ${value} (${guid})`;
  }

  return value ? `${typeLabel} ${value}` : typeLabel;
}

function getIdentifierTypeLabel(identifier) {
  const text = String(identifier?.type || identifier?.identifierType || identifier?.subtype || "").toLowerCase();

  if (text.includes("mob") || text.includes("phone") || text.includes("telefon")) {
    return "Telefon";
  }

  if (text.includes("bpk") || text.includes("card") || text.includes("karta")) {
    return "Karta";
  }

  return "Identifikátor";
}

function formatCount(count, one, few, many) {
  const value = Number(count || 0);
  const label = value === 1
    ? one
    : value >= 2 && value <= 4
      ? few
      : many;

  return `${value} ${label}`;
}

function renderClientStatusCardHtml(body) {
  const personalData = body.personalData || {};
  const photo = body.photo || {};
  const displayName = personalData.displayName
    || [personalData.firstName, personalData.lastName].filter(Boolean).join(" ")
    || personalData.email
    || "Přihlášený uživatel";

  return `
    <div class="app-card-list">
      <article class="app-card">
        <strong>${escapeHtml(getClientStatusTitle(body))}</strong>
        <p>${escapeHtml(getClientStatusText(body))}</p>
        <div class="app-card-meta">
          ${renderAppChip(body.isUserActive ? "uživatel aktivní" : "uživatel neaktivní")}
          ${renderAppChip(body.exists ? "klient existuje" : "klient chybí")}
          ${renderAppChip(body.hasPersonalData ? "osobní údaje uložené" : "bez osobních údajů")}
          ${renderAppChip(getClientStatusLabel(body.status))}
        </div>
        <div class="app-card-details">
          <div class="app-detail-row"><span>Stav</span><span>${escapeHtml(getClientStatusLabel(body.status))}</span></div>
          <div class="app-detail-row"><span>Uživatel aktivní</span><span>${escapeHtml(formatBooleanAnswer(body.isUserActive))}</span></div>
          <div class="app-detail-row"><span>Klient založen</span><span>${escapeHtml(formatBooleanAnswer(body.exists))}</span></div>
          <div class="app-detail-row"><span>Osobní údaje</span><span>${escapeHtml(formatBooleanAnswer(body.hasPersonalData))}</span></div>
          ${body.hasPersonalData ? `
            <div class="app-detail-row"><span>Jméno</span><span>${escapeHtml(displayName)}</span></div>
            ${personalData.email ? `<div class="app-detail-row"><span>E-mail</span><span>${escapeHtml(personalData.email)}</span></div>` : ""}
            ${personalData.mobile ? `<div class="app-detail-row"><span>Telefon</span><span>${escapeHtml(personalData.mobile)}</span></div>` : ""}
            ${personalData.dateOfBirth ? `<div class="app-detail-row"><span>Datum narození</span><span>${escapeHtml(formatDate(personalData.dateOfBirth))}</span></div>` : ""}
            ${personalData.registeredNumberIsic ? `<div class="app-detail-row"><span>ISIC</span><span>${escapeHtml(personalData.registeredNumberIsic)}</span></div>` : ""}
          ` : ""}
          ${body.photo ? `
            <div class="app-detail-row"><span>Fotografie</span><span>${escapeHtml(photo.exists ? "ano" : "ne")}</span></div>
            ${photo.statusName ? `<div class="app-detail-row"><span>Stav fotografie</span><span>${escapeHtml(photo.statusName)}</span></div>` : ""}
            ${photo.approvalDate ? `<div class="app-detail-row"><span>Schváleno</span><span>${escapeHtml(formatDate(photo.approvalDate))}</span></div>` : ""}
            ${photo.reason ? `<div class="app-detail-row"><span>Poznámka k fotografii</span><span>${escapeHtml(photo.reason)}</span></div>` : ""}
          ` : ""}
        </div>
      </article>
    </div>
  `;
}

function renderClientDataCardHtml(body) {
  const view = getClientDataViewModel(body);
  const personalData = view.personalData || {};
  const photo = view.photo || {};
  const photoItems = getClientPhotoDataItems(view.photoData);
  const displayName = personalData.displayName
    || [personalData.firstName, personalData.lastName].filter(Boolean).join(" ")
    || personalData.email
    || "Přihlášený uživatel";

  return `
    <div class="app-card-list">
      <article class="app-card">
        <strong>${escapeHtml(getClientStatusTitle(view))}</strong>
        <p>${escapeHtml(photoItems.length > 0
          ? "Backend vrátil kompletní klientská data včetně obrazových dat fotografií."
          : getClientStatusText(view))}</p>
        <div class="app-card-meta">
          ${renderAppChip(view.isUserActive ? "uživatel aktivní" : "uživatel neaktivní")}
          ${renderAppChip(view.exists ? "klient existuje" : "klient chybí")}
          ${renderAppChip(view.hasPersonalData ? "osobní údaje uložené" : "bez osobních údajů")}
          ${renderAppChip(photoItems.length > 0 ? `${photoItems.length} foto` : "bez fotek")}
          ${renderAppChip(getClientStatusLabel(view.status))}
        </div>
        <div class="app-card-details">
          <div class="app-detail-row"><span>Stav</span><span>${escapeHtml(getClientStatusLabel(view.status))}</span></div>
          <div class="app-detail-row"><span>Uživatel aktivní</span><span>${escapeHtml(formatBooleanAnswer(view.isUserActive))}</span></div>
          <div class="app-detail-row"><span>Klient založen</span><span>${escapeHtml(formatBooleanAnswer(view.exists))}</span></div>
          <div class="app-detail-row"><span>Osobní údaje</span><span>${escapeHtml(formatBooleanAnswer(view.hasPersonalData))}</span></div>
          ${view.hasPersonalData ? `
            <div class="app-detail-row"><span>Jméno</span><span>${escapeHtml(displayName)}</span></div>
            ${personalData.email ? `<div class="app-detail-row"><span>E-mail</span><span>${escapeHtml(personalData.email)}</span></div>` : ""}
            ${personalData.title ? `<div class="app-detail-row"><span>Titul</span><span>${escapeHtml(personalData.title)}</span></div>` : ""}
            ${personalData.firstName ? `<div class="app-detail-row"><span>Křestní jméno</span><span>${escapeHtml(personalData.firstName)}</span></div>` : ""}
            ${personalData.middleName ? `<div class="app-detail-row"><span>Prostřední jméno</span><span>${escapeHtml(personalData.middleName)}</span></div>` : ""}
            ${personalData.lastName ? `<div class="app-detail-row"><span>Příjmení</span><span>${escapeHtml(personalData.lastName)}</span></div>` : ""}
            ${personalData.mobile ? `<div class="app-detail-row"><span>Telefon</span><span>${escapeHtml(personalData.mobile)}</span></div>` : ""}
            ${personalData.dateOfBirth ? `<div class="app-detail-row"><span>Datum narození</span><span>${escapeHtml(formatDate(personalData.dateOfBirth))}</span></div>` : ""}
            ${personalData.registeredNumberIsic ? `<div class="app-detail-row"><span>ISIC</span><span>${escapeHtml(personalData.registeredNumberIsic)}</span></div>` : ""}
          ` : ""}
          ${view.photo ? `
            <div class="app-detail-row"><span>Fotografie</span><span>${escapeHtml(photo.exists ? "ano" : "ne")}</span></div>
            ${photo.statusName ? `<div class="app-detail-row"><span>Stav fotografie</span><span>${escapeHtml(photo.statusName)}</span></div>` : ""}
            ${photo.statusId != null ? `<div class="app-detail-row"><span>Kód stavu fotografie</span><span>${escapeHtml(photo.statusId)}</span></div>` : ""}
            ${photo.approvalDate ? `<div class="app-detail-row"><span>Schváleno</span><span>${escapeHtml(formatDate(photo.approvalDate))}</span></div>` : ""}
            ${photo.reason ? `<div class="app-detail-row"><span>Poznámka k fotografii</span><span>${escapeHtml(photo.reason)}</span></div>` : ""}
          ` : ""}
        </div>
        ${renderClientPhotoDataHtml(photoItems)}
      </article>
    </div>
  `;
}

function getClientDataViewModel(body) {
  const client = body?.client && typeof body.client === "object" ? body.client : {};
  const personalData = body?.personalData || client.personalData || {};
  const photo = body?.photo || client.photo || null;
  const photoData = body?.photoData || body?.photos || body?.photoPayload || client.photoData || null;
  const exists = coalesceBoolean(body?.exists, client.exists, Boolean(personalData && Object.keys(personalData).length));
  const isUserActive = coalesceBoolean(body?.isUserActive, body?.isActive, client.isUserActive, client.isActive, true);
  const hasPersonalData = coalesceBoolean(
    body?.hasPersonalData,
    client.hasPersonalData,
    Boolean(personalData && Object.keys(personalData).length));

  return {
    exists,
    isUserActive,
    hasPersonalData,
    status: body?.status || client.status || "",
    personalData,
    photo,
    photoData
  };
}

function coalesceBoolean(...values) {
  for (const value of values) {
    if (typeof value === "boolean") {
      return value;
    }
  }

  return false;
}

function renderClientPhotoDataHtml(photoItems) {
  if (photoItems.length === 0) {
    return `
      <div class="client-photo-grid">
        <div class="client-photo-empty">Obrazová data fotografie nejsou v odpovědi k dispozici.</div>
      </div>
    `;
  }

  return `
    <div class="client-photo-grid">
      ${photoItems.map(item => `
        <figure class="client-photo-card">
          <img src="${escapeHtml(item.src)}" alt="${escapeHtml(item.label)}">
          <figcaption>
            <strong>${escapeHtml(item.label)}</strong>
            <span>${escapeHtml(formatBytes(item.size))}</span>
          </figcaption>
        </figure>
      `).join("")}
    </div>
  `;
}

function getClientPhotoDataItems(photoData) {
  if (!photoData || typeof photoData !== "object") {
    return [];
  }

  return [
    { keys: ["colorPhoto", "ColorPhoto"], label: "Barevná fotografie" },
    { keys: ["blackWhitePhoto", "BlackWhitePhoto", "photoBW", "PhotoBW"], label: "Černobílá fotografie" }
  ]
    .map(item => {
      const base64 = item.keys.map(key => photoData[key]).find(value => value);

      if (!base64 || typeof base64 !== "string") {
        return null;
      }

      return {
        ...item,
        src: buildImageDataUrl(base64),
        size: getBase64ByteLength(base64)
      };
    })
    .filter(Boolean);
}

function buildImageDataUrl(base64) {
  const trimmed = String(base64).trim();

  if (trimmed.startsWith("data:")) {
    return trimmed;
  }

  return `data:image/jpeg;base64,${trimmed}`;
}

function getBase64ByteLength(base64) {
  try {
    return base64ToBytes(base64).byteLength;
  } catch {
    return 0;
  }
}

function renderSaveClientDataCardHtml(body) {
  const client = body.client || {};
  const personalData = client.personalData || {};
  const displayName = personalData.displayName
    || [personalData.firstName, personalData.lastName].filter(Boolean).join(" ")
    || "Klient";

  return `
    <div class="app-card-list">
      <article class="app-card">
        <strong>${escapeHtml(body.created ? "Klient založen" : "Klientská data uložena")}</strong>
        <p>${escapeHtml(body.created
          ? "Backend vytvořil klientský profil a uložil osobní údaje."
          : "Backend aktualizoval osobní údaje existujícího klienta.")}</p>
        <div class="app-card-meta">
          ${renderAppChip(getClientStatusLabel(body.status))}
          ${renderAppChip(body.created ? "nový klient" : "existující klient")}
          ${renderAppChip(client.isUserActive ? "uživatel aktivní" : "uživatel neaktivní")}
          ${renderAppChip(body.personalDataConsentApplied ? "souhlas uložen" : "souhlas neodeslán")}
        </div>
        <div class="app-card-details">
          <div class="app-detail-row"><span>Výsledek</span><span>${escapeHtml(getClientStatusLabel(body.status))}</span></div>
          <div class="app-detail-row"><span>Uživatel aktivní</span><span>${escapeHtml(formatBooleanAnswer(client.isUserActive))}</span></div>
          <div class="app-detail-row"><span>Klient založen</span><span>${escapeHtml(formatBooleanAnswer(body.created))}</span></div>
          <div class="app-detail-row"><span>Souhlas s údaji</span><span>${escapeHtml(formatBooleanAnswer(body.personalDataConsentApplied))}</span></div>
          <div class="app-detail-row"><span>Osobní údaje</span><span>${escapeHtml(formatBooleanAnswer(client.hasPersonalData))}</span></div>
          ${personalData ? `
            <div class="app-detail-row"><span>Jméno</span><span>${escapeHtml(displayName)}</span></div>
            ${personalData.mobile ? `<div class="app-detail-row"><span>Telefon</span><span>${escapeHtml(personalData.mobile)}</span></div>` : ""}
            ${personalData.dateOfBirth ? `<div class="app-detail-row"><span>Datum narození</span><span>${escapeHtml(formatDate(personalData.dateOfBirth))}</span></div>` : ""}
            ${personalData.registeredNumberIsic ? `<div class="app-detail-row"><span>ISIC</span><span>${escapeHtml(personalData.registeredNumberIsic)}</span></div>` : ""}
          ` : ""}
        </div>
      </article>
    </div>
  `;
}

function renderSaveClientPhotoCardHtml(body) {
  const client = body.client || {};
  const photo = client.photo || {};

  return `
    <div class="app-card-list">
      <article class="app-card">
        <strong>${escapeHtml(body.status === "Completed" ? "Fotografie uložena" : "Uložení fotografie")}</strong>
        <p>${escapeHtml(body.status === "Completed"
          ? "Backend uložil fotografii klienta samostatným požadavkem."
          : "Požadavek na uložení fotografie byl zpracován, ale není ve finálním stavu.")}</p>
        <div class="app-card-meta">
          ${renderAppChip(getClientStatusLabel(body.status))}
          ${renderAppChip(client.isUserActive ? "uživatel aktivní" : "uživatel neaktivní")}
          ${renderAppChip(client.hasPersonalData ? "osobní údaje uložené" : "bez osobních údajů")}
          ${renderAppChip(photo.exists ? "fotografie evidována" : "fotografie bez potvrzení")}
        </div>
        <div class="app-card-details">
          <div class="app-detail-row"><span>Výsledek</span><span>${escapeHtml(getClientStatusLabel(body.status))}</span></div>
          <div class="app-detail-row"><span>Uživatel aktivní</span><span>${escapeHtml(formatBooleanAnswer(client.isUserActive))}</span></div>
          <div class="app-detail-row"><span>Osobní údaje</span><span>${escapeHtml(formatBooleanAnswer(client.hasPersonalData))}</span></div>
          ${client.status ? `<div class="app-detail-row"><span>Stav klienta</span><span>${escapeHtml(getClientStatusLabel(client.status))}</span></div>` : ""}
          ${photo.statusName ? `<div class="app-detail-row"><span>Stav fotografie</span><span>${escapeHtml(photo.statusName)}</span></div>` : ""}
          ${photo.approvalDate ? `<div class="app-detail-row"><span>Schváleno</span><span>${escapeHtml(formatDate(photo.approvalDate))}</span></div>` : ""}
          ${photo.reason ? `<div class="app-detail-row"><span>Poznámka k fotografii</span><span>${escapeHtml(photo.reason)}</span></div>` : ""}
        </div>
      </article>
    </div>
  `;
}

function renderClientIdentifiersCardHtml(body, step = currentStep()) {
  const identifiers = Array.isArray(body.identifiers) ? body.identifiers : [];

  if (identifiers.length === 0) {
    return renderEmptyAppCardHtml(
      "Žádné identifikátory",
      "Klient zatím nemá uložený žádný identifikátor. Pro současnou fázi vývoje je prázdný seznam v pořádku."
    );
  }

  return buildCardListHtml(identifiers, identifier => {
    const title = getIdentifierDisplayName(identifier);

    const textParts = [
      identifier.maskedPan,
      identifier.expiry ? `platnost ${identifier.expiry}` : null
    ].filter(Boolean);

    return {
      title,
      text: textParts.length > 0
        ? textParts.join(", ")
        : "Identifikátor dostupný pro služby klienta.",
      chips: [
        getIdentifierTypeLabel(identifier),
        identifier.type || null,
        identifier.subtype || null,
        identifier.isActive ? "aktivní" : "neaktivní",
        identifier.isPersonalized === true ? "personalizovaný" : identifier.isPersonalized === false ? "nepersonalizovaný" : null,
        identifier.isAvailableForTransportSystem ? "dostupný pro dopravu" : null,
        identifier.isActiveForTransportSystem ? "aktivní v dopravě" : null
      ],
      details: [
        { label: "Identifikátor", value: getIdentifierDisplayName(identifier) },
        { label: "ID", value: identifier.identifierId },
        { label: "Název", value: identifier.name },
        { label: "Typ", value: identifier.type },
        { label: "Podtyp", value: identifier.subtype },
        { label: "Maskovaná hodnota", value: identifier.maskedPan },
        { label: "Expirace", value: identifier.expiry },
        { label: "Aktivní", value: formatBooleanAnswer(identifier.isActive) },
        { label: "Personalizovaný", value: identifier.isPersonalized === null || identifier.isPersonalized === undefined ? null : formatBooleanAnswer(identifier.isPersonalized) },
        { label: "Blokace", value: identifier.blockedStatus },
        { label: "Dostupný pro dopravu", value: formatBooleanAnswer(identifier.isAvailableForTransportSystem) },
        { label: "Aktivní v dopravě", value: formatBooleanAnswer(identifier.isActiveForTransportSystem) },
        { label: "Platný od", value: identifier.validFrom ? formatDate(identifier.validFrom) : null },
        { label: "Platný do", value: identifier.validTo ? formatDate(identifier.validTo) : null }
      ].filter(item => !isEmpty(item.value))
    };
  }, {
    selection: getSelectionDescriptor(step, identifiers)
  });
}

function renderStartIdentifierRegistrationCardHtml(body, step = currentStep()) {
  const steps = Array.isArray(body.steps) ? body.steps : [];
  const completed = body.status === "Completed";
  const kind = getGatewayIdentifierKindLabel(step, body);

  return `
    <div class="app-card-list">
      <article class="app-card">
        <strong>${escapeHtml(completed ? `${kind.shortName} - registrace zahájena` : `Registrace ${kind.genitiveLower}`)}</strong>
        <p>${escapeHtml(completed
          ? `Otevřete tokenizační bránu, dokončete registraci ${kind.genitiveLower} a potom pokračujte kontrolou stavu.`
          : `Registraci ${kind.genitiveLower} se nepodařilo připravit. Zkontrolujte kroky níže.`)}</p>
        <div class="app-card-meta">
          ${renderAppChip(getIdentifierOperationStatusLabel(body.status))}
          ${body.registrationId ? renderAppChip(`Registrace ${body.registrationId}`) : ""}
          ${renderAppChip(steps.length === 1 ? "1 krok" : `${steps.length} kroků`)}
        </div>
        <div class="app-card-details">
          <div class="app-detail-row"><span>Registrační ID</span><span>${escapeHtml(body.registrationId || "-")}</span></div>
          <div class="app-detail-row"><span>Tokenizační brána</span><span>${escapeHtml(body.gatewayRedirectUrl || "-")}</span></div>
          ${steps.map(step => `
            <div class="app-detail-row">
              <span>${escapeHtml(getIdentifierStepLabel(step.name))}</span>
              <span>${escapeHtml(getIdentifierStepDetails(step, body))}</span>
            </div>
          `).join("")}
        </div>
        ${body.gatewayRedirectUrl ? `
          <div class="app-card-actions">
            <a class="app-card-link" href="${escapeHtml(body.gatewayRedirectUrl)}" target="_blank" rel="noopener">Otevřít tokenizační bránu</a>
          </div>` : ""}
      </article>
    </div>
  `;
}

function renderIdentifierRegistrationStateCardHtml(body, step = currentStep()) {
  const tokens = Array.isArray(body.tokens) ? body.tokens : [];
  const steps = Array.isArray(body.steps) ? body.steps : [];
  const completed = isCompletedIdentifierRegistrationState(body);
  const kind = getGatewayIdentifierKindLabel(step, body);

  return `
    <div class="app-card-list">
      <article class="app-card">
        <strong>${escapeHtml(completed ? `${kind.shortName} - tokenizace dokončena` : `${kind.shortName} - stav tokenizace`)}</strong>
        <p>${escapeHtml(completed
          ? `Tokenizační brána vrátila token ${kind.genitiveLower}.`
          : `Registrace ${kind.genitiveLower} zatím není dokončená nebo nevrátila aktivní token.`)}</p>
        <div class="app-card-meta">
          ${renderAppChip(getIdentifierOperationStatusLabel(body.status))}
          ${body.registrationState ? renderAppChip(body.registrationState) : ""}
          ${body.identifierType ? renderAppChip(body.identifierType) : ""}
          ${renderAppChip(tokens.length === 1 ? "1 token" : `${tokens.length} tokenů`)}
        </div>
        <div class="app-card-details">
          <div class="app-detail-row"><span>Stav registrace</span><span>${escapeHtml(body.registrationState || "-")}</span></div>
          <div class="app-detail-row"><span>Typ identifikátoru</span><span>${escapeHtml(body.identifierType || "-")}</span></div>
          <div class="app-detail-row"><span>Režim</span><span>${escapeHtml(body.mode || "-")}</span></div>
          <div class="app-detail-row"><span>Vytvořeno</span><span>${escapeHtml(body.created ? formatDate(body.created) : "-")}</span></div>
        </div>
        ${tokens.length > 0 ? `
          <div class="app-card-details">
            ${tokens.map((token, index) => `
              <div class="app-detail-row">
                <span>${escapeHtml(tokens.length === 1 ? "Token" : `Token ${index + 1}`)}</span>
                <span>${escapeHtml([
                  token.tokenState,
                  token.tokenVersion ? `verze ${token.tokenVersion}` : null,
                  token.tokenValue ? `hodnota ${formatCompactIdentifier(token.tokenValue)}` : null,
                  token.validFrom && token.validTo ? `${token.validFrom} - ${token.validTo}` : null,
                  token.isTestOnly ? "testovací" : null
                ].filter(Boolean).join(" - "))}</span>
              </div>
            `).join("")}
          </div>` : ""}
        ${steps.length > 0 ? `
          <div class="app-card-details">
            ${steps.map(step => `
              <div class="app-detail-row">
                <span>${escapeHtml(getIdentifierStepLabel(step.name))}</span>
                <span>${escapeHtml(getIdentifierStepDetails(step, body))}</span>
              </div>
            `).join("")}
          </div>` : ""}
      </article>
    </div>
  `;
}

function renderCompleteIdentifierRegistrationCardHtml(body, step = currentStep()) {
  const steps = Array.isArray(body.steps) ? body.steps : [];
  const completed = body.status === "Completed";
  const kind = getGatewayIdentifierKindLabel(step, body);

  return `
    <div class="app-card-list">
      <article class="app-card">
        <strong>${escapeHtml(completed ? `${kind.shortName} přiřazena klientovi` : `Kompletace tokenizace ${kind.genitiveLower}`)}</strong>
        <p>${escapeHtml(completed
          ? `Primární token z tokenizační brány byl předán do AssignToken a vznikl klientský identifikátor ${kind.genitiveLower}.`
          : `Kompletace tokenizace ${kind.genitiveLower} se nedokončila. Zkontrolujte kroky níže.`)}</p>
        <div class="app-card-meta">
          ${renderAppChip(getIdentifierOperationStatusLabel(body.status))}
          ${body.identifierId ? renderAppChip(`TokenID ${body.identifierId}`) : ""}
          ${body.registrationState ? renderAppChip(body.registrationState) : ""}
          ${renderAppChip(steps.length === 1 ? "1 krok" : `${steps.length} kroků`)}
        </div>
        <div class="app-card-details">
          <div class="app-detail-row"><span>Výsledek</span><span>${escapeHtml(getIdentifierOperationStatusLabel(body.status))}</span></div>
          <div class="app-detail-row"><span>TokenID</span><span>${escapeHtml(body.identifierId || "-")}</span></div>
          <div class="app-detail-row"><span>Stav registrace</span><span>${escapeHtml(body.registrationState || "-")}</span></div>
          <div class="app-detail-row"><span>Personalizovaný</span><span>${escapeHtml(body.isPersonalized === null || body.isPersonalized === undefined ? "-" : formatBooleanAnswer(body.isPersonalized))}</span></div>
          <div class="app-detail-row"><span>Lze personalizovat</span><span>${escapeHtml(formatBooleanAnswer(body.canBePersonalized))}</span></div>
          ${steps.map(step => `
            <div class="app-detail-row">
              <span>${escapeHtml(getIdentifierStepLabel(step.name))}</span>
              <span>${escapeHtml(getIdentifierStepDetails(step, body))}</span>
            </div>
          `).join("")}
        </div>
      </article>
    </div>
  `;
}

function renderPersonalizeIdentifierCardHtml(body, step = currentStep()) {
  const steps = Array.isArray(body.steps) ? body.steps : [];
  const path = String(step?.request?.path || "").toLowerCase();
  const label = path.includes("/bank-card/")
    ? "Platební karta"
    : "Telefon";

  return `
    <div class="app-card-list">
      <article class="app-card">
        <strong>${escapeHtml(body.isPersonalized ? `${label} personalizován` : `Personalizace - ${label}`)}</strong>
        <p>${escapeHtml(body.isPersonalized
          ? "Identifikátor je v Core MOS označený jako personalizovaný a může sloužit pro scénáře, které vyžadují osobní nosič."
          : "Personalizace se nedokončila. Zkontrolujte kroky níže.")}</p>
        <div class="app-card-meta">
          ${renderAppChip(getIdentifierOperationStatusLabel(body.status))}
          ${body.identifierId ? renderAppChip(`TokenID ${body.identifierId}`) : ""}
          ${renderAppChip(body.isPersonalized ? "personalizovaný" : "nepersonalizovaný")}
          ${renderAppChip(steps.length === 1 ? "1 krok" : `${steps.length} kroků`)}
        </div>
        <div class="app-card-details">
          <div class="app-detail-row"><span>Výsledek</span><span>${escapeHtml(getIdentifierOperationStatusLabel(body.status))}</span></div>
          <div class="app-detail-row"><span>TokenID</span><span>${escapeHtml(body.identifierId || "-")}</span></div>
          <div class="app-detail-row"><span>Personalizovaný</span><span>${escapeHtml(formatBooleanAnswer(body.isPersonalized))}</span></div>
          ${steps.map(step => `
            <div class="app-detail-row">
              <span>${escapeHtml(getIdentifierStepLabel(step.name))}</span>
              <span>${escapeHtml(getIdentifierStepDetails(step, body))}</span>
            </div>
          `).join("")}
        </div>
      </article>
    </div>
  `;
}

function renderTokenizeMobileIdentifierCardHtml(body) {
  const steps = Array.isArray(body.steps) ? body.steps : [];
  const statusLabel = getIdentifierOperationStatusLabel(body.status);
  const completed = body.status === "Completed";

  return `
    <div class="app-card-list">
      <article class="app-card">
        <strong>${escapeHtml(completed ? "Telefon tokenizován" : "Tokenizace telefonu")}</strong>
        <p>${escapeHtml(completed
          ? "MobApp identifikátor byl zaregistrován, AssignToken vrátil TokenID a personalizace byla vypnutá."
          : "Flow tokenizace se nedokončilo úplně. Zkontrolujte, zda prošla identRegistration, co vrátil AssignToken a zda proběhlo SetTokenIsPersonalized(false).")}</p>
        <div class="app-card-meta">
          ${renderAppChip(statusLabel)}
          ${body.identifierId ? renderAppChip(`TokenID ${body.identifierId}`) : ""}
          ${body.isPersonalized === null || body.isPersonalized === undefined ? "" : renderAppChip(body.isPersonalized ? "personalizovaný" : "nepersonalizovaný")}
          ${renderAppChip(body.canBePersonalized ? "lze personalizovat" : "nelze personalizovat")}
          ${renderAppChip(steps.length === 1 ? "1 krok" : `${steps.length} kroků`)}
        </div>
        <div class="app-card-details">
          <div class="app-detail-row"><span>TokenID</span><span>${escapeHtml(body.identifierId || "-")}</span></div>
          <div class="app-detail-row"><span>Personalizovaný</span><span>${escapeHtml(body.isPersonalized === null || body.isPersonalized === undefined ? "-" : formatBooleanAnswer(body.isPersonalized))}</span></div>
          <div class="app-detail-row"><span>Lze personalizovat</span><span>${escapeHtml(formatBooleanAnswer(body.canBePersonalized))}</span></div>
        </div>
        ${steps.length > 0 ? `
          <div class="app-card-details">
            ${steps.map(step => `
              <div class="app-detail-row">
                <span>${escapeHtml(getIdentifierStepLabel(step.name))}</span>
                <span>${escapeHtml(getIdentifierStepDetails(step, body))}</span>
              </div>
            `).join("")}
          </div>` : ""}
      </article>
    </div>
  `;
}

function getIdentifierStepDetails(step, body) {
  return [
    getIdentifierOperationStatusLabel(step.status),
    step.name === "IdentRegistration" && step.status === "Completed" ? "registrace potvrzena" : null,
    step.name === "AssignToken" && body.identifierId ? `TokenID ${body.identifierId}` : null,
    step.message,
    step.resultId !== null && step.resultId !== undefined ? `Result ID ${step.resultId}` : null,
    step.resultType
  ].filter(Boolean).join(" - ");
}

function formatCompactIdentifier(value) {
  const text = String(value || "");

  if (text.length <= 18) {
    return text;
  }

  return `${text.slice(0, 8)}...${text.slice(-6)}`;
}

function getGatewayIdentifierKindLabel(step = currentStep(), body = null) {
  const path = String(step?.request?.path || "").toLowerCase();
  const identifierType = String(body?.identifierType || "").toLowerCase();

  if (path.includes("/inkarta/") || identifierType === "inkarta") {
    return {
      shortName: "InKarta",
      genitiveLower: "InKarty",
      expectedIdentifierType: "InKarta"
    };
  }

  if (path.includes("/opus-card/") || identifierType === "opuscard" || identifierType === "opus-card") {
    return {
      shortName: "OpusCard",
      genitiveLower: "OpusCard",
      expectedIdentifierType: "OpusCard"
    };
  }

  if (path.includes("/litacka/") || identifierType === "litacka" || identifierType === "lítačka") {
    return {
      shortName: "Lítačka",
      genitiveLower: "Lítačky",
      expectedIdentifierType: "Litacka"
    };
  }

  return {
    shortName: "Platební karta",
    genitiveLower: "platební karty",
    expectedIdentifierType: "BPK"
  };
}

function getIdentifierOperationStatusLabel(value) {
  switch (value) {
    case "Completed":
      return "Dokončeno";
    case "PartiallyCompleted":
      return "Částečně dokončeno";
    case "Failed":
      return "Selhalo";
    case "Skipped":
      return "Přeskočeno";
    default:
      return value || "Neznámý stav";
  }
}

function getIdentifierStepLabel(value) {
  switch (value) {
    case "CustomerResolution":
      return "Ověření klienta";
    case "IdentRegistration":
      return "identRegistration";
    case "AssignToken":
      return "AssignToken (vrací TokenID)";
    case "SetTokenIsPersonalized":
      return "SetTokenIsPersonalized";
    case "IdentifierResolution":
      return "Načtení identifikátoru";
    case "InitiateTokenRegistration":
      return "Zahájení tokenizace";
    case "GetTokenRegistrationState":
      return "Načtení stavu tokenizace";
    case "PrimaryTokenSelection":
      return "Výběr primárního tokenu";
    default:
      return value || "Krok";
  }
}

function getClientStatusTitle(body) {
  if (body.isUserActive === false) {
    return "Uživatel není aktivní";
  }

  if (!body.exists) {
    return "Klient zatím není založen";
  }

  if (!body.hasPersonalData) {
    return "Klient čeká na osobní údaje";
  }

  return "Klientská data jsou připravena";
}

function getClientStatusText(body) {
  if (body.isUserActive === false) {
    return "Neaktivní uživatel nemůže pokračovat v založení klienta ani ukládání osobních údajů.";
  }

  if (!body.exists) {
    return "Pro přihlášeného uživatele nebyl v Core MOS nalezen klientský profil.";
  }

  if (!body.hasPersonalData) {
    return "Profil existuje, ale backend nevrátil uložené osobní údaje.";
  }

  return "Backend vrátil osobní údaje přihlášeného klienta.";
}

function getClientStatusLabel(value) {
  if (value === "InactiveUser") {
    return "Uživatel neaktivní";
  }

  if (value === "Missing") {
    return "Chybí";
  }

  if (value === "PendingPersonalData") {
    return "Čeká na údaje";
  }

  if (value === "Completed") {
    return "Dokončeno";
  }

  return value || "Neznámý stav";
}

function formatBooleanAnswer(value) {
  if (value === true) {
    return "ano";
  }

  if (value === false) {
    return "ne";
  }

  return "-";
}

function formatMosPaymentStatus(value) {
  if (value === 0) {
    return "Ordered";
  }

  if (value === 1) {
    return "Authorized";
  }

  if (value === 2) {
    return "Paid";
  }

  if (value === 3) {
    return "Cancelled";
  }

  return value !== undefined && value !== null ? String(value) : "";
}

function renderEmptyAppCardHtml(title, text) {
  return `
    <div class="app-card-list">
      <article class="app-card">
        <strong>${escapeHtml(title)}</strong>
        <p>${escapeHtml(text)}</p>
      </article>
    </div>
  `;
}

function buildCardListHtml(items, mapItem, options = {}) {
  const selection = options.selection || null;

  return `<div class="app-card-list">${items.map((item, index) => {
    const card = mapItem(item);
    const chips = (card.chips || []).filter(Boolean);
    const isSelected = selection && selection.selectedIndex === index;

    return `
      <article class="app-card ${isSelected ? "app-card-selected" : ""}">
        <strong>${escapeHtml(card.title)}</strong>
        <p>${escapeHtml(card.text || "")}</p>
        ${chips.length > 0 ? `<div class="app-card-meta">${chips.map(renderAppChip).join("")}</div>` : ""}
        ${Array.isArray(card.details) && card.details.length > 0 ? `
          <div class="app-card-details">
            ${card.details.map(row => `
              <div class="app-detail-row"><span>${escapeHtml(row.label)}</span><span>${escapeHtml(row.value)}</span></div>
            `).join("")}
          </div>` : ""}
        ${card.extraHtml || ""}
        ${selection ? `
          <div class="app-card-actions">
            <button type="button" class="app-card-select" data-selection-index="${index}">
              ${escapeHtml(isSelected ? (selection.selectedButtonLabel || "Vybráno") : (selection.buttonLabel || "Vybrat"))}
            </button>
          </div>` : ""}
      </article>
    `;
  }).join("")}</div>`;
}

function getSelectionDescriptor(step, collection) {
  if (!step?.selection || !state.activeSelection || state.activeSelection.stepId !== step.id) {
    return null;
  }

  if (!isSelectionCollectionCompatible(state.activeSelection.items, collection)) {
    return null;
  }

  return {
    buttonLabel: step.selection.buttonLabel,
    selectedButtonLabel: step.selection.selectedButtonLabel,
    selectedIndex: state.activeSelection.selectedIndex
  };
}

function isSelectionCollectionCompatible(activeItems, renderedItems) {
  if (activeItems === renderedItems) {
    return true;
  }

  if (!Array.isArray(activeItems) || !Array.isArray(renderedItems) || activeItems.length !== renderedItems.length) {
    return false;
  }

  return activeItems.every((item, index) => item === renderedItems[index]);
}

function prepareSelection(step, body, status) {
  state.activeSelection = null;

  if (!step?.selection || status >= 400) {
    return;
  }

  const items = getSelectionItems(step, body);

  if (!Array.isArray(items) || items.length === 0) {
    return;
  }

  state.activeSelection = {
    stepId: step.id,
    config: step.selection,
    items,
    selectedIndex: null
  };
}

function getSelectionItems(step, body) {
  if (step.selection.sourceRegex) {
    return parseRegexSelectionItems(body, step.selection.sourceRegex);
  }

  const sourcePath = step.selection.sourcePath || "$";
  return getPath(body, sourcePath);
}

function parseRegexSelectionItems(body, sourceRegex) {
  const rawSource = typeof body === "string" ? body : JSON.stringify(body ?? "");
  const source = normalizeXmlPrefixes(rawSource);

  if (sourceRegex.parser === "mosTariffZones") {
    return parseMosTariffZoneSelectionItems(source);
  }

  const itemPattern = sourceRegex.itemPattern;

  if (!itemPattern) {
    return [];
  }

  const itemRegex = new RegExp(itemPattern, "gis");
  const fields = sourceRegex.fields || {};
  const items = [];
  let match;

  while ((match = itemRegex.exec(source)) !== null) {
    const itemSource = match[1] || match[0];
    const item = {};

    for (const [name, pattern] of Object.entries(fields)) {
      const fieldMatch = itemSource.match(new RegExp(pattern, "is"));
      item[name] = fieldMatch?.[1] ?? "";
    }

    items.push(item);
  }

  return items;
}

function parseMosTariffZoneSelectionItems(source) {
  const items = [];
  const tariffRegex = /<TariffBuy[^>]*>([\s\S]*?)<\/TariffBuy>/gi;
  let tariffMatch;

  while ((tariffMatch = tariffRegex.exec(source)) !== null) {
    const tariffSource = tariffMatch[1] || "";
    const tariff = {
      tariffId: getXmlElementText(tariffSource, "TariffID"),
      customerId: getXmlElementText(tariffSource, "CustomerID"),
      tariffName: getXmlElementText(tariffSource, "TariffName"),
      tariffProfileName: getXmlElementText(tariffSource, "TariffProfileName"),
      customerProfileName: getXmlElementText(tariffSource, "CustomerProfileName"),
      customerProfileId2: getXmlElementText(tariffSource, "CustomerProfileID2"),
      splitDate: getXmlElementText(tariffSource, "SplitDate"),
      validFrom: getXmlElementText(tariffSource, "NewCouponValidFrom"),
      validTill: getXmlElementText(tariffSource, "NewCouponValidTill")
    };

    const zoneRegex = /<Zone[^>]*>([\s\S]*?)<\/Zone>/gi;
    let zoneMatch;

    while ((zoneMatch = zoneRegex.exec(tariffSource)) !== null) {
      const zoneSource = zoneMatch[1] || "";
      const zoneName = getXmlElementText(zoneSource, "ZoneName");
      const displayPrice = getXmlElementText(zoneSource, "Price");
      const price = zoneName === "P" ? "0.0000" : displayPrice;

      items.push({
        ...tariff,
        name: `${tariff.tariffName || "Tarif"} - zóna ${zoneName || "?"}`,
        tariffZoneId: getXmlElementText(zoneSource, "TariffZoneID"),
        zoneName,
        displayPrice,
        price
      });
    }
  }

  return items;
}

function getXmlElementText(source, elementName) {
  const match = String(source || "").match(new RegExp(`<${elementName}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${elementName}>`, "i"));
  return match?.[1] ?? "";
}

function escapeXml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function getXmlOperationResultId(source, resultElementName) {
  const resultSource = getXmlElementSource(source, resultElementName);
  return getXmlElementText(resultSource, "ID");
}

function getXmlOperationResultText(source, resultElementName) {
  const resultSource = getXmlElementSource(source, resultElementName);
  const resultBlock = getXmlElementSource(resultSource, "Result");
  return getXmlElementText(resultBlock, "Text");
}

function getXmlElementSource(source, elementName) {
  const match = String(source || "").match(new RegExp(`<${elementName}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${elementName}>`, "i"));
  return match?.[1] ?? "";
}

function parseMosTokenItems(source) {
  const normalized = normalizeXmlPrefixes(source);
  const tokenRegex = /<TokenEx[^>]*>([\s\S]*?)<\/TokenEx>/gi;
  const items = [];
  let match;

  while ((match = tokenRegex.exec(normalized)) !== null) {
    const tokenSource = match[1] || "";
    items.push({
      tokenId: getXmlElementText(tokenSource, "TokenID"),
      name: getXmlElementText(tokenSource, "Name"),
      token: getXmlElementText(tokenSource, "Token"),
      customerId: getXmlElementText(tokenSource, "CustomerIDx"),
      identifierType: getXmlElementText(tokenSource, "IdentifierType"),
      identifierSubtype: getXmlElementText(tokenSource, "IdentifierSubtype"),
      maskedPan: getXmlElementText(tokenSource, "MaskedPAN"),
      cln: getXmlElementText(tokenSource, "CLN"),
      active: getXmlElementText(tokenSource, "Active"),
      isPersonalized: getXmlElementText(tokenSource, "IsPersonalized"),
      validTo: getXmlElementText(tokenSource, "ValidTo"),
      blockedStatus: getXmlElementText(tokenSource, "TokenBlockedStatus")
    });
  }

  return items;
}

function parseMosCouponItems(source) {
  const normalized = normalizeXmlPrefixes(source);
  const couponRegex = /<CouponInfoRecord[^>]*>([\s\S]*?)<\/CouponInfoRecord>/gi;
  const items = [];
  let match;

  while ((match = couponRegex.exec(normalized)) !== null) {
    const couponSource = match[1] || "";
    items.push({
      couponId: getXmlElementText(couponSource, "CouponID"),
      customerId: getXmlElementText(couponSource, "CustomerID"),
      status: getXmlElementText(couponSource, "Status"),
      customStatusName: getXmlElementText(couponSource, "CustomStatusName"),
      tariffId: getXmlElementText(couponSource, "TariffID"),
      tariffName: getXmlElementText(couponSource, "TariffName"),
      name: getXmlElementText(couponSource, "Name"),
      dateTimeFrom: getXmlElementText(couponSource, "DateTimeFrom"),
      dateTimeTo: getXmlElementText(couponSource, "DateTimeTo"),
      zones: getXmlElementText(couponSource, "Zones"),
      price: getXmlElementText(couponSource, "Price"),
      orderId: getXmlElementText(couponSource, "OrderID"),
      tokenId: getXmlElementText(couponSource, "TokenID"),
      tokenName: getXmlElementText(couponSource, "TokenName")
    });
  }

  return items;
}

function normalizeXmlPrefixes(source) {
  return String(source || "")
    .replace(/(<\/?)([A-Za-z_][\w.-]*):/g, "$1");
}

function renderSelectionItemsCardsHtml(step, fallbackItems = null) {
  const items = fallbackItems || state.activeSelection?.items || [];
  const selection = getSelectionDescriptor(step, items);

  return buildCardListHtml(items, item => ({
    title: getSelectionItemTitle(item),
    text: getSelectionItemText(item),
    chips: [
      item.identifierType || item.type || null,
      item.customerProfileName || null,
      item.tariffName || null,
      item.maskedPan || item.cln || null,
      item.isPersonalized === "true" ? "personalizovaný" : item.isPersonalized === "false" ? "nepersonalizovaný" : null,
      item.isDefault === "true" ? "výchozí profil" : null,
      item.zoneName ? `zóna ${item.zoneName}` : null,
      item.zones ? `zóny ${item.zones}` : null,
      item.customerProfileId2 ? "lomený tarif" : item.tariffZoneId ? "normální tarif" : null,
      item.price ? `${item.price} Kč` : null,
      item.displayPrice ? `tarif ${item.displayPrice} Kč` : null,
      item.active === "true" ? "aktivní" : item.active === "false" ? "neaktivní" : null
    ],
    details: [
      { label: "CouponID", value: item.couponId },
      { label: "TokenID", value: item.tokenId },
      { label: "CustomerID", value: item.customerId },
      { label: "CustomerProfileID", value: item.customerProfileId },
      { label: "OrderID", value: item.orderId },
      { label: "Název", value: item.name },
      { label: "Tarif", value: item.tariffName || item.tariffId },
      { label: "Profil tarifu", value: item.tariffProfileName },
      { label: "Profil zákazníka", value: item.customerProfileName },
      { label: "CustomerProfileID2", value: item.customerProfileId2 },
      { label: "SplitDate", value: item.splitDate ? formatDate(item.splitDate) : null },
      { label: "Zóna", value: item.zoneName },
      { label: "Zóny", value: item.zones },
      { label: "Platnost od", value: item.dateTimeFrom || item.validFrom ? formatDate(item.dateTimeFrom || item.validFrom) : null },
      { label: "Platnost do", value: item.dateTimeTo || item.validTill ? formatDate(item.dateTimeTo || item.validTill) : null },
      { label: "Cena", value: item.price ? `${item.price} Kč` : null },
      { label: "Cena v tarifu", value: item.displayPrice ? `${item.displayPrice} Kč` : null },
      { label: "Stav", value: item.customStatusName || item.status },
      { label: "Typ", value: item.identifierType },
      { label: "CompanyID", value: item.companyId },
      { label: "Aktivní profil", value: item.active === "true" ? "ano" : item.active === "false" ? "ne" : null },
      { label: "Výchozí profil", value: item.isDefault === "true" ? "ano" : item.isDefault === "false" ? "ne" : null },
      { label: "Maskovaná hodnota", value: item.maskedPan },
      { label: "CLN", value: item.cln },
      { label: "Personalizovaný", value: item.isPersonalized === "true" ? "ano" : item.isPersonalized === "false" ? "ne" : null }
    ]
  }), { selection });
}

function getSelectionItemTitle(item) {
  return item.name
    || item.customerProfileName
    || item.tariffName
    || item.maskedPan
    || item.cln
    || (item.couponId ? `Kupón ${item.couponId}` : null)
    || (item.tokenId ? `Token ${item.tokenId}` : "Položka");
}

function getSelectionItemText(item) {
  if (item.couponId) {
    return [
      item.dateTimeFrom && item.dateTimeTo ? `${formatDate(item.dateTimeFrom)} - ${formatDate(item.dateTimeTo)}` : null,
      item.zones ? `zóny ${item.zones}` : null
    ].filter(Boolean).join(", ") || "Kupón";
  }

  if (item.identifierType) {
    return `Identifikátor ${item.identifierType}`;
  }

  if (item.customerProfileId) {
    return [
      `CustomerProfileID ${item.customerProfileId}`,
      item.companyId ? `CompanyID ${item.companyId}` : null
    ].filter(Boolean).join(", ");
  }

  if (item.customerId) {
    return [
      `Zákazník ${item.customerId}`,
      item.customerProfileId2 ? `lomený tarif: CustomerProfileID2 ${item.customerProfileId2}` : null,
      item.splitDate ? `SplitDate ${formatDate(item.splitDate)}` : null
    ].filter(Boolean).join(", ");
  }

  return "Vybratelná položka";
}

function bindResultCardActions() {
  elements.resultCard.querySelectorAll("[data-selection-index]").forEach(button => {
    button.addEventListener("click", () => {
      applySelection(Number(button.dataset.selectionIndex));
    });
  });
}

function applySelection(index) {
  if (!state.activeSelection) {
    return;
  }

  const item = state.activeSelection.items[index];

  if (!item) {
    return;
  }

  state.activeSelection.selectedIndex = index;

  for (const [key, selector] of Object.entries(state.activeSelection.config.store || {})) {
    state.context[key] = resolveSelectionStoreValue(item, selector);
  }

  addLog("ok", "Položka vybrána", {
    stepId: state.activeSelection.stepId,
    selectedIndex: index,
    storedContext: state.activeSelection.config.store || {}
  });

  renderContext();
  renderModeBanner();
  updateNextStepControl();

  if (state.displayedResult) {
    showResult(
      state.displayedResult.level,
      state.displayedResult.message,
      state.displayedResult.body,
      state.displayedResult.step);
  }

  if (state.workflowRun?.status === "paused") {
    showWorkflowPauseNoticeInCurrentResult("ok", "Výběr byl uložen.", [
      "Klikněte na Pokračovat ve workflow."
    ]);
  }
}

function resolveSelectionStoreValue(item, selector) {
  if (selector && typeof selector === "object") {
    if (Object.hasOwn(selector, "literal")) {
      return selector.literal;
    }

    if (Object.hasOwn(selector, "path")) {
      return getPath(item, selector.path);
    }

    if (Object.hasOwn(selector, "identifierPersonalizationResource")) {
      return getIdentifierPersonalizationResource(item);
    }
  }

  return selector === "$" ? item : getPath(item, selector);
}

function getIdentifierPersonalizationResource(identifier) {
  const text = [
    identifier?.type,
    identifier?.identifierType,
    identifier?.subtype,
    identifier?.name
  ].filter(Boolean).join(" ").toLowerCase();

  if (text.includes("mobapp") || text.includes("mobile") || text.includes("telefon")) {
    return "mobile";
  }

  if (text.includes("bpk") || text.includes("bank") || text.includes("payment") || text.includes("plateb")) {
    return "bank-card";
  }

  return "";
}

function renderAppChip(chip) {
  if (chip && typeof chip === "object" && chip.type === "color") {
    return `
      <span class="app-chip app-chip-color" title="${escapeHtml(chip.label || chip.value || "Barva")}">
        <span class="app-chip-color-swatch" style="background:${escapeHtml(chip.value || "#cccccc")}"></span>
        ${chip.label ? `<span>${escapeHtml(chip.label)}</span>` : ""}
      </span>
    `;
  }

  if (chip && typeof chip === "object" && chip.type === "map") {
    const latitude = Number(chip.latitude);
    const longitude = Number(chip.longitude);
    const href = Number.isFinite(latitude) && Number.isFinite(longitude)
      ? `https://www.openstreetmap.org/?mlat=${latitude}&mlon=${longitude}#map=18/${latitude}/${longitude}`
      : "#";

    return `
      <a class="app-chip app-link-chip" href="${escapeHtml(href)}" target="_blank" rel="noopener">
        ${escapeHtml(chip.label || "Mapa")}
      </a>
    `;
  }

  return `<span class="app-chip">${escapeHtml(String(chip))}</span>`;
}

function getLocalizedTitle(title) {
  if (!title) {
    return "";
  }

  return title.cs || title.en || title.value || "";
}

function formatDate(value) {
  if (!value) {
    return "nyní";
  }

  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleString("cs-CZ", { dateStyle: "medium", timeStyle: "short" });
}

function shortId(value) {
  return String(value || "").slice(0, 8);
}

function summarizeBody(body) {
  if (Array.isArray(body)) {
    if (isVehicleArray(body)) {
      return [];
    }

    if (isFavoriteZoneArray(body)) {
      return [];
    }

    if (isParkingSuggestArray(body)) {
      return [];
    }

    return [
      {
        label: isVehicleArray(body) ? "Vozidel" : isZoneArray(body) ? "Zón" : "Položek",
        value: String(body.length)
      }
    ];
  }

  if (!body || typeof body !== "object") {
    return [];
  }

  if (isParkingSessionsResponse(body)) {
    return [];
  }

  if (isParkingSuggestResultsResponse(body)) {
    return [];
  }

  if (isParkingPriceMultiResponse(body)) {
    return [];
  }

  if (isClientDataResponse(body) || isClientDataStep(currentStep())) {
    return [];
  }

  if (isClientStatusResponse(body)) {
    return [];
  }

  if (isSaveClientDataResponse(body)) {
    return [];
  }

  if (isSaveClientPhotoResponse(body)) {
    return [];
  }

  if (isClientIdentifiersResponse(body)) {
    return [];
  }

  if (isTokenizeMobileIdentifierResponse(body)) {
    return [];
  }

  if (body.ticketSuccessfullyCreated && body.ticket) {
    return [];
  }

  if (isSavedCardPaymentResponse(body)) {
    return [];
  }

  if (isMosParkingOrderResponse(body) || isMosSavedCardPaymentResponse(body) || isMosTicketInfoResponse(body) || isMosTokenCouponsOverviewResponse(body)) {
    return [];
  }

  if (isFavoriteZoneResponse(body) || isDeleteFavoriteZoneResponse(body) || isDeletePaymentCardResponse(body)) {
    return [];
  }

  const rows = [];

  addSummary(rows, "Stav", body.status || body.state);
  addSummary(rows, "Existuje", typeof body.exists === "boolean" ? (body.exists ? "ano" : "ne") : null);
  addSummary(rows, "Aktivní", typeof body.isActive === "boolean" ? (body.isActive ? "ano" : "ne") : null);
  addSummary(rows, "Modul", body.moduleName);
  addSummary(rows, "Uživatel", body.userName);
  addSummary(rows, "Login ID", body.loginId);
  addSummary(rows, "Výsledek", body.finalStatus);
  addSummary(rows, "Aktivováno", typeof body.activateLoginCalled === "boolean" ? (body.activateLoginCalled ? "ano" : "ne") : null);
  addSummary(rows, "Platnost do", body.expiresAtUtc ? formatDate(body.expiresAtUtc) : null);
  addSummary(rows, "E-mail odeslán", typeof body.sent === "boolean" ? (body.sent ? "ano" : "ne") : null);
  addSummary(rows, "Heslo změněno", typeof body.passwordChanged === "boolean" ? (body.passwordChanged ? "ano" : "ne") : null);
  addSummary(rows, "Booking", body.bookingId);
  addSummary(rows, "Platba", body.paymentId || body.paymentAttemptId);
  addSummary(rows, "Platebn\u00ed flow", getPaymentFlowLabel(body, false));
  addSummary(rows, "Produkt", body.productId);
  addSummary(rows, "\u010dek\u00e1", body.pendingCount);
  addSummary(rows, "Content-Type", body.contentType);
  addSummary(rows, "Velikost", body.size ? `${body.size} B` : null);
  addSummary(rows, "Cena", body.price ? `${body.price.amount} ${body.price.currency}` : null);
  addSummary(rows, "Repository", body.products?.repositoryProvider);
  addSummary(rows, "DB provider", body.database?.providerName);
  addSummary(rows, "Polo\u017eek", Array.isArray(body.items) ? body.items.length : null);
  addSummary(rows, "Výsledků", Array.isArray(body.results) ? body.results.length : null);
  addSummary(rows, "Nab\u00eddek", Array.isArray(body.offers) ? body.offers.length : null);
  addSummary(rows, "Fulfillment", Array.isArray(body.fulfillments) ? body.fulfillments.length : null);

  if (rows.length === 0) {
    for (const [key, value] of Object.entries(body).slice(0, 4)) {
      addSummary(rows, key, value);
    }
  }

  return rows;
}

function addSummary(rows, label, value) {
  if (value === undefined || value === null || value === "") {
    return;
  }

  if (Array.isArray(value)) {
    rows.push({ label, value: `${value.length}` });
    return;
  }

  if (typeof value === "object") {
    addNestedSummary(rows, label, value);
    return;
  }

  rows.push({ label, value: formatSummaryValue(value) });
}

function addNestedSummary(rows, label, value, depth = 0) {
  if (!value || typeof value !== "object" || rows.length >= 12) {
    return;
  }

  if (Array.isArray(value)) {
    rows.push({ label, value: `${value.length}` });
    return;
  }

  for (const [key, childValue] of Object.entries(value)) {
    if (rows.length >= 12) {
      return;
    }

    if (childValue === undefined || childValue === null || childValue === "") {
      continue;
    }

    const childLabel = `${label} / ${formatSummaryLabel(key)}`;

    if (Array.isArray(childValue)) {
      rows.push({ label: childLabel, value: `${childValue.length}` });
      continue;
    }

    if (typeof childValue === "object") {
      if (depth < 2) {
        addNestedSummary(rows, childLabel, childValue, depth + 1);
      }
      continue;
    }

    rows.push({ label: childLabel, value: formatSummaryValue(childValue) });
  }
}

function formatSummaryLabel(value) {
  return String(value)
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .trim();
}

function formatSummaryValue(value) {
  if (Array.isArray(value)) {
    return `${value.length}`;
  }

  if (typeof value === "object") {
    return "";
  }

  if (typeof value === "boolean") {
    return value ? "ano" : "ne";
  }

  return String(value);
}

function getPaymentFlowLabel(payment, fallbackToDefault = true) {
  if (!payment || typeof payment !== "object") {
    return fallbackToDefault ? "Standardni karta" : null;
  }

  if (typeof payment.method === "string") {
    if (payment.method === "card_lvp") {
      return "Karta LVP";
    }

    if (payment.method === "card") {
      return typeof payment.paymentUrl === "string" && payment.paymentUrl.includes("/token/")
        ? "Ulo\u017een\u00e1 karta"
        : "Standardni karta";
    }
  }

  const paymentUrl = typeof payment.paymentUrl === "string"
    ? payment.paymentUrl
    : payment.paymentUrl?.absoluteUri || payment.paymentUrl?.href || "";

  if (paymentUrl.includes("/token/")) {
    return "Ulo\u017een\u00e1 karta";
  }

  if (paymentUrl.includes("/lvp/")) {
    return "Karta LVP";
  }

  if (paymentUrl.includes("/redirect/")) {
    return "Standardni karta";
  }

  return fallbackToDefault ? "Standardni karta" : null;
}

function isZoneArray(value) {
  return Array.isArray(value)
    && value.length > 0
    && value.every(item => item && typeof item === "object" && "id" in item);
}

function isFavoriteZoneArray(value) {
  return Array.isArray(value)
    && value.length > 0
    && value.every(item =>
      item
      && typeof item === "object"
      && "zoneId" in item
      && "createdAt" in item
      && "status" in item);
}

function isParkingSuggestArray(value) {
  return Array.isArray(value)
    && value.length > 0
    && value.every(item =>
      item
      && typeof item === "object"
      && "name" in item
      && "latitude" in item
      && "longitude" in item);
}

function isVehicleArray(value) {
  return Array.isArray(value)
    && value.length > 0
    && value.every(item =>
      item
      && typeof item === "object"
      && "licensePlate" in item
      && "name" in item
      && "color" in item);
}

function isPaymentCardArray(value) {
  return Array.isArray(value)
    && value.length > 0
    && value.every(isPaymentCardResponse);
}

function isPaymentCardResponse(value) {
  return Boolean(value && typeof value === "object" && ("cardId" in value || "maskedPan" in value || "maskedNumber" in value));
}

function getPaymentCardMaskedNumber(card) {
  return card?.maskedPan || card?.maskedNumber || null;
}

function getPaymentCardExpiration(card) {
  if (!card) {
    return null;
  }

  if (card.expiration) {
    return card.expiration;
  }

  if (card.expirationMonth && card.expirationYear) {
    return `${String(card.expirationMonth).padStart(2, "0")}/${card.expirationYear}`;
  }

  return null;
}

function isPaymentCardsStep(step) {
  const path = step?.request?.path || "";
  return path.includes("/payment-cards") || path.includes("/parking/cards");
}

function isSavedCardPaymentResponse(value) {
  return value
    && typeof value === "object"
    && !Array.isArray(value)
    && value.parkingTicket
    && typeof value.parkingTicket === "object";
}

function isMosParkingOrderResponse(value) {
  return value
    && typeof value === "object"
    && !Array.isArray(value)
    && "success" in value
    && value.ticket
    && typeof value.ticket === "object"
    && "ticketGUID" in value.ticket;
}

function isMosSavedCardPaymentResponse(value) {
  return value
    && typeof value === "object"
    && !Array.isArray(value)
    && "paymentSuccessful" in value
    && "paymentInProgress" in value
    && value.ticket
    && typeof value.ticket === "object"
    && "ticketGUID" in value.ticket;
}

function isMosTicketInfoResponse(value) {
  return value
    && typeof value === "object"
    && !Array.isArray(value)
    && "ticketGUID" in value
    && "paymentStatus" in value
    && ("parkingFrom" in value || "dateCreated" in value);
}

function isMosTokenCouponsOverviewResponse(value) {
  return value
    && typeof value === "object"
    && !Array.isArray(value)
    && value.kind === "mosTokenCouponsOverview"
    && Array.isArray(value.tokens);
}

function isCouponMoveTargetOverviewResponse(value) {
  return value
    && typeof value === "object"
    && !Array.isArray(value)
    && value.kind === "couponMoveTargetOverview"
    && Array.isArray(value.identifiers);
}

function isCouponMovePreviewResponse(value) {
  return value
    && typeof value === "object"
    && !Array.isArray(value)
    && value.targetIdentifier
    && Array.isArray(value.sources)
    && Array.isArray(value.warnings)
    && "couponCount" in value;
}

function isMoveCouponsResponse(value) {
  return value
    && typeof value === "object"
    && !Array.isArray(value)
    && "targetIdentifierId" in value
    && Array.isArray(value.moved)
    && Array.isArray(value.failed)
    && Array.isArray(value.steps);
}

function isSavedVehiclesStep(step) {
  return Boolean(step?.request?.path?.includes("/my-vehicles"));
}

function isDocumentArray(value) {
  return Array.isArray(value)
    && value.length > 0
    && value.every(item => item && typeof item === "object" && "documentId" in item && "mediaType" in item);
}

function isParkingSessionsResponse(value) {
  return value
    && typeof value === "object"
    && Array.isArray(value.sessions);
}

function isParkingSuggestResultsResponse(value) {
  return value
    && typeof value === "object"
    && Array.isArray(value.results)
    && value.results.length > 0
    && isParkingSuggestArray(value.results);
}

function isParkingPriceMultiResponse(value) {
  return value
    && typeof value === "object"
    && ((typeof value.calculationSuccessful === "boolean" && Array.isArray(value.calculations))
      || (typeof value.success === "boolean" && Array.isArray(value.priceCalculations)))
    && getParkingPriceCalculations(value).length > 0;
}

function isClientStatusResponse(value) {
  return value
    && typeof value === "object"
    && typeof value.exists === "boolean"
    && typeof value.isUserActive === "boolean"
    && typeof value.hasPersonalData === "boolean"
    && typeof value.status === "string"
    && ("personalData" in value)
    && ("photo" in value);
}

function isClientDataResponse(value) {
  return isClientStatusResponse(value)
    && ("photoData" in value);
}

function isClientIdentifiersResponse(value) {
  return value
    && typeof value === "object"
    && Array.isArray(value.identifiers);
}

function isTokenizeMobileIdentifierResponse(value) {
  return value
    && typeof value === "object"
    && typeof value.status === "string"
    && Array.isArray(value.steps)
    && ("identifierId" in value)
    && ("canBePersonalized" in value)
    && !("registrationState" in value);
}

function isPersonalizeIdentifierResponse(value) {
  return value
    && typeof value === "object"
    && typeof value.status === "string"
    && Array.isArray(value.steps)
    && ("identifierId" in value)
    && typeof value.isPersonalized === "boolean"
    && !("canBePersonalized" in value)
    && !("registrationState" in value);
}

function isCompleteIdentifierRegistrationResponse(value) {
  return value
    && typeof value === "object"
    && typeof value.status === "string"
    && Array.isArray(value.steps)
    && ("identifierId" in value)
    && ("registrationState" in value);
}

function isStartIdentifierRegistrationResponse(value) {
  return value
    && typeof value === "object"
    && typeof value.status === "string"
    && Array.isArray(value.steps)
    && ("registrationId" in value)
    && ("gatewayRedirectUrl" in value);
}

function isIdentifierRegistrationStateResponse(value) {
  return value
    && typeof value === "object"
    && typeof value.status === "string"
    && Array.isArray(value.steps)
    && Array.isArray(value.tokens)
    && ("registrationState" in value);
}

function isCompletedIdentifierRegistrationState(value) {
  const tokens = Array.isArray(value?.tokens) ? value.tokens : [];

  return value?.status === "Completed"
    && !isEmpty(value?.identifierType)
    && tokens.some(token => !isEmpty(token?.tokenValue));
}

function isClientDataStep(step) {
  return step?.request?.method === "GET"
    && String(step.request.path || "").includes("/v1/client/data");
}

function isSaveClientDataResponse(value) {
  return value
    && typeof value === "object"
    && typeof value.status === "string"
    && typeof value.created === "boolean"
    && typeof value.personalDataConsentApplied === "boolean"
    && value.client
    && typeof value.client === "object"
    && typeof value.client.exists === "boolean"
    && typeof value.client.isUserActive === "boolean"
    && typeof value.client.hasPersonalData === "boolean";
}

function isSaveClientPhotoResponse(value) {
  return value
    && typeof value === "object"
    && typeof value.status === "string"
    && Array.isArray(value.steps)
    && value.client
    && typeof value.client === "object"
    && typeof value.client.exists === "boolean"
    && typeof value.client.isUserActive === "boolean"
    && typeof value.client.hasPersonalData === "boolean"
    && !("created" in value)
    && !("personalDataConsentApplied" in value);
}

function getParkingPriceSuccessful(value) {
  if (typeof value?.calculationSuccessful === "boolean") {
    return value.calculationSuccessful;
  }

  if (typeof value?.success === "boolean") {
    return value.success;
  }

  return false;
}

function getParkingPriceCalculations(value) {
  if (Array.isArray(value?.calculations)) {
    return value.calculations.map(item => ({
      totalPrice: item.totalPrice,
      acceptedMinutes: item.acceptedMinutes,
      acceptedMinutesDuringParkingHours: item.acceptedMinutesDuringParkingHours,
      acceptedMinutesFormatted: item.acceptedMinutesFormatted,
      parkingTo: item.parkingTo,
      appliedDiscount: item.appliedDiscount,
      originalPrice: item.originalPrice
    }));
  }

  if (Array.isArray(value?.priceCalculations)) {
    return value.priceCalculations.map(item => ({
      totalPrice: item.priceTotal,
      acceptedMinutes: item.minutesAccepted,
      acceptedMinutesDuringParkingHours: item.minutesAcceptedDuringParkingHours,
      acceptedMinutesFormatted: item.minutesAcceptedHumanized,
      parkingTo: item.endOfParking,
      appliedDiscount: item.discountAmount,
      originalPrice: item.originalPriceTotal
    }));
  }

  return [];
}

function isFavoriteZoneResponse(value) {
  return value
    && typeof value === "object"
    && "zoneId" in value
    && "createdAt" in value
    && "status" in value
    && "id" in value;
}

function isDeleteFavoriteZoneResponse(value) {
  return value
    && typeof value === "object"
    && "deletedAt" in value
    && "undoPossible" in value
    && "undoExpiresInMinutes" in value
    && "status" in value
    && "id" in value;
}

function isDeletePaymentCardResponse(value, step = currentStep()) {
  const requestPath = step?.request?.path || "";
  return value
    && typeof value === "object"
    && "deletedAt" in value
    && "undoPossible" in value
    && "undoExpiresInMinutes" in value
    && "status" in value
    && "id" in value
    && (step?.id === "parking-card-delete-step" || requestPath.includes("/parking/cards/"));
}

function renderParkingSessionsCardsHtml(sessions, lookbackWindowInMinutes, options = {}) {
  const selection = options.selection || null;

  return `<div class="app-card-list">${sessions.map((session, index) => {
    const childSessions = Array.isArray(session.childSessions) ? session.childSessions : [];
    const vehicle = session.vehicle || {};
    const location = session.location || {};
    const isSelected = selection && selection.selectedIndex === index;

    return `
      <article class="app-card ${isSelected ? "app-card-selected" : ""}">
        <strong>${escapeHtml(vehicle.name || vehicle.licensePlate || session.licensePlate || "Parkovací relace")}</strong>
        <p>${escapeHtml(location.name || location.address || "Parkovací místo")} · ${escapeHtml(location.sectionCode || session.parkingSectionCode || "Bez zóny")}</p>
        <div class="app-card-meta">
          ${renderAppChip(session.totalPrice !== undefined ? `${session.totalPrice} CZK` : "")}
          ${renderAppChip(session.acceptedMinutes !== undefined ? `${session.acceptedMinutes} min` : "")}
          ${renderAppChip(session.totalParkingTo ? `Do ${formatTime(session.totalParkingTo)}` : "")}
          ${vehicle.color ? renderAppChip({ type: "color", value: vehicle.color, label: "Barva" }) : ""}
        </div>
        <div class="app-card-details">
          <div class="app-detail-row"><span>SPZ</span><span>${escapeHtml(vehicle.licensePlate || session.licensePlate || "-")}</span></div>
          ${vehicle.name ? `<div class="app-detail-row"><span>Název vozidla</span><span>${escapeHtml(vehicle.name)}</span></div>` : ""}
          <div class="app-detail-row"><span>Od</span><span>${escapeHtml(formatDate(session.parkingFrom))}</span></div>
          <div class="app-detail-row"><span>Do</span><span>${escapeHtml(formatDate(session.parkingTo))}</span></div>
          <div class="app-detail-row"><span>Celkove do</span><span>${escapeHtml(formatDate(session.totalParkingTo || session.parkingTo))}</span></div>
          <div class="app-detail-row"><span>Cena useku</span><span>${escapeHtml(session.price !== undefined ? `${session.price} CZK` : "-")}</span></div>
          <div class="app-detail-row"><span>Celkova cena</span><span>${escapeHtml(session.totalPrice !== undefined ? `${session.totalPrice} CZK` : "-")}</span></div>
          ${location.sectionCode ? `<div class="app-detail-row"><span>Section code</span><span>${escapeHtml(location.sectionCode)}</span></div>` : ""}
          ${location.name ? `<div class="app-detail-row"><span>Název zóny</span><span>${escapeHtml(location.name)}</span></div>` : ""}
          ${location.filter ? `<div class="app-detail-row"><span>Filter</span><span>${escapeHtml(location.filter)}</span></div>` : ""}
          ${location.parkingPolicy ? `<div class="app-detail-row"><span>Parking policy</span><span>${escapeHtml(location.parkingPolicy)}</span></div>` : ""}
          ${typeof location.active === "boolean" ? `<div class="app-detail-row"><span>Aktivní</span><span>${escapeHtml(location.active ? "ano" : "ne")}</span></div>` : ""}
          ${location.type ? `<div class="app-detail-row"><span>Typ</span><span>${escapeHtml(location.type)}</span></div>` : ""}
          <div class="app-detail-row"><span>Adresa</span><span>${escapeHtml(location.address || "-")}</span></div>
          <div class="app-detail-row"><span>Doklad</span><span>${escapeHtml(session.ticketId || "-")}</span></div>
          ${typeof lookbackWindowInMinutes === "number" ? `<div class="app-detail-row"><span>Lookback</span><span>${escapeHtml(`${lookbackWindowInMinutes} min`)}</span></div>` : ""}
        </div>
        ${childSessions.length > 0 ? `
          <div class="app-session-extensions">
            <strong class="app-session-extensions-title">Prodlouzeni</strong>
            ${childSessions.map(child => `
              <div class="app-session-extension">
                <div class="app-session-extension-head">
                  <span>Usek ${escapeHtml(String((child.extensionNumber ?? 0) + 1))}</span>
                  <span>${escapeHtml(child.price !== undefined ? `${child.price} CZK` : "-")}</span>
                </div>
                <div class="app-session-extension-time">
                  ${escapeHtml(formatDate(child.parkingFrom))} - ${escapeHtml(formatDate(child.parkingTo))}
                </div>
          </div>
            `).join("")}
          </div>` : ""}
        ${selection ? `
          <div class="app-card-actions">
            <button type="button" class="app-card-select" data-selection-index="${index}">
              ${escapeHtml(isSelected ? (selection.selectedButtonLabel || "Vybráno") : (selection.buttonLabel || "Vybrat"))}
            </button>
          </div>` : ""}
      </article>
    `;
  }).join("")}</div>`;
}

function formatTime(value) {
  if (!value) {
    return "-";
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? String(value)
    : date.toLocaleTimeString("cs-CZ", { hour: "2-digit", minute: "2-digit" });
}

async function fetchJson(url) {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Cannot load ${url}: HTTP ${response.status}`);
  }

  return response.json();
}

async function postJson(url, payload) {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const raw = await response.text();
    throw new Error(`Cannot post ${url}: HTTP ${response.status} ${raw}`);
  }

  return response.json();
}

async function updateHarnessProxyTarget(targetBaseUrl) {
  await postJson("/__harness/config/proxy-target", { targetBaseUrl });
}

function parseResponse(raw) {
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}

function resolveObject(value, fieldValues, step) {
  if (Array.isArray(value)) {
    return value.map(item => resolveObject(item, fieldValues, step));
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, child]) => [key, resolveObject(child, fieldValues, step)]));
  }

  if (typeof value === "string") {
    const formFieldMatch = value.match(/^\{\{form\.([a-zA-Z0-9_]+)\}\}$/);
    const formField = formFieldMatch
      ? (step.fields || []).find(field => field.name === formFieldMatch[1])
      : null;

    if (formField?.type === "image-file") {
      return fieldValues[formField.name] || normalizeImageFileValue(null, formField);
    }

    const resolved = resolveTemplate(value, { fieldValues });

    if (formField?.type === "tag-list") {
      return Array.isArray(fieldValues[formField.name]) ? fieldValues[formField.name] : [];
    }

    if (formField?.type === "number") {
      const numeric = Number(resolved);
      return Number.isFinite(numeric) ? numeric : resolved;
    }

    if (formField?.type === "select" && formField.valueType === "number") {
      const numeric = Number(resolved);
      return Number.isFinite(numeric) ? numeric : resolved;
    }

    if (formField?.type === "select" && formField.valueType === "boolean") {
      if (resolved === "true") {
        return true;
      }

      if (resolved === "false") {
        return false;
      }
    }

    if (formField?.type === "checkbox") {
      return resolved === "true";
    }

    return resolved;
  }

  return value;
}

function resolveExpectedValue(value, step) {
  return resolveObject(value, state.values, step);
}

function resolveFieldDefaultValue(field) {
  if (Array.isArray(field.value)) {
    return field.value.map(item => resolveTemplate(String(item), { fieldValues: {} }));
  }

  if (field.value && typeof field.value === "object") {
    return resolveObject(field.value, {}, { fields: [] });
  }

  if (field.type === "image-file") {
    return normalizeImageFileValue(null, field);
  }

  return resolveTemplate(field.value ?? "", { fieldValues: {} });
}

function resolveTemplate(template, { fieldValues }) {
  return String(template)
    .replaceAll("{{uuid}}", crypto.randomUUID())
    .replaceAll("{{hex64}}", randomHex(32))
    .replaceAll("{{now}}", new Date().toISOString())
    .replaceAll("{{today}}", new Date().toISOString().slice(0, 10))
    .replaceAll("{{todayPlus365}}", new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10))
    .replace(/\{\{form\.([a-zA-Z0-9_]+)\}\}/g, (_, name) => fieldValues[name] ?? "")
    .replace(/\{\{context\.([a-zA-Z0-9_]+)\}\}/g, (_, name) => state.context[name] ?? "")
    .replace(/\{\{secret\.([a-zA-Z0-9_]+)\}\}/g, (_, name) => state.secrets[name] ?? "")
    .replace(/\{\{session\.([a-zA-Z0-9_]+)\}\}/g, (_, name) => state.authSession?.[name] ?? "")
    .replace(/\{\{auth\.([a-zA-Z0-9_]+)\}\}/g, (_, name) => state.authFormValues?.[name] ?? "");
}

function randomHex(byteLength) {
  const bytes = new Uint8Array(byteLength);
  crypto.getRandomValues(bytes);
  return [...bytes].map(byte => byte.toString(16).padStart(2, "0")).join("");
}

function getPath(value, selector) {
  if (selector === "$") {
    return value;
  }

  const tokens = selector
    .replace(/^\$(\.?)/, "")
    .replace(/\[(\d+)\]/g, ".$1")
    .split(".")
    .filter(Boolean);

  return tokens.reduce((current, token) => current?.[token], value);
}

function isEmpty(value) {
  return value === undefined
    || value === null
    || value === ""
    || (Array.isArray(value) && value.length === 0);
}

function deepEqual(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

async function copyTextToClipboard(text) {
  if (!navigator.clipboard?.writeText) {
    return false;
  }

  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;")
    .replaceAll("'", "&#039;");
}

function createFormCard(form) {
  const card = document.createElement("article");
  card.className = "scenario-card";
  card.dataset.formId = form.id;
  card.innerHTML = `
    <button class="scenario-main" type="button">
      <strong>${escapeHtml(form.step.title)}</strong>
      <p>${escapeHtml(form.description || form.scenarioTitle)}</p>
      <div class="form-meta">
        <span>${escapeHtml(form.step.request.method || "GET")}</span>
        <span>${escapeHtml(form.step.request.path)}</span>
        ${renderTagChips(form.tags)}
        ${form.requiresAnonymousAuth ? `<span class="meta-badge meta-badge-auth">Anonym</span>` : form.requiresAuth ? `<span class="meta-badge meta-badge-auth">${escapeHtml(getAuthorizationBadgeLabel())}</span>` : ""}
        ${form.manualInputRequired ? `<span class="meta-badge meta-badge-manual">Ru\u010dn\u00ed vstup</span>` : ""}
      </div>
    </button>
  `;

  card.querySelector(".scenario-main").addEventListener("click", () => selectFreeForm(form.id));
  card.classList.toggle("active", state.freeForm && state.scenario?.id === form.id);
  return card;
}

function createSmokeCard(scenario) {
  const result = state.smokeResults[scenario.id] || createIdleSmokeResult(scenario);
  const smokeEligible = isSmokeEligible(scenario);
  const selected = smokeEligible && state.selectedScenarioIds.has(scenario.id);
  const status = selected ? result.state : "idle";
  const statusLabel = smokeEligible
    ? getSmokeStatusLabel(status, result, selected)
    : "Mimo smoke";
  const details = result.detailLines || [];
  const card = document.createElement("article");
  card.className = `smoke-card ${status}`;
  card.innerHTML = `
    <div class="smoke-card-header">
      <label class="smoke-select">
        <input class="smoke-select-checkbox" type="checkbox" ${selected ? "checked" : ""} ${state.batchRunning || !smokeEligible ? "disabled" : ""}>
      </label>
      <div class="smoke-card-body">
        <strong>${escapeHtml(scenario.title)}</strong>
        <p>${escapeHtml(scenario.description || "")}</p>
        <div class="smoke-card-meta">
          <span class="smoke-status ${status}">${escapeHtml(statusLabel)}</span>
          <span class="app-chip">${escapeHtml(`${scenario.steps.length} krok\u016f`)}</span>
          ${requiresAuthorization(scenario) ? `<span class="app-chip">${escapeHtml(getAuthorizationBadgeLabel())}</span>` : ""}
          ${requiresManualInput(scenario) ? `<span class="app-chip">Ru\u010dn\u00ed vstup</span>` : ""}
        </div>
      </div>
      <button class="smoke-open" type="button" ${state.batchRunning ? "disabled" : ""}>Otevřít</button>
    </div>
    ${details.length > 0 || !smokeEligible ? `
      <div class="smoke-card-details">
        <strong>Detaily</strong>
        <ul>${[
          ...(!smokeEligible ? ["Tento sc\u00e9n\u00e1\u0159 se z\u00e1m\u011brn\u011b nespou\u0161t\u00ed ve smoke runu."] : []),
          ...details
        ].map(item => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
      </div>` : ""}
  `;

  if (smokeEligible) {
    card.querySelector(".smoke-select-checkbox").addEventListener("change", event => {
      toggleScenarioSelection(scenario.id, event.target.checked);
    });
  }
  card.querySelector(".smoke-open").addEventListener("click", () => {
    activateLeftTab("scenarios");
    selectScenario(scenario.id);
  });

  return card;
}

function createScenarioCard(scenario) {
  const card = document.createElement("article");
  card.className = "scenario-card";
  card.dataset.scenarioId = scenario.id;
  card.innerHTML = `
    <button class="scenario-main" type="button" ${state.batchRunning ? "disabled" : ""}>
      <strong>${escapeHtml(scenario.title)}</strong>
      <p>${escapeHtml(scenario.description)}</p>
      <div class="form-meta">
        ${renderTagChips(scenario.tags)}
        ${requiresAnonymousAuth(scenario) ? `<span class="meta-badge meta-badge-auth">Anonym</span>` : requiresAuthorization(scenario) ? `<span class="meta-badge meta-badge-auth">${escapeHtml(getAuthorizationBadgeLabel())}</span>` : ""}
        ${requiresManualInput(scenario) ? `<span class="meta-badge meta-badge-manual">Ru\u010dn\u00ed vstup</span>` : ""}
        ${!isSmokeEligible(scenario) ? `<span class="meta-badge meta-badge-smoke">Mimo smoke</span>` : ""}
      </div>
    </button>
    <button class="scenario-toggle" type="button" aria-expanded="false" ${state.batchRunning ? "disabled" : ""}>Kroky (${scenario.steps.length})</button>
    <ol class="scenario-steps hidden">
      ${scenario.steps.map((step, index) => `
        <li>
          <span>${index + 1}</span>
          <div>
            <strong>${escapeHtml(step.title)}</strong>
            <p>${escapeHtml(step.description || "")}</p>
          </div>
        </li>`).join("")}
    </ol>
  `;

  card.querySelector(".scenario-main").addEventListener("click", () => selectScenario(scenario.id));
  card.querySelector(".scenario-toggle").addEventListener("click", event => {
    event.stopPropagation();
    const steps = card.querySelector(".scenario-steps");
    const toggle = card.querySelector(".scenario-toggle");
    const expanded = steps.classList.toggle("hidden") === false;
    toggle.setAttribute("aria-expanded", String(expanded));
    toggle.textContent = expanded ? "Skr\u00fdt kroky" : `Kroky (${scenario.steps.length})`;
  });
  card.classList.toggle("active", !state.freeForm && state.scenario?.id === scenario.id);
  return card;
}

function getSmokeStatusLabel(status, result, selected) {
  if (!selected) {
    return "Nevybrán";
  }

  switch (status) {
    case "running":
      return result.currentStepIndex !== null
        ? `B\u011b\u017e\u00ed krok ${result.currentStepIndex + 1}`
        : "Připraven";
    case "passed":
      return "Prošlo";
    case "failed":
      return "Selhalo";
    case "warning":
      return "S upozorn\u011bn\u00edm";
    case "stopped":
      return "Zastaveno";
    default:
      return "\u010cek\u00e1";
  }
}

function renderTagChips(tags = []) {
  return (tags || []).map(tag => `<span>${escapeHtml(getTagLabel(tag))}</span>`).join("");
}

function renderTagFilters(container, items, activeCategory, onSelect) {
  container.innerHTML = "";

  const categories = ["all", ...new Set(items.flatMap(item => item.tags || []).filter(Boolean))];

  for (const category of categories) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `filter-chip ${activeCategory === category ? "active" : ""}`;
    button.textContent = category === "all"
      ? `V\u0161e (${items.length})`
      : `${getTagLabel(category)} (${items.filter(item => (item.tags || []).includes(category)).length})`;
    button.addEventListener("click", () => onSelect(category));
    container.appendChild(button);
  }
}

function filterCatalogItems(items, search, category, buildSearchText) {
  return items.filter(item => {
    if (category !== "all" && !(item.tags || []).includes(category)) {
      return false;
    }

    if (!search) {
      return true;
    }

    return buildSearchText(item).includes(search);
  });
}

function renderFlatCatalog(container, items, renderCard, emptyMessage) {
  container.innerHTML = "";

  if (items.length === 0) {
    container.innerHTML = `<div class="catalog-empty">${escapeHtml(emptyMessage)}</div>`;
    return;
  }
  
  for (const item of items) {
    container.appendChild(renderCard(item));
  }
}

function deriveScenarioTags(item) {
  const text = [
    item.id,
    item.title,
    item.description,
    ...(item.steps || []).flatMap(step => [
      step.id,
      step.title,
      step.description,
      step.request?.path,
      step.request?.method
    ])
  ].filter(Boolean).join(" ").toLowerCase();

  const tags = (item.tags || []).map(normalizeTag);

  if (includesAny(text, ["diagnostic", "persistence", "module-info", "/_test/ticket-service/persistence"])) {
    tags.push("diagnostics");
  }

  if (includesAny(text, ["catalog", "produkt", "zon", "search-products", "products", "module info"])) {
    tags.push("catalog");
  }

  if (includesAny(text, ["offer", "nakup", "jizdenk"])) {
    tags.push("purchase");
  }

  if (includesAny(text, ["booking", "rezerv", "cancel", "zrus"])) {
    tags.push("booking");
  }

  if (includesAny(text, ["payment", "platb"])) {
    tags.push("payment");
  }

  if (includesAny(text, ["payment-card", "payment cards", "karta", "card", "/payment-cards", "/parking/cards"])) {
    tags.push("cards");
  }

  if (includesAny(text, ["device", "zarizen", "firebase-token", "/devices"])) {
    tags.push("devices");
  }

  if (includesAny(text, ["account-creation", "activation", "uzivatel", "username", "user name", "login"])) {
    tags.push("account");
  }

  if (includesAny(text, ["password/change", "password-change", "změna hesla", "zmena hesla", "change password"])) {
    tags.push("password-change");
  }

  if (includesAny(text, ["client-data", "client/status", "client/data", "klientsk", "osobn"])) {
    tags.push("client-data");
  }

  if (includesAny(text, ["client/identifiers", "identifik", "identifier"])) {
    tags.push("client-identifiers");
  }

  if (includesAny(text, ["identifiers/mobile", "tokenizace telefonu", "telefonní identifikátor", "mobapp"])) {
    tags.push("phone-tokenization");
  }

  if (includesAny(text, ["identifiers/bank-card/registration", "identifiers/registration", "tokenizace platebn", "tokenizace karty", "bank-card"])) {
    tags.push("card-tokenization");
  }

  if (includesAny(text, ["identifiers/inkarta/registration", "tokenizace inkarty", "inkarta"])) {
    tags.push("inkarta-tokenization");
  }

  if (includesAny(text, ["identifiers/opus-card/registration", "tokenizace opuscard", "opuscard", "opus-card"])) {
    tags.push("opuscard-tokenization");
  }

  if (includesAny(text, ["identifiers/litacka/registration", "tokenizace lítačky", "tokenizace litacky", "litacka", "lítačka"])) {
    tags.push("litacka-tokenization");
  }

  if (includesAny(text, ["client/status", "stav klient", "ověřit klient", "overit klient", "ověření klient", "overeni klient"])) {
    tags.push("client-check");
  }

  if (includesAny(text, ["/v1/client/data", "načíst kompletní", "nacist kompletni", "detail klient"])) {
    tags.push("client-read");
  }

  if (includesAny(text, ["uložit", "ulozit", "save", "post", "založit klient", "zalozit klient"])) {
    tags.push("client-save");
  }

  if (includesAny(text, ["photo", "foto", "fotograf"])) {
    tags.push("client-photo");
  }

  if (includesAny(text, ["validace", "validation"])) {
    tags.push("validation");
  }

  if (includesAny(text, ["parking", "parkov", "/v1/parking"])) {
    tags.push("parking");
  }

  if (includesAny(text, ["favorite-zones", "obliben", "oblíben", "zona", "zóna", "zoneId", "/v1/accounts/me/favorite-zones"])) {
    tags.push("zones");
  }

  if (includesAny(text, ["my-vehicles", "vozidl", "spz", "licenseplate", "license plate"])) {
    tags.push("vehicles");
  }

  if (includesAny(text, ["suggest", "lokalit", "latitude", "longitude", "photon"])) {
    tags.push("locations");
  }

  if (includesAny(text, ["document", "pdf", "doklad"])) {
    tags.push("documents");
  }

  if (includesAny(text, ["fulfillment"])) {
    tags.push("fulfillment");
  }

  if (includesAny(text, ["scheduler", "worker", "dispatch", "command", "reconciliation", "webhook", "gdpay", "/_test/ticket-service"])) {
    tags.push("background");
  }

  if (includesAny(text, ["negative", "chyb", "bez ", "missing", "404", "400", "odmitn", "expectederror"])) {
    tags.push("negative");
  }

  if (tags.length === 0) {
    tags.push("other");
  }

  return [...new Set(tags)];
}

function normalizeTag(tag) {
  const value = String(tag || "").trim();
  const normalized = value.toLowerCase();

  const map = {
    "profil": "profile",
    "klientská data": "client-data",
    "klientska data": "client-data",
    "ověření": "client-check",
    "overeni": "client-check",
    "ověření klienta": "client-check",
    "overeni klienta": "client-check",
    "načtení": "client-read",
    "nacteni": "client-read",
    "uložení": "client-save",
    "ulozeni": "client-save",
    "založení klienta": "client-create",
    "zalozeni klienta": "client-create",
    "bez klienta": "missing-client",
    "osobní údaje": "personal-data",
    "osobni udaje": "personal-data",
    "fotografie": "client-photo",
    "neaktivní uživatel": "inactive-account",
    "neaktivni uzivatel": "inactive-account",
    "negativní": "negative",
    "negativni": "negative",
    "validace": "validation",
    "kupóny": "coupons",
    "kupony": "coupons",
    "přesun": "move",
    "presun": "move",
    "identifikátory": "identifiers",
    "identifikatory": "identifiers"
  };

  return map[normalized] || value;
}

function categorizeScenarioLike(item) {
  const text = [
    item.id,
    item.title,
    item.description,
    ...(item.steps || []).flatMap(step => [
      step.id,
      step.title,
      step.description,
      step.request?.path,
      step.request?.method
    ])
  ].filter(Boolean).join(" ").toLowerCase();

  if (includesAny(text, ["diagnostic", "persistence", "module-info", "/_test/ticket-service/persistence"])) {
    return "diagnostics";
  }

  if (includesAny(text, ["document", "pdf", "doklad"])) {
    return "documents";
  }

  if (includesAny(text, ["payment-card", "payment cards", "karta", "card", "/payment-cards", "/parking/cards"])) {
    return "cards";
  }

  if (includesAny(text, ["device", "zarizen", "firebase-token", "/devices"])) {
    return "devices";
  }

  if (includesAny(text, ["account-creation", "activation", "uzivatel", "username", "user name", "login"])) {
    return "account";
  }

  if (includesAny(text, ["parking", "parkov", "/v1/parking"])) {
    return "parking";
  }

  if (includesAny(text, ["scheduler", "worker", "dispatch", "command", "reconciliation", "webhook", "gdpay", "/_test/ticket-service"])) {
    return "background";
  }

  if (includesAny(text, ["negative", "chyb", "bez ", "missing", "404", "400", "odmitn", "expectederror"])) {
    return "negative";
  }

  if (includesAny(text, ["payment", "platb"])) {
    return "payment";
  }

  if (includesAny(text, ["booking", "rezerv", "cancel", "zrus"])) {
    return "booking";
  }

  if (includesAny(text, ["offer", "nakup", "jizdenk", "fulfillment"])) {
    return "purchase";
  }

  if (includesAny(text, ["catalog", "produkt", "zón", "zon", "search-products", "products", "module info"])) {
    return "catalog";
  }

  return "other";
}

function buildScenarioSearchText(scenario) {
  return [
    scenario.id,
    scenario.title,
    scenario.description,
    ...(scenario.tags || []).map(tag => getTagLabel(tag)),
    ...scenario.steps.flatMap(step => [step.title, step.description, step.request?.path, step.request?.method])
  ].filter(Boolean).join(" ").toLowerCase();
}

function buildFormSearchText(form) {
  return [
    form.id,
    form.scenarioId,
    form.scenarioTitle,
    form.step.title,
    form.description,
    form.step.request?.path,
    form.step.request?.method,
    ...(form.tags || []).map(tag => getTagLabel(tag))
  ].filter(Boolean).join(" ").toLowerCase();
}

function getTagLabel(category) {
  if (category === "fulfillment") {
    return "Fulfillment";
  }

  return getCategoryLabel(category);
}

function getCategoryLabel(category) {
  switch (category) {
    case "diagnostics":
      return "Diagnostika";
    case "catalog":
      return "Katalog";
    case "cards":
      return "Platebn\u00ed karty";
    case "devices":
      return "Za\u0159\u00edzen\u00ed";
    case "account":
      return "U\u017eivatelsk\u00fd \u00fa\u010det";
    case "profile":
      return "Profil";
    case "client-data":
      return "Klientská data";
    case "client-check":
      return "Ověření klienta";
    case "client-read":
      return "Načtení";
    case "client-identifiers":
      return "Identifikátory";
    case "phone-tokenization":
      return "Tokenizace telefonu";
    case "card-tokenization":
      return "Tokenizace karty";
    case "inkarta-tokenization":
      return "Tokenizace InKarty";
    case "opuscard-tokenization":
      return "Tokenizace OpusCard";
    case "litacka-tokenization":
      return "Tokenizace Lítačky";
    case "client-save":
      return "Uložení";
    case "client-create":
      return "Založení klienta";
    case "missing-client":
      return "Bez klienta";
    case "personal-data":
      return "Osobní údaje";
    case "client-photo":
      return "Fotografie";
    case "validation":
      return "Validace";
    case "account-creation":
      return "Zalo\u017een\u00ed \u00fa\u010dtu";
    case "new-account":
      return "Nov\u00fd \u00fa\u010det";
    case "repeated-account-creation":
      return "Opakovan\u00e9 zalo\u017een\u00ed";
    case "activation":
      return "Aktivace";
    case "reactivation":
      return "Reaktivace";
    case "active-account":
      return "Aktivn\u00ed \u00fa\u010det";
    case "inactive-account":
      return "Neaktivn\u00ed \u00fa\u010det";
    case "user-check":
      return "Ov\u011b\u0159en\u00ed u\u017eivatele";
    case "password-recovery":
      return "Obnova hesla";
    case "password-change":
      return "Změna hesla";
    case "password-validation":
      return "Validace hesla";
    case "authorization":
      return "Autorizace";
    case "unknown-email":
      return "Nezn\u00e1m\u00fd e-mail";
    case "token":
      return "Token";
    case "password":
      return "Heslo";
    case "parking":
      return "Parkování";
    case "zones":
      return "Zóny";
    case "vehicles":
      return "Vozidla";
    case "locations":
      return "Lokality";
    case "purchase":
      return "N\u00e1kup";
    case "booking":
      return "Booking";
    case "payment":
      return "Platby";
    case "documents":
      return "Doklady";
    case "coupons":
      return "Kupóny";
    case "soap":
      return "SOAP";
    case "core-mos":
      return "Core MOS";
    case "move":
      return "Přesun";
    case "identifiers":
      return "Identifikátory";
    case "background":
      return "Scheduler a worker";
    case "negative":
      return "Negativn\u00ed";
    default:
      return "Ostatn\u00ed";
  }
}

function includesAny(text, needles) {
  return needles.some(needle => text.includes(needle));
}
