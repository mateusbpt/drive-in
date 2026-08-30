import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ROOM_CAPACITY, type Feature, type SessionState } from "@drive-in/shared";
import { LuMicOff, LuPlus } from "react-icons/lu";
import { LatencyBars } from "../components/Car";
import { FeaturePicker } from "../components/FeaturePicker";
import { NightSky, Landscape, StarField } from "../components/Landscape";
import { DjModeButton, StageButton, VoiceControls } from "../components/Controls";
import { carPaints, palette } from "../theme";
import { ui } from "../strings";

/*
  The idle room seen from inside the car: windscreen, dashboard and the big
  screen out front. It all lives in one coordinate system, 1280 by 720, and the
  clickable parts are SVG with handlers — so the interface does not float over
  the set, it IS the car's dashboard.

  Every measurement comes from the axis (CX) and is mirrored by calculation.
  Hand-typed coordinates left the scene crooked.
*/
const W = 1280;
const CX = W / 2;

/** The dashboard takes this band at the bottom, whatever the window height. */
/*
  The dashboard band is a fraction of the scene height, not a fixed measurement:
  in a tall window the box grows, and with a fixed value the dashboard shrank in
  proportion until it was a strip along the bottom.
*/
function dashboardHeight(H: number): number {
  return Math.min(440, Math.max(264, H * 0.32));
}
/*
  The box follows the shape of the window without a tight ceiling: with the
  ceiling at 1020, a tall window made `slice` cut 176 of width, and the controls
  console ended up half outside.
*/
const H_MIN = 560;
const H_MAX = 1700;

/*
  The box height follows the shape of the window instead of being fixed. With a
  fixed height and `meet`, the scene shrank until it fit and left black bars — in
  a tall window it got little more than half the space. Now width rules, and what
  grows is the sky.
*/
/*
  How far the dashboard rises in DJ mode. It lives outside the geometry because
  the zoom framing subtracts half of it from the margin: without that subtraction
  the frame grows too, the camera pulls back, and the dashboard ends up smaller
  than it was.
*/
const DASH_GROWTH = 18;

function geometry(H: number, midiaCrescida = false) {
  const dashboard = dashboardHeight(H);
  const glass = {
    // A higher roof and a higher mirror: that is what makes room for the screen.
    top: 58,
    apex: 30,
    base: H - dashboard + 12,
    belly: H - dashboard + 50,
    halfTop: 446,
    halfBase: 576,
  };
  const gap = [
    `M ${CX - glass.halfTop} ${glass.top}`,
    `Q ${CX} ${glass.apex} ${CX + glass.halfTop} ${glass.top}`,
    `L ${CX + glass.halfBase} ${glass.base}`,
    `Q ${CX} ${glass.belly} ${CX - glass.halfBase} ${glass.base}`,
    "Z",
  ].join(" ");

  const columnA = (side: number) => {
    const xTop = CX + side * glass.halfTop;
    const xBottom = CX + side * glass.halfBase;
    return `M ${xTop} ${glass.top} L ${xBottom} ${glass.base}
            L ${xBottom + side * 96} ${glass.base + 10} L ${xTop + side * 78} ${glass.top - 14} Z`;
  };

  const dashboardTop = glass.belly + 4;
  const dashboardCurve = `M 0 ${dashboardTop + 26} Q ${CX} ${dashboardTop - 32} ${W} ${dashboardTop + 26}`;

  /*
    Slope of the dashboard curve at a given x. Whatever sits on it — vents, trim,
    glovebox — is rotated by this angle; drawn straight, they came out crooked
    against the curve beneath them.
  */
  const dashboardTilt = (x: number) => {
    const t = x / W;
    const controlHeight = -58;
    const slope = (2 * (1 - 2 * t) * controlHeight) / W;
    return (Math.atan(slope) * 180) / Math.PI;
  };

  /*
    The dashboard has a height of its own and is anchored to the bottom. Tied to
    the dashboard band, it shrank along with it when the glass came down, and the
    content — header, names, what is playing and the button — got clipped.
  */
  // 226: header, three lines of names, what is playing and the button.
  const dashBase = Math.max(226, dashboard - 110);
  /*
    In DJ mode it rises a little. That is what gives the video the height to stay
    16:9 without pushing the transport out of the column — at the usual height,
    either the image was left with black bars, or the keys fell off the dashboard.
  */
  const dashHeight = dashBase + (midiaCrescida ? DASH_GROWTH : 0);
  const dash = {
    // Width from the usual height: it grows upwards only, never sideways.
    width: Math.min(560, dashBase * 2.3),
    height: dashHeight,
    y: H - dashHeight - 30,
    /*
      The middle of the dashboard as if it had never grown. The zoom frame centres
      here: on the real middle, growing upwards took the camera with it and
      uncovered a piece of the big screen above the dashboard.
    */
    fixedMiddle: H - 30 - dashBase / 2,
  };
  // Large and cut off by the bottom edge, as you see it sitting in the seat.
  // Set back until the rim clears the dashboard: it covered the start of the
  // text, and the "U" of "UP NEXT" sat behind it.
  const wheel = { cx: 96, cy: H - 26, r: 244 };
  // Content width: with the box larger than it, a margin was left on the right.

  const horizon = glass.base - 44;

  /*
    The screen sits above the horizon with room for the legs to show. Centred in
    the gap, its base fell below the ground and they disappeared. The top is
    pinned below the mirror, so it does not climb too far in a wide window.
  */
  const LEGS = 26;
  // The mirror's base plus slack: any less and the screen touches it.
  const screenCeiling = glass.apex + 80;
  const gapHeight = glass.base - glass.top;
  const screenHeight = Math.min(340, gapHeight * 0.84, horizon - LEGS - screenCeiling);
  const screen = {
    width: screenHeight * 1.77,
    height: screenHeight,
    top: horizon - LEGS - screenHeight,
  };

  return {
    glass,
    gap,
    columnA,
    dashboardTop,
    dashboardCurve,
    dashboardTilt,
    dash,
    wheel,
    screen,
    horizon,
  };
}

