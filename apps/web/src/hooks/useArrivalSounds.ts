import { useEffect, useRef } from "react";
import type { Participant } from "@drive-in/shared";
import { playArrival, playDeparture } from "../sounds";

/**
 * Two traps: the first list is not "everybody just arrived", and you do not
 * count as an arrival to yourself.
 */
export function useArrivalSounds(participants: Participant[] | undefined, myId: string | undefined) {
  const known = useRef<Set<string> | null>(null);

  useEffect(() => {
    if (!participants) return;
    const now = new Set(participants.map((p) => p.userId));

    if (known.current === null) {
      known.current = now;
      return;
    }

    const before = known.current;
    const arrived = [...now].some((id) => id !== myId && !before.has(id));
    const left = [...before].some((id) => id !== myId && !now.has(id));

    known.current = now;

    // One honk per update: overlapping sounds turn into noise.
    if (arrived) playArrival();
    else if (left) playDeparture();
  }, [participants, myId]);
}
