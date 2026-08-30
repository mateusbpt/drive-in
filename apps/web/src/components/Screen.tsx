import { useEffect, useRef, type ReactNode } from "react";
import type { ScreenTrack } from "../hooks/useLiveKit";
import { palette } from "../theme";

/** `contain` because cropping a shared screen is worse than black bars. */
function ScreenVideo({ track, muted }: { track: ScreenTrack; muted: boolean }) {
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    track.attach(el);
    return () => {
      track.detach(el);
    };
  }, [track]);

  return (
    /*
      The projection comes on: the image opens from the middle to the edges and
      the brightness settles. It used to cut from one frame to the next, with
      nothing saying the projector had been switched on.
    */
    <video
      ref={ref}
      autoPlay
      playsInline
      muted={muted}
      className="projector-on absolute inset-0 h-full w-full"
      style={{ objectFit: "contain", background: "#000" }}
    />
  );
}

type DriveInScreenProps = {
  children?: ReactNode;
  legs?: boolean;
  /**
   * Fills the parent instead of deriving height from width. Without this, a wide
   * window makes the screen taller than the space left for the parking lot.
   */
  fill?: boolean;
  track?: ScreenTrack | null;
  /** Your own preview goes out muted: the audio already leaves your speakers. */
  localPreview?: boolean;
};

/** The screen: heavy frame, scaffolding, and whatever is showing. */
export function DriveInScreen({ children, legs = true, fill, track, localPreview }: DriveInScreenProps) {
  // Either somebody is broadcasting, or the surface stays dark.
  const lit = Boolean(track);
  return (
    <div className={`relative flex flex-col items-center${fill ? " h-full" : ""}`}>
      <div
        className={
          `relative overflow-hidden rounded-[4px] ${
            fill ? "h-full w-full" : "aspect-video w-full shrink-0"
          }`
        }
        style={{
          border: "6px solid #33445e",
          background: lit ? "transparent" : "#16233a",
          boxShadow: lit
            ? "0 0 90px rgba(150,180,220,0.16)"
            : "inset 0 0 80px rgba(0,0,0,0.5)",
        }}
      >
        {track && <ScreenVideo track={track} muted={Boolean(localPreview)} />}
        {track && (
          // The flash of the first instant, over the image opening up.
          <div
            key="clarao"
            className="projector-flash pointer-events-none absolute inset-0"
            style={{ background: "#cfe0ff" }}
          />
        )}
        {lit && (
          <div
            className="pointer-events-none absolute inset-0"
            style={{ boxShadow: "inset 0 0 160px rgba(0,0,0,0.6)" }}
          />
        )}
        {children}
      </div>

      {legs && (
        <div className="flex w-full justify-center gap-[52%]">
          <div style={{ width: 22, height: 56, background: "#151d29" }} />
          <div style={{ width: 22, height: 56, background: "#151d29" }} />
        </div>
      )}
    </div>
  );
}

type OnAirBadgeProps = {
  label: string;
  specs?: string;
  /** Fades with the rest of the interface when the mouse stops. */
  visible?: boolean;
};

export function OnAirBadge({ label, specs, visible = true }: OnAirBadgeProps) {
  return (
    <div
      className="absolute left-4 top-3 flex items-center gap-2 rounded-full px-2.5 py-1 transition-opacity duration-[400ms]"
      style={{
        opacity: visible ? 1 : 0,
        background: "rgba(6,8,14,0.66)",
        border: `1px solid ${palette.line}`,
      }}
    >
      <span
        className="rounded-full"
        style={{
          width: 6,
          height: 6,
          // The red of a light in the air, not the pink left over from the old system.
          background: palette.tail,
        }}
      />
      <span
        className="text-[10.5px] font-semibold tracking-[0.04em]"
        style={{ color: palette.ink }}
      >
        {label}
      </span>
      {specs && (
        <>
          <span style={{ width: 1, height: 10, background: "rgba(255,220,236,0.22)" }} />
          <span className="font-mono text-[9.5px]" style={{ color: "#93a3bb" }}>
            {specs}
          </span>
        </>
      )}
    </div>
  );
}