type ParkingLotProps = {
  state: SessionState;
  onPickFeature: (choice: Feature | null) => void;
  currentUserId: string;
  onTakeStage: () => void;
  onEnterDj: () => void;
  /**
   * Closes the framing in on the dashboard until the big screen leaves the frame.
   * It is the same scene — what changes is the camera.
   */
  zoom?: boolean;
  /** Dashboard content. Without this, it shows the room. */
  dashContent?: ReactNode;
  /** An extra button beside the controls, in the corner. */
  extraControl?: ReactNode;
  onToggleMic: () => void;
  onToggleFullscreen: () => void;
  onLeave: () => void;
  busyLabel?: string;
};

/** Nobody projecting: you are in your car, looking at a dark screen. */
export function ParkingLot({
  state,
  onPickFeature,
  currentUserId,
  onTakeStage,
  onEnterDj,
  zoom = false,
  dashContent,
  extraControl,
  onToggleMic,
  onToggleFullscreen,
  onLeave,
  busyLabel,
}: ParkingLotProps) {
  const me = state.participants.find((p) => p.userId === currentUserId);
  const [picking, setPicking] = useState(false);
  const spots = Array.from({ length: ROOM_CAPACITY }, (_, i) => state.participants[i]);

  // The box follows the shape of the window: width rules and the sky is what grows.
  const box = useRef<HTMLDivElement>(null);
  /*
    Born already shaped like the window. Starting from a fixed 720, the first
    frame came out with the wrong geometry and the scene jumped as soon as the
    observer measured — every load looked like a zoom animation.
  */
  const [H, setH] = useState(() =>
    Math.round(
      Math.min(H_MAX, Math.max(H_MIN, (W * window.innerHeight) / window.innerWidth)),
    ),
  );
  /*
    What one scene point is worth in screen pixels. `slice` scales by whichever
    side has spare room, so it is the larger of the two. It exists to give the
    button inside the dashboard the real size of the controls, which do not scale.
  */
  const [scale, setScale] = useState(1);
  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      if (width === 0) return;
      const sceneHeight = Math.round(Math.min(H_MAX, Math.max(H_MIN, (W * height) / width)));
      setH(sceneHeight);
      setScale(Math.max(width / W, height / sceneHeight));
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const parts = useMemo(() => geometry(H, zoom), [H, zoom]);
  const { glass, gap, dashboardCurve, dash, wheel, screen, horizon } = parts;
  /*
    An axis of its own, not a mirror of the wheel: tied to it, moving the rim
    dragged the air vents along for no reason.
  */
  const passengerAxis = 1112;

  /*
    The framing closed in on the dashboard. The box grows until it has the shape
    of the window, otherwise `slice` would crop on one side only. The margin is
    the dashboard left around it, so it does not touch the edge.
  */
  const targetFrame = useMemo(() => {
    if (!zoom) return { x: 0, y: 0, w: W, h: H };
    const margin = 54 - DASH_GROWTH / 2;
    let w = dash.width + margin * 2;
    let h = dash.height + margin * 2;
    const aspect = H / W;
    if (h / w < aspect) h = w * aspect;
    else w = h / aspect;
    return {
      x: CX - w / 2,
      y: dash.fixedMiddle - h / 2,
      w,
      h,
    };
  }, [zoom, H, dash.width, dash.height, dash.fixedMiddle]);

  /*
    The camera slides to its target instead of jumping. Only on a mode change:
    changing frame on every pixel of resize would drag the scene along with the
    window.
  */
  const [frame, setQuadro] = useState(targetFrame);
  const frameRef = useRef(targetFrame);
  frameRef.current = frame;
  const previousZoom = useRef(zoom);

  useEffect(() => {
    if (previousZoom.current === zoom) {
      setQuadro(targetFrame);
      return;
    }
    previousZoom.current = zoom;

    // Whoever asked for less motion gets the hard cut.
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setQuadro(targetFrame);
      return;
    }

    const fromFrame = frameRef.current;
    const start = performance.now();
    const DURATION = 420;
    let alive = true;

    const step = (now: number) => {
      if (!alive) return;
      const t = Math.min(1, (now - start) / DURATION);
      // The same curve as the other animations: leaves fast and settles slowly.
      const e = 1 - Math.pow(1 - t, 3);
      setQuadro({
        x: fromFrame.x + (targetFrame.x - fromFrame.x) * e,
        y: fromFrame.y + (targetFrame.y - fromFrame.y) * e,
        w: fromFrame.w + (targetFrame.w - fromFrame.w) * e,
        h: fromFrame.h + (targetFrame.h - fromFrame.h) * e,
      });
      if (t < 1) requestAnimationFrame(step);
    };

    const id = requestAnimationFrame(step);
    return () => {
      alive = false;
      cancelAnimationFrame(id);
    };
  }, [zoom, targetFrame]);

  /*
    Counter-scale for the dashboard content. With the camera closed in, one scene
    point is worth more screen pixels, and the text inside the dashboard would be
    magnified with it. Giving the `foreignObject` more logical pixels in the same
    proportion, the text stays its usual size and it is the dashboard that takes
    up more screen.
  */
  const frameRatio = frame.w / W;
  const DASH_X = CX - dash.width / 2;
  const SCREEN_X = CX - screen.width / 2;

  return (
    <div
      ref={box}
      className="relative h-full overflow-hidden"
      style={{ background: palette.night }}
    >
      <svg
        viewBox={`${frame.x} ${frame.y} ${frame.w} ${frame.h}`}
        preserveAspectRatio="xMidYMid slice"
        className="absolute inset-0 h-full w-full"
      >
        <defs>
          <NightSky id="sky" />
          <radialGradient id="screenGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#9fb4d4" stopOpacity={0.3} />
            <stop offset="100%" stopColor="#9fb4d4" stopOpacity={0} />
          </radialGradient>
          <linearGradient id="glassSheen" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#fff" stopOpacity={0.05} />
            <stop offset="44%" stopColor="#fff" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="dashboardFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#151c26" />
            <stop offset="100%" stopColor="#04060b" />
          </linearGradient>
          <clipPath id="glassClip">
            <path d={gap} />
          </clipPath>
        </defs>

        <rect width={W} height={H} fill="#04060b" />

        {/* Whatever you see through the glass is clipped by it. */}
        <g clipPath="url(#glassClip)">
          <rect width={W} height={H} fill="url(#sky)" />
          <StarField />
          <ellipse cx={CX} cy={screen.top + screen.height / 2} rx={470} ry={280} fill="url(#screenGlow)" />

          <Landscape width={W} horizon={horizon} until={glass.belly + 10} />

          {/* The big screen, with its frame and the two towers. */}
          <rect x={SCREEN_X - 8} y={screen.top - 8} width={screen.width + 16} height={screen.height + 16} rx={3} fill="#16233a" />
          <rect x={SCREEN_X} y={screen.top} width={screen.width} height={screen.height} rx={2} fill="#0b1220" />
          {/*
            The inside of the screen is HTML, not SVG: in SVG I had to get every
            coordinate right, and the marquee was given a fixed width — its text
            is sized for 236 and overflowed.
          */}
          <foreignObject
            x={SCREEN_X + 14}
            y={screen.top + 14}
            width={screen.width - 28}
            height={screen.height - 28}
          >
            <div className="relative flex h-full w-full items-center justify-center gap-[5%]">
              <ProjectedBackdrop />
              <SessionCard height={Math.round(screen.height - 28)} />
            </div>
          </foreignObject>

          <rect
            x={SCREEN_X - 8}
            y={screen.top - 8}
            width={screen.width + 16}
            height={screen.height + 16}
            rx={3}
            fill="none"
            stroke="#1b2532"
            strokeWidth={8}
          />
          {/* Legs: they run to the ground, not to some arbitrary height. */}
          <g fill="#131b26">
            {[-1, 1].map((side) => (
              <rect
                key={side}
                x={CX + side * (screen.width * 0.34) - 7}
                y={screen.top + screen.height + 8}
                width={14}
                height={Math.max(12, horizon - (screen.top + screen.height) - 8)}
              />
            ))}
          </g>

          <path d={gap} fill="url(#glassSheen)" />
        </g>

        {/* The bodywork: the whole frame minus the gap of the glass. */}
        <path fillRule="evenodd" fill="#04060b" d={`M0 0 H${W} V${H} H0 Z ${gap}`} />
        <path d={parts.columnA(-1)} fill="#0b1119" />
        <path d={parts.columnA(1)} fill="#0b1119" />
        <path d={gap} fill="none" stroke="#141c26" strokeWidth={5} />

        {/* Headliner and the two sun visors. */}
        <path
          d={`M0 0 H${W} V${glass.top - 30} Q ${CX} ${glass.apex - 40} 0 ${glass.top - 30} Z`}
          fill="#070b11"
        />
        <g fill="#0d131c" stroke="#161e29" strokeWidth={2}>
          <rect x={CX - 386} y={glass.top - 38} width={264} height={46} rx={8} />
          <rect x={CX + 122} y={glass.top - 38} width={264} height={46} rx={8} />
        </g>

        {/* Wipers at rest, following the curve of the base. */}
        <g stroke="#0a0f16" strokeWidth={6} strokeLinecap="round" fill="none" opacity={0.85}>
          <path d={`M ${CX - 470} ${glass.base - 14} Q ${CX - 250} ${glass.belly - 6} ${CX - 60} ${glass.belly - 14}`} />
          <path d={`M ${CX + 60} ${glass.belly - 14} Q ${CX + 250} ${glass.belly - 6} ${CX + 470} ${glass.base - 14}`} />
        </g>

        {/* Rear-view mirror, centred on the axis. */}
        <rect x={CX - 5} y={glass.apex + 12} width={10} height={26} fill="#0b1017" />
        <rect x={CX - 66} y={glass.apex + 36} width={132} height={36} rx={10} fill="#0d1219" stroke="#1b2532" strokeWidth={2} />
        <rect x={CX - 57} y={glass.apex + 44} width={114} height={20} rx={6} fill="#161f2a" />

        {/* Dashboard */}
        <path d={`${dashboardCurve} L ${W} ${H} L 0 ${H} Z`} fill="url(#dashboardFill)" />
        <path d={dashboardCurve} fill="none" stroke="#232d3a" strokeWidth={2.5} />


        {/*
          Both panels are HTML inside the scene, through foreignObject: that way
          text behaves and the controls are the same components as the rest of
          the app, instead of me redrawing buttons in SVG.
        */}
        <rect
          x={DASH_X - 10}
          y={dash.y - 10}
          width={dash.width + 20}
          height={dash.height + 20}
          rx={14}
          fill="#0a0e14"
          stroke="#232d3a"
          strokeWidth={2}
        />
        <g transform={`translate(${DASH_X} ${dash.y}) scale(${frameRatio})`}>
          <foreignObject x={0} y={0} width={dash.width / frameRatio} height={dash.height / frameRatio}>
            {dashContent ?? (
              <CarDashboard
                spots={spots}
                currentUserId={currentUserId}
                feature={state.feature}
                busyLabel={busyLabel}
                    onTakeStage={onTakeStage}
                onEnterDj={onEnterDj}
                sceneScale={scale * frameRatio}
                onOpenFeature={() => setPicking((v) => !v)}
              />
            )}
          </foreignObject>
        </g>


        {/*
          Instruments behind the rim and the passenger-side vents, both derived
          from the wheel's axis — placed by eye, they came out crooked.
        */}
        {/* On the same line as the middle of the dashboard, not a fraction of the rim. */}
        <Instruments cx={wheel.cx} middle={dash.y + dash.height / 2} />
        <SteeringWheel cx={wheel.cx} cy={wheel.cy} r={wheel.r} />
        <PassengerSide cx={passengerAxis} middle={dash.y + dash.height * 0.34} />
      </svg>

      {/*
        Outside the scene, pinned to the corner: inside the dashboard they scaled
        with the set and, on a Full HD screen, came out enormous.
      */}
      <div className="absolute bottom-6 right-6 z-20 flex flex-col items-start gap-2">
        <span
          className="text-[9.5px] font-semibold tracking-[0.24em]"
          style={{ color: "#3a4656" }}
        >
          {ui.controls.title}
        </span>
        <span className="flex items-center gap-3">
          {extraControl}
        <VoiceControls
          micEnabled={me?.micEnabled ?? false}
          onToggleMic={onToggleMic}
          fullscreen={false}
          onToggleFullscreen={onToggleFullscreen}
          onLeave={onLeave}
          showFullscreen={false}
        />
        </span>
      </div>

      {picking && (
        <div className="pointer-events-none absolute inset-0 z-30">
          <FeaturePicker
            hasFeature={Boolean(state.feature)}
            current={state.feature}
            onPick={(choice) => {
              onPickFeature(choice);
              setPicking(false);
            }}
            onClose={() => setPicking(false)}
          />
        </div>
      )}
    </div>
  );
}

