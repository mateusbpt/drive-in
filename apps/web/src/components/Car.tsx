import { LuMicOff } from "react-icons/lu";
import type { Participant } from "@drive-in/shared";
import { carPaints, palette } from "../theme";
import { ui } from "../strings";

const CAR_W = 216;

/**
 * The cabin edge at a given height. The mirrors are derived from it: placed by
 * eye, a gap was left and they looked detached from the car.
 */
const CABIN = { baseY: 128, topY: 190, baseHalf: 70, topHalf: 48 };
function cabinEdge(y: number): number {
  const t = (y - CABIN.baseY) / (CABIN.topY - CABIN.baseY);
  return CABIN.baseHalf + t * (CABIN.topHalf - CABIN.baseHalf);
}

type CarBodyProps = { paint: number; speaking: boolean; muted: boolean };

/**
 * A pickup seen from behind, with the origin on the tyre line — the shape drops
 * into any layout without recalculating coordinates.
 *
 * The tail light is the speaking indicator: dark by default, lit while the
 * person talks. A parked car watching a film with its lights on makes no sense,
 * and this way the cue is born inside the drawing itself.
 */
export function CarBody({ paint, speaking, muted }: CarBodyProps) {
  const p = carPaints[paint % carPaints.length];
  const yMirror = 150;
  const x = cabinEdge(yMirror);
  const taillight = speaking ? palette.tail : "#5e2731";
  return (
    <g style={muted ? { filter: "grayscale(0.55)", opacity: 0.85 } : undefined}>
      <ellipse cx={0} cy={6} rx={102} ry={10} fill="#04070b" opacity={0.5} />
      {/* Lighter than the asphalt, with a groove in the tread: at #0b0f16 they
          disappeared against the dark ground. */}
      <g fill="#1b222c">
        <rect x={-92} y={-32} width={34} height={34} rx={4} />
        <rect x={58} y={-32} width={34} height={34} rx={4} />
      </g>
      <g fill="#2b3441">
        <rect x={-92} y={-32} width={34} height={5} rx={2.5} />
        <rect x={58} y={-32} width={34} height={5} rx={2.5} />
      </g>

      <g fill={p.fin}>
        <path
          d={`M-${x} -${yMirror + 6} L-${x + 24} -${yMirror + 2}
              Q-${x + 30} -${yMirror} -${x + 29} -${yMirror - 9}
              L-${x + 1} -${yMirror - 12} Z`}
        />
        <path
          d={`M${x} -${yMirror + 6} L${x + 24} -${yMirror + 2}
              Q${x + 30} -${yMirror} ${x + 29} -${yMirror - 9}
              L${x + 1} -${yMirror - 12} Z`}
        />
      </g>

      <path
        d="M-70 -128 L-64 -178 Q-62 -190 -48 -190 L48 -190 Q62 -190 64 -178 L70 -128 Z"
        fill={p.body}
      />
      <path
        d="M-62 -132 L-57 -176 Q-56 -184 -45 -184 L45 -184 Q56 -184 57 -176 L62 -132 Z"
        fill="#0a0f1a"
      />
      <path
        d="M-62 -132 L-57 -176 Q-56 -184 -45 -184 L45 -184 Q56 -184 57 -176 L62 -132 Z"
        fill={p.glass}
        opacity={0.24}
      />

      <path
        d="M-96 -128 L96 -128 Q102 -128 102 -120 L102 -34 Q102 -26 92 -26 L-92 -26
           Q-102 -26 -102 -34 L-102 -120 Q-102 -128 -96 -128 Z"
        fill={p.body}
      />
      <rect x={-92} y={-118} width={184} height={72} rx={6} fill="#000" opacity={0.18} />
      <path d="M-92 -76 H92" stroke="#000" strokeWidth={3} opacity={0.22} />

      {/* Pulses while the person is talking: the class was missing on the pickup. */}
      <g className={speaking ? "taillight-lit" : undefined}>
        {speaking && (
          <g fill={palette.tail} opacity={0.2}>
            <rect x={-110} y={-126} width={44} height={68} rx={12} />
            <rect x={66} y={-126} width={44} height={68} rx={12} />
          </g>
        )}
        <rect x={-98} y={-114} width={20} height={44} rx={4} fill={taillight} />
        <rect x={78} y={-114} width={20} height={44} rx={4} fill={taillight} />
      </g>
      <rect x={-26} y={-64} width={52} height={14} rx={2} fill="#c9d3e2" opacity={0.7} />
      <rect x={-98} y={-40} width={196} height={14} rx={6} fill={p.fin} />
    </g>
  );
}

