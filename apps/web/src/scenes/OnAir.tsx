import type { ScreenTrack } from "../hooks/useLiveKit";
import { ROOM_CAPACITY, type SessionState } from "@drive-in/shared";
import { LuUsers } from "react-icons/lu";
import { NightSky, Landscape } from "../components/Landscape";
import { CarSlot } from "../components/Car";
import { DriveInScreen, OnAirBadge } from "../components/Screen";
import { StageButton, VoiceControls } from "../components/Controls";
import { palette } from "../theme";
import { ui } from "../strings";
import { formatStats, useScreenStats } from "../hooks/useScreenStats";
import { useIdleHide } from "../hooks/useIdleHide";

// The row shrinks: with the film rolling, the screen is the subject.
const SCENE_W = 1280;
const SCENE_H = 720;
const LOT_HEIGHT = 150;
const CAR_SCALE = 0.4;
const BADGE_IDLE_MS = 3000;

type OnAirProps = {
  state: SessionState;
  currentUserId: string;
  onReleaseStage: () => void;
  onToggleMic: () => void;
  onToggleFullscreen: () => void;
  onLeave: () => void;
  /** Absent in design validation, present in the real app. */
  track?: ScreenTrack | null;
  localPreview?: boolean;
};

/** The screen takes the window and the cars become a strip: who is here. */
export function OnAir({
  state,
  currentUserId,
  onReleaseStage,
  onToggleMic,
  onToggleFullscreen,
  onLeave,
  track,
  localPreview,
}: OnAirProps) {
  const me = state.participants.find((p) => p.userId === currentUserId);
  const stats = useScreenStats(track ?? null);
  const bays = Array.from({ length: ROOM_CAPACITY }, (_, i) => state.participants[i]);
  const stage = state.stage;
  const iAmOnStage = stage.status === "occupied" && stage.userId === currentUserId;
  // The badge fades when the mouse stops, same as in fullscreen.
  const chrome = useIdleHide(BADGE_IDLE_MS);

  return (
    <div className="relative h-full overflow-hidden" style={{ background: palette.night }}>
      {/* The same landscape as the in-car scene, so the change does not jump. */}
      <svg
        viewBox={`0 0 ${SCENE_W} ${SCENE_H}`}
        preserveAspectRatio="xMidYMid slice"
        className="absolute inset-0 h-full w-full"
      >
        <defs>
          <NightSky id="sky-on-air" />
        </defs>
        <rect width={SCENE_W} height={SCENE_H} fill="url(#sky-on-air)" />
        <Landscape width={SCENE_W} horizon={SCENE_H - 168} until={SCENE_H} />
      </svg>

      {/* With something playing, the set recedes so the screen becomes the focus. */}
      <div className="pointer-events-none absolute inset-0" style={{ background: "rgba(3,5,9,0.62)" }} />

      {/* The light the screen throws onto the lot just below it. */}
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0"
        style={{
          height: LOT_HEIGHT + 80,
          background:
            "linear-gradient(180deg, rgba(143,166,200,0.14) 0%, rgba(143,166,200,0) 100%)",
        }}
      />

      {/* The screen takes the scene; the row and the controls sit over it. */}
      <main className="absolute inset-x-4 top-4" style={{ bottom: LOT_HEIGHT - 10 }}>
        <div className="mx-auto flex h-full items-center justify-center">
          {/* In a small window the screen shrinks too, rather than squeezing the rest. */}
            <div className="aspect-video h-full max-h-[94%] w-auto max-w-[92%] sm:max-h-full sm:max-w-full">
            <DriveInScreen fill track={track} localPreview={localPreview}>
              <OnAirBadge
                visible={chrome.visible}
                label={
                  iAmOnStage
                    ? ui.onAir.you
                    : ui.onAir.badge(stage.status === "occupied" ? stage.displayName : "")
                }
                specs={formatStats(stats)}
              />
            </DriveInScreen>
          </div>
        </div>
      </main>

      {/* Who is in the room, small and to the left: the screen is the subject. */}
      <div
        className="absolute bottom-4 left-6 flex items-end gap-3"
        style={{ height: LOT_HEIGHT - 16 }}
      >
        {bays.map((participant, i) => (
          <CarSlot
            key={participant?.userId ?? "empty-" + i}
            participant={participant}
            paint={participant?.paint ?? i}
            isYou={participant?.userId === currentUserId}
            scale={CAR_SCALE}
            compact
          />
        ))}
      </div>


      {/* The room count, on the opposite side from the row. */}
      <div
        className="absolute right-6 top-6 flex items-center gap-2 rounded-full px-3 py-1.5"
        style={{ background: "rgba(10,14,20,0.7)", border: `1px solid ${palette.line}` }}
      >
        <LuUsers size={14} color={palette.faint} />
        <span className="text-[12.5px]" style={{ color: palette.dim }}>
          {ui.lot.occupancy(state.participants.length, ROOM_CAPACITY)}
        </span>
      </div>

      {/* Controls in the opposite corner, with fullscreen and release. */}
      <div className="absolute bottom-6 right-6 flex flex-col items-start gap-2">
        <span
          className="text-[9.5px] font-semibold tracking-[0.24em]"
          style={{ color: "#3a4656" }}
        >
          {ui.controls.title}
        </span>
        <div className="flex items-center gap-3">
          {iAmOnStage && <StageButton mode="release" onClick={onReleaseStage} />}
          <VoiceControls
            micEnabled={me?.micEnabled ?? false}
            onToggleMic={onToggleMic}
            fullscreen={false}
            onToggleFullscreen={onToggleFullscreen}
            onLeave={onLeave}
          />
        </div>
      </div>
    </div>
  );
}
