// Bridge between the web app and the Electron shell.
// Exposes a tiny, explicit API — no Node access leaks into the page.
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("oneDesktop", {
  isDesktop: true,
  /** Report timer state so the menu bar can show the running time. */
  timerState: (state) => ipcRenderer.send("timer-state", state),
  closeMini: () => ipcRenderer.send("mini-close"),
  toggleMini: () => ipcRenderer.send("toggle-mini"),
  showMini: () => ipcRenderer.send("show-mini"),
  openMain: () => ipcRenderer.send("open-main"),
  /** Used by the offline fallback page to retry the failed load. */
  retryLoad: () => ipcRenderer.send("retry-load"),
});
