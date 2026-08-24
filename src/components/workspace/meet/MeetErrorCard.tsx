import React from "react";
import { AlertTriangle, RefreshCw, Upload, ShieldAlert, VideoOff, VolumeX } from "lucide-react";
import { MeetRecordErrorType } from "../../../types/meeting";

interface MeetErrorCardProps {
  errorReason: MeetRecordErrorType | string;
  meetingTitle?: string;
  onRetry: () => void;
  onManualUploadFallback?: () => void;
  onReconnectOAuth?: () => void;
}

export const MeetErrorCard: React.FC<MeetErrorCardProps> = ({
  errorReason,
  meetingTitle = "Meeting Session",
  onRetry,
  onManualUploadFallback,
  onReconnectOAuth,
}) => {
  const getErrorContent = () => {
    switch (errorReason) {
      case "HOST_DENIED_ENTRY":
        return {
          icon: ShieldAlert,
          title: "Host Denied Entry to NoteFlow Assistant",
          description:
            "The Google Meet organizer or host declined the assistant's request to join. The session was aborted and no partial audio was recorded.",
          actionText: "Retry Knocking",
          actionType: "retry",
        };
      case "WAITING_ROOM_TIMEOUT":
        return {
          icon: VideoOff,
          title: "Waiting Room Timeout (10 Minutes)",
          description:
            "NoteFlow Assistant waited in the Google Meet lobby for 10 minutes without being admitted by the host. The connection was safely terminated.",
          actionText: "Re-send Assistant",
          actionType: "retry",
        };
      case "OAUTH_EXPIRED":
        return {
          icon: AlertTriangle,
          title: "Google Calendar Authorization Expired",
          description:
            "Your Google Calendar OAuth session has expired or was revoked. Please reconnect to restore automated Google Meet detection.",
          actionText: "Reconnect Google Calendar",
          actionType: "oauth",
        };
      case "BOT_MUTED_SILENCE":
        return {
          icon: VolumeX,
          title: "Silence Detected (Assistant Muted)",
          description:
            "Voice Activity Detection (VAD) detected prolonged digital silence. The assistant appears to be muted in the Google Meet participant list.",
          actionText: "Resume Audio Check",
          actionType: "retry",
        };
      case "UNSUPPORTED_PLATFORM":
        return {
          icon: AlertTriangle,
          title: "Unsupported Conference Platform",
          description:
            "Meet Record MVP strictly supports Google Meet links (meet.google.com/xxx-xxxx-xxx). Zoom and Microsoft Teams will be available in Phase 2.",
          actionText: "Upload Transcript Instead",
          actionType: "upload",
        };
      default:
        return {
          icon: AlertTriangle,
          title: "Capture Ingress Interrupted",
          description:
            "A network glitch or WebRTC media stream disconnect interrupted the recording session. No data was lost.",
          actionText: "Retry Connection",
          actionType: "retry",
        };
    }
  };

  const { icon: Icon, title, description, actionText, actionType } = getErrorContent();

  return (
    <div className="p-5 rounded-2xl bg-[var(--error-surface)] border border-[var(--error-border)] text-[var(--text-primary)] space-y-4 transition-colors duration-150">
      <div className="flex items-start gap-3.5">
        <div className="p-2.5 rounded-xl bg-[var(--error-surface)] border border-[var(--error-border)] text-[var(--color-error)] shrink-0">
          <Icon className="w-5 h-5" />
        </div>
        <div className="space-y-1 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono uppercase tracking-wider text-[var(--color-error)] bg-[var(--error-surface)] px-2 py-0.5 rounded-full border border-[var(--error-border)] font-semibold">
              Error State
            </span>
            <span className="text-xs text-[var(--text-muted)] truncate max-w-[260px]">{meetingTitle}</span>
          </div>
          <h3 className="text-sm font-semibold text-[var(--text-primary)] tracking-tight">{title}</h3>
          <p className="text-xs text-[var(--text-secondary)] leading-relaxed pt-0.5">{description}</p>
        </div>
      </div>

      {/* Action Recovery Buttons */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-[var(--error-border)]">
        <div className="text-[11px] text-[var(--text-muted)]">
          Need help? You can upload an exported <code className="text-[var(--color-error)] font-mono font-medium">.vtt</code> transcript manually.
        </div>

        <div className="flex items-center gap-2">
          {onManualUploadFallback && (
            <button
              onClick={onManualUploadFallback}
              className="px-3 py-1.5 text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-card)] rounded-xl transition-colors flex items-center gap-1.5 border border-[var(--border-default)] bg-[var(--surface-subtle)] cursor-pointer shadow-2xs"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Manual Upload</span>
            </button>
          )}

          {actionType === "oauth" && onReconnectOAuth ? (
            <button
              onClick={onReconnectOAuth}
              className="px-3.5 py-1.5 text-xs font-semibold text-white bg-[var(--primary-action)] hover:bg-[var(--primary-hover)] rounded-xl shadow-xs flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>{actionText}</span>
            </button>
          ) : (
            <button
              onClick={onRetry}
              className="px-3.5 py-1.5 text-xs font-semibold text-white bg-[var(--color-error)] hover:opacity-90 rounded-xl shadow-xs flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>{actionText}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