/*
  The dashboard is where the room lives: who is inside, what is playing and the
  act of taking the screen. It is born in the set rather than floating over it.
*/
function CarDashboard({
  spots,
  currentUserId,
  feature,
  busyLabel,
  onTakeStage,
  onEnterDj,
  sceneScale,
  onOpenFeature,
}: {
  spots: (SessionState["participants"][number] | undefined)[];
  currentUserId: string;
  feature: SessionState["feature"];
  busyLabel?: string;
  onTakeStage: () => void;
  onEnterDj: () => void;
  sceneScale: number;
  onOpenFeature: () => void;
}) {
  const inside = spots.filter(Boolean).length;

  return (
    <div className="flex h-full w-full flex-col rounded-lg px-5 py-4" style={{ background: "#0e1721" }}>
      <div className="flex items-baseline justify-between">
        <span
          className="text-[10.5px] font-semibold tracking-[0.22em]"
          style={{ color: palette.faint }}
        >
          {ui.lot.inRoom}
        </span>
        <span className="text-[12px]" style={{ color: palette.faint }}>
          {ui.lot.occupancy(inside, ROOM_CAPACITY)}
        </span>
      </div>

      <div
        // A larger gap-y: with five or six people it is three lines, and at the
        // previous spacing they were pressed together.
        className="mt-3 grid flex-1 grid-cols-2 content-start gap-x-5 gap-y-3 border-t pt-4"
        style={{ borderColor: "#1e2836" }}
      >
        {spots.map((p, i) =>
          p ? (
            <span
              key={p.userId}
              className="flex min-w-0 items-center gap-2 text-[13.5px] leading-none"
              style={{
                /*
                  Muted dims for everybody, yourself included: the "your name"
                  highlight used to come first, and yours stayed bright even with
                  the microphone closed.
                */
                color: !p.micEnabled
                  ? palette.ghost
                  : p.speaking
                    ? palette.tail
                    : p.userId === currentUserId
                      ? palette.ink
                      : palette.dim,
                // Weight and colour only: a box behind the name became a form field.
                fontWeight: p.userId === currentUserId ? 600 : 400,
              }}
            >
              {/*
                Your own dot gets a ring. The marking uses what already exists on
                the line, rather than a box behind the name — which turned into a
                form field and appears nowhere else in the project.
              */}
              <span
                // The same pulse as the tail lights of whoever is talking.
                className={`h-[7px] w-[7px] shrink-0 rounded-full${
                  p.speaking ? " taillight-lit" : ""
                }`}
                style={{
                  background: carPaints[p.paint % carPaints.length].glass,
                  boxShadow:
                    p.userId === currentUserId
                      ? `0 0 0 2px ${palette.night}, 0 0 0 3.5px ${palette.ghost}`
                      : undefined,
                }}
              />
              <span className="truncate">{p.displayName}</span>
              {/*
                The icon's space always exists: appearing only on mute, it pushed
                the following names along and the whole list moved.
              */}
              <span className="flex w-3 shrink-0 justify-center">
                {!p.micEnabled && <LuMicOff size={12} />}
              </span>
              {p.latencyMs !== undefined && (
                /*
                  Smaller: inside the scene everything scales with the window, and
                  bars sized in screen pixels came out enormous.
                */
                <span
                  className="ml-auto flex shrink-0 items-center"
                  style={{ transform: "scale(0.62)", transformOrigin: "right center" }}
                >
                  <LatencyBars ms={p.latencyMs} />
                </span>
              )}
            </span>
          ) : (
            <span key={`spot-${i}`} />
          ),
        )}
      </div>

      <button
        type="button"
        onClick={onOpenFeature}
        className="mt-2 flex w-full cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-left text-[12.5px] transition-colors hover:bg-white/5"
        style={{ background: "#0a111a", color: palette.faint }}
      >
        {feature ? (
          <>
            {/* shrink-0: without it flex shrank the label and cut off the "UP ". */}
            <span className="shrink-0 font-semibold tracking-[0.18em] text-[10px]">
              {ui.lot.upNext}
            </span>
            <span className="min-w-0 truncate" style={{ color: palette.dim }}>
              {feature.title}
            </span>
          </>
        ) : (
          <>
            <LuPlus size={14} />
            {ui.feature.add}
          </>
        )}
      </button>

      <div className="mt-2 flex items-center justify-between gap-3">
        {/* Errors are a toast over the scene now; only who is on stage lives here. */}
        <span className="truncate text-[12px]" style={{ color: palette.dim }}>
          {busyLabel ?? ""}
        </span>
        {!busyLabel && (
          <span className="flex shrink-0 items-center gap-2">
            {/*
              DJ mode is the other thing the room knows how to do, so it lives
              beside the projector, on the same line and at the same height.
            */}
            <DjModeButton onClick={onEnterDj} scale={1 / sceneScale} />
            <StageButton mode="take" onClick={onTakeStage} scale={1 / sceneScale} />
          </span>
        )}
      </div>
    </div>
  );
}

