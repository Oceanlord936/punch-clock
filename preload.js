const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("api", {
  ping: (name) => ipcRenderer.invoke("ping", name),
});
