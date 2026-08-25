/**
 * Universal Desktop Bridge
 * Exposes helper methods for React components to interact with native desktop features
 */

import { DesktopAPI, DesktopAuthSession } from "../../desktop/types/desktop";
import { APP_URL } from "../config/appConfig";

export const isDesktopApp = (): boolean => {
  return typeof window !== "undefined" && typeof window.noteFlowDesktop !== "undefined";
};

export const getDesktopAPI = (): DesktopAPI | null => {
  if (isDesktopApp()) {
    return window.noteFlowDesktop!;
  }
  return null;
};

export const openInWebApp = async (route = "/"): Promise<void> => {
  const desktop = getDesktopAPI();
  if (desktop) {
    await desktop.openWebApp(route);
  } else {
    const cleanRoute = route.startsWith("/") ? route : `/${route}`;
    window.open(`${APP_URL}${cleanRoute}`, "_blank");
  }
};

export const desktopBridge = {
  isDesktop: isDesktopApp,
  getAPI: getDesktopAPI,
  openInWebApp,
  loginWithPKCE: async (): Promise<DesktopAuthSession | null> => {
    const desktop = getDesktopAPI();
    if (desktop?.loginWithPKCE) {
      return desktop.loginWithPKCE();
    }
    return null;
  },
  getSession: async (): Promise<DesktopAuthSession | null> => {
    const desktop = getDesktopAPI();
    if (desktop?.getSession) {
      return desktop.getSession();
    }
    return null;
  },
  logout: async (): Promise<void> => {
    const desktop = getDesktopAPI();
    if (desktop?.logout) {
      await desktop.logout();
    }
  },
};
