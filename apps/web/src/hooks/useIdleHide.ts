import { useCallback, useEffect, useRef, useState } from "react";

/** Instant return on purpose: a delay coming back is the annoying part. */
export function useIdleHide(delayMs: number, enabled = true) {
  const [visible, setVisible] = useState(true);
  const held = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const arm = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    if (!enabled || held.current) return;
    timer.current = setTimeout(() => setVisible(false), delayMs);
  }, [delayMs, enabled]);

  const wake = useCallback(() => {
    setVisible(true);
    arm();
  }, [arm]);

  const holdProps = {
    onPointerEnter: () => {
      held.current = true;
      setVisible(true);
      if (timer.current) clearTimeout(timer.current);
    },
    onPointerLeave: () => {
      held.current = false;
      arm();
    },
  };

  useEffect(() => {
    if (!enabled) {
      setVisible(true);
      if (timer.current) clearTimeout(timer.current);
      return;
    }
    window.addEventListener("pointermove", wake);
    window.addEventListener("pointerdown", wake);
    window.addEventListener("keydown", wake);
    arm();
    return () => {
      window.removeEventListener("pointermove", wake);
      window.removeEventListener("pointerdown", wake);
      window.removeEventListener("keydown", wake);
      if (timer.current) clearTimeout(timer.current);
    };
  }, [arm, wake, enabled]);

  return { visible, holdProps };
}
