import { serve } from "@hono/node-server";
import { getConnInfo } from "@hono/node-server/conninfo";
import { Hono, type Context } from "hono";
import { WebSocketServer } from "ws";
import { z } from "zod";
import {
  NAME_MAX_LENGTH,
  PAINT_COUNT,
  ROOM_CAPACITY,
  type ClientCommand,
  type JoinResponse,
  type RoomSummary,
} from "@drive-in/shared";
import { env } from "./env.ts";
import { connectRedis, redis } from "./redis.ts";
import { ensureRoom, participantToken } from "./livekit.ts";
import * as presence from "./presence.ts";
import * as stage from "./stage.ts";
import * as dj from "./dj.ts";
import { startPresenceSweep, startRoomSweep } from "./lifecycle.ts";
import {
  getRoom,
  issueSession,
  newUserId,
  readSession,
  saveRoom,
  type SessionClaims,
} from "./rooms.ts";
import { mountWeb, securityHeaders } from "./web.ts";

const app = new Hono();

app.use("*", securityHeaders);

/** The token's entropy already makes guessing hopeless; this is the seat belt. */
const attempts = new Map<string, { count: number; resetAt: number }>();
const MAX_ATTEMPTS = 30;
const WINDOW_MS = 60_000;

function rateLimited(ip: string): boolean {
  const now = Date.now();

  // Without pruning, every new IP becomes an eternal entry.
  if (attempts.size > 5_000) {
    for (const [k, v] of attempts) if (v.resetAt < now) attempts.delete(k);
  }

  const entry = attempts.get(ip);
  if (!entry || entry.resetAt < now) {
    attempts.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return false;
  }
  entry.count += 1;
  return entry.count > MAX_ATTEMPTS;
}

/**
 * Only X-Real-IP, which the edge proxy overwrites, and the socket.
 * X-Forwarded-For is ignored: the client chooses what to put in it.
 */
function clientIp(c: Context): string {
  const real = c.req.header("x-real-ip")?.trim();
  if (real) return real;
  return getConnInfo(c).remote.address ?? "unknown";
}

const featureBody = z.object({
  clear: z.boolean().optional(),
  title: z.string().trim().min(1).max(120).optional(),
  year: z.string().regex(/^\d{4}$/).nullable().optional(),
});

const joinBody = z.object({
  displayName: z.string().trim().min(1).max(NAME_MAX_LENGTH),
  paint: z.number().int().min(0).max(PAINT_COUNT - 1),
});

app.get("/api/health", (c) => c.json({ ok: true }));

app.get("/api/rooms/:token", async (c) => {
  // Unlimited, this route becomes an enumeration oracle that costs no join quota.
  if (rateLimited(clientIp(c))) {
    return c.json({ error: "Too many attempts. Wait a minute." }, 429);
  }
  const room = await getRoom(c.req.param("token"));
  if (!room) return c.json({ error: "Room not found." }, 404);
  const summary: RoomSummary = {
    locked: room.locked,
    full: presence.headcount(room.token) >= ROOM_CAPACITY,
    takenPaints: presence.takenPaints(room.token),
    feature: room.feature && {
      title: room.feature.title,
      year: room.feature.year,
    },
    expiresAt: room.expiresAt,
  };
  return c.json(summary);
});

app.post("/api/rooms/:token/join", async (c) => {
  if (rateLimited(clientIp(c))) {
    return c.json({ error: "Too many attempts. Wait a minute." }, 429);
  }

  const room = await getRoom(c.req.param("token"));
  if (!room) return c.json({ error: "Room not found." }, 404);
  if (room.locked) return c.json({ error: "Room locked." }, 403);
  if (presence.headcount(room.token) >= ROOM_CAPACITY) {
    return c.json({ error: "Room full." }, 403);
  }

  const parsed = joinBody.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: "Invalid name." }, 400);

  // The room on the SFU has to exist before anyone connects: without it, 404,
  // and the WebSocket never even opens.
  await ensureRoom(room.livekitRoom);

  const userId = newUserId();
  const displayName = parsed.data.displayName;
  const claims: SessionClaims = {
    room: room.token,
    userId,
    name: displayName,
    paint: parsed.data.paint,
    exp: room.expiresAt,
  };

  const body: JoinResponse = {
    session: issueSession(claims),
    userId,
    livekitToken: await participantToken(
      room.livekitRoom,
      userId,
      displayName,
      // Seconds of life the room has left, never less than a minute.
      Math.max(60, Math.ceil((room.expiresAt - Date.now()) / 1000)),
    ),
    livekitUrl: env.livekitPublicUrl,
    state: presence.sessionState(room),
  };
  return c.json(body);
});

