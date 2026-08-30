import { env } from "./env.ts";
import { dropRoom, revokeScreen } from "./livekit.ts";
import * as presence from "./presence.ts";
import { closeRoom, getRoom, releaseStageLock, tokenHint } from "./rooms.ts";

/**
 * LiveKit's `empty_timeout` would do part of this on its own, but only after a
 * few minutes — and in that window a room exists on the SFU with no record here.
 */
export async function shutRoom(token: string, reason: string): Promise<void> {
  const room = await getRoom(token);
  if (room?.stage.status === "occupied") {
    await revokeScreen(room.livekitRoom, room.stage.userId);
  }
  if (room) await dropRoom(room.livekitRoom);
  await releaseStageLock(token);
  await closeRoom(token);
  presence.broadcast(token, { type: "room:closed" });
  presence.forget(token);
  console.log(`[room] ${tokenHint(token)} closed (${reason})`);
}

/** The TTL is the ceiling; normally a room closes as soon as it empties. */
async function sweepEmpty(): Promise<void> {
  const limit = env.roomEmptyMin * 60_000;
  for (const token of presence.emptyLongerThan(limit)) {
    await shutRoom(token, `empty ${env.roomEmptyMin}m`);
  }
}

export function startRoomSweep(): NodeJS.Timeout {
  return setInterval(() => {
    void sweepEmpty().catch((err) => console.error("[room] sweep failed", err));
  }, 30_000);
}

/** With no heartbeat for this long, the person leaves the room. */
const STALE_MS = 35_000;

/**
 * A frozen tab keeps the socket open and TCP takes its time giving up, so the
 * person stayed listed — and on coming back appeared twice, because re-entering
 * minted another `userId`.
 */
export function startPresenceSweep(): NodeJS.Timeout {
  return setInterval(() => {
    presence.pingAll();
    for (const token of presence.activeRoomTokens()) {
      const gone = presence.pruneStale(token, STALE_MS);
      if (gone.length === 0) continue;

      console.warn(`[presence] ${tokenHint(token)} dropped ${gone.length} silent`);
      void getRoom(token).then((room) => {
        if (room) {
          presence.broadcast(token, {
            type: "session:state",
            payload: presence.sessionState(room),
          });
        }
      });
    }
  }, 10_000);
}
