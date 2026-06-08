import type { ReviewItem, ReviewStatus } from "../types";

type SignalPanelProps = {
  signals: ReviewItem[];
};

const statusLabel: Record<ReviewStatus, string> = {
  pass: "ОК",
  warning: "УВАГА",
  fail: "НЕ ВХІД",
};

const statusClassName: Record<ReviewStatus, string> = {
  pass: "border-emerald-300/18 bg-emerald-300/8 text-emerald-100",
  warning: "border-amber-300/18 bg-amber-300/8 text-amber-100",
  fail: "border-rose-300/18 bg-rose-300/8 text-rose-100",
};

export function SignalPanel({ signals }: SignalPanelProps) {
  return (
    <section className="rounded-[1.5rem] border border-white/10 bg-white/[0.03] p-5 backdrop-blur-md">
      <p className="text-[0.68rem] uppercase tracking-[0.28em] text-white/34">
        Автоматична перевірка
      </p>
      <div className="mt-4 grid gap-3 xl:grid-cols-2">
        {signals.map((signal) => (
          <div
            key={signal.id}
            className="rounded-[1.1rem] border border-white/10 bg-black/12 px-4 py-3"
          >
            <div className="flex items-center justify-between gap-3">
              <p className="font-medium text-white">{signal.label}</p>
              <span
                className={[
                  "rounded-full border px-2.5 py-1 text-xs",
                  statusClassName[signal.status],
                ].join(" ")}
              >
                {statusLabel[signal.status]}
              </span>
            </div>
            <p className="mt-2 text-sm leading-5 text-white/54">
              {signal.detail}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
