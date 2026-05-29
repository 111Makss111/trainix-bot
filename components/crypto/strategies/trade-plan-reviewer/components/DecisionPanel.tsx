import type { ReviewGrade, ReviewResult } from "../types";

type DecisionPanelProps = {
  review: ReviewResult;
};

const gradeClassName: Record<ReviewGrade, string> = {
  ready: "border-emerald-300/22 bg-emerald-300/8 text-emerald-100",
  review: "border-sky-300/22 bg-sky-300/8 text-sky-100",
  weak: "border-amber-300/22 bg-amber-300/8 text-amber-100",
  "no-trade": "border-rose-300/22 bg-rose-300/8 text-rose-100",
};

const gradeLabel: Record<ReviewGrade, string> = {
  ready: "READY",
  review: "REVIEW",
  weak: "WEAK",
  "no-trade": "NO-TRADE",
};

export function DecisionPanel({ review }: DecisionPanelProps) {
  return (
    <section
      className={[
        "rounded-[1.5rem] border p-5 backdrop-blur-md",
        gradeClassName[review.grade],
      ].join(" ")}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[0.68rem] uppercase tracking-[0.28em] opacity-70">
            Decision
          </p>
          <h2 className="mt-3 text-3xl font-semibold text-white">
            {gradeLabel[review.grade]}
          </h2>
        </div>
        <span className="rounded-full border border-current/20 bg-black/12 px-3 py-1.5 text-sm">
          Live
        </span>
      </div>

      <p className="mt-4 text-sm leading-6 text-white/68">{review.summary}</p>

      <div className="mt-5 space-y-2">
        {review.nextActions.slice(0, 3).map((action) => (
          <div
            key={action}
            className="rounded-[1rem] border border-white/10 bg-black/12 px-3 py-2 text-sm leading-5 text-white/72"
          >
            {action}
          </div>
        ))}
      </div>
    </section>
  );
}
