import { ROOM_CAPACITY, type SessionState } from "@drive-in/shared";
import { useState } from "react";
import {
  LuMicOff,
  LuMusic,
  LuPause,
  LuPlay,
  LuPlus,
  LuSkipBack,
  LuSkipForward,
  LuX,
} from "react-icons/lu";
import { LatencyBars } from "../components/Car";
import { useYouTube, expectedPosition } from "../hooks/useYouTube";
import { carPaints, palette } from "../theme";
import { ui } from "../strings";

/*
  DJ mode: the car's dashboard taking the whole screen. It is the same box as in
  the idle room — `#0e1721`, rounded corner, uppercase header at 0.22em tracking,
  a `#1e2836` rule and 13.5px lines — except that here it is the screen, and two
  apps live inside it: the music and the room.

  The queue has no owner: whoever is in the room adds, removes, skips and pauses.
  The video never passes through our media server — each browser loads the same
  id in the YouTube player and puts itself at the second the server dictates.
*/

type DjPanelProps = {
  state: SessionState;
  currentUserId: string;
  onAdd: (url: string) => void;
  onRemove: (id: string) => void;
  onClear: () => void;
  /** Comes from the controls: the volume button owns it. */
  volume: number;
  onPlay: (index: number) => void;
  onToggle: () => void;
  onSkip: (delta: number) => void;
  onEnded: (index: number) => void;
};

