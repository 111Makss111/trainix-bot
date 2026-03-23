"use client";

type PlanProgressToggleProps = {
  checked: boolean;
  disabled?: boolean;
  onToggle: (nextValue: boolean) => void;
};

export function PlanProgressToggle({
  checked,
  disabled = false,
  onToggle,
}: PlanProgressToggleProps) {
  return (
    <label
      className={[
        "flex cursor-pointer items-center gap-3 rounded-full border px-3 py-2 text-[0.7rem] uppercase tracking-[0.2em] transition",
        checked
          ? "border-sky-300/30 bg-sky-300/14 text-sky-50 shadow-[0_0_28px_rgba(56,189,248,0.16)]"
          : "border-white/10 bg-white/[0.03] text-white/58 hover:border-white/18 hover:text-white/88",
        disabled ? "pointer-events-none opacity-70" : "",
      ].join(" ")}
    >
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onToggle(event.currentTarget.checked)}
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
  );
}
