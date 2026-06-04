import { formatTradingViewPrice } from "../formatters";
import type {
  DirectionCandidate,
  DirectionPriority,
  ReviewStatus,
  TradeDirection,
} from "../types";

type DirectionPriorityPanelProps = {
  priority: DirectionPriority;
  onUseDirection: (direction: TradeDirection) => void;
};

const statusClassName: Record<ReviewStatus, string> = {
  pass: "border-emerald-300/18 bg-emerald-300/8 text-emerald-100",
  warning: "border-amber-300/18 bg-amber-300/8 text-amber-100",
  fail: "border-rose-300/18 bg-rose-300/8 text-rose-100",
};

function DirectionCard({
  candidate,
  isPreferred,
  onUseDirection,
}: {
  candidate: DirectionCandidate;
  isPreferred: boolean;
  onUseDirection: (direction: TradeDirection) => void;
}) {
  const levels = candidate.review.levels;
  const rewardToRisk = levels.rewardToRisk;

  return (
    <div
      className={[
        "rounded-[1.25rem] border p-4",
        isPreferred
          ? "border-white/20 bg-white/[0.06]"
          : "border-white/10 bg-black/12",
      ].join(" ")}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[0.62rem] uppercase tracking-[0.22em] text-white/36">
            Варіант
          </p>
          <h3 className="mt-2 text-xl font-semibold text-white">
            {candidate.label}
          </h3>
        </div>
        <span
          className={[
            "rounded-full border px-3 py-1 text-sm",
            statusClassName[candidate.status],
          ].join(" ")}
        >
          {candidate.score}/100
        </span>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2">
        <LevelStat label="Вхід" value={formatTradingViewPrice(levels.entryPrice)} />
        <LevelStat label="Стоп" value={formatTradingViewPrice(levels.stopLoss)} />
        <LevelStat label="Ціль" value={formatTradingViewPrice(levels.takeProfit)} />
      </div>

      <div className="mt-3 flex flex-wrap gap-2 text-xs text-white/52">
        <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1">
          R/R {rewardToRisk === null ? "авто" : `${rewardToRisk.toFixed(2)}R`}
        </span>
        <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1">
          зона {levels.zoneDistancePercent.toFixed(2)}%
        </span>
        <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1">
          діапазон {levels.pricePositionPercent.toFixed(0)}%
        </span>
      </div>

      <div className="mt-3 space-y-2">
        {candidate.reasons.map((reason) => (
          <p
            key={reason}
            className="rounded-[0.85rem] border border-white/10 bg-black/14 px-3 py-2 text-sm leading-5 text-white/60"
          >
            {reason}
          </p>
        ))}
      </div>

      <button
        type="button"
        onClick={() => onUseDirection(candidate.direction)}
        className="mt-4 w-full rounded-[0.95rem] border border-white/12 bg-white/[0.05] px-3 py-2 text-sm font-medium text-white/72 transition hover:border-white/24 hover:bg-white/[0.09] hover:text-white"
      >
        Взяти {candidate.label} з авто-рівнями
      </button>
    </div>
  );
}

function LevelStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[0.85rem] border border-white/10 bg-white/[0.035] px-3 py-2">
      <p className="text-[0.58rem] uppercase tracking-[0.18em] text-white/34">
        {label}
      </p>
      <p className="mt-1 font-mono text-sm font-semibold text-white">{value}</p>
    </div>
  );
}

export function DirectionPriorityPanel({
  priority,
  onUseDirection,
}: DirectionPriorityPanelProps) {
  return (
    <section className="rounded-[1.5rem] border border-white/10 bg-white/[0.03] p-5 backdrop-blur-md">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[0.68rem] uppercase tracking-[0.28em] text-white/34">
            Авто-пріоритет
          </p>
          <h2 className="mt-2 text-2xl font-semibold text-white">
            {priority.title}
          </h2>
        </div>
        <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-sm text-white/58">
          Long vs Short
        </span>
      </div>

      <p className="mt-3 max-w-3xl text-sm leading-6 text-white/58">
        {priority.summary}
      </p>

      <div className="mt-4 grid gap-3 xl:grid-cols-2">
        {priority.candidates.map((candidate) => (
          <DirectionCard
            key={candidate.direction}
            candidate={candidate}
            isPreferred={priority.preferredDirection === candidate.direction}
            onUseDirection={onUseDirection}
          />
        ))}
      </div>
    </section>
  );
}
