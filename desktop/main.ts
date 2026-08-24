/**
 * NoteFlow AI • Meet Record Desktop Companion
 * Main Electron Process Entry Point
 */

import {
  app,
  BrowserWindow,
  ipcMain,
  Tray,
  Menu,
  nativeImage,
  shell,
  dialog,
} from "electron";
import path from "path";
import { AuthService } from "./services/authService";
import { MeetingDaemon } from "./services/meetingDaemon";
import { NotificationService } from "./services/notificationService";
import { AudioIngressService } from "./services/audioIngressService";
import { AutoUpdaterService } from "./services/autoUpdaterService";
import { CrashReporterService } from "./services/crashReporterService";

// Register custom deep link scheme
if ((process as any).defaultApp) {
  if (process.argv.length >= 2) {
    app.setAsDefaultProtocolClient("noteflow", process.execPath, [
      path.resolve(process.argv[1]),
    ]);
  }
} else {
  app.setAsDefaultProtocolClient("noteflow");
}

class NoteFlowDesktopApp {
  private mainWindow: BrowserWindow | null = null;
  private tray: Tray | null = null;
  private isQuitting = false;

  public async init(): Promise<void> {
    // Single instance lock to prevent duplicate tray/recording processes
    const gotSingleInstanceLock = app.requestSingleInstanceLock();
    if (!gotSingleInstanceLock) {
      app.quit();
      return;
    }

    app.on("second-instance", (_, commandLine) => {
      // Windows deep linking via argv
      const deepLink = commandLine.find((arg) => arg.startsWith("noteflow://"));
      if (deepLink) {
        this.handleDeepLink(deepLink);
      }

      if (this.mainWindow) {
        if (this.mainWindow.isMinimized()) this.mainWindow.restore();
        this.mainWindow.show();
        this.mainWindow.focus();
      }
    });

    // macOS deep linking via open-url event
    app.on("open-url", (event, url) => {
      event.preventDefault();
      this.handleDeepLink(url);
    });

    await app.whenReady();

    // 1. Initialize diagnostics & crash reporting
    CrashReporterService.initialize();

    // 2. Initialize auto-updater
    AutoUpdaterService.initialize();

    // 3. Create Tray icon & menu
    this.createTray();

    // 4. Create Main Workspace Window
    await this.createMainWindow();

    // 5. Register IPC Handlers
    this.registerIPCHandlers();

    // 6. Start Background Meeting Daemon
    MeetingDaemon.start();

    // App Lifecycle
    app.on("activate", () => {
      if (this.mainWindow === null) {
        this.createMainWindow();
      } else {
        this.mainWindow.show();
      }
    });

    app.on("before-quit", () => {
      this.isQuitting = true;
      MeetingDaemon.stop();
    });
  }

  private async createMainWindow(): Promise<void> {
    const preloadPath = path.join(__dirname, "preload.js");

    this.mainWindow = new BrowserWindow({
      width: 1280,
      height: 840,
      minWidth: 960,
      minHeight: 640,
      title: "NoteFlow AI • Meet Record",
      show: true,
      backgroundColor: "#F8F9FA",
      webPreferences: {
        preload: preloadPath,
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: false, // Allows contextBridge preload script to safely expose API
      },
    });

    // In dev mode load dev server, in prod load built index.html
    const isDev = !app.isPackaged;
    if (isDev && process.env.VITE_DEV_SERVER_URL) {
      await this.mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
    } else if (isDev) {
      const indexPath = path.join(app.getAppPath(), "dist/index.html");
      await this.mainWindow.loadFile(indexPath);
    } else {
      const indexPath = path.join(app.getAppPath(), "dist/index.html");
      await this.mainWindow.loadFile(indexPath);
    }

    this.mainWindow.on("close", (event) => {
      // Background daemon behavior: close window minimizes to tray instead of quitting
      if (!this.isQuitting) {
        event.preventDefault();
        this.mainWindow?.hide();
      }
    });
  }

