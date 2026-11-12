const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("claritytrackDesktop", {
  mode: "desktop-employee",
  getMeta: () => ipcRenderer.invoke("claritytrack:get-meta"),
  onSystemIdle: (handler) => {
    const listener = (_event, payload) => handler(payload);
    ipcRenderer.on("claritytrack:system-idle", listener);
    return () => ipcRenderer.removeListener("claritytrack:system-idle", listener);
  },
});