/**
 * Connection quality as bars, like a signal indicator. The exact number only
 * shows on hover — four bars say what matters without littering six parking
 * spots with digits.
 */
export function LatencyBars({ ms }: { ms: number }) {
  const gainLevel = ms <= 60 ? 4 : ms <= 120 ? 3 : ms <= 250 ? 2 : 1;
  const paintIndex = gainLevel >= 3 ? palette.cyan : gainLevel === 2 ? "#e0b45f" : palette.tail;

  return (
    <span className="inline-flex items-end gap-[3px]" title={ui.lot.latency(ms)}>
      {[4, 7, 10, 13].map((height, i) => (
        <span
          key={height}
          style={{
            width: 3.5,
            height: height,
            borderRadius: 1.5,
            background: i < gainLevel ? paintIndex : "#232c38",
          }}
        />
      ))}
    </span>
  );
}

type CarSlotProps = {
  participant?: Participant;
  paint: number;
  /** Your own name comes brighter and heavier than everybody else's. */
  isYou?: boolean;
  scale?: number;
  /** The shrunken row in the film scene: no empty-spot label. */
  compact?: boolean;
};

/** One spot: a parked car with a name, or an empty marked-out bay. */
export function CarSlot({ participant, paint, isYou, scale = 1, compact }: CarSlotProps) {
  const w = CAR_W * scale;
  const speaking = participant?.speaking ?? false;
  const muted = participant ? !participant.micEnabled : false;

  return (
    /*
      The spot takes the width of whichever is wider: the drawing or the name.
      Names used to be truncated to fit the width of the car.
    */
    <div className="flex shrink-0 flex-col items-center">
      {/* +14 of box height: the wheels were being clipped by the bottom edge. */}
      <svg viewBox="-112 -206 224 240" className="h-auto" style={{ width: w }} aria-hidden>
        {participant ? (
          <CarBody paint={paint} speaking={speaking} muted={muted} />
        ) : (
          /*
            Floor markings, open at the top: the full dashed box, the size of a
            car, turned into five empty frames competing for attention with the
            people who are actually in the room.
          */
          <path
            d="M-92 -78 L-92 -4 L92 -4 L92 -78"
            fill="none"
            stroke="#1e2733"
            strokeWidth={3}
            strokeLinecap="round"
            strokeDasharray="10 11"
          />
        )}
      </svg>

      {/*
        The name under the car, with the latency right below it. Above, it sat
        loose, far from the drawing it belongs to.
      */}
      <div
        className="flex items-center justify-center whitespace-nowrap leading-tight"
        style={{ height: compact ? 16 : 22 }}
      >
        {participant && (
          <span
            className="flex items-center gap-1 leading-none"
            style={{
              fontSize: compact ? 11 : 13,
              fontWeight: isYou ? 600 : 400,
              /*
                Speaking does not change the name's colour: the car's tail light
                is what announces it. Two cues for the same state left the row
                flickering colour on every word.
              */
              color: muted ? palette.ghost : isYou ? palette.ink : palette.dim,
            }}
          >
            {/*
              An empty slot on the left the same size as the icon's reservation:
              the reservation exists so the position does not jump on mute, but
              on its own it pulled the name off the centre of the spot.
            */}
            <span className="w-3 shrink-0" aria-hidden />
            <span>{participant.displayName}</span>
            <span className="flex w-3 shrink-0 justify-center">
              {muted && <LuMicOff size={12} />}
            </span>

          </span>
        )}
      </div>

      {/* Latency below the name, centred in the spot. */}
      <div
        className="flex items-center justify-center text-center text-[11.5px]"
        style={{ height: compact ? 16 : 20, color: palette.ghost }}
      >
        {participant
          ? participant.latencyMs !== undefined && (
              <span
                className="flex items-center"
                // In the shrunken row the bars shrink too: at the size they use
                // in the idle room they came out bigger than the car's name.
                style={{ transform: `scale(${compact ? 0.56 : 0.78})` }}
              >
                <LatencyBars ms={participant.latencyMs} />
              </span>
            )
          : !compact && ui.lot.emptyBay}
      </div>
    </div>
  );
}
