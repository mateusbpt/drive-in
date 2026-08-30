import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  LuLogOut,
  LuMaximize,
  LuMic,
  LuMicOff,
  LuMinimize,
  LuMonitor,
  LuListMusic,
  LuMonitorOff,
  LuVolume2,
  LuVolumeX,
} from "react-icons/lu";
import { useVolumes } from "../hooks/useVolumes";
import { palette } from "../theme";
import { ui } from "../strings";

type IconButtonProps = {
  label: string;
  onClick?: () => void;
  children: ReactNode;
  quiet?: boolean;
  ghost?: boolean;
};

export function IconButton({ label, onClick, children, quiet, ghost }: IconButtonProps) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={onClick}
      className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-lg transition-colors"
      style={{
        background: ghost ? "rgba(8,11,17,0.6)" : quiet ? "transparent" : palette.surface,
        border: `1px solid ${ghost ? "rgba(219,228,240,0.14)" : palette.line}`,
        color: quiet ? palette.dim : "#c3cede",
      }}
    >
      {children}
    </button>
  );
}

type SliderProps = {
  label: string;
  value: number;
  onChange: (value: number) => void;
  /** Film and voices go to 150%; YouTube's music stops at 100. */
  max?: number;
};

function VolumeSlider({ label, value, onChange, max = 1.5 }: SliderProps) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="flex items-baseline justify-between">
        <span className="text-[12px]" style={{ color: palette.ink }}>
          {label}
        </span>
        <span className="font-mono text-[11px]" style={{ color: palette.faint }}>
          {value === 0 ? ui.controls.muted : Math.round(value * 100) + "%"}
        </span>
      </span>
      <input
        type="range"
        min={0}
        max={max}
        step={0.05}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-1 w-full cursor-pointer appearance-none rounded-full"
        style={{
          background:
            `linear-gradient(90deg, ${palette.cyan} ${(value / max) * 100}%, ` +
          `${palette.line} ${(value / max) * 100}%)`,
          accentColor: palette.cyan,
        }}
      />
    </label>
  );
}

type VolumePopoverProps = {
  ghost?: boolean;
  /** With nobody projecting there is no film to adjust. */
  showMovie?: boolean;
};

