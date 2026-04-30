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
  values: {},
  dirty: false,
  freeForm: false,
  lastStepResult: null,
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
  harnessMeta: null,
  authSession: null,
  authFormValues: {},
  authProfileNotes: {},
  authCustomProfiles: [],
  displayedResult: null,
  activeSelection: null
};

const NEW_AUTH_PROFILE_ID = "__new_auth_profile__";

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
  nextStep: document.querySelector("#nextStep"),
  resetScenario: document.querySelector("#resetScenario"),
  resultCard: document.querySelector("#resultCard"),
  clearLog: document.querySelector("#clearLog"),
  contextView: document.querySelector("#contextView"),
  logEntries: document.querySelector("#logEntries"),
  autoRunTarget: document.querySelector("#autoRunTarget"),
  autoRun: document.querySelector("#autoRun"),
  autoRunSummary: document.querySelector("#autoRunSummary"),
  scenariosTab: document.querySelector("#scenariosTab"),
  smokeTab: document.querySelector("#smokeTab"),
  formsTab: document.querySelector("#formsTab"),
  scenariosPane: document.querySelector("#scenariosPane"),
  smokePane: document.querySelector("#smokePane"),
  formsPane: document.querySelector("#formsPane"),
  testerTab: document.querySelector("#testerTab"),
  logTab: document.querySelector("#logTab"),
  testerPane: document.querySelector("#testerPane"),
  logPane: document.querySelector("#logPane")
};

init();

