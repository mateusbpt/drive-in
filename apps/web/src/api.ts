import type { Feature, JoinResponse, RoomSummary } from "@drive-in/shared";

/** Same domain on purpose: no CORS, and a same-origin WebSocket. */
const BASE = "/api";

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(BASE + path, {
    ...init,
    headers: { "content-type": "application/json", ...init?.headers },
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new ApiError(res.status, body?.error ?? `request failed (${res.status})`);
  }
  return (await res.json()) as T;
}

export function roomSummary(token: string): Promise<RoomSummary> {
  return request<RoomSummary>(`/rooms/${token}`);
}

export function joinRoom(
  token: string,
  displayName: string,
  paint: number,
): Promise<JoinResponse> {
  return request<JoinResponse>(`/rooms/${token}/join`, {
    method: "POST",
    body: JSON.stringify({ displayName, paint }),
  });
}

export function setFeature(session: string, choice: Feature | null): Promise<{ ok: true }> {
  return request<{ ok: true }>("/feature/set", {
    method: "POST",
    headers: { authorization: `Bearer ${session}` },
    body: JSON.stringify(choice ? { ...choice } : { clear: true }),
  });
}

export function takeStage(session: string): Promise<{ ok: true }> {
  return request<{ ok: true }>("/stage/take", {
    method: "POST",
    headers: { authorization: `Bearer ${session}` },
  });
}

export function releaseStage(session: string): Promise<{ ok: true }> {
  return request<{ ok: true }>("/stage/release", {
    method: "POST",
    headers: { authorization: `Bearer ${session}` },
  });
}

export function presenceSocketUrl(session: string): string {
  const proto = location.protocol === "https:" ? "wss:" : "ws:";
  return `${proto}//${location.host}${BASE}/ws?session=${encodeURIComponent(session)}`;
}

/**
 * The token lives in the fragment, which the browser never sends to the server:
 * it stays out of access logs and out of the Referer.
 *
 * A token of the wrong shape can be called out without asking anyone. A token of
 * the right shape that the server cannot find is ambiguous on purpose: telling
 * "never existed" from "expired" would confirm the token once existed.
 */
export type RoomUrl =
  | { kind: "root" }
  | { kind: "malformed" }
  | { kind: "token"; token: string };

/** Same shape the api validates: UUID v4. */
const TOKEN_SHAPE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

export function readRoomUrl(): RoomUrl {
  const path = location.pathname.replace(/\/+$/, "");
  const token = location.hash.replace(/^#/, "").trim();

  if (path === "" && token === "") return { kind: "root" };
  if (TOKEN_SHAPE.test(token)) return { kind: "token", token };

  return { kind: "malformed" };
}
