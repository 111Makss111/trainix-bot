import type { ReviewGrade, ReviewResult } from "../types";

type ReviewResultPanelProps = {
  review: ReviewResult;
};

const gradeClassName: Record<ReviewGrade, string> = {
  ready: "border-emerald-300/22 bg-emerald-300/8 text-emerald-100",
  review: "border-sky-300/22 bg-sky-300/8 text-sky-100",
  weak: "border-amber-300/22 bg-amber-300/8 text-amber-100",
  "no-trade": "border-rose-300/22 bg-rose-300/8 text-rose-100",
};

const gradeLabel: Record<ReviewGrade, string> = {
  ready: "Ready",
  review: "Needs review",
  weak: "Weak",
  "no-trade": "No-trade",
};

export function ReviewResultPanel({ review }: ReviewResultPanelProps) {
  return (
    <section
      className={[
        "rounded-[2rem] border px-6 py-6 backdrop-blur-md",
        gradeClassName[review.grade],
      ].join(" ")}
    >
      <p className="text-[0.72rem] uppercase tracking-[0.3em] opacity-70">
        Review Result
      </p>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <span className="rounded-full border border-current/20 bg-black/14 px-3 py-1.5 text-sm">
          {gradeLabel[review.grade]}
        </span>
        <h2 className="text-2xl font-medium text-white">{review.title}</h2>
      </div>
      <p className="mt-4 text-sm leading-7 text-white/64">{review.summary}</p>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <ResultList title="Що вже добре" items={review.positives} empty="Поки немає сильних пунктів." />
        <ResultList title="Що виправити" items={review.nextActions} empty="Критичних правок немає." />
      </div>
    </section>
  );
}

function ResultList({
  title,
  items,
  empty,
}: {
  title: string;
  items: string[];
  empty: string;
}) {
  return (
    <div className="rounded-[1.3rem] border border-white/10 bg-black/12 px-4 py-4">
      <p className="text-sm font-medium text-white">{title}</p>
      <ul className="mt-3 space-y-2 text-sm leading-6 text-white/58">
        {(items.length > 0 ? items : [empty]).map((item) => (
          <li key={item} className="flex gap-3">
            <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-white/40" />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