/**
 * The projector's light across the whole screen: a radial gradient and the grain.
 * This used to be the session card's background, so the light was stuck in a
 * column in the middle and the rest of the screen stayed dark.
 */
export function ProjectedBackdrop({ alive = false }: { alive?: boolean }) {
  return (
    <>
      <span
        className={`pointer-events-none absolute inset-0${alive ? " projection-alive" : ""}`}
        style={{
          background:
            "radial-gradient(118% 88% at 50% 42%, #1b2a45 0%, #101a2c 46%, #080e1a 100%)",
        }}
      />
      {/* Projector grain, almost at the edge of visible. */}
      <span
        className={`pointer-events-none absolute inset-0${alive ? " grain-drift" : ""}`}
        style={{
          background:
            "repeating-linear-gradient(0deg, rgba(255,255,255,0.028) 0 1px, transparent 1px 3px)",
        }}
      />
    </>
  );
}

/**
 * The session card as a projected slide. The measurements come from the HEIGHT
 * available, not from an arbitrary square: sized by the side, the content added
 * up to more than the box and the date fell outside the screen.
 */
export function SessionCard({ height }: { height: number }) {
  /*
    The measurement comes from the real box, measured in the browser. Estimating
    the width in JavaScript was off by a few pixels and the composition touched
    the edges; a container unit, inside the `foreignObject`, resolved the width
    before flex distributed it and returned less than half the right value.

    151 = the whole composition (the name plus the two buckets, 137) added to the
    breathing room at the edges (14), in that same unit.
  */
  const box = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);

  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    const observer = new ResizeObserver(([e]) => setWidth(e.contentRect.width));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const unit = width > 0 ? Math.min(height / 100, width / 162) : height / 100;

  const name = {
    fontSize: 12.5 * unit,
    letterSpacing: `${2.4 * unit}px`,
    // Compensates for the gap tracking leaves after the last letter.
    textIndent: `${2.4 * unit}px`,
    lineHeight: 1.34,
    whiteSpace: "nowrap" as const,
  };

  return (
    <div
      ref={box}
      className="relative flex min-w-0 flex-1 flex-col items-center justify-center overflow-hidden text-center"
      style={{ height: height, padding: `0 ${7 * unit}px` }}
    >
      {/* The two buckets flank the name; the whole composition is the logo. */}
      <span className="flex items-center" style={{ gap: 6 * unit }}>
        <PopcornBucket height={30 * unit} />
        <span className="flex flex-col">
          <span style={{ ...name, fontWeight: 600, color: palette.ink }}>DRIVE-IN</span>
          <span style={{ ...name, fontWeight: 500, color: palette.dim }}>&amp; POPCORN</span>
        </span>
        <PopcornBucket height={30 * unit} mirrored />
      </span>
      <span style={{ width: 30 * unit, height: 1, margin: `${9 * unit}px 0`, background: palette.line }} />
      <span
        style={{
          /*
            No `nowrap`: the date is wider than the card and came out clipped.
            7.2 and not 5.4: with the buckets taking width, the unit dropped and
            the date landed near nine pixels. The colour went up a step for the
            same reason — `faint` disappears at that size.
          */
          fontSize: 7.2 * unit,
          letterSpacing: `${1.2 * unit}px`,
          textIndent: `${1.2 * unit}px`,
          lineHeight: 1.5,
          color: palette.dim,
        }}
      >
        {ui.lot.session().toUpperCase()}
      </span>
    </div>
  );
}

