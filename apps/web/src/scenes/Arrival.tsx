import { useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  StarField,
  NightSky,
  MoonHalo,
  Moon,
  Landscape,
  BigScreen,
} from "../components/Landscape";
import { CarBody } from "../components/Car";
import { SessionCard, ProjectedBackdrop } from "./ParkingLot";
import { palette } from "../theme";

/*
  Arriving at the drive-in: the same sky, the same ridge and the same big screen
  as the room, seen from outside the car. It is the shell for the entry form and
  every notice — whoever opens the link sees the place before stepping into it,
  rather than a form screen unrelated to everything else.

  Same coordinates as the parking lot: 1280 wide by a height that follows the
  shape of the window. With a fixed height, the sky stretched and the ridge
  flattened.
*/
const W = 1280;
const H_MIN = 560;
const H_MAX = 1700;
const CX = W / 2;
/** Gap between the foot of the screen and the ground, so the legs show. */
const LEGS = 44;

function geometry(H: number) {
  /*
    The horizon sits above the middle: the bottom half is the asphalt the card
    lands on. Tied to the centre, the card covered the foot of the screen.
  */
  const horizon = Math.round(H * 0.5);
  const screenHeight = Math.round(Math.min(292, Math.max(170, (horizon - LEGS) * 0.74)));
  const screenWidth = Math.round(screenHeight * 1.77);

  return {
    horizon,
    screen: {
      width: screenWidth,
      height: screenHeight,
      x: CX - screenWidth / 2,
      top: horizon - LEGS - screenHeight,
    },
  };
}

/** Empty bays marked on the asphalt, narrowing with distance. */
function EmptyBays({ horizon, until }: { horizon: number; until: number }) {
  const bottom = horizon + 16;
  const depth = Math.max(40, until - bottom);

  return (
    <g stroke={palette.bayLine} strokeWidth={2} fill="none" opacity={0.5}>
      {[-2.5, -1.5, -0.5, 0.5, 1.5, 2.5].map((i) => {
        // Vanishing towards the centre: parallel lines do not read as ground.
        const top = CX + i * 96;
        const base = CX + i * 168;
        return (
          <path
            key={i}
            d={`M${top} ${bottom} L${base} ${bottom + depth}`}
            strokeDasharray="10 12"
          />
        );
      })}
    </g>
  );
}

/*
  Those who already arrived. They sit to the sides, clear of the central band
  where the card lands, and shrink with distance. It is the same drawing as the
  room — you see from outside the car you are about to become.
*/
const PARKED: { x: number; setback: number; scale: number; paintIndex: number; light: number }[] = [
  { x: 300, setback: 58, scale: 0.29, paintIndex: 2, light: 0.5 },
  { x: 990, setback: 46, scale: 0.27, paintIndex: 5, light: 0.46 },
  { x: 150, setback: 226, scale: 0.48, paintIndex: 0, light: 0.72 },
  { x: 1140, setback: 250, scale: 0.5, paintIndex: 3, light: 0.76 },
];

function ParkedCars({ horizon }: { horizon: number }) {
  return (
    <>
      {PARKED.map((c) => (
        <g
          key={c.x}
          transform={`translate(${c.x} ${horizon + c.setback}) scale(${c.scale})`}
          opacity={c.light}
        >
          <CarBody paint={c.paintIndex} speaking={false} muted={false} />
        </g>
      ))}
    </>
  );
}

type ArrivalProps = {
  /** The card that lands on the asphalt: the entry form, or a notice. */
  children: ReactNode;
};