/** Goes to 150%: a quiet film is common, and turning everyone down is the wrong fix. */
function VolumePopover({ ghost, showMovie = true }: VolumePopoverProps) {
  const { volumes, setMovieVolume, setVoiceVolume, others, musicVolume, setMusicVolume, musicOn } =
    useVolumes();
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => {
      if (!box.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", away);
    return () => document.removeEventListener("pointerdown", away);
  }, [open]);

  // With no film and nobody else, nothing is muted — there is just nothing to
  // adjust. Music counts: with it on the card, the empty-room notice made no sense.
  const hasAnything = showMovie || musicOn || others.length > 0;
  const silent =
    hasAnything &&
    (!musicOn || musicVolume === 0) &&
    (!showMovie || volumes.movie === 0) &&
    others.every((p) => (volumes.voices[p.userId] ?? 1) === 0);

  return (
    <div ref={box} className="relative">
      <IconButton label={ui.controls.volume} onClick={() => setOpen((v) => !v)} ghost={ghost}>
        {silent ? <LuVolumeX size={19} /> : <LuVolume2 size={19} />}
      </IconButton>

      {open && (
        <div
          /*
            Anchored to the right: centred on the button, it spilled off screen
            whenever the controls sit tight against the edge.
          */
          className="absolute bottom-[calc(100%+10px)] right-0 z-20 flex max-h-[60vh] w-[224px] flex-col gap-3.5 overflow-y-auto rounded-xl p-4"
          style={{
            background: "rgba(10,14,20,0.96)",
            border: `1px solid ${palette.line}`,
            boxShadow: "0 18px 48px rgba(0,0,0,0.6)",
          }}
        >
          {showMovie && (
            <VolumeSlider
              label={ui.controls.movieVolume}
              value={volumes.movie}
              onChange={setMovieVolume}
            />
          )}

          {/* DJ mode music lives on the same scale as the rest: 0 to 1.5. */}
          {musicOn && (
            <VolumeSlider
              label={ui.controls.musicVolume}
              value={musicVolume / 100}
              max={1}
              onChange={(v) => setMusicVolume(Math.round(v * 100))}
            />
          )}

          {!hasAnything && (
            <span className="text-[12.5px]" style={{ color: palette.faint }}>
              {ui.controls.aloneInRoom}
            </span>
          )}

          {others.length > 0 && (
            <>
              {/*
                Always on the left, like the other labels. The left rule used to
                depend on whether the film volume was showing, so the title came
                out centred on one screen and flush left on the next.
              */}
              <div className="flex items-center gap-2">
                <span
                  className="text-[10.5px] font-semibold tracking-[0.06em]"
                  style={{ color: palette.faint }}
                >
                  {ui.controls.voiceVolume}
                </span>
                <span style={{ height: 1, flexGrow: 1, background: palette.line }} />
              </div>

              {others.map((p) => (
                <VolumeSlider
                  key={p.userId}
                  label={p.displayName}
                  value={volumes.voices[p.userId] ?? 1}
                  onChange={(v) => setVoiceVolume(p.userId, v)}
                />
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}

type VoiceControlsProps = {
  micEnabled: boolean;
  onToggleMic: () => void;
  fullscreen: boolean;
  onToggleFullscreen: () => void;
  onLeave: () => void;
  ghost?: boolean;
  showFullscreen?: boolean;
};

export function VoiceControls({
  micEnabled,
  onToggleMic,
  fullscreen,
  onToggleFullscreen,
  onLeave,
  ghost,
  showFullscreen = true,
}: VoiceControlsProps) {
  return (
    <div className="flex items-center gap-2.5">
      <IconButton
        label={micEnabled ? ui.controls.mic : ui.controls.micOff}
        onClick={onToggleMic}
        ghost={ghost}
      >
        {micEnabled ? <LuMic size={19} /> : <LuMicOff size={19} />}
      </IconButton>

      <VolumePopover ghost={ghost} showMovie={showFullscreen} />

      {showFullscreen && (
        <IconButton
          label={fullscreen ? ui.controls.exitFullscreen : ui.controls.enterFullscreen}
          onClick={onToggleFullscreen}
          ghost={ghost}
        >
          {fullscreen ? <LuMinimize size={19} /> : <LuMaximize size={19} />}
        </IconButton>
      )}

      {!ghost && (
        <IconButton label={ui.controls.leave} onClick={onLeave} quiet>
          <LuLogOut size={19} />
        </IconButton>
      )}
    </div>
  );
}

/**
 * The way into DJ mode, on the same spec as the projector button: the two sit
 * side by side on the dashboard, and separate measurements would drift apart again.
 */
export function DjModeButton({ onClick, scale = 1 }: { onClick: () => void; scale?: number }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex cursor-pointer items-center font-semibold uppercase transition-colors hover:brightness-110"
      style={{
        height: 44 * scale,
        paddingInline: 16 * scale,
        gap: 8 * scale,
        borderRadius: 8 * scale,
        fontSize: 10.5 * scale,
        letterSpacing: 1.68 * scale,
        background: palette.surface,
        border: `${Math.max(1, scale)}px solid ${palette.line}`,
        color: palette.dim,
      }}
    >
      <LuListMusic size={16 * scale} />
      {ui.dj.enter}
    </button>
  );
}

type StageButtonProps = {
  mode: "take" | "release";
  onClick: () => void;
  /**
   * Counter-scale for whoever draws this button inside the SVG scene, which
   * shrinks and grows with the window. Given the inverse of the scene's scale,
   * the button comes out the size of the controls, which are pinned to the corner.
   */
  scale?: number;
};

export function StageButton({ mode, onClick, scale = 1 }: StageButtonProps) {
  const take = mode === "take";

  /*
    One spec for both: same height, same radius, same padding, and the scene's
    label typography — uppercase, weight 600, wide tracking. Written separately,
    they drifted apart in height and corner radius. The only difference is the
    background, because one sits on the dashboard and the other over the film.
  */
  const k = scale;

  return (
    <button
      type="button"
      onClick={onClick}
      className={
        "flex cursor-pointer items-center font-semibold uppercase transition-colors " +
        (take ? "hover:brightness-110" : "")
      }
      style={{
        height: 44 * k,
        paddingInline: 16 * k,
        gap: 8 * k,
        borderRadius: 8 * k,
        fontSize: 10.5 * k,
        letterSpacing: 1.68 * k,
        background: take ? palette.surface : "rgba(8,11,17,0.6)",
        border: `${Math.max(1, k)}px solid ${palette.line}`,
        color: palette.dim,
      }}
    >
      {take ? <LuMonitor size={16 * k} /> : <LuMonitorOff size={16 * k} />}
      {take ? ui.lot.take : ui.lot.release}
    </button>
  );
}
