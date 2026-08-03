// Electron shell for the One calendar app.
// The main window loads the hosted app; a small always-on-top window hosts the timer.
const { app, BrowserWindow, Tray, Menu, shell, nativeImage } = require("electron");
const path = require("path");
const fs = require("fs");

const CONFIG_PATH = path.join(app.getPath("userData"), "config.json");

function readAppUrl() {
  if (process.env.ONE_APP_URL) return process.env.ONE_APP_URL;
  try {
    const cfg = JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8"));
    if (cfg.appUrl) return cfg.appUrl;
  } catch {
    /* no config yet */
  }
  try {
    const bundled = JSON.parse(
      fs.readFileSync(path.join(__dirname, "app-config.json"), "utf8"),
    );
    if (bundled.appUrl) return bundled.appUrl;
  } catch {
    /* no bundled config */
  }
  return "https://project--e6fc8f1b-61d1-441b-abd3-1c9a7c24f17f.lovable.app";
}

const APP_URL = readAppUrl().replace(/\/$/, "");

let mainWindow = null;
let miniWindow = null;
let tray = null;

function createMainWindow() {
  if (mainWindow) {
    mainWindow.show();
    mainWindow.focus();
    return mainWindow;
  }
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 860,
    minWidth: 420,
    backgroundColor: "#101010",
    title: "One",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      partition: "persist:one",
    },
  });
  mainWindow.loadURL(APP_URL);
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

function createMiniWindow() {
  if (miniWindow) {
    miniWindow.show();
    miniWindow.focus();
    return miniWindow;
  }
  miniWindow = new BrowserWindow({
    width: 260,
    height: 92,
    resizable: false,
    frame: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    backgroundColor: "#101010",
    title: "One timer",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      partition: "persist:one",
    },
  });
  miniWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  miniWindow.loadURL(`${APP_URL}/mini-timer`);
  miniWindow.on("closed", () => {
    miniWindow = null;
  });
  return miniWindow;
}

function toggleMiniWindow() {
  if (miniWindow) {
    miniWindow.close();
  } else {
    createMiniWindow();
  }
}

function createTray() {
  const iconPath = path.join(__dirname, "tray.png");
  let image = nativeImage.createFromPath(iconPath);
  if (image.isEmpty()) image = nativeImage.createEmpty();
  image = image.resize({ width: 16, height: 16 });
  image.setTemplateImage(true);
  tray = new Tray(image);
  tray.setToolTip("One — kalender & timer");
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: "Öppna kalendern", click: () => createMainWindow() },
      { label: "Visa/dölj mini-timer", click: () => toggleMiniWindow() },
      { type: "separator" },
      { label: "Avsluta", click: () => app.quit() },
    ]),
  );
  tray.on("click", () => toggleMiniWindow());
}

app.whenReady().then(() => {
  createMainWindow();
  createMiniWindow();
  createTray();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
  });
});

// Keep running in the tray so the timer stays reachable after closing the calendar window.
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    // Tray keeps the app alive; quit only when the tray is gone.
    if (!tray) app.quit();
  }
});
