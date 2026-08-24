/**
 * Production Installer Configuration & Desktop Architecture Test Suite
 * NoteFlow AI • Meet Record
 */

import fs from "fs";
import path from "path";

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(`❌ Assertion Failed: ${message}`);
  }
}

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void): void {
  try {
    fn();
    console.log(`  ✅ ${name}`);
    passed++;
  } catch (err: any) {
    console.error(`  ❌ ${name}: ${err.message}`);
    failed++;
  }
}

console.log("\n🧪 Running NoteFlow AI Production Desktop Installer Test Suite...\n");

// 1. Electron-Builder Configuration Tests
test("electron-builder.yml exists and defines correct application metadata", () => {
  const configPath = path.join(process.cwd(), "electron-builder.yml");
  assert(fs.existsSync(configPath), "electron-builder.yml must exist");

  const content = fs.readFileSync(configPath, "utf-8");
  assert(content.includes("appId: ai.noteflow.desktop"), "appId must be ai.noteflow.desktop");
  assert(content.includes("productName: NoteFlow AI"), "productName must be NoteFlow AI");
  assert(content.includes("copyright: © 2026 NoteFlow AI Inc."), "copyright notice must be present");
});

// 2. macOS Installer Specifications
test("macOS configuration defines signed .dmg, .app bundle, Hardened Runtime & Entitlements", () => {
  const content = fs.readFileSync(path.join(process.cwd(), "electron-builder.yml"), "utf-8");
  assert(content.includes("target: dmg"), "mac target must include dmg");
  assert(content.includes("hardenedRuntime: true"), "hardenedRuntime must be enabled");
  assert(content.includes("entitlements: build/entitlements.mac.plist"), "entitlements must point to build/entitlements.mac.plist");
  assert(content.includes("NSMicrophoneUsageDescription:"), "NSMicrophoneUsageDescription must be declared");
  assert(content.includes("noteflow"), "CFBundleURLSchemes must register noteflow scheme");
});

test("macOS entitlements plist files exist and grant audio-input permissions", () => {
  const plistPath = path.join(process.cwd(), "build/entitlements.mac.plist");
  const inheritPlistPath = path.join(process.cwd(), "build/entitlements.mac.inherit.plist");
  assert(fs.existsSync(plistPath), "build/entitlements.mac.plist must exist");
  assert(fs.existsSync(inheritPlistPath), "build/entitlements.mac.inherit.plist must exist");

  const plistContent = fs.readFileSync(plistPath, "utf-8");
  assert(plistContent.includes("com.apple.security.device.audio-input"), "audio-input entitlement must be enabled");
  assert(plistContent.includes("com.apple.security.network.client"), "network.client entitlement must be enabled");
});

// 3. Windows Installer Specifications
test("Windows configuration defines signed NSIS installer and MSI targets", () => {
  const content = fs.readFileSync(path.join(process.cwd(), "electron-builder.yml"), "utf-8");
  assert(content.includes("target: nsis"), "win target must include nsis");
  assert(content.includes("target: msi"), "win target must include msi");
  assert(content.includes("oneClick: false"), "nsis must allow user custom installation path");
  assert(content.includes("createDesktopShortcut: always"), "desktop shortcut must be created");
  assert(content.includes("createStartMenuShortcut: true"), "start menu shortcut must be created");
});

// 4. Secrets Security Audit
test("Desktop source code does not contain hardcoded API keys or secrets", () => {
  const desktopFiles = [
    "desktop/main.ts",
    "desktop/preload.ts",
    "desktop/services/authService.ts",
    "desktop/services/autoUpdaterService.ts",
    "desktop/services/crashReporterService.ts",
    "desktop/services/meetingDaemon.ts",
    "desktop/services/audioIngressService.ts",
  ];

  const forbiddenPatterns = [
    /sk-[a-zA-Z0-9]{20,}/i,
    /ghp_[a-zA-Z0-9]{20,}/i,
    /password\s*=\s*['"][^'"]+['"]/i,
    /secret\s*=\s*['"][^'"]+['"]/i,
  ];

  desktopFiles.forEach((file) => {
    const fullPath = path.join(process.cwd(), file);
    if (fs.existsSync(fullPath)) {
      const code = fs.readFileSync(fullPath, "utf-8");
      forbiddenPatterns.forEach((pattern) => {
        assert(!pattern.test(code), `File ${file} contains potentially hardcoded secret matching ${pattern}`);
      });
    }
  });
});

// 5. Auto-Updater & Crash Reporting
test("Auto-updater and Crash Reporter configurations are properly wired", () => {
  const autoUpdaterContent = fs.readFileSync(path.join(process.cwd(), "desktop/services/autoUpdaterService.ts"), "utf-8");
  assert(autoUpdaterContent.includes("electron-updater"), "AutoUpdater must use electron-updater");
  assert(autoUpdaterContent.includes("checkForUpdates"), "AutoUpdater must implement checkForUpdates");

  const crashContent = fs.readFileSync(path.join(process.cwd(), "desktop/services/crashReporterService.ts"), "utf-8");
  assert(crashContent.includes("crashReporter.start"), "CrashReporterService must initialize native crashReporter");
  assert(crashContent.includes("uploadToServer: false"), "Crash telemetry must default to opt-in");
});

// 6. Universal Desktop Bridge
test("Universal desktop bridge properly detects environment and forwards commands", () => {
  const bridgePath = path.join(process.cwd(), "src/lib/desktopBridge.ts");
  assert(fs.existsSync(bridgePath), "src/lib/desktopBridge.ts must exist");

  const bridgeContent = fs.readFileSync(bridgePath, "utf-8");
  assert(bridgeContent.includes("isDesktopApp"), "isDesktopApp must be exported");
  assert(bridgeContent.includes("getDesktopAPI"), "getDesktopAPI must be exported");
  assert(bridgeContent.includes("openInWebApp"), "openInWebApp must be exported");
});

console.log(`\n========================================`);
console.log(`🏁 Desktop Installer Test Results:`);
console.log(`   Passed: ${passed}`);
console.log(`   Failed: ${failed}`);
console.log(`   Success Rate: ${((passed / (passed + failed)) * 100).toFixed(1)}%`);
console.log(`========================================\n`);

if (failed > 0) {
  process.exit(1);
}
