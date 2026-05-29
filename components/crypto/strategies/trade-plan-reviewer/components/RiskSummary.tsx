import type { ReviewMetric, ReviewStatus } from "../types";

type RiskSummaryProps = {
  metrics: ReviewMetric[];
};

const statusClassName: Record<ReviewStatus, string> = {
  pass: "border-emerald-300/18 bg-emerald-300/8 text-emerald-100",
  warning: "border-amber-300/18 bg-amber-300/8 text-amber-100",
  fail: "border-rose-300/18 bg-rose-300/8 text-rose-100",
};

export function RiskSummary({ metrics }: RiskSummaryProps) {
  return (
    <section className="grid gap-3 sm:grid-cols-3">
      {metrics.map((metric) => (
        <div
          key={metric.label}
          className={[
            "rounded-[1.25rem] border px-4 py-4",
            statusClassName[metric.status],
          ].join(" ")}
        >
          <p className="text-[0.62rem] uppercase tracking-[0.22em] opacity-70">
            {metric.label}
          </p>
          <p className="mt-2 text-xl font-medium">{metric.value}</p>
          <p className="mt-1 text-xs leading-5 opacity-70">{metric.detail}</p>
        </div>
      ))}
    </section>
  );
}
