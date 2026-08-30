import { useEffect, useRef, useState } from "react";
import { LuX } from "react-icons/lu";
import type { Feature } from "@drive-in/shared";
import { palette } from "../theme";
import { ui } from "../strings";

type FeaturePickerProps = {
  onPick: (choice: Feature | null) => void;
  onClose: () => void;
  /** Something is already on the marquee, so offering to remove it makes sense. */
  hasFeature: boolean;
  /** What is on the marquee now, to correct rather than retype. */
  current?: Feature;
};

/**
 * Choosing what is playing, opened by clicking the marquee. Anyone in the room
 * can change it: it is their room, and somebody who mistyped the title should
 * not have to depend on another person to fix it.
 *
 * The title is typed, not searched. A catalogue would give the right spelling
 * and a poster, but it would cost an API key to anyone cloning this project —
 * and the marquee is decoration, not a catalogue.
 */
export function FeaturePicker({ onPick, onClose, hasFeature, current }: FeaturePickerProps) {
  const [title, setTitle] = useState(current?.title ?? "");
  const [year, setYear] = useState(current?.year ?? "");
  const box = useRef<HTMLDivElement>(null);

  // Clicking outside and Esc close it, which is what a click-opened thing does.
  useEffect(() => {
    const outsideTheBox = (e: PointerEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) onClose();
    };
    const escape = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("pointerdown", outsideTheBox);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", outsideTheBox);
      document.removeEventListener("keydown", escape);
    };
  }, [onClose]);

  const submit = () => {
    const clean = title.trim();
    if (!clean) return;
    // The year is decoration: four digits or nothing, never part of a year.
    onPick({ title: clean, year: /^\d{4}$/.test(year.trim()) ? year.trim() : null });
  };

  return (
    <div
      ref={box}
      // Centred in whatever gap the parent defines: on the big screen, opening
      // half outside the frame looked adrift against the sky.
      className="pointer-events-auto absolute left-1/2 top-1/2 z-20 w-[320px] -translate-x-1/2 -translate-y-1/2 rounded-lg p-3"
      style={{
        background: "rgba(10,16,26,0.97)",
        border: `1px solid ${palette.line}`,
        boxShadow: "0 20px 60px rgba(0,0,0,0.6)",
      }}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          autoFocus
          maxLength={120}
          placeholder={ui.feature.placeholder}
          className="h-9 w-full rounded-md px-3 text-[14px] outline-none"
          style={{
            background: "#060b12",
            border: `1px solid ${palette.line}`,
            color: palette.ink,
          }}
        />

        <div className="mt-2 flex gap-2">
          <input
            value={year}
            onChange={(e) => setYear(e.target.value.replace(/\D/g, "").slice(0, 4))}
            inputMode="numeric"
            placeholder={ui.feature.year}
            className="h-9 w-[88px] shrink-0 rounded-md px-3 text-center font-mono text-[13px] outline-none"
            style={{
              background: "#060b12",
              border: `1px solid ${palette.line}`,
              color: palette.ink,
            }}
          />
          <button
            type="submit"
            disabled={!title.trim()}
            className="h-9 flex-1 rounded-md text-[10.5px] font-semibold uppercase tracking-[0.16em] transition-colors enabled:cursor-pointer enabled:hover:brightness-110 disabled:cursor-not-allowed"
            style={{
              background: palette.surface,
              border: `1px solid ${palette.line}`,
              color: title.trim() ? palette.ink : palette.ghost,
            }}
          >
            {ui.feature.save}
          </button>
        </div>
      </form>

      {hasFeature && (
        <button
          type="button"
          onClick={() => onPick(null)}
          className="mt-2 flex w-full cursor-pointer items-center gap-2 rounded px-2 py-2 text-[12.5px] transition-colors hover:bg-white/5"
          style={{ color: palette.faint }}
        >
          <LuX size={13} />
          {ui.feature.clear}
        </button>
      )}
    </div>
  );
}
