import { useState } from "react";
import { NAME_MAX_LENGTH, PAINT_COUNT } from "@drive-in/shared";
import { LuCarFront, LuLock } from "react-icons/lu";
import { Arrival, ArrivalCard } from "./Arrival";
import { CarBody } from "../components/Car";
import { carPaints, palette } from "../theme";
import { ui } from "../strings";

type JoinRoomProps = {
  locked: boolean;
  full: boolean;
  /** Colours already in use. They block nothing: they only pick the default. */
  takenPaints: number[];
  onJoin: (displayName: string, paint: number) => void;
};

/** What you see when you open the link. No account, no password. */
export function JoinRoom({ locked, full, takenPaints, onJoin }: JoinRoomProps) {
  const [name, setName] = useState("");
  // Starts on a colour nobody has taken, so the lot does not come out all one
  // shade without anyone having chosen. Picking a duplicate is still allowed.
  const free = Array.from({ length: PAINT_COUNT }, (_, i) => i).filter(
    (i) => !takenPaints.includes(i),
  );
  const [paint, setPaint] = useState(free[0] ?? 0);

  // Locked and full are different refusals: one is a decision, one is capacity.
  const barred = locked
    ? { icon: <LuLock size={15} color={palette.faint} />, ...ui.joinRoom.locked }
    : full
      ? { icon: <LuCarFront size={15} color={palette.faint} />, ...ui.joinRoom.full }
      : null;

  return (
    <Arrival>
      <ArrivalCard>
        {barred ? (
          <div className="flex flex-col">
            <span className="flex items-center gap-2">
              {barred.icon}
              <span
                className="text-[10.5px] font-semibold uppercase tracking-[0.22em]"
                style={{ color: palette.faint }}
              >
                {barred.title}
              </span>
            </span>
            <p
              className="mt-3 border-t pt-4 text-[13px] leading-[1.6]"
              style={{ borderColor: "#1e2836", color: palette.dim }}
            >
              {barred.body}
            </p>
          </div>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (name.trim()) onJoin(name.trim(), paint);
            }}
          >
            {/* Same header as the notices: an uppercase label and a rule. */}
            <span
              className="block text-[10.5px] font-semibold uppercase tracking-[0.22em]"
              style={{ color: palette.faint }}
            >
              {ui.joinRoom.heading}
            </span>

            <label className="mt-3 block border-t pt-4" style={{ borderColor: "#1e2836" }}>
              <span
                className="text-[9.5px] font-semibold uppercase tracking-[0.24em]"
                style={{ color: "#3a4656" }}
              >
                {ui.joinRoom.nameLabel}
              </span>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoFocus
                maxLength={NAME_MAX_LENGTH}
                className="mt-2 h-12 w-full rounded-lg px-4 text-[15.5px] outline-none"
                style={{
                  background: "#070b12",
                  border: `1px solid ${palette.line}`,
                  color: palette.ink,
                }}
              />
            </label>

            {/*
              The pickup as drawn, not a colour swatch: this is how you will
              recognise yourself in there. A duplicate colour is allowed, because
              what tells people apart is the name.
            */}
            <span
              className="mt-5 block text-[9.5px] font-semibold uppercase tracking-[0.24em]"
              style={{ color: "#3a4656" }}
            >
              {ui.joinRoom.paintLabel}
            </span>
            <div className="mt-2 flex items-end justify-between">
              {carPaints.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setPaint(i)}
                  className="flex cursor-pointer flex-col items-center gap-1.5 transition-opacity"
                  style={{ opacity: i === paint ? 1 : 0.4 }}
                >
                  <svg viewBox="-112 -206 224 210" style={{ width: 46 }} aria-hidden>
                    <CarBody paint={i} speaking={false} muted={false} />
                  </svg>
                  <span
                    style={{
                      width: 22,
                      height: 2,
                      borderRadius: 2,
                      background: i === paint ? palette.cyan : "transparent",
                    }}
                  />
                </button>
              ))}
            </div>

            <button
              type="submit"
              disabled={name.trim().length === 0}
              className="mt-6 flex h-11 w-full cursor-pointer items-center justify-center rounded-lg text-[10.5px] font-semibold uppercase tracking-[0.16em] transition-colors hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
              style={{
                background: palette.surface,
                border: `1px solid ${palette.line}`,
                color: palette.ink,
              }}
            >
              {ui.joinRoom.enter}
            </button>
          </form>
        )}
      </ArrivalCard>
    </Arrival>
  );
}