  private createTray(): void {
    const icon = nativeImage.createEmpty();
    this.tray = new Tray(icon);
    this.tray.setToolTip("NoteFlow AI • Meet Record (Running in background)");

    const contextMenu = Menu.buildFromTemplate([
      {
        label: "Open NoteFlow AI",
        click: () => {
          this.mainWindow?.show();
          this.mainWindow?.focus();
        },
      },
      {
        label: "Check for Updates...",
        click: async () => {
          const status = await AutoUpdaterService.checkForUpdates();
          if (status.status === "not_available") {
            dialog.showMessageBox({
              type: "info",
              title: "Up to Date",
              message: `NoteFlow AI is up to date (Version ${app.getVersion()}).`,
            });
          }
        },
      },
      { type: "separator" },
      {
        label: "Quit NoteFlow AI",
        click: () => {
          this.isQuitting = true;
          app.quit();
        },
      },
    ]);

    this.tray.setContextMenu(contextMenu);
    this.tray.on("click", () => {
      this.mainWindow?.show();
    });
  }

  private registerIPCHandlers(): void {
    // Auth & Session
    ipcMain.handle("desktop:login-pkce", async () => {
      await AuthService.startPKCELogin();
      return AuthService.getSession();
    });

    ipcMain.handle("desktop:get-session", async () => {
      return AuthService.getSession();
    });

    ipcMain.handle("desktop:logout", async () => {
      await AuthService.logout();
    });

    // Calendar & Meeting Detection
    ipcMain.handle("desktop:sync-calendar", async () => {
      return MeetingDaemon.pollUpcomingMeetings();
    });

    ipcMain.handle("desktop:approve-recording", async (_, meetingId: string) => {
      return MeetingDaemon.approveRecording(meetingId);
    });

    // Recording & Audio Ingress
    ipcMain.handle("desktop:start-recording", async (_, meetingId: string) => {
      return AudioIngressService.startRecording(meetingId);
    });

    ipcMain.handle("desktop:pause-recording", async () => {
      return AudioIngressService.pauseRecording();
    });

    ipcMain.handle("desktop:resume-recording", async () => {
      return AudioIngressService.resumeRecording();
    });

    ipcMain.handle("desktop:stop-recording", async () => {
      const result = AudioIngressService.stopRecording();
      NotificationService.showSummaryReadyAlert(
        "Sprint Planning & Q3 Roadmap",
        2,
        3,
        () => {
          this.mainWindow?.show();
          this.mainWindow?.focus();
        }
      );
      return result;
    });

    // Web App & Navigation
    ipcMain.handle("desktop:open-web-app", async (_, route = "/") => {
      const { baseUrl } = AuthService.getEnvironment();
      await shell.openExternal(`${baseUrl}${route}`);
    });

    ipcMain.handle("desktop:minimize-to-tray", async () => {
      this.mainWindow?.hide();
    });

    // Auto-Updates
    ipcMain.handle("desktop:check-updates", async () => {
      return AutoUpdaterService.checkForUpdates();
    });

    ipcMain.handle("desktop:install-update", async () => {
      await AutoUpdaterService.installDownloadedUpdate();
    });

    // Platform Diagnostics
    ipcMain.handle("desktop:get-platform-info", async () => {
      const envInfo = AuthService.getEnvironment();
      return {
        platform: process.platform as "darwin" | "win32",
        arch: process.arch,
        version: app.getVersion(),
        isPackaged: app.isPackaged,
        environment: envInfo.environmentName,
        authBaseUrl: envInfo.baseUrl,
      };
    });
  }

  private async handleDeepLink(url: string): Promise<void> {
    if (url.startsWith("noteflow://auth/callback")) {
      const session = await AuthService.handleAuthCallback(url);
      if (session && this.mainWindow) {
        this.mainWindow.webContents.send("desktop:auth-success", session);
        this.mainWindow.show();
      }
    }
  }
}

const desktopApp = new NoteFlowDesktopApp();
desktopApp.init();
