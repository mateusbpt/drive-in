import { AccessToken, RoomServiceClient, TrackSource } from "livekit-server-sdk";
import { env, livekitHttpUrl } from "./env.ts";

const rooms = new RoomServiceClient(livekitHttpUrl, env.livekitKey, env.livekitSecret);

const VOICE_ONLY = [TrackSource.MICROPHONE];

const VOICE_AND_SCREEN = [
  TrackSource.MICROPHONE,
  TrackSource.SCREEN_SHARE,
  TrackSource.SCREEN_SHARE_AUDIO,
];

/** `auto_create` is off on purpose: rooms are the api's decision. */
export async function ensureRoom(name: string): Promise<void> {
  const existing = await rooms.listRooms([name]);
  if (existing.length > 0) return;
  await rooms.createRoom({ name, emptyTimeout: 300 });
}

/**
 * Minted with microphone only. The stage adds screen on top, without reissuing.
 *
 * It lasts exactly as long as the room has left: a token that dies first would
 * drop anyone reconnecting mid-session, and one that outlives the room would be
 * an orphaned credential.
 */
export async function participantToken(
  room: string,
  identity: string,
  name: string,
  ttlSeconds: number,
): Promise<string> {
  const at = new AccessToken(env.livekitKey, env.livekitSecret, {
    identity,
    name,
    ttl: ttlSeconds,
  });
  at.addGrant({
    room,
    roomJoin: true,
    canSubscribe: true,
    canPublish: true,
    canPublishData: true,
    canPublishSources: VOICE_ONLY,
  });
  return at.toJwt();
}

/**
 * Whether the person still has a screen track live. It is the only source that
 * does not depend on the client telling us: stopping from the browser's button,
 * locking the machine or closing the laptop all read the same here.
 */
export async function isPublishingScreen(room: string, identity: string): Promise<boolean> {
  try {
    const people = await rooms.listParticipants(room);
    const person = people.find((p) => p.identity === identity);
    return (person?.tracks ?? []).some((t) => t.source === TrackSource.SCREEN_SHARE);
  } catch {
    // An SFU that is down is no reason to take anybody's stage away.
    return true;
  }
}

export async function liveParticipants(room: string): Promise<string[] | null> {
  const exists = await rooms.listRooms([room]);
  if (exists.length === 0) return null;
  const people = await rooms.listParticipants(room);
  return people.map((p) => p.identity);
}

/** Without this the room lives until `empty_timeout`, orphaned for minutes. */
export async function dropRoom(name: string): Promise<void> {
  try {
    await rooms.deleteRoom(name);
  } catch (err) {
    // It may have died on its own through empty_timeout; not an error.
    console.warn(`[room] delete failed for ${name}: ${(err as Error).message}`);
  }
}

export async function liveRoomNames(): Promise<string[]> {
  return (await rooms.listRooms()).map((r) => r.name);
}

/**
 * Granting and revoking the stage changes the permission on the SFU, not the
 * token. The client can ask all it likes: without the grant, LiveKit itself
 * refuses the track.
 */
async function setScreenPermission(
  room: string,
  identity: string,
  allowed: boolean,
): Promise<void> {
  // Permissions are atomic: LiveKit replaces the whole set.
  await rooms.updateParticipant(room, identity, undefined, {
    canSubscribe: true,
    canPublish: true,
    canPublishData: true,
    canPublishSources: allowed ? VOICE_AND_SCREEN : VOICE_ONLY,
  });
}

export function grantScreen(room: string, identity: string): Promise<void> {
  return setScreenPermission(room, identity, true);
}

/** Revoking drops the live track: the server taking it, not asking for it. */
export async function revokeScreen(room: string, identity: string): Promise<void> {
  try {
    await setScreenPermission(room, identity, false);
  } catch (err) {
    // Somebody who already left no longer exists to the SFU; not an error.
    console.warn(`[stage] revoke failed for ${identity}: ${(err as Error).message}`);
  }
}