async function init() {
  initResizablePanels();
  state.projectIndex = await fetchJson("/scenarios/index.json");
  await loadHarnessMeta();
  populateProjectOptions();
  await loadProject(getDefaultProjectId());

  elements.runStep.addEventListener("click", runCurrentStep);
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
  elements.scenarioSearch.addEventListener("input", event => {
    state.scenarioSearch = event.target.value.trim().toLowerCase();
    renderScenarioList();
  });
  elements.projectSelect.addEventListener("change", async event => {
    await loadProject(event.target.value);
  });
  elements.environmentSelect.addEventListener("change", async event => {
    await applyProjectEnvironment(state.currentProject, event.target.value);
  });
  elements.scenarioPack.addEventListener("change", async event => {
    await loadScenarioPack(event.target.value);
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
  elements.authLogoutAction.addEventListener("click", executeAuthLogout);
  elements.authResetAction.addEventListener("click", resetAuthState);
  elements.formSearch.addEventListener("input", event => {
    state.formSearch = event.target.value.trim().toLowerCase();
    renderFormList();
  });
  elements.testerTab.addEventListener("click", () => activateRightTab("tester"));
  elements.logTab.addEventListener("click", () => activateRightTab("log"));
  elements.clearLog.addEventListener("click", () => {
    state.log = [];
    renderLog();
  });
}

function populateProjectOptions() {
  elements.projectSelect.innerHTML = "";

  for (const project of state.projectIndex.projects || []) {
    const option = document.createElement("option");
    option.value = project.id;
    option.textContent = project.name;
    elements.projectSelect.appendChild(option);
  }
}

function populateScenarioPackOptions() {
  elements.scenarioPack.innerHTML = "";

  for (const pack of state.packIndex?.packs || []) {
    const option = document.createElement("option");
    option.value = pack.id;
    option.textContent = pack.name;
    elements.scenarioPack.appendChild(option);
  }
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

function getDefaultPackId() {
  return state.packIndex?.defaultPackId
    || state.packIndex?.packs?.[0]?.id
    || null;
}

function getDefaultEnvironmentId(project) {
  return project?.defaultEnvironmentId
    || project?.environments?.[0]?.id
    || "";
}

function isSmokeEligible(scenario) {
  return scenario?.smoke !== false;
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
  return getProjectAuthConfig().type === "login" ? "Přihlášení" : "JWT";
}

async function loadProject(projectId) {
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
  await loadScenarioPack(getDefaultPackId());
}

async function loadScenarioPack(packId) {
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
  state.values = {};
  state.dirty = false;
  state.freeForm = false;
  state.lastStepResult = null;
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
  elements.authPanelTitle.textContent = authConfig.panelTitle || (authConfig.type === "login" ? "Přihlášení" : "Přístup (JWT)");
  renderAuthForm();
  renderAuthPanelStatus();
  elements.authLoginAction.textContent = activeLoginConfig?.buttonText || authConfig.login?.buttonText || (authConfig.type === "login" ? "Přihlásit" : "Uložit");
  elements.authRefreshAction.textContent = authConfig.refresh?.buttonText || "Obnovit";
  elements.authLogoutAction.textContent = authConfig.logout?.buttonText || "Odhlásit";
  elements.authResetAction.textContent = authConfig.type === "login" ? "Vymazat" : "Vyčistit";
  elements.authLoginAction.disabled = authConfig.type !== "login" && authConfig.type !== "jwt";
  elements.authRefreshAction.disabled = !(authConfig.type === "login" && authConfig.refresh && state.authSession?.refreshToken);
  elements.authLogoutAction.disabled = !(authConfig.type === "login" && authConfig.logout && state.authSession?.accessToken);
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
  renderModeBanner();
}

async function executeAuthLogin() {
  const authConfig = getProjectAuthConfig();

  if (authConfig.type === "jwt") {
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
      updateSessionFromAuthResponse(body, config);
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

function saveNewAuthProfileAfterSuccessfulLogin() {
  const email = String(state.authFormValues?.email || "").trim();
  const password = String(state.authFormValues?.password || "");

  if (!email || !password) {
    return;
  }

  const note = String(state.authFormValues?.__newProfileNote || "").trim();
  const id = `custom-${email.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}-${Date.now()}`;
  const profile = {
    id,
    label: email,
    note,
    values: {
      email,
      password,
      deviceId: state.authFormValues?.deviceId || "",
      deviceName: state.authFormValues?.deviceName || "",
      platform: state.authFormValues?.platform || "",
      osVersion: state.authFormValues?.osVersion || "",
      appVersion: state.authFormValues?.appVersion || "",
      model: state.authFormValues?.model || ""
    }
  };

  state.authCustomProfiles = [
    ...(state.authCustomProfiles || []).filter(item => item.label?.toLowerCase() !== email.toLowerCase()),
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

  if (!password) {
    return;
  }

  let changed = false;
  state.authCustomProfiles = (state.authCustomProfiles || []).map(profile => {
    if (profile.id !== selectedProfile.id || profile.values?.password === password) {
      return profile;
    }

    changed = true;
    return {
      ...profile,
      values: {
        ...(profile.values || {}),
        password
      }
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

function updateSessionFromAuthResponse(body, config) {
  const responseConfig = config.response || {};
  const accessTokenPath = responseConfig.accessTokenPath || "$.accessToken";
  const refreshTokenPath = responseConfig.refreshTokenPath || "$.refreshToken";
  const expiresAtPath = responseConfig.expiresAtPath || "$.expiresAt";
  const emailPath = responseConfig.emailPath || "$.email";
  const displayNamePath = responseConfig.displayNamePath || "$.displayName";
  const identityIdPath = responseConfig.identityIdPath || "$.identityId";
  const deviceIdField = responseConfig.deviceIdField || "deviceId";
  const isAnonymousSession = config.sessionKind === "anonymous" || Boolean(state.authSession?.isAnonymous);

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

function getAuthorizationInfo() {
  const authConfig = getProjectAuthConfig();

  if (authConfig.type === "login") {
    return getLoginSessionInfo();
  }

  return getJwtInfo(getCurrentJwtToken());
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

  const info = getJwtInfo(getCurrentJwtToken());
  return {
    ok: info.valid,
    message: info.message
  };
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

  elements.scenariosTab.classList.toggle("active", showScenarios);
  elements.smokeTab.classList.toggle("active", showSmoke);
  elements.formsTab.classList.toggle("active", showForms);
  elements.scenariosTab.setAttribute("aria-selected", String(showScenarios));
  elements.smokeTab.setAttribute("aria-selected", String(showSmoke));
  elements.formsTab.setAttribute("aria-selected", String(showForms));
  elements.scenariosPane.classList.toggle("active", showScenarios);
  elements.smokePane.classList.toggle("active", showSmoke);
  elements.formsPane.classList.toggle("active", showForms);
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
  const scenarios = state.catalog.scenarios.map(scenario => ({
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

function selectScenario(scenarioId, options = {}) {
  const preserveLog = options.preserveLog === true;
  const suppressLog = options.suppressLog === true;
  state.scenario = state.catalog.scenarios.find(scenario => scenario.id === scenarioId);
  state.stepIndex = 0;
  state.context = {};
  state.values = {};
  state.dirty = false;
  state.freeForm = false;
  state.lastStepResult = null;
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
  renderAutoRunOptions();
  clearAutoRunSummary();
  renderStep();
}

function selectFreeForm(formId) {
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
  state.values = {};
  state.dirty = true;
  state.freeForm = true;
  state.lastStepResult = null;
  state.displayedResult = null;
  state.activeSelection = null;
  state.log = [];

  document.querySelectorAll(".scenario-card").forEach(card => {
    card.classList.toggle("active", card.dataset.formId === formId);
  });

  addLog("ok", "Formul\u00e1\u0159 vybr\u00e1n", {
    title: form.step.title,
    sourceScenario: form.scenarioId,
    mode: "Voln\u00fd formul\u00e1\u0159"
  });
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

function renderStep() {
  const step = currentStep();
  const scenarioRequiresManualInput = requiresManualInput(state.scenario);
  const stepRequiresAuth = requiresAuthorizationForStep(step);
  const missingContextKeys = getMissingContextKeys(step);
  elements.resetScenario.disabled = !state.scenario;
  elements.runStep.disabled = !step || state.batchRunning || missingContextKeys.length > 0 || (stepRequiresAuth && (!hasRequiredAuthorizationFor(step) || !hasRequiredAuthorizationFor(state.scenario)));
  elements.autoRun.disabled = !state.scenario || state.freeForm || state.batchRunning || scenarioRequiresManualInput || !hasRequiredAuthorizationFor(state.scenario);
  elements.autoRunTarget.disabled = !state.scenario || state.freeForm || state.batchRunning || scenarioRequiresManualInput || !hasRequiredAuthorizationFor(state.scenario);
  elements.runStep.textContent = "Spustit krok";
  elements.nextStep.disabled = !step || !state.lastStepResult || state.batchRunning;

  if (!step) {
    elements.stepCounter.textContent = "";
    elements.screenTitle.textContent = state.scenario ? "Dokončeno" : "Jízdenky";
    elements.screenDescription.textContent = state.scenario
      ? "V\u0161echny kroky sc\u00e9n\u00e1\u0159e jsou hotov\u00e9."
      : "P\u0159ehled dostupn\u00fdch slu\u017eeb pro cestuj\u00edc\u00ed.";
    elements.testerTitle.textContent = state.scenario ? "Sc\u00e9n\u00e1\u0159 dokon\u010den" : "Vyberte sc\u00e9n\u00e1\u0159";
    elements.testerDescription.textContent = state.scenario
      ? "Flow dob\u011bhl na konec dostupn\u00fdch krok\u016f."
      : "Technick\u00fd popis krok\u016f a o\u010dek\u00e1v\u00e1n\u00ed se zobraz\u00ed zde.";
    elements.stepForm.innerHTML = "";
    state.displayedResult = null;
    state.activeSelection = null;
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
  elements.stepForm.innerHTML = "";
  elements.resultCard.className = "result-card hidden";
  state.lastStepResult = null;
  state.displayedResult = null;
  state.activeSelection = null;
  const visibleFields = getVisibleFields(step);

  for (const field of step.fields || []) {
    const defaultValue = resolveFieldDefaultValue(field);
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
  const text = step
    ? [step.id, step.title, step.request?.path].filter(Boolean).join(" ").toLowerCase()
    : "";

  if (!step) {
    return {
      items: ["Jízdenky", "Platby", "Profil"],
      activeIndex: 0
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

  if (text.includes("parking") || text.includes("parkov")) {
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
    "auth/register",
    "auth/password",
    "password-recovery",
    "obnova hesla",
    "resetovat heslo"
  ]);
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

  input.addEventListener("input", () => {
    state.values[field.name] = input.value;

    if (shouldTrackDirty(field) && input.value !== input.dataset.defaultValue) {
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

function getVisibleFields(step) {
  return (step.fields || []).filter(field => !field.hidden);
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

  const method = step.request.method || "GET";
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
  const card = document.createElement("section");
  card.className = "request-preview";

  const method = step.request.method || "GET";
  const requestKind = method === "GET"
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

function getMobileTitle(step) {
  const text = [step.id, step.title, step.request?.path].filter(Boolean).join(" ").toLowerCase();

  if (isAccountStepText(text)) {
    return "Profil";
  }

  if (text.includes("parking") || text.includes("parkov")) {
    return "Parkování";
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
  const text = [step.id, step.title, step.request?.path].filter(Boolean).join(" ").toLowerCase();

  if (isAccountStepText(text)) {
    return "Založení a správa účtu.";
  }

  if (text.includes("parking") || text.includes("parkov")) {
    return "Založení, prodloužení a přehled parkovacích relací.";
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

  for (const assertion of step.expected.assertions || []) {
    if (assertion.equals !== undefined) {
      const expectedValue = resolveExpectedValue(assertion.equals, step);
      parts.push(`${assertion.path} = ${JSON.stringify(expectedValue)}`);
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

  if (!step) {
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

  elements.runStep.disabled = true;
  elements.runStep.textContent = "Pracuji...";
  elements.nextStep.disabled = true;
  showResult("warn", "Pracuji na požadavku...");
  let request = null;

  try {
    request = buildRequest(step);
    const startedAt = performance.now();
    const response = await fetch(request.url, request.options);
    const durationMs = Math.round(performance.now() - startedAt);
    const body = await readResponseBody(response);
    const result = evaluateStep(step, response.status, body);

    applyExtracts(step, body, response.status);
    applyRemember(step);
    prepareSelection(step, body, response.status);
    state.lastStepResult = result;

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
    elements.nextStep.disabled = false;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    state.lastStepResult = { level: "error", messages: [message] };
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
    }
  }
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

function setAutoRunControls(isRunning) {
  elements.runStep.disabled = isRunning || !currentStep();
  elements.nextStep.disabled = isRunning || !currentStep() || !state.lastStepResult;
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
      selectScenario(scenario.id, { preserveLog: true, suppressLog: true });
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
    const token = getProjectAuthConfig().type === "login"
      ? state.authSession?.accessToken
      : getCurrentJwtToken();

    if (token) {
      headers.Authorization = `Bearer ${token}`;
      visibleHeaders.Authorization = "Bearer ***";
    }
  }

  if (step.request.body !== undefined) {
    if (step.request.contentType === "text/plain") {
      body = resolveTemplate(String(step.request.body), { fieldValues: state.values });
      visibleBody = body;
      headers["Content-Type"] = "text/plain";
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

  for (const assertion of expected.assertions || []) {
    const actual = getPath(body, assertion.path);
    const expectedValue = assertion.equals !== undefined
      ? resolveExpectedValue(assertion.equals, step)
      : undefined;

    if (assertion.equals !== undefined && !deepEqual(actual, expectedValue)) {
      failures.push(`Očekáváno ${assertion.path} = ${JSON.stringify(expectedValue)}, vráceno ${JSON.stringify(actual)}.`);
    }

    if (assertion.notEmpty && isEmpty(actual)) {
      failures.push(`Očekáváno, že ${assertion.path} nebude prázdné.`);
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
    if (isDocumentArray(body)) {
      return `K j\u00edzdence je dostupn\u00fdch ${body.length} doklad\u016f.`;
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
      ? "Nasli jsme 1 parkovaci relaci."
      : `Nasli jsme ${count} parkovaci relace.`;
  }

  if (isParkingSuggestResultsResponse(body)) {
    const count = body.results.length;
    return count === 1
      ? "Našli jsme 1 návrh lokality."
      : `Našli jsme ${count} návrhů lokalit.`;
  }

  if (isParkingPriceMultiResponse(body)) {
    const count = Array.isArray(body.calculations) ? body.calculations.length : 0;
    return count === 1
      ? "Našli jsme 1 cenovou variantu parkování."
      : `Našli jsme ${count} cenových variant parkování.`;
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
    return "Parkovani je pripraveno k zaplaceni.";
  }

  if (isFavoriteZoneResponse(body)) {
    return `Oblíbená zóna ${body.zoneId} je připravena.`;
  }

  if (isDeleteFavoriteZoneResponse(body)) {
    const zoneCode = state.context.selectedFavoriteZoneCode || "Vybraná zóna";
    return `${zoneCode} byla odstraněna z oblíbených zón.`;
  }

  if ((body.paymentId || body.paymentAttemptId) && (body.state || body.status)) {
    return `Platba je ve stavu ${body.state || body.status}.`;
  }

  if (body.messageType && body.status === "DISPATCHED") {
    return "Krok na pozadi byl zpracovan.";
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
}

function nextStep() {
  if (!state.scenario) {
    return;
  }

  state.stepIndex += 1;
  renderStep();
}

function currentStep() {
  return state.scenario?.steps[state.stepIndex] || null;
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
    elements.modeBanner.textContent = getProjectAuthConfig().type === "login"
      ? "Tento scénář vyžaduje platné přihlášení v panelu Přístup."
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

  elements.modeBanner.textContent = "Scenario mode: vstupy odpovídají připravenému scénáři a výsledky se vyhodnocují proti očekávání.";
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
        addLog("warn", "Kopirovani logu selhalo", {
          title: entry.title,
          reason: "Clipboard API neni dostupne."
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

function showResult(level, message, body = null, step = currentStep()) {
  state.displayedResult = { level, message, body, step };
  elements.resultCard.innerHTML = buildResultHtml(level, message, body, step);
  elements.resultCard.className = `result-card ${level}`;
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
    <div class="result-message">${escapeHtml(message)}</div>
    ${rows.length > 0 ? `<div class="result-grid">${rows.map(row => `
      <div class="result-row">
        <span>${escapeHtml(row.label)}</span>
        <span>${escapeHtml(row.value)}</span>
      </div>`).join("")}</div>` : ""}
    ${buildAppCardsHtml(body, step)}
  `;
}

function buildAppCardsHtml(body, step = currentStep()) {
  if (!body || typeof body !== "object") {
    return "";
  }

  if (isParkingSessionsResponse(body)) {
    return renderParkingSessionsCardsHtml(body.sessions, body.activeParkingLookbackWindowInMinutes);
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
    const calculations = Array.isArray(body.calculations) ? body.calculations : [];

    return `
      <div class="app-card-list">
        <article class="app-card">
          <strong>Výpočet ceny parkování</strong>
          <p>${body.calculationSuccessful ? "Kalkulace proběhla úspěšně." : "Kalkulace se nepodařila plně dokončit."}</p>
          <div class="app-card-meta">
            ${renderAppChip(body.calculationSuccessful ? "Úspěšné" : "Neúplné")}
            ${renderAppChip(calculations.length === 1 ? "1 varianta" : `${calculations.length} variant`)}
          </div>
          <div class="app-card-details">
            <div class="app-detail-row"><span>Parkování od</span><span>${escapeHtml(formatDate(body.parkingFrom))}</span></div>
            ${body.tariffId ? `<div class="app-detail-row"><span>Tarif</span><span>${escapeHtml(shortId(body.tariffId))}</span></div>` : ""}
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
      text: `Backend bezi nad ${info.products.repositoryProvider}. Produktu v katalogu: ${info.products.count}.`,
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
          <strong>Parkovani pripraveno</strong>
          <p>${escapeHtml((ticket.licensePlate || body.licensePlate || "Vozidlo"))} muzete dokoncit pres platebni branu.</p>
          <div class="app-card-meta">
            ${renderAppChip(ticket.parkingSectionCode ? `Zona ${ticket.parkingSectionCode}` : "Parkovani")}
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
              <a class="app-card-link" href="${escapeHtml(body.paymentGatewayRedirectUrl)}" target="_blank" rel="noopener">Otevrit platebni branu</a>
            </div>` : ""}
        </article>
      </div>
    `;
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

  if (body.cardId) {
    return buildCardListHtml([body], card => ({
      title: card.name || "Platebn\u00ed karta",
      text: card.maskedNumber
        ? `Karta ${card.maskedNumber} je připravena k použití.`
        : "Karta byla zalo\u017eena a je p\u0159ipravena k dal\u0161\u00ed spr\u00e1v\u011b.",
      chips: [card.expiration, shortId(card.cardId)]
    }));
  }

  if (Array.isArray(body) && body.length > 0 && body.every(item => item && typeof item === "object" && "cardId" in item)) {
    return buildCardListHtml(body, card => ({
      title: card.name || "Platebn\u00ed karta",
      text: card.maskedNumber
        ? `Karta ${card.maskedNumber}`
        : "Ulo\u017een\u00e1 karta",
      chips: [card.expiration, card.registrationUrl ? "\u010dek\u00e1jici registrace" : "aktivn\u00ed"]
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

  if (state.activeSelection.items !== collection) {
    return null;
  }

  return {
    buttonLabel: step.selection.buttonLabel,
    selectedButtonLabel: step.selection.selectedButtonLabel,
    selectedIndex: state.activeSelection.selectedIndex
  };
}

function prepareSelection(step, body, status) {
  state.activeSelection = null;

  if (!step?.selection || status >= 400) {
    return;
  }

  const sourcePath = step.selection.sourcePath || "$";
  const items = getPath(body, sourcePath);

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
    state.context[key] = selector === "$" ? item : getPath(item, selector);
  }

  addLog("ok", "Položka vybrána", {
    stepId: state.activeSelection.stepId,
    selectedIndex: index,
    storedContext: state.activeSelection.config.store || {}
  });

  renderContext();
  renderModeBanner();

  if (state.displayedResult) {
    showResult(
      state.displayedResult.level,
      state.displayedResult.message,
      state.displayedResult.body,
      state.displayedResult.step);
  }
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

  if (body.ticketSuccessfullyCreated && body.ticket) {
    return [];
  }

  if (isFavoriteZoneResponse(body) || isDeleteFavoriteZoneResponse(body)) {
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
      addSummary(rows, key, formatSummaryValue(value));
    }
  }

  return rows;
}

function addSummary(rows, label, value) {
  if (value === undefined || value === null || value === "") {
    return;
  }

  rows.push({ label, value: formatSummaryValue(value) });
}

function formatSummaryValue(value) {
  if (Array.isArray(value)) {
    return `${value.length}`;
  }

  if (typeof value === "object") {
    return JSON.stringify(value);
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
    && typeof value.calculationSuccessful === "boolean"
    && Array.isArray(value.calculations)
    && value.calculations.length > 0;
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

function renderParkingSessionsCardsHtml(sessions, lookbackWindowInMinutes) {
  return `<div class="app-card-list">${sessions.map(session => {
    const childSessions = Array.isArray(session.childSessions) ? session.childSessions : [];
    const vehicle = session.vehicle || {};
    const location = session.location || {};

    return `
      <article class="app-card">
        <strong>${escapeHtml(vehicle.name || vehicle.licensePlate || session.licensePlate || "Parkovaci relace")}</strong>
        <p>${escapeHtml(location.name || location.address || "Parkovaci misto")} · ${escapeHtml(location.sectionCode || session.parkingSectionCode || "Bez zony")}</p>
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
    const resolved = resolveTemplate(value, { fieldValues });
    const formFieldMatch = value.match(/^\{\{form\.([a-zA-Z0-9_]+)\}\}$/);
    const formField = formFieldMatch
      ? (step.fields || []).find(field => field.name === formFieldMatch[1])
      : null;

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

  return resolveTemplate(field.value ?? "", { fieldValues: {} });
}

function resolveTemplate(template, { fieldValues }) {
  return String(template)
    .replaceAll("{{uuid}}", crypto.randomUUID())
    .replaceAll("{{now}}", new Date().toISOString())
    .replace(/\{\{form\.([a-zA-Z0-9_]+)\}\}/g, (_, name) => fieldValues[name] ?? "")
    .replace(/\{\{context\.([a-zA-Z0-9_]+)\}\}/g, (_, name) => state.context[name] ?? "")
    .replace(/\{\{session\.([a-zA-Z0-9_]+)\}\}/g, (_, name) => state.authSession?.[name] ?? "")
    .replace(/\{\{auth\.([a-zA-Z0-9_]+)\}\}/g, (_, name) => state.authFormValues?.[name] ?? "");
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
      <button class="smoke-open" type="button" ${state.batchRunning ? "disabled" : ""}>Otevrit</button>
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

  const tags = [...(item.tags || [])];

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

  if (includesAny(text, ["payment-card", "payment cards", "karta", "card", "/payment-cards"])) {
    tags.push("cards");
  }

  if (includesAny(text, ["device", "zarizen", "firebase-token", "/devices"])) {
    tags.push("devices");
  }

  if (includesAny(text, ["account-creation", "activation", "uzivatel", "username", "user name", "login"])) {
    tags.push("account");
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

  if (includesAny(text, ["payment-card", "payment cards", "karta", "card", "/payment-cards"])) {
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
    case "password-validation":
      return "Validace hesla";
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