/**
 * The marquee's popcorn bucket: red and white stripes, a rim, and the popcorn
 * spilling over. The red is darkened to live alongside the blue of the slide —
 * the old neon one leapt out too far.
 */
function PopcornBucket({ height, mirrored }: { height: number; mirrored?: boolean }) {
  return (
    <svg
      width={height * 0.78}
      height={height}
      style={{ flexShrink: 0 }}
      viewBox="0 0 78 100"
      aria-hidden
      transform={mirrored ? "scale(-1 1)" : undefined}
    >
      {/* Popcorn: bubbles of different sizes, otherwise it is one cloud. */}
      <g fill={palette.ink} opacity={0.82}>
        <circle cx={24} cy={26} r={11} />
        <circle cx={41} cy={18} r={13} />
        <circle cx={57} cy={27} r={10} />
        <circle cx={15} cy={34} r={8} />
        <circle cx={64} cy={36} r={7.5} />
        <circle cx={33} cy={33} r={9} />
        <circle cx={50} cy={34} r={8.5} />
      </g>

      {/* The cup, narrower at the bottom: white with the red stripes. */}
      <path d="M8 44 L70 44 L60 96 L18 96 Z" fill="#e3e7ef" />
      {/*
        The stripes converge on the axis in the same proportion as the cup — 42
        at the base to 62 at the top. Drawn as slanted rectangles, they fell
        outside and the whole bucket looked bent.
      */}
      <g fill="#8c2b38">
        <path d="M8.0 44 L15.4 44 L23.0 96 L18.0 96 Z" />
        <path d="M20.4 44 L27.8 44 L31.4 96 L26.4 96 Z" />
        <path d="M32.8 44 L40.2 44 L39.8 96 L34.8 96 Z" />
        <path d="M45.2 44 L52.6 44 L48.2 96 L43.2 96 Z" />
        <path d="M57.6 44 L65.0 44 L56.6 96 L51.6 96 Z" />
      </g>
      {/* The rim: without it the cup meets the popcorn and disappears. */}
      <rect x={5} y={40} width={68} height={7} rx={2.5} fill="#a33646" />
    </svg>
  );
}

