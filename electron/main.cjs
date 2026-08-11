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
const MINI_SIZE = { width: 268, height: 96 };

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
  win.loadURL(url).catch(() => {
    /* did-fail-load handles it */
  });
}

function attachOfflineFallback(win, url) {
  win.webContents.on("did-fail-load", (_e, code, _desc, failedUrl, isMainFrame) => {
    // -3 is an aborted load (e.g. a redirect); not a real failure.
    if (!isMainFrame || code === -3) return;
    win.__retryUrl = failedUrl && failedUrl.startsWith("http") ? failedUrl : url;
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
    frame: false,
    transparent: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    fullscreenable: false,
    backgroundColor: "#101010",
    title: "One timer",
    webPreferences: webPrefs(),
  });
  miniWindow.setAlwaysOnTop(true, "floating");
  miniWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  miniWindow.loadURL(`${APP_URL}/mini-timer`);
  const remember = () => {
    if (!miniWindow) return;
    const [x, y] = miniWindow.getPosition();
    saveState({ mini: { x, y } });
  };
  miniWindow.on("moved", remember);
  miniWindow.on("close", remember);
  miniWindow.on("closed", () => {
    miniWindow = null;
    saveState({ miniOpen: false });
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
  if (!tray) return;
  const running = timerState.running;
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

ipcMain.on("timer-state", (_e, next) => {
  timerState = { running: false, paused: false, label: "", elapsed: "", ...(next || {}) };
  refreshTray();
});
ipcMain.on("mini-close", () => {
  if (miniWindow) miniWindow.close();
});
ipcMain.on("open-main", () => createMainWindow());

app.whenReady().then(() => {
  createMainWindow();
  if (state.miniOpen !== false) createMiniWindow();
  createTray();

  globalShortcut.register("CommandOrControl+Shift+T", () => toggleMiniWindow());

  app.on("activate", () => {
    if (!mainWindow) createMainWindow();
  });
});

app.on("will-quit", () => globalShortcut.unregisterAll());

// Keep running in the tray so the timer stays reachable after closing the calendar window.
app.on("window-all-closed", () => {
  if (!tray) app.quit();
});
