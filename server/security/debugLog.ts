/**
 * Debug logging gate. The verbose [OAuth DEBUG] / [RECORDING DEBUG]
 * traces are development aids; in production they stay silent unless
 * DEBUG_LOGS=true is set explicitly for a troubleshooting session.
 */
export function debugLog(...args: any[]): void {
  if (process.env.NODE_ENV !== "production" || process.env.DEBUG_LOGS === "true") {
    // eslint-disable-next-line no-console
    console.log(...args);
  }
}
