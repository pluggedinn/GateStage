/**
 * Electron main process: starts the GateStage Node server (custom Next + Socket.io),
 * then opens a window on the local UI. Crew tablets still reach the same bind on :8080.
 */
const { app, BrowserWindow, Menu, shell } = require("electron");
const { spawn } = require("node:child_process");
const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");

const DEFAULT_PORT = Number(process.env.PORT ?? 8080);
const HOSTNAME = process.env.HOSTNAME ?? "0.0.0.0";

/** @type {import('node:child_process').ChildProcess | null} */
let serverProcess = null;
/** @type {import('electron').BrowserWindow | null} */
let mainWindow = null;
let isQuitting = false;
let boundPort = DEFAULT_PORT;

function isDevMode() {
  return !app.isPackaged;
}

function resolveStandaloneDir() {
  if (isDevMode()) {
    return path.join(__dirname, "..", ".next", "standalone");
  }
  // electron-builder extraResources → resources/standalone
  return path.join(process.resourcesPath, "standalone");
}

function resolveServerEntry(standaloneDir) {
  const bundled = path.join(standaloneDir, "gatestage-server.cjs");
  if (fs.existsSync(bundled)) return bundled;
  throw new Error(
    `Missing ${bundled}. Run \`npm run build:next\` before launching Electron.`,
  );
}

function userConfigPath() {
  return path.join(app.getPath("userData"), "config.json");
}

function waitForHealth(port, timeoutMs = 60_000) {
  const started = Date.now();
  return new Promise((resolve, reject) => {
    const attempt = () => {
      const req = http.get(
        `http://127.0.0.1:${port}/api/health`,
        { timeout: 2_000 },
        (res) => {
          res.resume();
          if (res.statusCode && res.statusCode >= 200 && res.statusCode < 500) {
            resolve();
            return;
          }
          retry();
        },
      );
      req.on("error", retry);
      req.on("timeout", () => {
        req.destroy();
        retry();
      });
    };

    const retry = () => {
      if (Date.now() - started > timeoutMs) {
        reject(new Error(`GateStage health check timed out on port ${port}`));
        return;
      }
      setTimeout(attempt, 400);
    };

    attempt();
  });
}

function startServer() {
  const standaloneDir = resolveStandaloneDir();
  const serverEntry = resolveServerEntry(standaloneDir);
  boundPort = DEFAULT_PORT;

  const env = {
    ...process.env,
    ELECTRON_RUN_AS_NODE: "1",
    NODE_ENV: "production",
    PORT: String(boundPort),
    HOSTNAME,
    GATESTAGE_APP_DIR: standaloneDir,
    GATESTAGE_CONFIG_PATH: userConfigPath(),
  };

  serverProcess = spawn(process.execPath, [serverEntry], {
    env,
    cwd: standaloneDir,
    stdio: ["ignore", "pipe", "pipe"],
  });

  serverProcess.stdout?.on("data", (chunk) => {
    process.stdout.write(`[server] ${chunk}`);
  });
  serverProcess.stderr?.on("data", (chunk) => {
    process.stderr.write(`[server] ${chunk}`);
  });
  serverProcess.on("exit", (code, signal) => {
    console.log(`[desktop] server exited code=${code} signal=${signal}`);
    serverProcess = null;
    if (!isQuitting) {
      app.quit();
    }
  });

  return waitForHealth(boundPort);
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 840,
    minWidth: 960,
    minHeight: 640,
    title: "GateStage",
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  mainWindow.once("ready-to-show", () => {
    mainWindow?.show();
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  void mainWindow.loadURL(`http://127.0.0.1:${boundPort}`);
}

function buildMenu() {
  const template = [
    ...(process.platform === "darwin"
      ? [
          {
            label: app.name,
            submenu: [
              { role: "about" },
              { type: "separator" },
              { role: "services" },
              { type: "separator" },
              { role: "hide" },
              { role: "hideOthers" },
              { role: "unhide" },
              { type: "separator" },
              { role: "quit" },
            ],
          },
        ]
      : []),
    {
      label: "File",
      submenu: [
        {
          label: "Open in Browser",
          click: () => {
            void shell.openExternal(`http://127.0.0.1:${boundPort}`);
          },
        },
        { type: "separator" },
        process.platform === "darwin" ? { role: "close" } : { role: "quit" },
      ],
    },
    {
      label: "Edit",
      submenu: [
        { role: "undo" },
        { role: "redo" },
        { type: "separator" },
        { role: "cut" },
        { role: "copy" },
        { role: "paste" },
        { role: "selectAll" },
      ],
    },
    {
      label: "View",
      submenu: [
        { role: "reload" },
        { role: "toggleDevTools" },
        { type: "separator" },
        { role: "resetZoom" },
        { role: "zoomIn" },
        { role: "zoomOut" },
        { type: "separator" },
        { role: "togglefullscreen" },
      ],
    },
    {
      label: "Help",
      submenu: [
        {
          label: "Crew LAN URL",
          click: () => {
            void shell.openExternal(`http://127.0.0.1:${boundPort}`);
          },
        },
        {
          label: "GitHub",
          click: () => {
            void shell.openExternal("https://github.com/pluggedinn/GateStage");
          },
        },
      ],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

function stopServer() {
  if (!serverProcess || serverProcess.killed) return;
  const child = serverProcess;
  serverProcess = null;
  try {
    child.kill("SIGTERM");
  } catch {
    // ignore
  }
  setTimeout(() => {
    if (!child.killed) {
      try {
        child.kill("SIGKILL");
      } catch {
        // ignore
      }
    }
  }, 2_000).unref?.();
}

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.whenReady().then(async () => {
    buildMenu();
    try {
      await startServer();
      createWindow();
    } catch (err) {
      console.error("[desktop] failed to start GateStage server", err);
      app.quit();
      return;
    }

    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
      }
    });
  });

  app.on("before-quit", () => {
    isQuitting = true;
    stopServer();
  });

  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") {
      app.quit();
    }
  });
}
