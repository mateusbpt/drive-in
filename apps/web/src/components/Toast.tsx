import { useEffect, useState } from "react";
import { LuTriangleAlert } from "react-icons/lu";
import { palette } from "../theme";

/*
  A notice floating over the scene, top right. Each screen used to print its
  error in a corner of its own layout — under the dashboard, below the queue —
  and the message sat loose, competing with the content.

  It fades on its own: stage and queue errors are momentary, and none of them
  asks for anything beyond trying again.
*/
const LIFETIME_MS = 4500;

export function Toast({ message }: { message?: string | null }) {
  const [visible, setVisible] = useState(false);
  const [text, setText] = useState<string | null>(null);

  useEffect(() => {
    /*
      A null message hides it. Returning early here, the previous effect's
      cleanup had already cancelled the timer and the toast stayed on screen
      forever.
    */
    if (!message) {
      setVisible(false);
      return;
    }
    // Keep the text separately: once the message is gone, the toast still has
    // something to show while it leaves.
    setText(message);
    setVisible(true);
    const id = setTimeout(() => setVisible(false), LIFETIME_MS);
    return () => clearTimeout(id);
  }, [message]);

  if (!text) return null;

  return (
    <div
      className="pointer-events-none absolute inset-x-0 top-6 z-40 flex justify-end px-6"
      role="status"
      aria-live="polite"
    >
      <div
        className="flex max-w-[440px] items-center gap-2.5 rounded-lg px-4 py-3 transition-all duration-200"
        style={{
          background: "rgba(14,23,33,0.96)",
          border: `1px solid ${palette.line}`,
          boxShadow: "0 12px 30px rgba(0,0,0,0.5)",
          color: palette.ink,
          opacity: visible ? 1 : 0,
          transform: visible ? "translateY(0)" : "translateY(-8px)",
        }}
      >
        <LuTriangleAlert size={16} color={palette.tail} className="shrink-0" />
        <span className="text-[13px] leading-snug">{text}</span>
      </div>
    </div>
  );
}
