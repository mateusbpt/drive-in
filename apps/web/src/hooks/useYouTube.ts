import { useEffect, useRef, useState } from "react";
import type { DjPlayback } from "@drive-in/shared";

/*
  Each person's own YouTube player, obeying the room's clock. The video never
  passes through our media server: the server says which track and since when,
  and every browser puts itself at the same second. Whoever arrives mid-song
  lands at the right point with nobody telling them.
*/

/** The slice of the YouTube API we use, without pulling in their types. */
interface YTPlayer {
  loadVideoById(opts: { videoId: string; startSeconds?: number }): void;
  playVideo(): void;
  pauseVideo(): void;
  seekTo(seconds: number, allowSeekAhead: boolean): void;
  getCurrentTime(): number;
  getDuration(): number;
  getPlayerState(): number;
  stopVideo(): void;
  setVolume(v: number): void;
  destroy(): void;
}

interface YTGlobal {
  Player: new (
    el: HTMLElement,
    opts: {
      videoId?: string;
      playerVars?: Record<string, string | number>;
      events?: {
        onReady?: () => void;
        onStateChange?: (e: { data: number }) => void;
        onError?: () => void;
      };
    },
  ) => YTPlayer;
  PlayerState: { ENDED: number; PLAYING: number; PAUSED: number };
}

declare global {
  interface Window {
    YT?: YTGlobal;
    onYouTubeIframeAPIReady?: () => void;
  }
}

const SRC = "https://www.youtube.com/iframe_api";
/** Drift tolerated before seeking. Any tighter and it turns into hiccups. */
const MAX_DRIFT_S = 1.8;
/** `YT.PlayerState.ENDED`, without depending on the global being loaded. */
const STATE_ENDED = 0;

let loading: Promise<YTGlobal> | null = null;

/** Loads iframe_api exactly once, however often the scene mounts and unmounts. */
function loadApi(): Promise<YTGlobal> {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (loading) return loading;

  loading = new Promise<YTGlobal>((resolve, reject) => {
    const tag = document.createElement("script");
    tag.src = SRC;
    tag.async = true;
    tag.onerror = () => reject(new Error("iframe_api failed to load"));
    window.onYouTubeIframeAPIReady = () => {
      if (window.YT?.Player) resolve(window.YT);
      else reject(new Error("iframe_api has no Player"));
    };
    document.head.appendChild(tag);
  });
  return loading;
}

/** Where the track should be right now, by the room's clock. */
export function expectedPosition(p: DjPlayback): number {
  if (p.paused) return p.offsetSec;
  return p.offsetSec + (Date.now() - p.startedAt) / 1000;
}

type Options = {
  videoId: string | null;
  playback?: DjPlayback;
  /** 0 to 100, from the controls. It is per person, not per room. */
  volume: number;
  /** Only the reporter announces the end; the others would all repeat it. */
  onEnded?: () => void;
};

