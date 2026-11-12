const { app, BrowserWindow, ipcMain, powerMonitor, shell } = require("electron");
const path = require("path");

/**
 * Employee desktop client.
 * Loads the ClarityTrack web backend but runs as a native desktop window
 * with OS-level idle signals (not browser-tab-only).
 *
 * Set CLARITYTRACK_URL to your server, e.g. http://127.0.0.1:43123
 */
const SERVER_URL = (process.env.CLARITYTRACK_URL || "http://127.0.0.1:43123").replace(
  /\/$/,
  "",
);

let mainWindow = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 960,
    minHeight: 640,
    title: "ClarityTrack Employee",
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  // Employee session entry — login still happens in-app; desktop is the shell.
  mainWindow.loadURL(`${SERVER_URL}/?desktop=1`);

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

function broadcastIdle() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  const idleSeconds = powerMonitor.getSystemIdleTime();
  mainWindow.webContents.send("claritytrack:system-idle", {
    idleSeconds,
    state: powerMonitor.getSystemIdleState(60),
    at: new Date().toISOString(),
  });
}

app.whenReady().then(() => {
  createWindow();

  // OS idle pulse for future desktop activity hooks (employee web UI unchanged for now).
  setInterval(broadcastIdle, 5000);
  powerMonitor.on("resume", broadcastIdle);
  powerMonitor.on("unlock-screen", broadcastIdle);

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

ipcMain.handle("claritytrack:get-meta", () => ({
  mode: "desktop-employee",
  serverUrl: SERVER_URL,
  platform: process.platform,
}));
