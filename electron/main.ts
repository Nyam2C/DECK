import { app, BrowserWindow, globalShortcut } from "electron";
import windowStateKeeper from "electron-window-state";
import { startBackend, stopBackend } from "./backend";
import { createTray, destroyTray } from "./tray";

const isDev = !app.isPackaged;
let mainWindow: BrowserWindow & { _forceQuit?: boolean };

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
    // 프로덕션: 백엔드 시작
    if (!isDev) {
      await startBackend();
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
      backgroundColor: "#0a0a14",
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
      },
    }) as BrowserWindow & { _forceQuit?: boolean };

    windowState.manage(mainWindow);

    // URL 로드
    const url = isDev ? "http://localhost:5173" : "http://127.0.0.1:3000";
    mainWindow.loadURL(url);

    // 닫기 → 트레이 숨기기
    mainWindow.on("close", (e) => {
      if (!mainWindow._forceQuit) {
        e.preventDefault();
        mainWindow.hide();
      }
    });

    // 트레이 생성
    createTray(mainWindow);

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

  // macOS Cmd+Q
  app.on("before-quit", () => {
    if (mainWindow) mainWindow._forceQuit = true;
  });

  // 종료 체인
  app.on("will-quit", () => {
    globalShortcut.unregisterAll();
    destroyTray();
    stopBackend();
  });

  // macOS: 독 아이콘 클릭 시 윈도우 복원
  app.on("activate", () => {
    if (mainWindow) {
      mainWindow.show();
      mainWindow.focus();
    }
  });
}
