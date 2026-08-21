const { app, BrowserWindow, dialog } = require("electron");
const http = require("node:http");
const net = require("node:net");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

let localHttpServer = null;

function getFreePort() {
  return new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.once("error", reject);
    probe.listen(0, "127.0.0.1", () => {
      const address = probe.address();
      const port = typeof address === "object" && address ? address.port : 0;
      probe.close((error) => (error ? reject(error) : resolve(port)));
    });
  });
}

function waitForHealth(port, attempts = 50) {
  return new Promise((resolve, reject) => {
    let remaining = attempts;

    const retry = () => {
      remaining -= 1;
      if (remaining <= 0) {
        reject(new Error("Local game server did not become ready."));
        return;
      }
      setTimeout(check, 100);
    };

    const check = () => {
      const request = http.get(
        {
          hostname: "127.0.0.1",
          port,
          path: "/health",
          timeout: 500,
        },
        (response) => {
          response.resume();
          if (response.statusCode === 200) {
            resolve();
          } else {
            retry();
          }
        },
      );
      request.on("error", retry);
      request.on("timeout", () => request.destroy());
    };

    check();
  });
}

async function startLocalServer() {
  const port = await getFreePort();
  const appPath = app.getAppPath();

  process.env.NODE_ENV = "production";
  process.env.HOST = "127.0.0.1";
  process.env.PORT = String(port);
  process.env.CLIENT_DIST_PATH = path.join(appPath, "dist");

  const serverEntry = path.join(appPath, "dist-server", "server", "index.js");
  const serverModule = await import(pathToFileURL(serverEntry).href);
  localHttpServer = serverModule.httpServer;
  await waitForHealth(port);
  return port;
}

function createWindow(port) {
  const window = new BrowserWindow({
    width: 1280,
    height: 760,
    minWidth: 960,
    minHeight: 640,
    show: false,
    autoHideMenuBar: true,
    backgroundColor: "#171a26",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  const localOrigin = `http://127.0.0.1:${port}`;
  window.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  window.webContents.on("will-navigate", (event, url) => {
    if (!url.startsWith(localOrigin)) event.preventDefault();
  });
  window.once("ready-to-show", () => window.show());
  void window.loadURL(`${localOrigin}/`);
}

app.setAppUserModelId("com.kevin32456.shuaigou");

app.whenReady().then(async () => {
  try {
    const port = await startLocalServer();
    createWindow(port);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    dialog.showErrorBox("甩狗啟動失敗", message);
    app.quit();
  }
});

app.on("before-quit", () => {
  localHttpServer?.close();
  localHttpServer = null;
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
