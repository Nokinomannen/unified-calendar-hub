// Electron shell for the One calendar app.
// The main window loads the hosted app; a small always-on-top window hosts the timer.
const {
  app,
  BrowserWindow,
  Tray,
  Menu,
  shell,
  nativeImage,
  ipcMain,
  globalShortcut,
  screen,
} = require("electron");
const path = require("path");
const fs = require("fs");

const CONFIG_PATH = path.join(app.getPath("userData"), "config.json");
const STATE_PATH = path.join(app.getPath("userData"), "window-state.json");

function readJson(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return fallback;
  }
}

function readAppUrl() {
  if (process.env.ONE_APP_URL) return process.env.ONE_APP_URL;
  const cfg = readJson(CONFIG_PATH, {});
  if (cfg.appUrl) return cfg.appUrl;
  const bundled = readJson(path.join(__dirname, "app-config.json"), {});
  if (bundled.appUrl) return bundled.appUrl;
  return "https://unified-flow-time.lovable.app";
}

const APP_URL = readAppUrl().replace(/\/$/, "");
const MINI_SIZE = { width: 300, height: 132 };

let state = readJson(STATE_PATH, {});
function saveState(patch) {
  state = { ...state, ...patch };
  try {
    fs.writeFileSync(STATE_PATH, JSON.stringify(state));
  } catch {
    /* best effort */
  }
}

let mainWindow = null;
let miniWindow = null;
let tray = null;
let isQuitting = false;

const webPrefs = () => ({
  contextIsolation: true,
  nodeIntegration: false,
  partition: "persist:one",
  preload: path.join(__dirname, "preload.cjs"),
});

/** Keep a remembered window box on screen even if displays changed. */
function boxOnScreen(saved, fallback) {
  if (!saved) return fallback;
  const fits = screen.getAllDisplays().some((d) => {
    const b = d.workArea;
    return saved.x >= b.x - 60 && saved.y >= b.y - 40 && saved.x <= b.x + b.width - 80 && saved.y <= b.y + b.height - 40;
  });
  return fits ? { ...fallback, ...saved } : fallback;
}

function loadApp(win, url) {
  win.__loadedAt = Date.now();
  win.loadURL(url).catch(() => {
    /* did-fail-load handles it */
  });
}

// The app is the published web app in a shell, so "updating" means fetching a
// fresh build. We reload past a staleness threshold instead of on every focus,
// so typing in the chat is never interrupted.
const STALE_AFTER_MS = 30 * 60 * 1000;

function refreshWindow(win, { force = false } = {}) {
  if (!win || win.isDestroyed()) return;
  if (!force && Date.now() - (win.__loadedAt || 0) < STALE_AFTER_MS) return;
  win.__loadedAt = Date.now();
  win.webContents.reloadIgnoringCache();
}

function checkForUpdates(force = true) {
  refreshWindow(mainWindow, { force });
  refreshWindow(miniWindow, { force });
}

function trackFreshness(win) {
  win.webContents.on("did-finish-load", () => {
    win.__loadedAt = Date.now();
  });
  win.on("focus", () => refreshWindow(win));
}


function attachOfflineFallback(win, url) {
  win.webContents.on("did-fail-load", (_e, code, _desc, failedUrl, isMainFrame) => {
    // -3 is an aborted load (e.g. a redirect); not a real failure.
    if (!isMainFrame || code === -3) return;
    win.__retryUrl = failedUrl && failedUrl.startsWith("http") ? failedUrl : url;
    win.loadFile(path.join(__dirname, "offline.html"));
  });
  // A 403/404/5xx returns a body ("Forbidden") instead of failing the load,
  // which would otherwise render as bare text in a frameless window.
  win.webContents.on("did-navigate", (_e, navUrl, httpCode) => {
    if (!httpCode || httpCode < 400) return;
    win.__retryUrl = navUrl && navUrl.startsWith("http") ? navUrl : url;
    win.loadFile(path.join(__dirname, "offline.html"));
  });
}

