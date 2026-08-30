import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  Feature,
  JoinResponse,
  RoomSummary,
  ServerEvent,
  SessionState,
} from "@drive-in/shared";
import * as api from "../api";
import { ui } from "../strings";

const PING_MS = 10_000;

/**
 * The session is kept per room for as long as the tab lives. Without this, a
 * reload minted another `userId` and the same person appeared twice.
 *
 * `sessionStorage` and not `localStorage` on purpose: the identity survives an
 * F5 but dies when the tab closes — which is what "the name dies with the room"
 * means.
 */
const stored = {
  chave: (token: string) => `cinema:sessao:${token}`,
  ler(token: string): JoinResponse | null {
    try {
      const raw = sessionStorage.getItem(this.chave(token));
      return raw ? (JSON.parse(raw) as JoinResponse) : null;
    } catch {
      return null;
    }
  },
  gravar(token: string, res: JoinResponse) {
    try {
      sessionStorage.setItem(this.chave(token), JSON.stringify(res));
    } catch {
      // A browser with no storage: all we lose is the reuse.
    }
  },
  clear(token: string) {
    try {
      sessionStorage.removeItem(this.chave(token));
    } catch {
      // Same.
    }
  },
};

export type Phase =
  | { name: "loading" }
  | { name: "missing" }
  | { name: "join"; summary: RoomSummary }
  | { name: "inside" }
  | { name: "error"; message: string; gone?: boolean };

