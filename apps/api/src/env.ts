/** Configuration from the environment. Fails at boot if anything is missing. */
function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`missing required environment variable: ${name}`);
  return v;
}

function number(name: string, fallback: number): number {
  const v = process.env[name];
  if (!v) return fallback;
  const n = Number(v);
  if (!Number.isFinite(n)) throw new Error(`${name} is not a number: ${v}`);
  return n;
}

export const env = {
  port: number("PORT", 3000),
  redisUrl: process.env.REDIS_URL ?? "redis://127.0.0.1:6379",
  /** Address the api uses to talk to the SFU; internal to Docker. */
  livekitUrl: required("LIVEKIT_URL"),
  /**
   * Address the browser uses. It is a different one: the api reaches the SFU by
   * service name, and the browser only reaches it by public domain, over TLS.
   */
  livekitPublicUrl: process.env.LIVEKIT_PUBLIC_URL ?? required("LIVEKIT_URL"),
  livekitKey: required("LIVEKIT_API_KEY"),
  livekitSecret: required("LIVEKIT_API_SECRET"),
  /** Public base of the app; it goes into the link the CLI prints. */
  publicBaseUrl: (process.env.PUBLIC_BASE_URL ?? "http://localhost:5173").replace(/\/$/, ""),
  sessionSecret: required("SESSION_SECRET"),
  roomTtlHours: number("ROOM_TTL_HOURS", 16),
  /** Minutes with nobody inside before the room closes itself. */
  roomEmptyMin: number("ROOM_EMPTY_MIN", 5),
  /**
   * Where the frontend bundle lives. Absent in development, where Vite serves
   * the interface; present in the image, where the api serves both.
   */
  webRoot: process.env.WEB_ROOT,
};

/** LiveKit speaks WebSocket to the client and HTTP to the server. */
export const livekitHttpUrl = env.livekitUrl.replace(/^ws/, "http");
