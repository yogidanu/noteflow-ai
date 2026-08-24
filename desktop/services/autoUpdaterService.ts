/**
 * Automatic Updates Service
 * Background update checking with signature verification & progress notification
 */

import { app, BrowserWindow } from "electron";
import { AutoUpdateStatus } from "../types/desktop";

export class AutoUpdaterService {
  private static status: AutoUpdateStatus = { status: "idle" };
  private static listeners: Array<(status: AutoUpdateStatus) => void> = [];

  public static initialize(): void {
    if (!app.isPackaged) {
      // In development mode, mock update availability safely without hitting external servers
      this.updateStatus({ status: "idle", version: app.getVersion() });
      return;
    }

    try {
      // Lazy load electron-updater only when packaged
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const updaterModule = require("electron-updater");
      const autoUpdater = updaterModule.autoUpdater || updaterModule;

      autoUpdater.autoDownload = false;
      autoUpdater.autoInstallOnAppQuit = true;

      autoUpdater.on("checking-for-update", () => {
        this.updateStatus({ status: "checking" });
      });

      autoUpdater.on("update-available", (info: any) => {
        this.updateStatus({
          status: "available",
          version: info.version,
          releaseNotes: typeof info.releaseNotes === "string" ? info.releaseNotes : undefined,
        });
      });

      autoUpdater.on("update-not-available", () => {
        this.updateStatus({ status: "not_available" });
      });

      autoUpdater.on("download-progress", (progress: any) => {
        this.updateStatus({
          status: "downloading",
          progressPercent: Math.round(progress.percent),
        });
      });

      autoUpdater.on("update-downloaded", (info: any) => {
        this.updateStatus({
          status: "downloaded",
          version: info.version,
        });
      });

      autoUpdater.on("error", (err: any) => {
        this.updateStatus({
          status: "error",
          errorMessage: err?.message || "Failed to check for updates",
        });
      });

      // Automatically check for updates on startup
      autoUpdater.checkForUpdates().catch((err: any) => {
        console.warn("[AutoUpdater] Check failed:", err);
      });
    } catch (err) {
      console.warn("[AutoUpdaterService] Auto-updater inactive or unbundled in local build:", err);
    }
  }

  public static async checkForUpdates(): Promise<AutoUpdateStatus> {
    if (!app.isPackaged) {
      return { status: "not_available", version: app.getVersion() };
    }

    try {
      const updaterModule = require("electron-updater");
      const autoUpdater = updaterModule.autoUpdater || updaterModule;
      await autoUpdater.checkForUpdates();
      return this.status;
    } catch (err: any) {
      return { status: "error", errorMessage: err?.message };
    }
  }

  public static async installDownloadedUpdate(): Promise<void> {
    if (!app.isPackaged) return;

    try {
      const updaterModule = require("electron-updater");
      const autoUpdater = updaterModule.autoUpdater || updaterModule;
      autoUpdater.quitAndInstall();
    } catch (err) {
      console.error("[AutoUpdaterService] Error quitting to install update:", err);
    }
  }

  public static onStatusChange(callback: (status: AutoUpdateStatus) => void): () => void {
    this.listeners.push(callback);
    callback(this.status);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== callback);
    };
  }

  private static updateStatus(newStatus: AutoUpdateStatus): void {
    this.status = newStatus;
    this.listeners.forEach((listener) => listener(this.status));

    // Broadcast update state to all active browser windows
    BrowserWindow.getAllWindows().forEach((win) => {
      if (!win.isDestroyed()) {
        win.webContents.send("desktop:update-status", this.status);
      }
    });
  }
}
