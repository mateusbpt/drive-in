/** Contracts between the api and the client. A type used on both sides lives here. */

// --- Room ---

/**
 * Six spots, six people. The parking lot is drawn around that number and the
 * server refuses the seventh — as two separate values they would drift apart.
 */
export const ROOM_CAPACITY = 6;

/**
 * A name that fits under the car without shoving the neighbouring spots. The
 * server refuses anything longer — a limit on the field alone would be decoration.
 */
export const NAME_MAX_LENGTH = 16;

/** One paint colour per spot: the car is each person's visual identity. */
export const PAINT_COUNT = 6;

/** Rooms are born from the CLI. The link's token is the entire credential. */
export interface RoomSummary {
  /** Already at capacity. It comes in the summary to warn before the name is typed. */
  full: boolean;
  /** Colours already taken, so the entry screen does not offer a duplicate. */
  takenPaints: number[];
  feature?: Feature;
  locked: boolean;
  expiresAt: number;
}

// --- Identity ---

/** There are no accounts: you type a name on the way in and it dies with the room. */
export interface Participant {
  userId: string;
  displayName: string;
  micEnabled: boolean;
  speaking: boolean;
  /**
   * Round trip to the SFU, in milliseconds. Only each person's own browser can
   * measure theirs, so everyone reports their own and the server relays it.
   */
  latencyMs?: number;
  /** Car colour, chosen on the way in. */
  paint: number;
}

/** What is playing. Typed by whoever is in the room. */
export interface Feature {
  title: string;
  year: string | null;
}

// --- Room in use ---

export type StageState =
  | { status: "free" }
  | { status: "occupied"; userId: string; displayName: string; since: number };

// --- DJ mode ---

/** A track in the queue. The video is everyone's own: we keep only what identifies it. */
export interface Track {
  /** The video's own YouTube id; it is what each player loads. */
  videoId: string;
  title: string;
  /** Seconds. Comes from YouTube, so the queue can show a duration. */
  durationSec: number | null;
  /** Who pasted the link. The queue shows it, like a shared playlist. */
  addedBy: string;
  addedByName: string;
  /** Tells two entries of the same video apart; it is what removal uses. */
  id: string;
}

/**
 * What is playing now. We do not store the current position but when the track
 * started: each browser then works out on its own which second to join at, and
 * somebody arriving mid-song lands at the right point with nobody telling them.
 */
export interface DjPlayback {
  /** Index in the queue. Past the end means the queue ran out. */
  index: number;
  /** The moment the track started, corrected on every pause. */
  startedAt: number;
  /** Second of the track where play happened; it moves when you rewind. */
  offsetSec: number;
  paused: boolean;
}

export interface DjState {
  /** On only while somebody is in the mode. The big screen stays dark. */
  active: boolean;
  /** The queue has no owner: whoever is in the room adds, removes, skips and pauses. */
  queue: Track[];
  playback?: DjPlayback;
}

export interface SessionState {
  feature?: Feature;
  roomName: string;
  participants: Participant[];
  stage: StageState;
  dj: DjState;
}

// --- HTTP responses ---

export interface JoinResponse {
  session: string;
  userId: string;
  livekitToken: string;
  livekitUrl: string;
  state: SessionState;
}

// --- WebSocket protocol ---

export type ServerEvent =
  | { type: "session:state"; payload: SessionState }
  | { type: "dj:error"; payload: { message: string } }
  | { type: "stage:granted" }
  | { type: "stage:released" }
  | { type: "room:locked" }
  | { type: "room:closed" }
  | { type: "error"; payload: { message: string } };

export type ClientCommand =
  | { type: "latency:set"; payload: { ms: number } }
  | { type: "mic:set"; payload: { enabled: boolean } }
  /*
    Queue and transport. Entering the mode requires a free stage; leaving gives
    the room back to the parking lot. The queue belongs to everybody.
  */
  | { type: "dj:enter" }
  | { type: "dj:leave" }
  | { type: "dj:add"; payload: { url: string } }
  | { type: "dj:remove"; payload: { id: string } }
  | { type: "dj:clear" }
  | { type: "dj:play"; payload: { index: number } }
  | { type: "dj:toggle" }
  | { type: "dj:skip"; payload: { delta: number } }
  /** The track ended in the reporting player; the room moves along with it. */
  | { type: "dj:ended"; payload: { index: number } }
  | { type: "ping" };
