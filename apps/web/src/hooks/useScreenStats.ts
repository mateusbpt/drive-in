import { useEffect, useRef, useState } from "react";
import { LocalVideoTrack, RemoteVideoTrack } from "livekit-client";
import type { ScreenTrack } from "./useLiveKit";

export type ScreenStats = {
  width: number;
  height: number;
  fps: number;
  kbps: number;
};

const SAMPLE_MS = 2000;

type Sample = { bytes: number; frames: number; at: number };

/** Measures what actually goes out: asking for 1080p does not guarantee it. */
export function useScreenStats(track: ScreenTrack | null): ScreenStats | null {
  const [stats, setStats] = useState<ScreenStats | null>(null);
  const previous = useRef<Sample | null>(null);

  useEffect(() => {
    if (!track) {
      setStats(null);
      previous.current = null;
      return;
    }

    let alive = true;

    const read = async () => {
      let width = 0;
      let height = 0;
      let bytes = 0;
      let frames = 0;
      // Only the sender reports fps; on the receiver it comes from frame counts.
      let reportedFps: number | null = null;

      if (track instanceof LocalVideoTrack) {
        // With simulcast off there is one layer, but the SDK returns a list.
        const [s] = await track.getSenderStats();
        if (!s) return;
        width = s.frameWidth ?? 0;
        height = s.frameHeight ?? 0;
        bytes = s.bytesSent ?? 0;
        frames = s.framesSent ?? 0;
        reportedFps = s.framesPerSecond ?? null;
      } else if (track instanceof RemoteVideoTrack) {
        const s = await track.getReceiverStats();
        if (!s) return;
        width = s.frameWidth ?? 0;
        height = s.frameHeight ?? 0;
        bytes = s.bytesReceived ?? 0;
        frames = s.framesDecoded ?? 0;
      }

      const now = Date.now();
      const before = previous.current;
      previous.current = { bytes, frames, at: now };

      // The first reading has nothing to compare against.
      const elapsed = before ? now - before.at : 0;
      const kbps =
        before && elapsed > 0 ? Math.round(((bytes - before.bytes) * 8) / elapsed) : 0;
      const fps =
        reportedFps ??
        (before && elapsed > 0 ? ((frames - before.frames) * 1000) / elapsed : 0);

      if (alive) setStats({ width, height, fps: Math.round(fps), kbps });
    };

    void read().catch(() => undefined);
    const timer = setInterval(() => void read().catch(() => undefined), SAMPLE_MS);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [track]);

  return stats;
}

export function formatStats(stats: ScreenStats | null): string {
  if (!stats || stats.height === 0) return "";
  const parts = [`${stats.height}p`];
  if (stats.fps > 0) parts.push(`${stats.fps} fps`);
  if (stats.kbps > 0) parts.push(`${stats.kbps} kbps`);
  return parts.join(" · ");
}
