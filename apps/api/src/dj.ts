import { randomUUID } from "node:crypto";
import type { DjState, Track } from "@drive-in/shared";
import { saveRoom, type Room } from "./rooms.ts";

/*
  DJ mode: a queue of links everybody feeds. The video never passes through our
  media server — each browser loads the same id in the YouTube player, and the
  server only says which track is playing and since when. Whoever arrives
  mid-song finds the right point on their own, and no third-party audio crosses
  the SFU.
*/

/** State for a room that has never been in DJ mode. */
export function empty(): DjState {
  return { active: false, queue: [] };
}

function playerState(room: Room): DjState {
  return room.dj ?? empty();
}

/**
 * Freezes the transport, keeping the second it stopped at. Leaving the mode uses
 * this instead of forgetting the track: coming back resumes where it left off.
 */
export function freeze(dj: DjState): DjState {
  const p = dj.playback;
  return {
    ...dj,
    playback: p
      ? {
          ...p,
          paused: true,
          offsetSec: p.paused ? p.offsetSec : p.offsetSec + (Date.now() - p.startedAt) / 1000,
        }
      : undefined,
  };
}

/**
 * The video id in any of the shapes YouTube uses. It tolerates extra parameters
 * because a link copied from a phone arrives with `si=` and friends.
 */
export function parseVideoId(url: string): string | null {
  let u: URL;
  try {
    u = new URL(url.trim());
  } catch {
    return null;
  }

  const host = u.hostname.replace(/^www\./, "").replace(/^m\./, "");
  const valid = (id: string | null | undefined) =>
    id && /^[A-Za-z0-9_-]{11}$/.test(id) ? id : null;

  if (host === "youtu.be") return valid(u.pathname.slice(1).split("/")[0]);
  if (host !== "youtube.com" && host !== "music.youtube.com") return null;
  if (u.pathname === "/watch") return valid(u.searchParams.get("v"));

  const [, section, id] = u.pathname.split("/");
  if (section === "shorts" || section === "embed" || section === "live") return valid(id);
  return null;
}

/**
 * Title through oEmbed, which needs no key. Duration only exists in the Data
 * API, which would mean an API key for that one field — so the queue shows the
 * duration of the current track, reported by each listener's own player.
 */
async function fetchTitle(videoId: string): Promise<string | null> {
  try {
    const res = await fetch(
      `https://www.youtube.com/oembed?url=${encodeURIComponent(
        `https://www.youtube.com/watch?v=${videoId}`,
      )}&format=json`,
    );
    if (!res.ok) return null;
    const body = (await res.json()) as { title?: string };
    return body.title?.trim() || null;
  } catch {
    return null;
  }
}

/**
 * Turns the mode on. Resumes the track where it stopped; with no stored
 * transport and a queue waiting, it starts from the first one. It used to come
 * back silent, waiting for somebody to click.
 */
export async function enter(room: Room): Promise<void> {
  const dj = playerState(room);
  const resumed = dj.playback
    ? { ...dj.playback, startedAt: Date.now(), paused: false }
    : dj.queue.length > 0
      ? { index: 0, startedAt: Date.now(), offsetSec: 0, paused: false }
      : undefined;

  room.dj = { ...dj, active: true, playback: resumed };
  await saveRoom(room);
}

/**
 * Turns the mode off. The queue survives and the transport freezes where it was,
 * so next time resumes from the same track and the same second.
 */
export async function leave(room: Room): Promise<void> {
  room.dj = { ...freeze(playerState(room)), active: false };
  await saveRoom(room);
}

export async function add(
  room: Room,
  url: string,
  userId: string,
  displayName: string,
): Promise<string | null> {
  const videoId = parseVideoId(url);
  if (!videoId) return "That link is not a YouTube video.";

  const dj = playerState(room);

  const track: Track = {
    id: randomUUID(),
    videoId,
    // With no title the queue shows the id: ugly, but it goes once oEmbed answers.
    title: (await fetchTitle(videoId)) ?? videoId,
    durationSec: null,
    addedBy: userId,
    addedByName: displayName,
  };

  const queue = [...dj.queue, track];
  /*
    The first track into an empty queue starts playing straight away: with the
    mode on and nothing in the air, the room sat silent waiting for a click.
  */
  const playback =
    dj.active && !dj.playback
      ? { index: queue.length - 1, startedAt: Date.now(), offsetSec: 0, paused: false }
      : dj.playback;

  room.dj = { ...dj, queue, playback };
  await saveRoom(room);
  return null;
}

/**
 * Removing a track shifts the indices. If one before the playing track goes, the
 * index walks back with it; if the playing one goes, the next takes its place.
 */
export async function remove(room: Room, id: string): Promise<void> {
  const dj = playerState(room);
  const target = dj.queue.findIndex((t) => t.id === id);
  if (target < 0) return;

  const queue = dj.queue.filter((t) => t.id !== id);
  let playback = dj.playback;

  if (playback) {
    if (target < playback.index) {
      playback = { ...playback, index: playback.index - 1 };
    } else if (target === playback.index) {
      playback =
        target < queue.length
          ? { index: target, startedAt: Date.now(), offsetSec: 0, paused: false }
          : undefined;
    }
  }

  room.dj = { ...dj, queue, playback };
  await saveRoom(room);
}

/** Empties the queue and stops the music. The room stays in the mode. */
export async function clear(room: Room): Promise<void> {
  room.dj = { ...playerState(room), queue: [], playback: undefined };
  await saveRoom(room);
}

/**
 * A breath between one track and the next. Butted together, the change is
 * hurried — the new track lands on top of the previous one's last chord.
 */
const BREATH_MS = 1400;

/**
 * `pauseMs` pushes the start into the future. Somebody picking a track from the
 * list wants to hear it now, so there the pause is zero; arriving here because
 * the queue moved along earns the breath.
 */
export async function play(room: Room, index: number, pauseMs = 0): Promise<void> {
  const dj = playerState(room);
  if (index < 0 || index >= dj.queue.length) return;
  room.dj = {
    ...dj,
    playback: { index, startedAt: Date.now() + pauseMs, offsetSec: 0, paused: false },
  };
  await saveRoom(room);
}

/**
 * Pauses while keeping the second it stopped at, and play resumes from there.
 * Without it, coming back from a pause would throw everyone to the start.
 */
export async function toggle(room: Room): Promise<void> {
  const dj = playerState(room);
  const p = dj.playback;
  if (!p) return;

  room.dj = {
    ...dj,
    playback: p.paused
      ? { ...p, startedAt: Date.now(), paused: false }
      : {
          ...p,
          paused: true,
          offsetSec: p.offsetSec + (Date.now() - p.startedAt) / 1000,
        },
  };
  await saveRoom(room);
}

/** Moves to the next or back to the previous; stops at the end of the queue. */
export async function skip(room: Room, delta: number): Promise<void> {
  const dj = playerState(room);
  if (!dj.playback) return;
  const target = dj.playback.index + (delta >= 0 ? 1 : -1);
  if (target < 0 || target >= dj.queue.length) {
    if (target >= dj.queue.length) {
      room.dj = { ...dj, playback: undefined };
      await saveRoom(room);
    }
    return;
  }
  await play(room, target, BREATH_MS);
}

/**
 * The track ended in the reporting player. The index comes along so that a late
 * report cannot skip the following track, already changed by somebody else.
 */
export async function ended(room: Room, index: number): Promise<void> {
  const dj = playerState(room);
  if (!dj.playback || dj.playback.index !== index) return;
  await skip(room, 1);
}