function clock(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export function DjPanel({
  state,
  currentUserId,
  onAdd,
  onRemove,
  onClear,
  volume,
  onPlay,
  onToggle,
  onSkip,
  onEnded,
}: DjPanelProps) {
  const { dj } = state;
  const [link, setLink] = useState("");
  const current = dj.playback ? dj.queue[dj.playback.index] : undefined;
  /*
    The transport follows the position in the queue, not merely its existence: on
    the first track there is nowhere to go back to, on the last nowhere to go.
    Both used to answer clicks and the server discarded the command in silence.
  */
  const hasPrevious = dj.playback !== undefined && dj.playback.index > 0;
  const hasNext =
    dj.playback !== undefined && dj.playback.index < dj.queue.length - 1;

  /*
    With no owner, everybody would report the end at once and the queue would
    skip several tracks. Only one reports: the first userId in order, which gives
    the same answer in every browser without anyone agreeing on anything.
  */
  const reporter = [...state.participants.map((p) => p.userId)].sort()[0] === currentUserId;

  const player = useYouTube({
    videoId: current?.videoId ?? null,
    playback: dj.playback,
    volume,
    onEnded: reporter && dj.playback ? () => onEnded(dj.playback!.index) : undefined,
  });

  /*
    Clamped between zero and the duration. During the breath between tracks the
    sum goes negative, and at the end it runs past the duration — the room clock
    keeps ticking while the end report makes its way round through the server,
    and the display showed 4:13 on a 4:12 video.
  */
  const raw = dj.playback ? Math.max(0, expectedPosition(dj.playback)) : 0;
  const elapsed = player.duration ? Math.min(raw, player.duration) : raw;
  const progress = player.duration ? elapsed / player.duration : 0;

  return (
    <div
      className="flex h-full w-full flex-col rounded-lg px-5 py-4"
      style={{ background: "#0e1721" }}
    >
      {/* Dashboard header, the same as the room's. */}
      <div className="flex items-baseline justify-between">
        <span
          className="text-[10.5px] font-semibold tracking-[0.22em]"
          style={{ color: palette.faint }}
        >
          {ui.dj.title}
        </span>
      </div>

      {/* The two apps, in place of the list of names. */}
      <div
        className="mt-3 flex min-h-0 flex-1 gap-4 border-t pt-4"
        style={{ borderColor: "#1e2836" }}
      >
        <DashApp
          titulo={ui.dj.appMusic}
          direita={
            <span className="text-[12px]" style={{ color: palette.faint }}>
              {ui.dj.queueCount(dj.queue.length)}
            </span>
          }
          className="min-w-0 flex-1"
        >
          <div className="flex min-h-0 flex-1 gap-5">
            {/* The current track, with the player at cover size. */}
            <div className="flex min-h-0 w-[260px] shrink-0 flex-col">
              {/*
                16:9, the proportion of what you watch — the dashboard grows
                upwards in DJ mode precisely so it fits. The iframe covers the
                box rather than fitting inside it: without that, the player made
                up the rounding difference with black bars.
              */}
              <div
                className="dj-video relative w-full shrink-0 overflow-hidden rounded"
                style={{ background: "#060b12", aspectRatio: "16 / 9" }}
              >
                <div ref={player.box} className="h-full w-full" />
                {/*
                  With no track, an opaque lid over the player. `stopVideo`
                  already clears the frame, but the player can still show the
                  thumbnail of what left — and a cleared queue must stay cleared.
                */}
                {!current && (
                  /*
                    The display at rest. The black lid alone left a hole in the
                    middle of the dashboard; the dimmed note says the unit is on
                    and has no track, without repeating the text that comes
                    right below it.
                  */
                  <span
                    className="absolute inset-0 flex flex-col items-center justify-center gap-2"
                    style={{ background: "#060b12" }}
                  >
                    <LuMusic size={26} color="#1c2635" />
                    <span
                      className="text-[10px] font-semibold uppercase tracking-[0.24em]"
                      style={{ color: "#1c2635" }}
                    >
                      {ui.dj.idle}
                    </span>
                  </span>
                )}
                {/*
                  A shield over the player: clicking it would pause, seek or open
                  YouTube for yourself alone, and drop you out of step with the
                  room. The transport is the dashboard's, and that is the one
                  that counts for everybody.
                */}
                <span className="absolute inset-0" aria-hidden />
                {current && player.blocked && (
                  /* The browser only releases sound after a gesture from the listener. */
                  <button
                    type="button"
                    onClick={player.unlock}
                    className="absolute inset-0 flex cursor-pointer flex-col items-center justify-center gap-1"
                    style={{ background: "rgba(6,11,18,0.9)" }}
                  >
                    <LuPlay size={20} color={palette.ink} />
                    <span className="text-[12px]" style={{ color: palette.ink }}>
                      {ui.dj.tapToPlay}
                    </span>
                  </button>
                )}
              </div>

              <span
                // shrink-0: as a flex column item the title shrank until it
                // vanished, leaving only the line saying who added it.
                className="mt-3 line-clamp-2 shrink-0 text-[13.5px] leading-snug"
                style={{ color: current ? palette.ink : palette.faint }}
              >
                {current ? current.title : ui.dj.silent}
              </span>
              {current && (
                <span className="mt-1 shrink-0 text-[12px]" style={{ color: palette.dim }}>
                  {ui.dj.addedBy(current.addedByName)}
                </span>
              )}

              <div className="mt-auto shrink-0 pt-4">
                <span
                  className="block h-[3px] w-full overflow-hidden rounded-full"
                  style={{ background: "#1e2836" }}
                >
                  <span
                    className="block h-full rounded-full"
                    style={{ width: `${progress * 100}%`, background: palette.cyan }}
                  />
                </span>
                <div
                  className="mt-1.5 flex justify-between text-[11.5px]"
                  style={{ color: palette.faint }}
                >
                  <span>{clock(elapsed)}</span>
                  <span>{player.duration ? clock(player.duration) : "--:--"}</span>
                </div>

                {/* Transport: no owner, anyone in the room touches it. */}
                <div className="mt-3 flex items-center justify-center gap-2">
                  <TransportKey label={ui.dj.previous} disabled={!hasPrevious} onClick={() => onSkip(-1)}>
                    <LuSkipBack size={14} />
                  </TransportKey>
                  <TransportKey
                    label={dj.playback?.paused ? ui.dj.resume : ui.dj.pause}
                    disabled={!current}
                    onClick={onToggle}
                  >
                    {dj.playback?.paused ? <LuPlay size={14} /> : <LuPause size={14} />}
                  </TransportKey>
                  <TransportKey label={ui.dj.next} disabled={!hasNext} onClick={() => onSkip(1)}>
                    <LuSkipForward size={14} />
                  </TransportKey>
                </div>

              </div>
            </div>

            {/* The queue. */}
            <div
              className="flex min-h-0 min-w-0 flex-1 flex-col border-l pl-5"
              style={{ borderColor: "#1e2836" }}
            >
              <span className="flex shrink-0 items-center justify-between gap-3">
                <span
                  className="text-[10px] font-semibold tracking-[0.18em]"
                  style={{ color: palette.faint }}
                >
                  {ui.dj.queue}
                </span>
                {dj.queue.length > 0 && (
                  <button
                    type="button"
                    onClick={onClear}
                    className="cursor-pointer text-[11px] transition-colors hover:brightness-125"
                    style={{ color: palette.faint }}
                  >
                    {ui.dj.clear}
                  </button>
                )}
              </span>

              <div
                className="mt-2 min-h-0 flex-1 overflow-y-auto pr-1"
                style={{ scrollbarWidth: "thin", scrollbarColor: "#1e2836 transparent" }}
              >
                {dj.queue.length === 0 ? (
                  <p className="py-2 text-[12.5px]" style={{ color: palette.faint }}>
                    {ui.dj.queueEmpty}
                  </p>
                ) : (
                  dj.queue.map((t, i) => {
                    const playing = dj.playback?.index === i;
                    return (
                      <div
                        key={t.id}
                        className="group flex items-center gap-3 rounded px-2 py-1.5"
                        style={{ background: playing ? "rgba(95,224,232,0.07)" : undefined }}
                      >
                        <span
                          className="w-4 shrink-0 text-right text-[11.5px]"
                          style={{ color: playing ? palette.cyan : palette.faint }}
                        >
                          {i + 1}
                        </span>
                        <button
                          type="button"
                          onClick={() => onPlay(i)}
                          className="flex min-w-0 flex-1 cursor-pointer flex-col items-start text-left"
                        >
                          <span
                            className="w-full truncate text-[13.5px]"
                            style={{ color: playing ? palette.ink : palette.dim }}
                          >
                            {t.title}
                          </span>
                          <span className="text-[11.5px]" style={{ color: palette.faint }}>
                            {ui.dj.addedBy(t.addedByName)}
                          </span>
                        </button>
                        <button
                          type="button"
                          title={ui.dj.remove}
                          aria-label={ui.dj.remove}
                          onClick={() => onRemove(t.id)}
                          className="shrink-0 cursor-pointer opacity-0 transition-opacity group-hover:opacity-100"
                          style={{ color: palette.faint }}
                        >
                          <LuX size={14} />
                        </button>
                      </div>
                    );
                  })
                )}
              </div>

              <form
                className="mt-2 flex shrink-0 gap-2 border-t pt-3"
                style={{ borderColor: "#1e2836" }}
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!link.trim()) return;
                  onAdd(link.trim());
                  setLink("");
                }}
              >
                <input
                  value={link}
                  onChange={(e) => setLink(e.target.value)}
                  placeholder={ui.dj.addPlaceholder}
                  className="h-9 min-w-0 flex-1 rounded-md px-3 text-[12.5px] outline-none"
                  style={{ background: "#060b12", border: `1px solid ${palette.line}`, color: palette.ink }}
                />
                <button
                  type="submit"
                  title={ui.dj.add}
                  aria-label={ui.dj.add}
                  className="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-md transition-colors hover:bg-white/5"
                  style={{ background: palette.surface, border: `1px solid ${palette.line}`, color: palette.dim }}
                >
                  <LuPlus size={15} />
                </button>
              </form>
            </div>
          </div>
        </DashApp>

        {/* The second app: who is in the room, on the room's own line style. */}
        <DashApp
          titulo={ui.dj.appRoom}
          direita={
            <span className="text-[12px]" style={{ color: palette.faint }}>
              {ui.lot.occupancy(state.participants.length, ROOM_CAPACITY)}
            </span>
          }
          className="w-[240px] shrink-0"
        >
          {/*
            No `overflow-x-hidden`, and slack on both sides: the ring around your
            own dot sits 3.5px outside it, and clipping ate that overhang.
          */}
          <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-1">
            {state.participants.map((p) => (
              <span
                key={p.userId}
                className="flex min-w-0 items-center gap-2 text-[13.5px] leading-none"
                style={{
                  color: !p.micEnabled
                    ? palette.ghost
                    : p.speaking
                      ? palette.tail
                      : p.userId === currentUserId
                        ? palette.ink
                        : palette.dim,
                  fontWeight: p.userId === currentUserId ? 600 : 400,
                }}
              >
                <span
                  className={`h-[7px] w-[7px] shrink-0 rounded-full${
                    p.speaking ? " taillight-lit" : ""
                  }`}
                  style={{
                    background: carPaints[p.paint % carPaints.length].glass,
                    boxShadow:
                      p.userId === currentUserId
                        ? `0 0 0 2px #0a111a, 0 0 0 3.5px ${palette.ghost}`
                        : undefined,
                  }}
                />
                <span className="truncate">{p.displayName}</span>
                <span className="flex w-3 shrink-0 justify-center">
                  {!p.micEnabled && <LuMicOff size={12} />}
                </span>
                {p.latencyMs !== undefined && (
                  <span
                    className="ml-auto flex shrink-0 items-center"
                    style={{ transform: "scale(0.62)", transformOrigin: "right center" }}
                  >
                    <LatencyBars ms={p.latencyMs} />
                  </span>
                )}
              </span>
            ))}
          </div>
        </DashApp>
      </div>

    </div>
  );
}