async function requireSession(header: string | undefined) {
  const claims = readSession(header?.replace(/^Bearer /, ""));
  if (!claims) return null;
  const room = await getRoom(claims.room);
  if (!room) return null;
  return { claims, room };
}

/** Anyone in the room changes what is playing; it is their room. */
app.post("/api/feature/set", async (c) => {
  const auth = await requireSession(c.req.header("authorization"));
  if (!auth) return c.json({ error: "Invalid session." }, 401);

  const parsed = featureBody.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: "Invalid title." }, 400);

  auth.room.feature = parsed.data.clear
    ? undefined
    : {
        title: parsed.data.title ?? "",
        year: parsed.data.year ?? null,
      };
  await saveRoom(auth.room);

  presence.broadcast(auth.room.token, {
    type: "session:state",
    payload: presence.sessionState(auth.room),
  });
  return c.json({ ok: true });
});

app.post("/api/stage/take", async (c) => {
  const auth = await requireSession(c.req.header("authorization"));
  if (!auth) return c.json({ error: "Invalid session." }, 401);

  // Only somebody actually in the room can ask for the stage.
  if (!presence.isPresent(auth.room.token, auth.claims.userId)) {
    return c.json({ error: "Come into the room before turning the projector on." }, 409);
  }

  try {
    const result = await stage.take(auth.room, auth.claims.userId, auth.claims.name);
    if (!result.ok) return c.json({ error: "Somebody else already has the screen." }, 409);
    return c.json({ ok: true });
  } catch (err) {
    // It must not become a bare 500: whoever clicked needs to know it was not them.
    console.error("[stage] grant failed", err);
    // A 404 from the SFU means their video connection dropped: they still show
    // up in the room because the presence WebSocket is a different one, still up.
    if ((err as { status?: number }).status === 404) {
      return c.json({ error: "Your video connection dropped. Reload the page." }, 409);
    }
    return c.json({ error: "Could not start broadcasting. Try again." }, 502);
  }
});

app.post("/api/stage/release", async (c) => {
  const auth = await requireSession(c.req.header("authorization"));
  if (!auth) return c.json({ error: "Invalid session." }, 401);

  const current = auth.room.stage;
  if (current.status !== "occupied" || current.userId !== auth.claims.userId) {
    return c.json({ error: "The screen is not yours." }, 403);
  }

  await stage.release(auth.room);
  return c.json({ ok: true });
});

app.all("/api/*", (c) => c.json({ error: "Route not found." }, 404));
mountWeb(app);

await connectRedis();

const server = serve({ fetch: app.fetch, port: env.port }, (info) => {
  console.log(`[api] listening on :${info.port}`);
});

/**
 * DJ mode commands. Each one re-reads the room before touching it: two people
 * can be touching it at once. There is no owner — whoever is in the room adds,
 * removes, skips and pauses. It is their room.
 */
async function handleDj(
  cmd: ClientCommand,
  token: string,
  userId: string,
  displayName: string,
): Promise<void> {
  const room = await getRoom(token);
  if (!room) return;

  const refusal = (message: string) =>
    presence.sendTo(token, userId, { type: "dj:error", payload: { message } });

  switch (cmd.type) {
    case "dj:enter":
      if (room.stage.status === "occupied") {
        return refusal("Somebody is broadcasting. DJ mode darkens the screen.");
      }
      await dj.enter(room);
      break;

    case "dj:leave":
      await dj.leave(room);
      break;

    case "dj:add": {
      const failure = await dj.add(room, String(cmd.payload?.url ?? ""), userId, displayName);
      if (failure) return refusal(failure);
      break;
    }

    case "dj:remove":
      await dj.remove(room, String(cmd.payload?.id ?? ""));
      break;

    case "dj:clear":
      await dj.clear(room);
      break;

    case "dj:play":
      await dj.play(room, Number(cmd.payload?.index));
      break;

    case "dj:toggle":
      await dj.toggle(room);
      break;

    case "dj:skip":
      await dj.skip(room, Number(cmd.payload?.delta));
      break;

    case "dj:ended":
      // The index in the report guards against skipping twice: a report that
      // arrives after the change no longer matches the track now playing.
      await dj.ended(room, Number(cmd.payload?.index));
      break;

    default:
      return;
  }

  await announceState(token);
}

