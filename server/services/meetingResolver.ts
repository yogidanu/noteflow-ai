import { computeMeetingHash } from "../security/crypto.js";

export type SupportedPlatform = "google_meet" | "zoom" | "teams" | "unsupported";

export interface PlatformCapabilities {
  supportsHeadlessBot: boolean;
  supportsNativeCloudRecording: boolean;
  supportsLiveStreaming: boolean;
  requiresHostAdmission: boolean;
}

export interface IMeetingResolver {
  platformId: SupportedPlatform;
  matchUrl(url: string): boolean;
  extractMeetingId(url: string): string | null;
  canonicalizeUrl(url: string): string;
  getCapabilities(): PlatformCapabilities;
}

/**
 * Google Meet Resolver (MVP Primary)
 * Regex pattern: https://meet.google.com/abc-defg-hij
 */
export class GoogleMeetResolver implements IMeetingResolver {
  public platformId: SupportedPlatform = "google_meet";
  private regex = /^https?:\/\/meet\.google\.com\/([a-z]{3}-[a-z]{4}-[a-z]{3})(?:\?.*)?$/i;

  public matchUrl(url: string): boolean {
    return this.regex.test(url.trim());
  }

  public extractMeetingId(url: string): string | null {
    const match = url.trim().match(this.regex);
    return match ? match[1].toLowerCase() : null;
  }

  public canonicalizeUrl(url: string): string {
    const meetId = this.extractMeetingId(url);
    return meetId ? `https://meet.google.com/${meetId}` : url.trim();
  }

  public getCapabilities(): PlatformCapabilities {
    return {
      supportsHeadlessBot: true,
      supportsNativeCloudRecording: false,
      supportsLiveStreaming: false,
      requiresHostAdmission: true,
    };
  }
}

/**
 * Zoom Resolver (Roadmap Phase 2)
 */
export class ZoomResolver implements IMeetingResolver {
  public platformId: SupportedPlatform = "zoom";
  private regex = /^https?:\/\/([a-z0-9-]+\.)?zoom\.us\/(?:j|my)\/(\d{9,11})(?:\?.*)?$/i;

  public matchUrl(url: string): boolean {
    return this.regex.test(url.trim());
  }

  public extractMeetingId(url: string): string | null {
    const match = url.trim().match(this.regex);
    return match ? match[2] : null;
  }

  public canonicalizeUrl(url: string): string {
    const zoomId = this.extractMeetingId(url);
    return zoomId ? `https://zoom.us/j/${zoomId}` : url.trim();
  }

  public getCapabilities(): PlatformCapabilities {
    return {
      supportsHeadlessBot: true,
      supportsNativeCloudRecording: true,
      supportsLiveStreaming: true,
      requiresHostAdmission: true,
    };
  }
}

/**
 * Resolver Registry
 */
export class MeetingPlatformRegistry {
  private resolvers: IMeetingResolver[] = [
    new GoogleMeetResolver(),
    new ZoomResolver(),
  ];

  public resolve(url: string): {
    platform: SupportedPlatform;
    meetingId: string | null;
    canonicalUrl: string;
    dedupHash: string;
    capabilities: PlatformCapabilities;
  } {
    for (const resolver of this.resolvers) {
      if (resolver.matchUrl(url)) {
        const meetingId = resolver.extractMeetingId(url);
        const canonicalUrl = resolver.canonicalizeUrl(url);
        const dedupHash = computeMeetingHash(canonicalUrl);

        return {
          platform: resolver.platformId,
          meetingId,
          canonicalUrl,
          dedupHash,
          capabilities: resolver.getCapabilities(),
        };
      }
    }

    return {
      platform: "unsupported",
      meetingId: null,
      canonicalUrl: url.trim(),
      dedupHash: computeMeetingHash(url),
      capabilities: {
        supportsHeadlessBot: false,
        supportsNativeCloudRecording: false,
        supportsLiveStreaming: false,
        requiresHostAdmission: false,
      },
    };
  }
}

export const platformRegistry = new MeetingPlatformRegistry();
