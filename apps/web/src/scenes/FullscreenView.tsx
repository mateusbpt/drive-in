import type { ScreenTrack } from "../hooks/useLiveKit";
import type { SessionState } from "@drive-in/shared";
import { DriveInScreen } from "../components/Screen";
import { VoiceControls } from "../components/Controls";
import { useIdleHide } from "../hooks/useIdleHide";
import { palette } from "../theme";
import { ui } from "../strings";

/** Controls fade before the tail lights: those still say who is talking. */
const CHROME_IDLE_MS = 3000;
const TAILLIGHT_IDLE_MS = 8000;

type FullscreenViewProps = {
  state: SessionState;
  currentUserId: string;
  onToggleMic: () => void;
  onExit: () => void;
  track?: ScreenTrack | null;
  localPreview?: boolean;
  /** Resolution, fps and bitrate — the same the film scene shows. */
  specs?: string;
};

/**
 * The film alone. Controls fade after a while idle and come back instantly.
 * Whoever is talking shows as a lit tail light, and that layer stays alive for
 * as long as somebody is talking: the indicator only exists while it informs.
 */
export function FullscreenView({
  state,
  currentUserId,
  onToggleMic,
  onExit,
  track,
  localPreview,
  specs,
}: FullscreenViewProps) {
  const me = state.participants.find((p) => p.userId === currentUserId);
  const speaking = state.participants.filter((p) => p.speaking);
  const silent = state.participants.length - speaking.length;
  const stage = state.stage;

  const chrome = useIdleHide(CHROME_IDLE_MS);
  // Somebody talking keeps the tail lights lit, regardless of the timer.
  const lights = useIdleHide(TAILLIGHT_IDLE_MS, speaking.length === 0);
  const lightsVisible = speaking.length > 0 || lights.visible;

  return (
    <div
      className={
        "relative h-full w-full overflow-hidden " + (chrome.visible ? "" : "cursor-hidden")
      }
    >
      <div className="absolute inset-0">
        <DriveInScreen legs={false} fill bare track={track} localPreview={localPreview} />
      </div>
      <div
        className="absolute left-7 top-6 flex items-center gap-2.5 rounded-full py-1.5 pl-3 pr-4 transition-opacity duration-[400ms]"
        style={{
          background: "rgba(6,8,14,0.5)",
          opacity: chrome.visible ? 1 : 0,
        }}
      >
        <span
          className="rounded-full"
          style={{
            width: 7,
            height: 7,
            background: palette.tail,
            boxShadow: "0 0 6px rgba(255,95,122,0.5)",
          }}
        />
        <span
          className="text-[12.5px] tracking-[0.01em]"
          style={{ color: "rgba(255,220,236,0.82)" }}
        >
          {stage.status === "occupied" ? ui.onAir.badge(stage.displayName) : ""}
        </span>
        {/* The same numbers as the other screen: they were missing here. */}
        {specs && (
          <>
            <span style={{ width: 1, height: 11, background: "rgba(255,220,236,0.22)" }} />
            <span className="font-mono text-[10.5px]" style={{ color: "#93a3bb" }}>
              {specs}
            </span>
          </>
        )}
      </div>

      <div
        className="absolute bottom-7 left-7 flex items-center gap-6 transition-opacity duration-[400ms]"
        style={{ opacity: lightsVisible ? 1 : 0 }}
      >
        {speaking.map((p) => (
          <div key={p.userId} className="flex items-center gap-3">
            <span
              className="rounded-full"
              style={{
                width: 12,
                height: 12,
                background: palette.tail,
                boxShadow: "0 0 9px rgba(255,95,122,0.7)",
              }}
            />
            <span
              className="text-[15px]"
              // The shadow replaces the gradient that darkened 168px of the
              // film: it keeps the name legible over a bright scene without
              // dimming the picture.
              style={{ color: "#f2f6fc", textShadow: "0 1px 6px rgba(0,0,0,0.9)" }}
            >
              {p.displayName}
            </span>
          </div>
        ))}
        {speaking.length > 0 && silent > 0 && (
          <span
            className="text-[12.5px]"
            style={{
              color: "rgba(219,228,240,0.55)",
              textShadow: "0 1px 6px rgba(0,0,0,0.9)",
            }}
          >
            {ui.fullscreen.silentOthers(silent)}
          </span>
        )}
      </div>

      <div
        className="absolute bottom-7 right-7 flex flex-col items-start gap-2 transition-opacity duration-[400ms]"
        style={{ opacity: chrome.visible ? 1 : 0 }}
        {...chrome.holdProps}
      >
        <span
          className="text-[9.5px] font-semibold tracking-[0.24em]"
          style={{ color: "#8794a8", textShadow: "0 1px 6px rgba(0,0,0,0.9)" }}
        >
          {ui.controls.title}
        </span>
        <VoiceControls
          micEnabled={me?.micEnabled ?? false}
          onToggleMic={onToggleMic}
          fullscreen
          onToggleFullscreen={onExit}
          onLeave={onExit}
          ghost
        />
      </div>
    </div>
  );
}
