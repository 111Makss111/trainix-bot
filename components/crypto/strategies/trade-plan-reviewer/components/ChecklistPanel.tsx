import type { ReviewItem, ReviewStatus } from "../types";

type ChecklistPanelProps = {
  items: ReviewItem[];
};

const statusLabel: Record<ReviewStatus, string> = {
  pass: "OK",
  warning: "Review",
  fail: "Stop",
};

const statusClassName: Record<ReviewStatus, string> = {
  pass: "border-emerald-300/18 bg-emerald-300/8 text-emerald-100",
  warning: "border-amber-300/18 bg-amber-300/8 text-amber-100",
  fail: "border-rose-300/18 bg-rose-300/8 text-rose-100",
};

export function ChecklistPanel({ items }: ChecklistPanelProps) {
  return (
    <div className="grid gap-3 xl:grid-cols-2">
        {items.map((item) => (
          <div
            key={item.id}
            className="rounded-[1.2rem] border border-white/10 bg-white/[0.03] px-4 py-4"
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="font-medium text-white">{item.label}</p>
              <span
                className={[
                  "rounded-full border px-3 py-1 text-xs",
                  statusClassName[item.status],
                ].join(" ")}
              >
                {statusLabel[item.status]}
              </span>
            </div>
            <p className="mt-3 text-sm leading-6 text-white/54">{item.detail}</p>
          </div>
        ))}
    </div>
  );
}