function createMainWindow() {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
    return mainWindow;
  }
  mainWindow = new BrowserWindow({
    ...boxOnScreen(state.main, { width: 1240, height: 880 }),
    minWidth: 420,
    minHeight: 380,
    show: false,
    backgroundColor: "#101010",
    title: "One",
    titleBarStyle: process.platform === "darwin" ? "hiddenInset" : "default",
    webPreferences: webPrefs(),
  });
  if (state.mainMaximized) mainWindow.maximize();
  attachOfflineFallback(mainWindow, APP_URL);
  trackFreshness(mainWindow);
  loadApp(mainWindow, APP_URL);
  mainWindow.once("ready-to-show", () => mainWindow && mainWindow.show());
  const rememberMain = () => {
    if (!mainWindow || mainWindow.isMinimized() || mainWindow.isFullScreen()) return;
    const maximized = mainWindow.isMaximized();
    const b = mainWindow.getNormalBounds();
    saveState({ main: b, mainMaximized: maximized });
  };
  mainWindow.on("resize", rememberMain);
  mainWindow.on("moved", rememberMain);
  mainWindow.on("close", rememberMain);
  mainWindow.on("closed", () => {
    mainWindow = null;
  });
  // External links open in the real browser.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (!url.startsWith(APP_URL)) {
      shell.openExternal(url);
      return { action: "deny" };
    }
    return { action: "allow" };
  });
  return mainWindow;
}

/** Keep a remembered position on screen even if displays changed. */
function miniPosition() {
  const saved = state.mini;
  if (!saved) return {};
  const inside = screen.getAllDisplays().some((d) => {
    const b = d.workArea;
    return (
      saved.x >= b.x - 40 &&
      saved.y >= b.y - 40 &&
      saved.x <= b.x + b.width - 40 &&
      saved.y <= b.y + b.height - 40
    );
  });
  return inside ? { x: saved.x, y: saved.y } : {};
}

function createMiniWindow() {
  if (miniWindow) {
    miniWindow.show();
    miniWindow.focus();
    return miniWindow;
  }
  miniWindow = new BrowserWindow({
    ...MINI_SIZE,
    ...miniPosition(),
    resizable: false,
    movable: true,
    frame: false,
    transparent: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    fullscreenable: false,
    minimizable: false,
    maximizable: false,
    hasShadow: true,
    backgroundColor: "#101010",
    title: "One timer",
    webPreferences: webPrefs(),
  });
  // "screen-saver" keeps the panel above full-screen apps and other floating windows.
  miniWindow.setAlwaysOnTop(true, "screen-saver");
  miniWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  attachOfflineFallback(miniWindow, `${APP_URL}/mini-timer`);
  trackFreshness(miniWindow);
  loadApp(miniWindow, `${APP_URL}/mini-timer`);
  const remember = () => {
    if (!miniWindow) return;
    const [x, y] = miniWindow.getPosition();
    saveState({ mini: { x, y } });
  };
  miniWindow.on("moved", remember);
  miniWindow.on("close", remember);
  miniWindow.on("closed", () => {
    miniWindow = null;
    // Quitting should not forget that the timer window was open.
    if (!isQuitting) saveState({ miniOpen: false });
    refreshTray();
  });
  saveState({ miniOpen: true });
  return miniWindow;
}

function toggleMiniWindow() {
  if (miniWindow) miniWindow.close();
  else createMiniWindow();
  refreshTray();
}

// ---- Menu bar ---------------------------------------------------------------

let timerState = { running: false, paused: false, label: "", elapsed: "" };

function trayImage() {
  const iconPath = path.join(__dirname, "trayTemplate.png");
  let image = nativeImage.createFromPath(iconPath);
  if (image.isEmpty()) image = nativeImage.createEmpty();
  else image = image.resize({ width: 16, height: 16 });
  image.setTemplateImage(true);
  return image;
}

function refreshTray() {
  const running = timerState.running;
  // Dock badge mirrors the menu bar so the running timer is visible either way.
  if (process.platform === "darwin" && app.dock) {
    app.dock.setBadge(running ? (timerState.paused ? "⏸" : "●") : "");
  }
  if (!tray) return;
  tray.setTitle(
    running ? ` ${timerState.paused ? "⏸" : ""}${timerState.elapsed}` : "",
  );
  tray.setToolTip(
    running ? `One — ${timerState.label} ${timerState.elapsed}` : "One — kalender & timer",
  );
  tray.setContextMenu(
    Menu.buildFromTemplate([
      {
        label: running
          ? `${timerState.label}: ${timerState.elapsed}${timerState.paused ? " (pausad)" : ""}`
          : "Ingen timer igång",
        enabled: false,
      },
      { type: "separator" },
      { label: "Öppna kalendern", click: () => createMainWindow() },
      { label: "Hämta senaste versionen", click: () => checkForUpdates(true) },
      {
        label: miniWindow ? "Dölj mini-timer" : "Visa mini-timer",
        accelerator: "CommandOrControl+Shift+T",
        click: () => toggleMiniWindow(),
      },
      { type: "separator" },
      {
        label: "Starta vid inloggning",
        type: "checkbox",
        checked: app.getLoginItemSettings().openAtLogin,
        click: (item) => app.setLoginItemSettings({ openAtLogin: item.checked }),
      },
      { type: "separator" },
      { label: "Avsluta One", click: () => app.quit() },
    ]),
  );
}