/** The server is the only source of truth: this hook only asks and listens. */
export function useRoom(roomToken: string | null) {
  const [phase, setPhase] = useState<Phase>({ name: "loading" });
  const [state, setState] = useState<SessionState | null>(null);
  const [me, setMe] = useState<JoinResponse | null>(null);
  const [stageError, setStageError] = useState<string | null>(null);
  /** A DJ mode refusal: it fades on its own, being a notice and not state. */
  const [djError, setDjError] = useState<string | null>(null);
  const socketRef = useRef<WebSocket | null>(null);
  /*
    Reconnection. The socket is the only channel for presence, stage and queue:
    with it down, the room freezes on whatever was true when it died and no
    command gets out. Leaving and coming back used to be the only fix — and every
    deploy drops the connection of everyone in the room.
  */
  const leaving = useRef(false);
  const attempts = useRef(0);
  const reconnect = useRef<number | null>(null);

  const connect = useCallback(
    (token: string, res: JoinResponse) => {
      setMe(res);
      setState(res.state);
      setPhase({ name: "inside" });
      leaving.current = false;
      attempts.current = 0;

      const open = () => {
        const socket = new WebSocket(api.presenceSocketUrl(res.session));
        socketRef.current = socket;

        socket.onopen = () => {
          attempts.current = 0;
        };

        /*
          Backoff up to ten seconds, with a pinch of jitter: without it, six tabs
          coming back together after a deploy hit the server at the same instant.
          The whole state returns on its own when the socket reconnects, because
          the server announces the session to whoever joins.
        */
        socket.onclose = () => {
          if (leaving.current || socketRef.current !== socket) return;
          const backoff = Math.min(10_000, 2 ** attempts.current * 1000);
          attempts.current += 1;
          reconnect.current = window.setTimeout(open, backoff + Math.random() * 400);
        };

        socket.onmessage = (ev) => {
          const event = JSON.parse(String(ev.data)) as ServerEvent;
          switch (event.type) {
            case "session:state":
              setState(event.payload);
              break;
            case "stage:released":
              break;
            case "dj:error":
              setDjError(event.payload.message);
              setTimeout(() => setDjError(null), 4000);
              break;
            case "room:closed":
              leaving.current = true;
              stored.clear(token);
              setPhase({ name: "error", message: ui.notice.sessionEnded, gone: true });
              break;
            case "error":
              /*
                Session refused: the stored one is no good any more, and insisting
                on it would leave the person stuck in an error an F5 cannot fix.
                It also stops reconnecting — the problem is not the connection.
              */
              leaving.current = true;
              stored.clear(token);
              setPhase({ name: "error", message: event.payload.message });
              break;
          }
        };
      };

      open();
    },
    [],
  );

  useEffect(() => {
    if (!roomToken) {
      setPhase({ name: "missing" });
      return;
    }
    let alive = true;
    const previous = stored.ler(roomToken);
    api
      .roomSummary(roomToken)
      .then((summary) => {
        if (!alive) return;
        // A reload must not ask for the name again nor mint another identity.
        if (previous) connect(roomToken, previous);
        else setPhase({ name: "join", summary });
      })
      .catch((err) =>
        alive
          ? setPhase({
              name: "error",
              message: err instanceof api.ApiError ? err.message : ui.notice.roomUnavailable,
              gone: err instanceof api.ApiError && err.status === 404,
            })
          : undefined,
      );
    return () => {
      alive = false;
    };
  }, [roomToken, connect]);

  const join = useCallback(
    async (displayName: string, paint: number) => {
      if (!roomToken) return;
      try {
        const res = await api.joinRoom(roomToken, displayName, paint);
        stored.gravar(roomToken, res);
        connect(roomToken, res);
      } catch (err) {
        setPhase({
          name: "error",
          message: err instanceof api.ApiError ? err.message : ui.notice.couldNotEnter,
          gone: err instanceof api.ApiError && err.status === 404,
        });
      }
    },
    [roomToken, connect],
  );

  const takeStage = useCallback(async (): Promise<boolean> => {
    if (!me) return false;
    setStageError(null);
    try {
      await api.takeStage(me.session);
      return true;
    } catch (err) {
      // Failing silently makes people click again thinking they got it wrong.
      setStageError(
        err instanceof api.ApiError ? err.message : ui.notice.couldNotProject,
      );
      return false;
    }
  }, [me]);

  const releaseStage = useCallback(async () => {
    if (!me) return;
    await api.releaseStage(me.session).catch(() => undefined);
  }, [me]);

  /** A sign of life every ten seconds; the server drops whoever goes quiet. */
  useEffect(() => {
    const id = setInterval(() => {
      socketRef.current?.send(JSON.stringify({ type: "ping" }));
    }, PING_MS);
    return () => clearInterval(id);
  }, []);

  const reportLatency = useCallback((ms: number) => {
    socketRef.current?.send(JSON.stringify({ type: "latency:set", payload: { ms } }));
  }, []);

  /**
   * Leaving for real: clears the stored session before reloading. Without this
   * the reload would reuse the identity and put the person straight back in.
   */
  const leave = useCallback(() => {
    leaving.current = true;
    if (reconnect.current) clearTimeout(reconnect.current);
    if (roomToken) stored.clear(roomToken);
    socketRef.current?.close();
    location.reload();
  }, [roomToken]);

  const pickFeature = useCallback(
    (choice: Feature | null) => {
      if (!me) return;
      // The new state arrives by broadcast; here we only ask for the change.
      void api.setFeature(me.session, choice).catch(() => undefined);
    },
    [me],
  );

  const setMicFlag = useCallback((enabled: boolean) => {
    socketRef.current?.send(JSON.stringify({ type: "mic:set", payload: { enabled } }));
  }, []);

  /*
    DJ mode. Everything goes through the WebSocket that already exists, and the
    state comes back in `session:state`: the client never decides what plays, it
    only asks.
  */
  const dj = useMemo(
    () => ({
      enter: () => socketRef.current?.send(JSON.stringify({ type: "dj:enter" })),
      leave: () => socketRef.current?.send(JSON.stringify({ type: "dj:leave" })),
      add: (url: string) =>
        socketRef.current?.send(JSON.stringify({ type: "dj:add", payload: { url } })),
      remove: (id: string) =>
        socketRef.current?.send(JSON.stringify({ type: "dj:remove", payload: { id } })),
      clear: () => socketRef.current?.send(JSON.stringify({ type: "dj:clear" })),
      play: (index: number) =>
        socketRef.current?.send(JSON.stringify({ type: "dj:play", payload: { index } })),
      toggle: () => socketRef.current?.send(JSON.stringify({ type: "dj:toggle" })),
      skip: (delta: number) =>
        socketRef.current?.send(JSON.stringify({ type: "dj:skip", payload: { delta } })),
      ended: (index: number) =>
        socketRef.current?.send(JSON.stringify({ type: "dj:ended", payload: { index } })),
    }),
    [],
  );

  useEffect(
    () => () => {
      leaving.current = true;
      if (reconnect.current) clearTimeout(reconnect.current);
      socketRef.current?.close();
    },
    [],
  );

  return {
    phase,
    state,
    me,
    stageError,
    join,
    leave,
    pickFeature,
    takeStage,
    releaseStage,
    setMicFlag,
    reportLatency,
    dj,
    djError,
  };
}
