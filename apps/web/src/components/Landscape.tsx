import type { CSSProperties, ReactNode } from "react";
import { palette } from "../theme";

/*
  Two planes of ridge, a treeline and the ground — all derived from the horizon,
  never from fixed heights. Both scenes (inside the car and with the film) use
  this same landscape: drawn separately, they drifted apart from each other.
*/
type LandscapeProps = {
  /** Width of the caller's coordinate system. */
  width: number;
  /** Height where the ground meets the trees. */
  horizon: number;
  /** How far down the asphalt goes. */
  until: number;
};

export function Landscape({ width: L, horizon, until }: LandscapeProps) {
  return (
    <>
      <path
        d={`M0 ${horizon - 68} L150 ${horizon - 112} L268 ${horizon - 76}
            L392 ${horizon - 128} L520 ${horizon - 82} L640 ${horizon - 124}
            L768 ${horizon - 80} L900 ${horizon - 120} L1030 ${horizon - 78}
            L1160 ${horizon - 112} L${L} ${horizon - 76}
            L${L} ${horizon} L0 ${horizon} Z`}
        fill="#0a1220"
        opacity={0.85}
      />
      <path
        d={`M0 ${horizon - 46} Q150 ${horizon - 64} 268 ${horizon - 50}
            Q392 ${horizon - 72} 520 ${horizon - 52} Q640 ${horizon - 74} 768 ${horizon - 54}
            Q900 ${horizon - 68} 1030 ${horizon - 52} Q1160 ${horizon - 66} 1250 ${horizon - 50}
            L${L} ${horizon - 56} L${L} ${horizon} L0 ${horizon} Z`}
        fill={palette.treeline}
      />
      <rect x={0} y={horizon} width={L} height={Math.max(0, until - horizon)} fill={palette.asphalt} />
    </>
  );
}

/** The sky, with the same gradient in both scenes. */
export function NightSky({ id }: { id: string }) {
  return (
    <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stopColor={palette.skyTop} />
      <stop offset="44%" stopColor={palette.skyMid} />
      <stop offset="80%" stopColor={palette.skyLow} />
      <stop offset="100%" stopColor={palette.skyHorizon} />
    </linearGradient>
  );
}

/*
  The same stars in every scene. They used to be declared inside the parking lot,
  so the entry screen would have had a similar sky, never the same one.
*/
export const STARS: [number, number, number, number][] = [
  [268, 158, 1, 0.42],
  [372, 128, 1.3, 0.6],
  [470, 170, 1.1, 0.46],
  [568, 116, 1.6, 0.8],
  [668, 154, 1, 0.4],
  [772, 124, 1.2, 0.54],
  [872, 166, 1.4, 0.64],
  [972, 136, 1, 0.38],
];

/*
  A second handful, higher and fainter. The sky had eight stars in a single band,
  and the top half came out nearly black.
*/
const HIGH_STARS: [number, number, number, number][] = [
  [156, 86, 1.1, 0.34], [318, 62, 1, 0.5], [420, 96, 1.3, 0.3],
  [516, 48, 1, 0.46], [628, 84, 1.2, 0.36], [716, 56, 1, 0.52],
  [820, 92, 1.1, 0.3], [918, 60, 1.4, 0.44], [1044, 100, 1, 0.38],
  [1128, 64, 1.2, 0.48], [1204, 132, 1, 0.32], [92, 148, 1.2, 0.4],
];

export function StarField() {
  return (
    <g fill={palette.star}>
      {STARS.map(([cx, cy, r, o]) => (
        <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r={r} opacity={o} />
      ))}
      {HIGH_STARS.map(([cx, cy, r, o], i) => (
        <circle
          key={`high-${cx}-${cy}`}
          cx={cx}
          cy={cy}
          r={r}
          // One in three twinkles, each on its own beat: all together they turn
          // into fairy lights.
          className={i % 3 === 0 ? "star-twinkle" : undefined}
          style={
            i % 3 === 0
              ? ({ "--glow": o, animationDelay: `${(i % 5) * 0.9}s` } as CSSProperties)
              : { opacity: o }
          }
          opacity={i % 3 === 0 ? undefined : o}
        />
      ))}
    </g>
  );
}

/** The moon and its halo. Arrival scene only: in the car it falls behind the roof. */
export function Moon({ cx, cy, r }: { cx: number; cy: number; r: number }) {
  return (
    <g>
      <circle cx={cx} cy={cy} r={r * 3.4} fill="url(#moonHalo)" />
      <circle cx={cx} cy={cy} r={r} fill="#e9eefb" opacity={0.9} />
      {/* Craters: a smooth disc of one tone reads as a bubble, not a moon. */}
      <g fill="#c9d3e8" opacity={0.5}>
        <circle cx={cx - r * 0.3} cy={cy - r * 0.24} r={r * 0.19} />
        <circle cx={cx + r * 0.26} cy={cy + r * 0.12} r={r * 0.13} />
        <circle cx={cx - r * 0.06} cy={cy + r * 0.38} r={r * 0.1} />
      </g>
    </g>
  );
}

export function MoonHalo() {
  return (
    <radialGradient id="moonHalo" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stopColor="#cddaf6" stopOpacity={0.28} />
      <stop offset="60%" stopColor="#cddaf6" stopOpacity={0.07} />
      <stop offset="100%" stopColor="#cddaf6" stopOpacity={0} />
    </radialGradient>
  );
}

type BigScreenProps = {
  /** Top-left corner of the usable area, excluding the frame. */
  x: number;
  y: number;
  width: number;
  height: number;
  /** Where the legs meet the ground. */
  horizon: number;
  children?: ReactNode;
};

/**
 * Frame, surface and the two legs. The legs run down to the horizon rather than
 * having a height of their own: with a fixed value the screen looked like it was
 * floating whenever the scene changed proportion.
 */
export function BigScreen({ x, y, width, height, horizon, children }: BigScreenProps) {
  const cx = x + width / 2;
  const foot = y + height + 8;

  return (
    <>
      <rect x={x - 8} y={y - 8} width={width + 16} height={height + 16} rx={3} fill="#16233a" />
      <rect x={x} y={y} width={width} height={height} rx={2} fill="#0b1220" />
      {children}
      <rect
        x={x - 8}
        y={y - 8}
        width={width + 16}
        height={height + 16}
        rx={3}
        fill="none"
        stroke="#1b2532"
        strokeWidth={8}
      />
      <g fill="#131b26">
        {[-1, 1].map((side) => (
          <rect
            key={side}
            x={cx + side * (width * 0.34) - 7}
            y={foot}
            width={14}
            height={Math.max(12, horizon - foot)}
          />
        ))}
      </g>
    </>
  );
}