/**
 * Instruments, drawn before the wheel: the rim passes over them and what you see
 * are the dials through its gaps. It all comes from `cx`, the wheel's axis.
 */
function Instruments({ cx, middle }: { cx: number; middle: number }) {
  const radius = 50;

  /*
    A dial with a bezel, a longer mark every other one and a tapered needle. A
    plain circle with identical ticks does not read as an instrument at this size.
  */
  const dial = (px: number, comFaixa: boolean) => {
    const start = Math.PI * 0.75;
    const arc = Math.PI * 1.5;
    const point = (angle: number, dist: number) => ({
      x: px + Math.cos(angle) * dist,
      y: middle + Math.sin(angle) * dist,
    });
    const needle = start + arc * (comFaixa ? 0.22 : 0.34);
    const tip = point(needle, radius - 14);
    const base = point(needle + Math.PI / 2, 5);
    const baseRight = point(needle - Math.PI / 2, 5);
    const bandFrom = point(start + arc * 0.78, radius - 9);
    const bandTo = point(start + arc, radius - 9);

    return (
      <g key={px}>
        <circle cx={px} cy={middle} r={radius + 4} fill="#0f1620" />
        <circle cx={px} cy={middle} r={radius} fill="#080d14" stroke="#1c2635" strokeWidth={2} />
        <circle cx={px} cy={middle} r={radius - 7} fill="none" stroke="#121a25" strokeWidth={1.5} />

        {comFaixa && (
          <path
            d={`M${bandFrom.x.toFixed(1)} ${bandFrom.y.toFixed(1)}
                A${radius - 9} ${radius - 9} 0 0 1 ${bandTo.x.toFixed(1)} ${bandTo.y.toFixed(1)}`}
            fill="none"
            stroke="#6b2733"
            strokeWidth={4}
            strokeLinecap="round"
          />
        )}

        <g strokeLinecap="round">
          {Array.from({ length: 13 }, (_, i) => {
            const angle = start + (i / 12) * arc;
            const larger = i % 2 === 0;
            const fromFrame = point(angle, radius - (larger ? 17 : 12));
            const until = point(angle, radius - 6);
            return (
              <path
                key={i}
                d={`M${fromFrame.x.toFixed(1)} ${fromFrame.y.toFixed(1)} L${until.x.toFixed(1)} ${until.y.toFixed(1)}`}
                stroke={larger ? "#42506a" : "#232e3f"}
                strokeWidth={larger ? 2.6 : 1.8}
              />
            );
          })}
        </g>

        <path
          d={`M${base.x.toFixed(1)} ${base.y.toFixed(1)}
              L${tip.x.toFixed(1)} ${tip.y.toFixed(1)}
              L${baseRight.x.toFixed(1)} ${baseRight.y.toFixed(1)} Z`}
          fill="#8d5c62"
        />
        <circle cx={px} cy={middle} r={7} fill="#141d29" stroke="#232e3f" strokeWidth={1.5} />
      </g>
    );
  };

  return (
    <g>
      {/* A dark hood: in a light tone it became a block in the middle of the dash. */}
      <path
        d={`M${cx - 172} ${middle + 96} L${cx - 162} ${middle - 62}
            Q${cx - 158} ${middle - 76} ${cx - 140} ${middle - 76} L${cx + 140} ${middle - 76}
            Q${cx + 158} ${middle - 76} ${cx + 162} ${middle - 62} L${cx + 172} ${middle + 96} Z`}
        fill="#080c12"
        stroke="#141c27"
        strokeWidth={2}
      />
      {dial(cx - 72, false)}
      {dial(cx + 72, true)}
      <rect x={cx - 24} y={middle - 16} width={48} height={32} rx={5} fill="#070b11" stroke="#182131" strokeWidth={1.5} />
      <g fill="#212b3a">
        <rect x={cx - 14} y={middle - 6} width={24} height={3.5} rx={1.75} />
        <rect x={cx - 14} y={middle + 2} width={14} height={3.5} rx={1.75} />
      </g>
    </g>
  );
}