/** Button to leave the mode, for the scene's controls corner. */
export function DjLeaveButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex h-11 cursor-pointer items-center gap-2 rounded-lg px-4 text-[10.5px] font-semibold uppercase tracking-[0.16em] transition-colors hover:brightness-110"
      style={{
        background: "rgba(8,11,17,0.6)",
        border: `1px solid ${palette.line}`,
        color: palette.dim,
      }}
    >
      <LuX size={16} />
      {ui.dj.leave}
    </button>
  );
}

/**
 * An app inside the dashboard. The background is the same `#0a111a` as the
 * what-is-playing button, and the label has the same size and tracking as
 * "UP NEXT" — all of it already exists on the room's dashboard.
 */
function DashApp({
  titulo,
  direita,
  className,
  children,
}: {
  titulo: string;
  /** A count to the right of the label, as on the room's dashboard header. */
  direita?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={`flex min-h-0 flex-col rounded-md px-4 py-3 ${className ?? ""}`}
      // An outline of its own: over the dashboard, background alone did not separate it.
      style={{ background: "#0a111a", border: "1px solid #182231" }}
    >
      <span className="flex shrink-0 items-baseline justify-between gap-3">
        <span
          className="text-[10px] font-semibold tracking-[0.18em]"
          style={{ color: palette.faint }}
        >
          {titulo}
        </span>
        {direita}
      </span>
      <div
        className="mt-2.5 flex min-h-0 flex-1 flex-col border-t pt-3"
        style={{ borderColor: "#1e2836" }}
      >
        {children}
      </div>
    </div>
  );
}

/** A transport key, shaped like the dashboard's own buttons. */
function TransportKey({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string;
  onClick: () => void;
  /** With nothing to play, the key stays put but stops responding. */
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      className="flex h-8 w-8 items-center justify-center rounded-md transition-colors enabled:cursor-pointer enabled:hover:bg-white/5 disabled:cursor-not-allowed"
      style={{
        background: palette.surface,
        border: `1px solid ${palette.line}`,
        color: disabled ? palette.ghost : palette.dim,
        opacity: disabled ? 0.5 : 1,
      }}
    >
      {children}
    </button>
  );
}
