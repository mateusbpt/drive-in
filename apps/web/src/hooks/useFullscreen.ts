import { useCallback, useEffect, useState } from "react";

/** requestFullscreen only resolves from a gesture: call it from a click. */
export function useFullscreen() {
  const [active, setActive] = useState(false);

  useEffect(() => {
    const onChange = () => setActive(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  const enter = useCallback(async () => {
    if (document.fullscreenElement) return;
    try {
      await document.documentElement.requestFullscreen();
    } catch {
      // Denied or unsupported: the scene renders the same, just in a window.
    }
  }, []);

  const exit = useCallback(async () => {
    if (!document.fullscreenElement) return;
    try {
      await document.exitFullscreen();
    } catch {
      // Nothing to do: the scene changes either way.
    }
  }, []);

  return { active, enter, exit };
}