function createTray() {
  tray = new Tray(trayImage());
  tray.on("click", () => toggleMiniWindow());
  refreshTray();
}

// ---- Application menu (Swedish, with the shortcuts the browser gives you) ----

function buildAppMenu() {
  const isMac = process.platform === "darwin";
  const template = [
    ...(isMac
      ? [
          {
            label: "One",
            submenu: [
              { role: "about", label: "Om One" },
              {
                label: "Hämta senaste versionen",
                accelerator: "CmdOrCtrl+Alt+R",
                click: () => checkForUpdates(true),
              },
              { type: "separator" },
              { role: "services", label: "Tjänster" },
              { type: "separator" },
              { role: "hide", label: "Göm One" },
              { role: "hideOthers", label: "Göm övriga" },
              { role: "unhide", label: "Visa alla" },
              { type: "separator" },
              { role: "quit", label: "Avsluta One" },
            ],
          },
        ]
      : []),
    {
      label: "Arkiv",
      submenu: [
        { label: "Öppna kalendern", accelerator: "CmdOrCtrl+N", click: () => createMainWindow() },
        {
          label: "Visa/dölj mini-timer",
          accelerator: "CmdOrCtrl+Shift+T",
          click: () => toggleMiniWindow(),
        },
        { type: "separator" },
        { role: isMac ? "close" : "quit", label: isMac ? "Stäng fönster" : "Avsluta" },
      ],
    },
    {
      label: "Redigera",
      submenu: [
        { role: "undo", label: "Ångra" },
        { role: "redo", label: "Gör om" },
        { type: "separator" },
        { role: "cut", label: "Klipp ut" },
        { role: "copy", label: "Kopiera" },
        { role: "paste", label: "Klistra in" },
        { role: "selectAll", label: "Markera allt" },
      ],
    },
    {
      label: "Visa",
      submenu: [
        { role: "reload", label: "Ladda om" },
        { role: "forceReload", label: "Tvinga omladdning" },
        { type: "separator" },
        { role: "resetZoom", label: "Normal storlek" },
        { role: "zoomIn", label: "Zooma in" },
        { role: "zoomOut", label: "Zooma ut" },
        { type: "separator" },
        { role: "togglefullscreen", label: "Helskärm" },
        { role: "toggleDevTools", label: "Utvecklarverktyg" },
      ],
    },
    {
      label: "Fönster",
      submenu: [
        { role: "minimize", label: "Minimera" },
        { role: "zoom", label: "Zooma" },
        ...(isMac ? [{ type: "separator" }, { role: "front", label: "Lägg alla överst" }] : []),
      ],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

ipcMain.on("timer-state", (_e, next) => {
  timerState = { running: false, paused: false, label: "", elapsed: "", ...(next || {}) };
  refreshTray();
});
ipcMain.on("mini-close", () => {
  if (miniWindow) miniWindow.close();
});
ipcMain.on("open-main", () => createMainWindow());
ipcMain.on("retry-load", (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (!win) return;
  loadApp(win, win.__retryUrl || APP_URL);
});

// A second launch should focus the running app, not spawn another tray icon.
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on("second-instance", () => {
    createMainWindow();
    if (miniWindow) miniWindow.show();
  });

  app.whenReady().then(() => {
    buildAppMenu();
    createMainWindow();
    if (state.miniOpen !== false) createMiniWindow();
    createTray();

    globalShortcut.register("CommandOrControl+Shift+T", () => toggleMiniWindow());

    // Background freshness check: pull a new build a few times a day even if
    // the window is never refocused.
    setInterval(() => checkForUpdates(true), 3 * 60 * 60 * 1000);

    app.on("activate", () => {
      if (!mainWindow) createMainWindow();
      else createMainWindow();
    });
  });
}

// On quit, take every window and the menu bar icon with us — the frameless
// mini timer has no title bar, so a lingering one cannot be closed by hand.
app.on("before-quit", () => {
  isQuitting = true;
  if (miniWindow) miniWindow.destroy();
  miniWindow = null;
  if (tray) tray.destroy();
  tray = null;
});

app.on("will-quit", () => globalShortcut.unregisterAll());

// Keep running in the tray so the timer stays reachable after closing the calendar window.
app.on("window-all-closed", () => {
  if (!tray) app.quit();
});

