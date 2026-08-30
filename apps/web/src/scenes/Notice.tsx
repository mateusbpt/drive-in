import type { ReactNode } from "react";
import { Arrival, ArrivalCard } from "./Arrival";
import { palette } from "../theme";

type NoticeProps = {
  heading: string;
  body?: string;
  children?: ReactNode;
};

/** Every roomless screen uses this one: root, no such room, expired, error. */
export function Notice({ heading, body, children }: NoticeProps) {
  return (
    <Arrival>
      <ArrivalCard>
        {/*
          Same structure as the dashboard panel: uppercase label, rule, content.
          This used to be a centred mixed-case heading, which exists on no other
          screen.
        */}
        <div className="flex flex-col">
          <span
            className="text-[10.5px] font-semibold uppercase tracking-[0.22em]"
            style={{ color: palette.faint }}
          >
            {heading}
          </span>
          {body && (
            <p
              className="mt-3 border-t pt-4 text-[13px] leading-[1.6]"
              style={{ borderColor: "#1e2836", color: palette.dim }}
            >
              {body}
            </p>
          )}
          {children}
        </div>
      </ArrivalCard>
    </Arrival>
  );
}
