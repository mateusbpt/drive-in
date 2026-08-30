import type { WebSocket } from "ws";
import type { Participant, ServerEvent, SessionState } from "@drive-in/shared";
import type { Room } from "./rooms.ts";

/** In memory on purpose: this is state of the moment. A restart loses nothing. */
type Member = {
  userId: string;
  displayName: string;
  micEnabled: boolean;
  speaking: boolean;
  latencyMs?: number;
  /** Chosen on the way in; the car is each person's visual identity. */
  paint: number;
  /** Last sign of life. An open socket does not prove the tab still answers. */
  lastSeen: number;
  socket: WebSocket;
};

const byRoom = new Map<string, Map<string, Member>>();

/**
 * The room record is not deleted when it empties — if it were, the sweep would
 * never see an empty room to close. A restart resets the clock, and five extra
 * minutes beats closing the door on somebody about to reconnect.
 */
const emptySince = new Map<string, number>();

function members(roomToken: string): Map<string, Member> {
  let m = byRoom.get(roomToken);
  if (!m) {
    m = new Map();
    byRoom.set(roomToken, m);
  }
  return m;
}

export function join(roomToken: string, member: Member): void {
  members(roomToken).set(member.userId, member);
  emptySince.delete(roomToken);
}

/**
 * A protocol-level ping, answered by the browser's own network stack. A
 * `setInterval` heartbeat is not enough on its own: Chrome throttles background
 * tab timers to one firing per minute, and whoever is sharing their screen is
 * precisely the person who switched to another window — they were being dropped
 * mid-broadcast for looking silent.
 */
export function pingAll(): void {
  for (const room of byRoom.values()) {
    for (const member of room.values()) {
      try {
        member.socket.ping();
      } catch {
        // Dead socket: removing from the list is the sweep's job.
      }
    }
  }
}

export function heartbeat(roomToken: string, userId: string): void {
  const member = byRoom.get(roomToken)?.get(userId);
  if (member) member.lastSeen = Date.now();
}

/**
 * Removes whoever stopped showing signs of life. A frozen tab keeps the socket
 * open and TCP takes its time giving up — without this the person stays listed
 * until then, and on coming back appeared twice.
 */
export function pruneStale(roomToken: string, maxIdleMs: number): string[] {
  const gone: string[] = [];
  const room = members(roomToken);
  for (const [userId, member] of room) {
    if (Date.now() - member.lastSeen <= maxIdleMs) continue;
    gone.push(userId);
    try {
      member.socket.close();
    } catch {
      // Socket already dead: what matters is getting the person off the list.
    }
    room.delete(userId);
  }
  if (gone.length > 0 && room.size === 0) emptySince.set(roomToken, Date.now());
  return gone;
}

/** Colours already in use in the room, so the next person does not repeat one. */
export function takenPaints(roomToken: string): number[] {
  return [...members(roomToken).values()].map((m) => m.paint);
}

export function leave(roomToken: string, userId: string): void {
  const m = byRoom.get(roomToken);
  if (!m) return;
  m.delete(userId);
  if (m.size === 0 && !emptySince.has(roomToken)) emptySince.set(roomToken, Date.now());
}

export function emptyLongerThan(ms: number): string[] {
  const now = Date.now();
  return [...emptySince].filter(([, since]) => now - since >= ms).map(([token]) => token);
}

export function forget(roomToken: string): void {
  byRoom.delete(roomToken);
  emptySince.delete(roomToken);
}

export function headcount(roomToken: string): number {
  return byRoom.get(roomToken)?.size ?? 0;
}

export function setMic(roomToken: string, userId: string, enabled: boolean): void {
  const member = byRoom.get(roomToken)?.get(userId);
  if (!member) return;
  member.micEnabled = enabled;
  if (!enabled) member.speaking = false;
}

/**
 * Each browser measures its own round trip to the SFU; here we only store it.
 * Returns whether the value moved enough to be worth broadcasting — a few
 * milliseconds of drift is noise, and telling the whole room about every reading
 * is chatter for nothing.
 */
export function setLatency(roomToken: string, userId: string, ms: number): boolean {
  const member = byRoom.get(roomToken)?.get(userId);
  if (!member) return false;
  const before = member.latencyMs;
  member.latencyMs = ms;
  return before === undefined || Math.abs(before - ms) >= 5;
}

export function listParticipants(roomToken: string): Participant[] {
  return [...members(roomToken).values()].map(
    ({ userId, displayName, micEnabled, speaking, latencyMs, paint }) => ({
      userId,
      displayName,
      micEnabled,
      speaking,
      latencyMs,
      paint,
    }),
  );
}

export function sessionState(room: Room): SessionState {
  return {
    roomName: room.livekitRoom,
    feature: room.feature && {
      title: room.feature.title,
      year: room.feature.year,
    },
    participants: listParticipants(room.token),
    stage: room.stage,
    // A room opened before DJ mode existed has no such field stored.
    dj: room.dj ?? { active: false, queue: [] },
  };
}

export function broadcast(roomToken: string, event: ServerEvent, exceptUserId?: string): void {
  const payload = JSON.stringify(event);
  for (const member of members(roomToken).values()) {
    if (member.userId === exceptUserId) continue;
    if (member.socket.readyState === member.socket.OPEN) member.socket.send(payload);
  }
}

export function sendTo(roomToken: string, userId: string, event: ServerEvent): void {
  const member = byRoom.get(roomToken)?.get(userId);
  if (member && member.socket.readyState === member.socket.OPEN) {
    member.socket.send(JSON.stringify(event));
  }
}

export function isPresent(roomToken: string, userId: string): boolean {
  return byRoom.get(roomToken)?.has(userId) ?? false;
}

export function activeRoomTokens(): string[] {
  return [...byRoom.keys()];
}
