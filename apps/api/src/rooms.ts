import { randomBytes, randomUUID, createHmac, timingSafeEqual } from "node:crypto";
import type { DjState, Feature, StageState } from "@drive-in/shared";
import { env } from "./env.ts";
import { redis } from "./redis.ts";

/** A room is a Redis key with an expiry. No database: nothing outlives the session. */
export interface Room {
  token: string;
  /**
   * What is playing. Typed by whoever is in the room, not looked up in any
   * catalogue: this project talks to no external service.
   */
  feature?: Feature;
  livekitRoom: string;
  createdAt: number;
  expiresAt: number;
  locked: boolean;
  stage: StageState;
  /*
    DJ mode's queue and transport. It lives here because it belongs to the room,
    not to whoever is playing: the person who turned the mode on can close their
    browser and the queue carries on. Optional on read, because rooms created
    before this existed have no such field.
  */
  dj?: DjState;
}

const key = (token: string) => `room:${token}`;

/** Shape of a room token. Worth validating before touching Redis at all. */
export const TOKEN_SHAPE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

export async function createRoom(feature?: Feature): Promise<Room> {
  const token = randomUUID();
  const now = Date.now();
  const room: Room = {
    token,
    feature,
    livekitRoom: `room-${token.slice(0, 8)}`,
    createdAt: now,
    expiresAt: now + env.roomTtlHours * 3600_000,
    locked: false,
    stage: { status: "free" },
    dj: { active: false, queue: [] },
  };
  await redis.set(key(token), JSON.stringify(room), {
    expiration: { type: "PX", value: env.roomTtlHours * 3600_000 },
  });
  return room;
}

export async function getRoom(token: string): Promise<Room | null> {
  if (!TOKEN_SHAPE.test(token)) return null;
  const raw = await redis.get(key(token));
  return raw ? (JSON.parse(raw) as Room) : null;
}

export async function saveRoom(room: Room): Promise<void> {
  const remaining = room.expiresAt - Date.now();
  if (remaining <= 0) {
    await redis.del(key(room.token));
    return;
  }
  await redis.set(key(room.token), JSON.stringify(room), {
    expiration: { type: "PX", value: remaining },
  });
}

export async function closeRoom(token: string): Promise<void> {
  // Same check as on read: without it, a forged token would delete another key.
  if (!TOKEN_SHAPE.test(token)) return;
  await redis.del(key(token));
}

export async function listRooms(): Promise<Room[]> {
  const found: Room[] = [];
  for await (const keys of redis.scanIterator({ MATCH: "room:*", COUNT: 100 })) {
    for (const k of keys) {
      const raw = await redis.get(k);
      if (raw) found.push(JSON.parse(raw) as Room);
    }
  }
  return found.sort((a, b) => b.createdAt - a.createdAt);
}

/**
 * Reading the room, seeing the stage free and writing afterwards is a race: two
 * simultaneous requests both win. SET NX decides it in one step.
 */
export async function acquireStage(token: string, userId: string): Promise<boolean> {
  const ok = await redis.set(`stage:${token}`, userId, {
    condition: "NX",
    expiration: { type: "PX", value: env.roomTtlHours * 3600_000 },
  });
  return ok === "OK";
}

export async function releaseStageLock(token: string): Promise<void> {
  await redis.del(`stage:${token}`);
}

export async function stageLockHolder(token: string): Promise<string | null> {
  return redis.get(`stage:${token}`);
}

export async function allStageLocks(): Promise<string[]> {
  const found: string[] = [];
  for await (const keys of redis.scanIterator({ MATCH: "stage:*", COUNT: 100 })) {
    for (const k of keys) found.push(k.replace(/^stage:/, ""));
  }
  return found;
}

export function timeLeft(room: Room): number {
  return room.expiresAt - Date.now();
}

/** Never log the whole token: it is the room's credential. */
export function tokenHint(token: string): string {
  return token.slice(0, 6) + "…";
}

/**
 * The token goes in the fragment. Browsers never send the fragment to the
 * server, so it stays out of access logs and never leaks through Referer.
 */
export function roomLink(token: string): string {
  return `${env.publicBaseUrl}/s/#${token}`;
}

// --- Participant session ---

/** Not an account: a signed token with room, id and name, dying with the room. */
export interface SessionClaims {
  room: string;
  userId: string;
  name: string;
  /** It rides in the session because a WebSocket arrival already has one picked. */
  paint: number;
  exp: number;
}

function sign(data: string): string {
  return createHmac("sha256", env.sessionSecret).update(data).digest("base64url");
}

export function issueSession(claims: SessionClaims): string {
  const body = Buffer.from(JSON.stringify(claims)).toString("base64url");
  return `${body}.${sign(body)}`;
}

export function readSession(token: string | undefined): SessionClaims | null {
  if (!token) return null;
  const [body, mac] = token.split(".");
  if (!body || !mac) return null;

  const expected = Buffer.from(sign(body));
  const given = Buffer.from(mac);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;

  try {
    const claims = JSON.parse(Buffer.from(body, "base64url").toString()) as SessionClaims;
    return claims.exp > Date.now() ? claims : null;
  } catch {
    return null;
  }
}

export function newUserId(): string {
  return randomBytes(8).toString("hex");
}
