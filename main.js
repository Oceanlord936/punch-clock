// Where does require() come from?
// require() is built into Node.js.
// You don't import it, because Node gives it to every file automatically.

//  It does the same job as import in React/ES modules:

// main.js runs in Node (Electron includes a copy of Node), not in a browser.
// That's why require works here and there's no window or document.
const { app, BrowserWindow, ipcMain } = require("electron");

// path is Node's built-in tool for building file paths. It handles \ on Windows and / on Mac/Linux for you.
const path = require("node:path");

// What does createWindow() do?
function createWindow() {
  const win = new BrowserWindow({
    width: 1100,
    height: 760,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"), // for this window, run preload.js inside the page before the page's own scripts run.
    },
  });
  win.loadFile(path.join(__dirname, "renderer", "index.html"));
}

// ipcMain.handle() is like @PostMapping method in a Spring Boot @RestController
ipcMain.handle("ping", (_event, name) => {
  console.log("main got a ping from", name);
  return `pong, ${name}! (answered by Node ${process.versions.node})`;
});

app.whenReady().then(createWindow);

app.on("window-all-closed", () => app.quit());