/**
 * The passenger side: two circular vents, upright. No rotation — a car's
 * diffusers are round and do not follow the curve of the dashboard; rotating
 * them along with it was what made everything look crooked.
 */
function PassengerSide({ cx, middle }: { cx: number; middle: number }) {
  const radius = 32;

  const vent = (px: number) => (
    <g key={px}>
      <circle cx={px} cy={middle} r={radius + 5} fill="#0a0f16" stroke="#182131" strokeWidth={2} />
      <circle cx={px} cy={middle} r={radius} fill="#060a10" />
      {/* Fins: horizontal chords inside the circle, shortening towards the ends. */}
      <g stroke="#1d2634" strokeWidth={3} strokeLinecap="round">
        {[-18, -9, 0, 9, 18].map((dy) => {
          const half = Math.sqrt(Math.max(0, (radius - 5) ** 2 - dy ** 2));
          return <path key={dy} d={`M${px - half} ${middle + dy} H${px + half}`} />;
        })}
      </g>
      <circle cx={px} cy={middle} r={radius} fill="none" stroke="#121a24" strokeWidth={2} />
    </g>
  );

  return (
    <g>
      {vent(cx - 46)}
      {vent(cx + 46)}
    </g>
  );
}

/** A steering wheel with a double rim, three spokes and the airbag hub. */
function SteeringWheel({ cx, cy, r }: { cx: number; cy: number; r: number }) {
  return (
    <g>
      {/*
        Order matters: the spokes come before the rim, so the rim passes over
        them at the join. Drawn afterwards, they crossed the border on the outside.
      */}
      <g fill="#111823">
        <path
          d={`M${cx - r + 8} ${cy - 20} L${cx - 66} ${cy - 54} L${cx - 62} ${cy - 4}
              L${cx - r + 8} ${cy + 20} Z`}
        />
        <path
          d={`M${cx + r - 8} ${cy - 20} L${cx + 66} ${cy - 54} L${cx + 62} ${cy - 4}
              L${cx + r - 8} ${cy + 20} Z`}
        />
        <rect x={cx - 34} y={cy - 14} width={68} height={r} rx={12} />
      </g>

      {/* Double rim: the dark core underneath and the leather over it. */}
      <circle cx={cx} cy={cy} r={r + 4} fill="none" stroke="#070b11" strokeWidth={40} />
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#131a24" strokeWidth={32} />
      <circle cx={cx} cy={cy} r={r - 13} fill="none" stroke="#1c2634" strokeWidth={2} opacity={0.6} />
      <circle cx={cx} cy={cy} r={r + 13} fill="none" stroke="#05080d" strokeWidth={2} opacity={0.5} />

      {/* The hub with the airbag, last. */}
      <ellipse cx={cx} cy={cy - 30} rx={82} ry={62} fill="#151d28" />
      <ellipse cx={cx} cy={cy - 33} rx={70} ry={52} fill="#0f151e" />
      <path
        d={`M${cx - 52} ${cy - 62} Q${cx} ${cy - 80} ${cx + 52} ${cy - 62}`}
        fill="none"
        stroke="#232f3f"
        strokeWidth={2.5}
      />
      <ellipse cx={cx} cy={cy - 38} rx={28} ry={20} fill="#1b2432" />
    </g>
  );
}

