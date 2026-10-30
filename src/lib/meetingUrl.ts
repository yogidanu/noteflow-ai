/**
 * Only https: meeting links may be rendered as clickable hrefs.
 * React does not sanitize href schemes, so a `javascript:` / `data:`
 * URL arriving via a pasted link or calendar payload must never become
 * a live anchor. Returns the normalized URL, or null when unsafe/absent.
 */
export function safeMeetingUrl(url?: string | null): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url.trim());
    return parsed.protocol === "https:" ? parsed.toString() : null;
  } catch {
    return null;
  }
}
