/**
 * Crash Reporter & Diagnostics Service
 * Native Electron crashReporter configuration with sanitized telemetry
 */

import { crashReporter, app } from "electron";
import { CrashReportConfig } from "../types/desktop";

export class CrashReporterService {
  private static isInitialized = false;

  public static initialize(config?: Partial<CrashReportConfig>): void {
    if (this.isInitialized) return;

    const finalConfig: CrashReportConfig = {
      submitURL: "https://telemetry.noteflow.ai/api/v1/crashes",
      uploadToServer: false, // Default to false until user explicitly opts in
      companyName: "NoteFlow AI Inc.",
      productName: "NoteFlow AI Desktop",
      ...config,
    };

    try {
      crashReporter.start({
        submitURL: finalConfig.submitURL,
        uploadToServer: finalConfig.uploadToServer,
        compress: true,
        companyName: finalConfig.companyName,
        productName: finalConfig.productName,
        extra: {
          app_version: app.getVersion(),
          platform: process.platform,
          arch: process.arch,
          session_started_at: new Date().toISOString(),
          // STRICT SECURITY: Zero API keys, passwords, or raw audio data are permitted in extra payload
        },
      });

      this.isInitialized = true;
    } catch (err) {
      console.warn("[CrashReporterService] Failed to initialize native crash reporter:", err);
    }
  }

  public static setUploadConsent(consent: boolean): void {
    try {
      crashReporter.setUploadToServer(consent);
    } catch (err) {
      console.warn("[CrashReporterService] Error setting upload consent:", err);
    }
  }
}
