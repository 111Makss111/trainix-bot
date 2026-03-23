"use client";

import { useRef, useState, useTransition } from "react";
import { togglePlanInProgressAction } from "@/app/cabinet/notes/actions";
import type { PlanPeriod } from "@/lib/plans";

type NotesViewMode = "active" | "history";

type PlanProgressToggleProps = {
  planId: string;
  activePeriod: PlanPeriod;
  activeMode: NotesViewMode;
  isPending: boolean;
};

export function PlanProgressToggle({
  planId,
  activePeriod,
  activeMode,
  isPending,
}: PlanProgressToggleProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const [checked, setChecked] = useState(isPending);
  const [isSubmitting, startTransition] = useTransition();

  return (
    <form ref={formRef} action={togglePlanInProgressAction}>
      <input type="hidden" name="planId" value={planId} />
      <input type="hidden" name="viewPeriod" value={activePeriod} />
      <input type="hidden" name="viewMode" value={activeMode} />

      <label
        className={[
          "flex cursor-pointer items-center gap-3 rounded-full border px-3 py-2 text-[0.7rem] uppercase tracking-[0.2em] transition",
          checked
            ? "border-sky-300/30 bg-sky-300/14 text-sky-50 shadow-[0_0_28px_rgba(56,189,248,0.16)]"
            : "border-white/10 bg-white/[0.03] text-white/58 hover:border-white/18 hover:text-white/88",
          isSubmitting ? "opacity-80" : "",
        ].join(" ")}
      >
        <input
          type="checkbox"
          checked={checked}
          disabled={isSubmitting}
          onChange={(event) => {
            const nextValue = event.currentTarget.checked;
            setChecked(nextValue);
            startTransition(() => {
              formRef.current?.requestSubmit();
            });
          }}
          className={[
            "h-5 w-5 shrink-0 cursor-pointer rounded border border-white/18 bg-[#07101f] accent-sky-400 transition",
            checked ? "shadow-[0_0_14px_rgba(56,189,248,0.22)]" : "",
          ].join(" ")}
        />

        <span className="flex items-center gap-2">
          <span>{checked ? "В роботі" : "В роботу"}</span>
          {checked ? (
            <span className="h-2 w-2 rounded-full bg-sky-300 animate-pulse" />
          ) : null}
        </span>
      </label>
    </form>
  );
}