export function Arrival({ children }: ArrivalProps) {
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

  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      if (width === 0) return;
      setH(Math.round(Math.min(H_MAX, Math.max(H_MIN, (W * height) / width))));
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const { horizon, screen } = useMemo(() => geometry(H), [H]);

  return (
    <div
      ref={box}
      className="relative h-full overflow-hidden"
      style={{ background: palette.night }}
    >
      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="xMidYMid slice"
        className="absolute inset-0 h-full w-full"
      >
        <defs>
          <NightSky id="arrivalSky" />
          <MoonHalo />
          <radialGradient id="bigScreenGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#22406b" stopOpacity={0.3} />
            <stop offset="100%" stopColor="#22406b" stopOpacity={0} />
          </radialGradient>
        </defs>

        <rect width={W} height={H} fill="url(#arrivalSky)" />
        <StarField />
        {/* Left and high up: in the centre it fought with the screen. */}
        <Moon cx={196} cy={Math.round(horizon * 0.34)} r={30} />
        <ellipse
          cx={CX}
          cy={screen.top + screen.height / 2}
          rx={screen.width * 0.92}
          ry={screen.height * 1.5}
          fill="url(#bigScreenGlow)"
        />

        <Landscape width={W} horizon={horizon} until={H} />
        <EmptyBays horizon={horizon} until={H} />

        <BigScreen
          x={screen.x}
          y={screen.top}
          width={screen.width}
          height={screen.height}
          horizon={horizon}
        >
          {/*
            The screen shows the session card, the same slide projected in the
            room. It is the app's mark — the bulb-lit marquee that used to be
            here brought back the neon that left everywhere else.
          */}
          <foreignObject
            x={screen.x + 12}
            y={screen.top + 12}
            width={screen.width - 24}
            height={screen.height - 24}
          >
            <div className="relative flex h-full w-full items-center justify-center">
              <ProjectedBackdrop alive />
              <SessionCard height={screen.height - 24} />
            </div>
          </foreignObject>
        </BigScreen>

        {/* After the screen: the cars sit between it and whoever is looking. */}
        <ParkedCars horizon={horizon} />
      </svg>

      {/*
        Outside the SVG: inside it, the card would scale with the window and the
        form text would come out enormous on a Full HD screen. The anchor is the
        horizon, proportionally, so the card always lands on the asphalt.

        Pinned at the bottom too: that way the asphalt band has a real height and
        whatever needs it can ask for `h-full` and share out what exists, instead
        of me guessing how much is left at each window size.
      */}
      <div
        className="absolute inset-x-0 flex flex-col items-center gap-5 px-6"
        style={{
          top: `${((horizon + 40) / H) * 100}%`,
          bottom: 24,
        }}
      >
        {children}
      </div>
    </div>
  );
}

/**
 * The sign at the entrance, built like the big screen: a frame with thickness,
 * an outline over it and the surface recessed inside. With a 1px border and a
 * rounded corner it was a UI card resting on the drawing, not an object of the
 * place. The same for the entry form and the notices.
 */
export function ArrivalCard({
  children,
  /** Maximum width. */
  maxWidth = 392,
}: {
  children: ReactNode;
  maxWidth?: number;
}) {
  return (
    <div className="flex w-full flex-col items-center" style={{ maxWidth: maxWidth }}>
      <div
        className="relative w-full"
        style={{
          /*
            A thin frame. At the big screen's thickness it turned into a picture
            frame: there the surface is 585px and the border disappears beside
            it; here the sign is 392 and the same border took over.
          */
          background: "#1a2534",
          border: "3px solid #22303f",
          borderRadius: 3,
          padding: 5,
        }}
      >
        <div
          style={{
            background: "rgba(8,12,19,0.96)",
            border: "1px solid #0b1220",
            borderRadius: 2,
            padding: "22px 22px 24px",
          }}
        >
          {children}
        </div>
      </div>

      {/* Posts the same width and colour as the screen's legs, 34% off centre. */}
      <div className="relative h-[66px] w-full">
        {[{ left: "16%" }, { right: "16%" }].map((side, i) => (
          <span
            key={i}
            className="absolute top-0"
            style={{ ...side, width: 14, height: 66, background: "#131b26" }}
          />
        ))}
        <span
          className="absolute bottom-[-10px] left-1/2 h-[20px] w-[62%] -translate-x-1/2"
          style={{
            background: "radial-gradient(50% 50% at 50% 50%, rgba(0,0,0,0.5) 0%, transparent 72%)",
          }}
        />
      </div>
    </div>
  );
}
