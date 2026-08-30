import { grantScreen, isPublishingScreen, revokeScreen } from "./livekit.ts";
import * as presence from "./presence.ts";
import * as dj from "./dj.ts";
import {
  acquireStage,
  getRoom,
  releaseStageLock,
  saveRoom,
  tokenHint,
  type Room,
} from "./rooms.ts";

/** The client asks; here the answer is yes or no. */
export async function take(
  room: Room,
  userId: string,
  displayName: string,
): Promise<{ ok: boolean }> {
  // The lock comes first: if somebody got there first, stop without granting.
  if (!(await acquireStage(room.token, userId))) return { ok: false };

  try {
    await grantScreen(room.livekitRoom, userId);
  } catch (err) {
    // Give the lock back, or the stage stays held by someone who never aired.
    await releaseStageLock(room.token);
    throw err;
  }

  room.stage = { status: "occupied", userId, displayName, since: Date.now() };
  /*
    The two modes are mutually exclusive: taking the screen turns the DJ off.
    The queue survives and the track freezes where it was — once the film is
    over, the music resumes from there.
  */
  if (room.dj?.active) {
    room.dj = { ...dj.freeze(room.dj), active: false };
  }
  await saveRoom(room);

  presence.broadcast(room.token, {
    type: "session:state",
    payload: presence.sessionState(room),
  });
  return { ok: true };
}

export async function release(room: Room): Promise<void> {
  if (room.stage.status === "occupied") {
    await revokeScreen(room.livekitRoom, room.stage.userId);
  }
  await releaseStageLock(room.token);
  room.stage = { status: "free" };
  await saveRoom(room);

  presence.broadcast(room.token, { type: "stage:released" });
  presence.broadcast(room.token, {
    type: "session:state",
    payload: presence.sessionState(room),
  });
}

/*
  When this process started. After a restart presence begins empty — it lives in
  memory — and whoever is connected only reappears once their browser rebuilds
  the WebSocket. Without waiting for that, the sweep took the stage away from
  somebody who never left.
*/
const STARTED_AT = Date.now();
const BOOT_GRACE_MS = 60_000;

/** Safety net for when the WebSocket `close` never arrives. */
async function sweepOnce(): Promise<void> {
  if (Date.now() - STARTED_AT < BOOT_GRACE_MS) return;

  for (const token of presence.activeRoomTokens()) {
    const room = await getRoom(token);
    if (!room || room.stage.status !== "occupied") continue;

    if (!presence.isPresent(token, room.stage.userId)) {
      console.warn(`[stage] ${tokenHint(token)} released (holder disconnected)`);
      await release(room);
      continue;
    }

    // Being present is not enough: somebody who stops from the browser's own
    // button is still in the room, and if the release request is lost the stage
    // stays stuck for everyone.
    //
    // The grace period exists because between taking the stage and picking a
    // window there is no track at all — without it we would drop whoever has
    // the picker open.
    const since = Date.now() - room.stage.since;
    if (since < GRACE_MS) continue;

    if (!(await isPublishingScreen(room.livekitRoom, room.stage.userId))) {
      console.warn(`[stage] ${tokenHint(token)} released (no screen track)`);
      await release(room);
    }
  }
}

/** Time for the browser picker to appear, be answered, and start publishing. */
const GRACE_MS = 60_000;

export function startIdleSweep(): NodeJS.Timeout {
  return setInterval(() => {
    void sweepOnce().catch((err) => console.error("[stage] sweep failed", err));
  }, 30_000);
}
