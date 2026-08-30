/** Palette for the SVG scenes. Mirrors the @theme block in index.css. */
export const palette = {
  night: "#05080f",
  skyTop: "#04070e",
  skyMid: "#0b1526",
  skyLow: "#16263f",
  skyHorizon: "#28405e",
  treeline: "#050810",
  asphalt: "#0a0d13",
  asphaltHi: "#121821",
  bayLine: "#1e2733",
  surface: "#141b24",
  line: "#2b3543",
  ink: "#dbe4f0",
  dim: "#7f90a8",
  faint: "#4c5a70",
  ghost: "#2c3644",
  cyan: "#5fe0e8",
  tail: "#ff5f7a",
  chrome: "#8b96a1",
  star: "#dae4f6",
} as const;

/** One colour per car, so each person keeps the same one throughout. */
export const carPaints = [
  { body: "#1b3a41", fin: "#194047", cabin: "#17333a", glass: "#33606c" },
  { body: "#5c2331", fin: "#6a2a39", cabin: "#4d1d29", glass: "#94505f" },
  { body: "#1e2436", fin: "#232a3e", cabin: "#191e2d", glass: "#333b52" },
  { body: "#4a4432", fin: "#554e3a", cabin: "#403b2c", glass: "#7b7360" },
  { body: "#2c2338", fin: "#352b43", cabin: "#241d2e", glass: "#544665" },
  { body: "#1f3a2e", fin: "#254435", cabin: "#1a3126", glass: "#3d6b54" },
] as const;
