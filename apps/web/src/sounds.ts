/** Synthesised sounds: a car horn is two notes a major third apart. */

let ctx: AudioContext | null = null;

/** Every sound comes from an action, so the context arrives already unlocked. */
function audio(): AudioContext | null {
  if (typeof window === "undefined") return null;
  ctx ??= new AudioContext();
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

type Note = {
  hz: number;
  shape: OscillatorType;
  start: number;
  duration: number;
  gain: number;
  hzEnd?: number;
};

function play(notes: Note[]): void {
  const ctx = audio();
  if (!ctx) return;

  const now = ctx.currentTime;
  for (const n of notes) {
    const osc = ctx.createOscillator();
    const level = ctx.createGain();
    osc.type = n.shape;
    osc.frequency.setValueAtTime(n.hz, now + n.start);
    if (n.hzEnd) {
      osc.frequency.exponentialRampToValueAtTime(n.hzEnd, now + n.start + n.duration);
    }

    // A hard cut turns into a click in the speaker.
    level.gain.setValueAtTime(0.0001, now + n.start);
    level.gain.exponentialRampToValueAtTime(n.gain, now + n.start + 0.012);
    level.gain.exponentialRampToValueAtTime(0.0001, now + n.start + n.duration);

    osc.connect(level).connect(ctx.destination);
    osc.start(now + n.start);
    osc.stop(now + n.start + n.duration + 0.02);
  }
}

function horn(start: number, duration: number, gain: number): Note[] {
  return [
    { hz: 440, shape: "sawtooth", start, duration, gain },
    { hz: 554, shape: "sawtooth", start, duration, gain: gain * 0.8 },
  ];
}

export function playArrival(): void {
  play(horn(0, 0.26, 0.07));
}

export function playDeparture(): void {
  play([...horn(0, 0.11, 0.055), ...horn(0.17, 0.15, 0.055)]);
}

export function playMicOn(): void {
  play([{ hz: 520, hzEnd: 780, shape: "sine", start: 0, duration: 0.1, gain: 0.09 }]);
}

export function playMicOff(): void {
  play([{ hz: 700, hzEnd: 380, shape: "sine", start: 0, duration: 0.12, gain: 0.09 }]);
}
