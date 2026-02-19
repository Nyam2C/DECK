import { app, BrowserWindow, globalShortcut, ipcMain } from "electron";
import windowStateKeeper from "electron-window-state";
import { resolve, join } from "node:path";
import { appendFileSync } from "node:fs";
import { startBackend, stopBackend } from "./backend";
import { createTray, destroyTray } from "./tray";

const isDev = !app.isPackaged;
const logPath = join(app.getPath("userData"), "deck-debug.log");
function log(msg: string) {
  const line = `${new Date().toISOString()} ${msg}\n`;
  try {
    appendFileSync(logPath, line);
  } catch {}
  console.log(msg);
}
let mainWindow: BrowserWindow;
let forceQuit = false;

// --- 단일 인스턴스 ---
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
    }
  });

  app.whenReady().then(async () => {
    log(`[init] isDev=${isDev}, isPackaged=${app.isPackaged}`);
    log(`[init] __dirname=${__dirname}`);

    // 프로덕션: 백엔드 시작
    if (!isDev) {
      try {
        log("[backend] starting...");
        await startBackend();
        log("[backend] started OK");
      } catch (err) {
        log(`[backend] FAILED: ${err}`);
      }
    }

    // 윈도우 상태 복원
    const windowState = windowStateKeeper({
      defaultWidth: 1280,
      defaultHeight: 800,
    });

    mainWindow = new BrowserWindow({
      x: windowState.x,
      y: windowState.y,
      width: windowState.width,
      height: windowState.height,
      minWidth: 800,
      minHeight: 600,
      frame: false,
      icon: resolve(__dirname, "../icons/icon.png"),
      backgroundColor: "#0a0a14",
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: resolve(__dirname, "preload.js"),
      },
    });

    windowState.manage(mainWindow);

    // URL 로드
    const url = isDev ? "http://localhost:5173" : "http://127.0.0.1:3000";
    mainWindow.loadURL(url);

    // 닫기 → 트레이 숨기기 (forceQuit이 아니면 숨기기만)
    mainWindow.on("close", (e) => {
      log(`[close] forceQuit=${forceQuit}`);
      if (!forceQuit) {
        log("[close] preventing close, hiding window");
        e.preventDefault();
        mainWindow.hide();
      } else {
        log("[close] allowing close");
      }
    });

    // IPC: 창 컨트롤
    ipcMain.on("window-minimize", () => mainWindow.minimize());
    ipcMain.on("window-maximize", () => {
      if (mainWindow.isMaximized()) mainWindow.unmaximize();
      else mainWindow.maximize();
    });
    ipcMain.on("window-close", () => mainWindow.close());

    log("[init] window created, creating tray...");

    // 트레이 생성
    createTray(mainWindow);
    log("[init] tray created, app ready");

    // 글로벌 단축키
    globalShortcut.register("CmdOrCtrl+Shift+D", () => {
      if (mainWindow.isVisible()) {
        mainWindow.hide();
      } else {
        mainWindow.show();
        mainWindow.focus();
      }
    });
  });

  // app.quit() 호출 시 forceQuit 플래그 설정
  app.on("before-quit", () => {
    log("[quit] before-quit → forceQuit=true");
    forceQuit = true;
  });

  // 종료 체인
  app.on("will-quit", () => {
    log("[quit] will-quit → cleanup");
    globalShortcut.unregisterAll();
    destroyTray();
    stopBackend();
    log("[quit] cleanup done");
  });

  // macOS: 독 아이콘 클릭 시 윈도우 복원
  app.on("activate", () => {
    if (mainWindow) {
      mainWindow.show();
      mainWindow.focus();
    }
  });
}