export function useYouTube({ videoId, playback, volume, onEnded }: Options) {
  const box = useRef<HTMLDivElement>(null);
  const player = useRef<YTPlayer | null>(null);
  const loaded = useRef<string | null>(null);
  const endRef = useRef(onEnded);
  endRef.current = onEnded;

  const [ready, setReady] = useState(false);
  /** Last video whose end was reported, so it is never reported twice. */
  const endReported = useRef<string | null>(null);
  /** The browser refused sound before a gesture; the scene offers the button. */
  const [blocked, setBlocked] = useState(false);
  const [duration, setDuration] = useState<number | null>(null);
  const [position, setPosition] = useState(0);

  useEffect(() => {
    let alive = true;
    void loadApi()
      .then((YT) => {
        if (!alive || !box.current || player.current) return;
        player.current = new YT.Player(box.current, {
          playerVars: {
            // No end-of-video suggestions and none of their controls: the room
            // owns the transport.
            rel: 0,
            controls: 0,
            disablekb: 1,
            playsinline: 1,
            modestbranding: 1,
          },
          events: {
            onReady: () => alive && setReady(true),
            onStateChange: (e) => {
              if (!alive || !window.YT) return;
              if (e.data === window.YT.PlayerState.ENDED) endRef.current?.();
              if (e.data === window.YT.PlayerState.PLAYING) setBlocked(false);
            },
          },
        });
      })
      .catch(() => undefined);

    return () => {
      alive = false;
      player.current?.destroy();
      player.current = null;
    };
  }, []);

  // Track change: load straight at the right second, otherwise the track starts
  // from zero and is only then repositioned, with an audible jolt.
  useEffect(() => {
    const p = player.current;
    if (!ready || !p) return;

    if (!videoId) {
      // `stop` and not `pause`: paused, the player keeps the last frame on
      // screen, and a cleared queue went on showing the track that just left.
      try {
        p.stopVideo();
      } catch {
        p.pauseVideo();
      }
      loaded.current = null;
      // With no track there is nothing to unlock: the blocked-sound notice goes too.
      setBlocked(false);
      /*
        Duration and position die with the track too. Without this the display
        read "Nothing playing" with the 4:12 of the track that just left still
        on the clock.
      */
      setDuration(null);
      setPosition(0);
      return;
    }

    if (loaded.current !== videoId) {
      loaded.current = videoId;
      endReported.current = null;
      p.loadVideoById({
        videoId,
        startSeconds: playback ? Math.max(0, expectedPosition(playback)) : 0,
      });
    }
  }, [videoId, ready, playback]);

  // Obeys the room's transport and corrects drift every second.
  useEffect(() => {
    if (!ready || !playback || !videoId) return;

    const adjust = () => {
      const p = player.current;
      if (!p) return;

      /*
        The breath between tracks: the server marks the start in the future, and
        until then the player waits still at the beginning. Without this the new
        track landed on top of the previous one's last chord.
      */
      if (Date.now() < playback.startedAt) {
        p.pauseVideo();
        return;
      }

      const target = Math.max(0, expectedPosition(playback));
      let current = 0;
      let currentDuration = 0;
      try {
        current = p.getCurrentTime();
        currentDuration = p.getDuration();
        if (currentDuration > 0) setDuration(currentDuration);
      } catch {
        return;
      }
      setPosition(current);

      const playerState = p.getPlayerState();

      /*
        End of track, by two routes. The player's event is the first; the second
        is the room clock passing the duration, which covers the event never
        arriving — a background tab has its timers throttled.
      */
      const finished = playerState === STATE_ENDED || (currentDuration > 0 && target > currentDuration - 0.4);
      if (finished) {
        if (endReported.current !== videoId) {
          endReported.current = videoId;
          endRef.current?.();
        }
        return;
      }

      if (Math.abs(current - target) > MAX_DRIFT_S) p.seekTo(target, true);

      if (playback.paused) {
        p.pauseVideo();
        return;
      }

      /*
        -1 unstarted, 2 paused, 5 cued: in all three the sound does not start on
        its own. The "ended" state was excluded above: telling it to play would
        restart the track before the end report made it round through the server.
      */
      if (playerState !== window.YT?.PlayerState.PLAYING) {
        p.playVideo();
        if (playerState === -1 || playerState === 5) setBlocked(true);
      }
    };

    adjust();
    const id = setInterval(adjust, 1000);
    return () => clearInterval(id);
  }, [ready, playback, videoId]);

  useEffect(() => {
    try {
      player.current?.setVolume(volume);
    } catch {
      // Player not ready yet: the next adjustment will catch it.
    }
  }, [volume, ready, videoId]);

  /** Called from inside a click: that gesture is what releases the sound. */
  const unlock = () => {
    setBlocked(false);
    // With no track loaded, calling play resurrected the video that had left.
    if (!videoId) return;
    player.current?.playVideo();
  };

  return { box, ready, blocked, unlock, duration, position };
}
