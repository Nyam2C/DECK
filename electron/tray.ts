import { app, Tray, Menu, type BrowserWindow, nativeImage } from "electron";
import { resolve } from "node:path";

let tray: Tray | null = null;

export function createTray(mainWindow: BrowserWindow): void {
  const iconPath = resolve(__dirname, "../icons/tray.png");
  const icon = nativeImage.createFromPath(iconPath);
  tray = new Tray(icon);
  tray.setToolTip("DECK");

  const contextMenu = Menu.buildFromTemplate([
    {
      label: "DECK 열기",
      click: () => {
        mainWindow.show();
        mainWindow.focus();
      },
    },
    {
      label: "숨기기",
      click: () => {
        mainWindow.hide();
      },
    },
    { type: "separator" },
    {
      label: "종료",
      click: () => {
        mainWindow.destroy();
        app.quit();
      },
    },
  ]);

  tray.setContextMenu(contextMenu);

  tray.on("double-click", () => {
    mainWindow.show();
    mainWindow.focus();
  });
}

export function destroyTray(): void {
  if (tray) {
    tray.destroy();
    tray = null;
  }
}