/*
  Re-reads the room before announcing. The WebSocket handler holds the object
  from when the person connected; taking the stage mutates a different instance
  and writes it to Redis, so announcing the held instance sent the old stage —
  and whoever was broadcasting watched their own stage vanish when they touched
  the microphone.
*/
async function announceState(token: string): Promise<void> {
  const fresh = await getRoom(token);
  if (!fresh) return;
  presence.broadcast(token, {
    type: "session:state",
    payload: presence.sessionState(fresh),
  });
}

/** Time for a page reload or a brief drop to find the stage again. */
const RECONNECT_GRACE_MS = 15_000;

// --- Presence WebSocket ---

const wss = new WebSocketServer({ noServer: true });

server.on("upgrade", (req, socket, head) => {
  const url = new URL(req.url ?? "/", "http://localhost");
  if (url.pathname !== "/api/ws") {
    socket.destroy();
    return;
  }
  wss.handleUpgrade(req, socket, head, (ws) => {
    wss.emit("connection", ws, req);
  });
});

wss.on("connection", async (ws, req) => {
  const url = new URL(req.url ?? "/", "http://localhost");
  const auth = await requireSession(url.searchParams.get("session") ?? undefined);

  if (!auth) {
    ws.send(JSON.stringify({ type: "error", payload: { message: "Invalid session." } }));
    ws.close();
    return;
  }

  const { claims, room } = auth;

  // The HTTP join's count may be stale: coming in for real happens here.
  if (
    !presence.isPresent(room.token, claims.userId) &&
    presence.headcount(room.token) >= ROOM_CAPACITY
  ) {
    ws.send(JSON.stringify({ type: "error", payload: { message: "Room full." } }));
    ws.close();
    return;
  }

  presence.join(room.token, {
    userId: claims.userId,
    displayName: claims.name,
    micEnabled: true,
    speaking: false,
    paint: claims.paint,
    lastSeen: Date.now(),
    socket: ws,
  });

  presence.broadcast(room.token, {
    type: "session:state",
    payload: presence.sessionState(room),
  });

  // The browser's automatic answer to the protocol `ping`: it counts as a sign
  // of life even with the tab in the background, where timers do not run.
  ws.on("pong", () => presence.heartbeat(room.token, claims.userId));

  ws.on("message", (raw) => {
    let cmd: ClientCommand;
    try {
      cmd = JSON.parse(String(raw)) as ClientCommand;
    } catch {
      return;
    }

    if (cmd.type === "ping") {
      presence.heartbeat(room.token, claims.userId);
      return;
    }

    if (cmd.type === "latency:set") {
      const ms = Number(cmd.payload?.ms);
      // A client-supplied value: we only accept a plausible network time.
      if (Number.isFinite(ms) && ms >= 0 && ms < 10_000) {
        const changed = presence.setLatency(room.token, claims.userId, Math.round(ms / 10) * 10);
        if (changed) void announceState(room.token);
      }
      return;
    }

    if (cmd.type === "mic:set") {
      presence.setMic(room.token, claims.userId, cmd.payload.enabled);
      void announceState(room.token);
      return;
    }

    if (cmd.type.startsWith("dj:")) {
      void handleDj(cmd, room.token, claims.userId, claims.name);
    }
  });

  ws.on("close", async () => {
    presence.leave(room.token, claims.userId);

    const fresh = await getRoom(room.token);
    if (fresh) {
      presence.broadcast(fresh.token, {
        type: "session:state",
        payload: presence.sessionState(fresh),
      });
    }

    // The stage does not fall with the socket: a network drop and a page reload
    // both close the connection without anybody having stopped broadcasting, and
    // releasing straight away took the screen from whoever was on air. The
    // session survives a reload, so coming back inside the grace period finds
    // the stage where it was left.
    setTimeout(() => {
      void (async () => {
        if (presence.isPresent(room.token, claims.userId)) return;
        const now = await getRoom(room.token);
        if (now?.stage.status === "occupied" && now.stage.userId === claims.userId) {
          await stage.release(now);
        }
      })().catch((err) => console.error("[stage] release on close failed", err));
    }, RECONNECT_GRACE_MS);
  });
});

stage.startIdleSweep();
startRoomSweep();
startPresenceSweep();

// Staying up with the rooms unreachable is worse than restarting.
redis.on("end", () => {
  console.error("[api] Redis connection ended — exiting");
  process.exit(1);
});

export { app };
