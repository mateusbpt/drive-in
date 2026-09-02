import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import type { ScreenTrack } from "../hooks/useLiveKit";
import { palette } from "../theme";

/*
  The video covers its box rather than fitting inside it — because the box takes
  the video's own proportion, measured here. With the box locked to 16:9 and
  `contain`, a source of any other shape was left with black bars, and even when
  the shapes matched a hairline of sub-pixel rounding showed between the picture
  and the frame.

  Cropping a shared screen is still out of the question: since the box has the
  shape of the source, covering crops nothing.
*/
function ScreenVideo({
  track,
  muted,
  onRatio,
}: {
  track: ScreenTrack;
  muted: boolean;
  onRatio: (ratio: number) => void;
}) {
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    track.attach(el);

    // `resize` as well as `loadedmetadata`: whoever is sharing can switch window
    // mid-stream, and then the source changes shape without anything reloading.
    const measure = () => {
      if (el.videoWidth > 0 && el.videoHeight > 0) onRatio(el.videoWidth / el.videoHeight);
    };
    measure();
    el.addEventListener("loadedmetadata", measure);
    el.addEventListener("resize", measure);

    return () => {
      el.removeEventListener("loadedmetadata", measure);
      el.removeEventListener("resize", measure);
      track.detach(el);
    };
  }, [track, onRatio]);

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
      style={{ objectFit: "cover" }}
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
  /**
   * No frame, no glow, no rounded corner: in fullscreen you are watching the
   * film, not looking at a screen standing inside the scene.
   */
  bare?: boolean;
  track?: ScreenTrack | null;
  /** Your own preview goes out muted: the audio already leaves your speakers. */
  localPreview?: boolean;
};

/** The screen: heavy frame, scaffolding, and whatever is showing. */
export function DriveInScreen({
  children,
  legs = true,
  fill,
  bare,
  track,
  localPreview,
}: DriveInScreenProps) {
  // Either somebody is broadcasting, or the surface stays dark.
  const lit = Boolean(track);
  /*
    The proportion comes from the source, not from a constant: whoever is sharing
    may be on a monitor that is not 16:9, and the frame has to have the shape of
    what arrives.
  */
  const [ratio, setRatio] = useState<number | null>(null);
  const onRatio = useCallback((r: number) => setRatio(r), []);

  return (
    <div
      className={`relative flex flex-col items-center${fill ? " h-full justify-center" : ""}`}
    >
      {/*
        The frame dresses the picture, not the window. Stretched, it framed the
        whole gap and black bars were left inside it — in a 1920x945 window that
        was 120px on each side. The height comes from the space available and the
        width from the source's proportion; `max-w-full` only binds when the
        window is narrower than that.
      */}
      <div
        className={
          `relative overflow-hidden ${bare ? "" : "rounded-[4px] "}${
            fill ? "h-full max-w-full" : "w-full shrink-0"
          }`
        }
        style={{
          aspectRatio: ratio ?? 16 / 9,
          border: bare ? undefined : "6px solid #33445e",
          background: lit ? "transparent" : bare ? undefined : "#16233a",
          boxShadow: bare
            ? undefined
            : lit
              ? "0 0 90px rgba(150,180,220,0.16)"
              : "inset 0 0 80px rgba(0,0,0,0.5)",
        }}
      >
        {track && (
          <ScreenVideo track={track} muted={Boolean(localPreview)} onRatio={onRatio} />
        )}
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
