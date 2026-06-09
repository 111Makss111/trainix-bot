import { formatTradingViewPrice } from "../formatters";
import type {
  DirectionalZoneVolume,
  DirectionCandidate,
  MarketZoneReaction,
  MoveStageState,
  OpenInterestState,
  PriceActionState,
  DirectionPriority,
  ReviewStatus,
  ZoneVolumeProfile,
} from "../types";

type DirectionPriorityPanelProps = {
  priority: DirectionPriority;
};

const statusClassName: Record<ReviewStatus, string> = {
  pass: "border-emerald-300/18 bg-emerald-300/8 text-emerald-100",
  warning: "border-amber-300/18 bg-amber-300/8 text-amber-100",
  fail: "border-rose-300/18 bg-rose-300/8 text-rose-100",
};

const reactionClassName: Record<MarketZoneReaction["strength"], string> = {
  strong: "border-emerald-300/18 bg-emerald-300/8 text-emerald-100",
  medium: "border-sky-300/18 bg-sky-300/8 text-sky-100",
  weak: "border-amber-300/18 bg-amber-300/8 text-amber-100",
  none: "border-white/10 bg-white/[0.04] text-white/52",
};

const priceActionClassName: Record<PriceActionState["direction"], string> = {
  long: "border-emerald-300/18 bg-emerald-300/8 text-emerald-100",
  short: "border-rose-300/18 bg-rose-300/8 text-rose-100",
  neutral: "border-white/10 bg-white/[0.04] text-white/52",
};

const directionalVolumeClassName: Record<DirectionalZoneVolume["alignment"], string> = {
  supports: "border-emerald-300/18 bg-emerald-300/8 text-emerald-100",
  neutral: "border-amber-300/18 bg-amber-300/8 text-amber-100",
  against: "border-rose-300/18 bg-rose-300/8 text-rose-100",
  unknown: "border-white/10 bg-white/[0.04] text-white/52",
};

const openInterestClassName: Record<OpenInterestState["status"], string> = {
  ok: "border-sky-300/18 bg-sky-300/8 text-sky-100",
  partial: "border-amber-300/18 bg-amber-300/8 text-amber-100",
  unavailable: "border-white/10 bg-white/[0.04] text-white/52",
};

function getScoreStatus(score: number): ReviewStatus {
  if (score >= 70) {
    return "pass";
  }

  if (score >= 45) {
    return "warning";
  }

  return "fail";
}

function DirectionCard({
  candidate,
  isPreferred,
}: {
  candidate: DirectionCandidate;
  isPreferred: boolean;
}) {
  const levels = candidate.review.levels;
  const rewardToRisk = levels.rewardToRisk;
  const reaction = levels.zoneReaction;
  const zoneVolume = levels.zoneVolume;
  const directionalVolume = levels.directionalVolume;
  const openInterest = levels.openInterest;
  const priceAction = levels.priceAction;
  const moveStage = levels.moveStage;
  const review = candidate.review;

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
          <h3 className="mt-2 text-xl font-semibold text-white">{candidate.label}</h3>
          <p className="mt-1 text-sm text-white/50">{review.signal.label}</p>
        </div>
        <span
          className={[
            "rounded-full border px-3 py-1 text-sm",
            statusClassName[review.verdict.status],
          ].join(" ")}
        >
          {review.verdict.label}
        </span>
      </div>

      <p className="mt-3 rounded-[0.9rem] border border-white/10 bg-black/14 px-3 py-2 text-sm leading-5 text-white/62">
        {review.verdict.detail}
      </p>

      <div className="mt-3 grid grid-cols-3 gap-2">
        <QualityStat
          label="Ринок"
          value={`${review.marketScore}/100`}
          status={getScoreStatus(review.marketScore)}
        />
        <QualityStat
          label="Вхід"
          value={`${review.entryScore}/100`}
          status={getScoreStatus(review.entryScore)}
        />
        <QualityStat
          label="Баланс"
          value={`${candidate.score}/100`}
          status={candidate.status}
        />
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2">
        <LevelStat label="Вхід" value={formatTradingViewPrice(levels.entryPrice)} />
        <LevelStat label="Стоп" value={formatTradingViewPrice(levels.stopLoss)} />
        <LevelStat label="Ціль" value={formatTradingViewPrice(levels.takeProfit)} />
      </div>

      <div className="mt-3 flex flex-wrap gap-2 text-xs text-white/52">
        <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1">
          RR {rewardToRisk === null ? "авто" : `${rewardToRisk.toFixed(2)}R`}
        </span>
        <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1">
          зона {levels.zoneDistancePercent.toFixed(2)}%
        </span>
        <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1">
          діапазон {levels.pricePositionPercent.toFixed(0)}%
        </span>
        <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1">
          {levels.entryMode === "limit"
            ? "чекати вхід"
            : levels.entryMode === "momentum"
              ? "імпульс"
            : levels.entryMode === "distant"
              ? "зона далеко"
            : levels.entryMode === "custom"
              ? "ручний вхід"
              : "market-вхід"}
        </span>
        {levels.targetAtrMultiple !== null ? (
          <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1">
            ціль {levels.targetAtrMultiple.toFixed(1)} ATR
          </span>
        ) : null}
        <span
          className={[
            "rounded-full border px-2.5 py-1",
            reactionClassName[reaction.strength],
          ].join(" ")}
        >
          реакція {reaction.summary}
        </span>
        <span
          className={[
            "rounded-full border px-2.5 py-1",
            directionalVolumeClassName[directionalVolume.alignment],
          ].join(" ")}
        >
          {directionalVolume.label} {directionalVolume.score}/100
        </span>
        {openInterest.status === "ok" ? (
          <span
            className={[
              "rounded-full border px-2.5 py-1",
              openInterestClassName[openInterest.status],
            ].join(" ")}
          >
            OI {openInterest.label}
          </span>
        ) : null}
        <span
          className={[
            "rounded-full border px-2.5 py-1",
            priceActionClassName[priceAction.direction],
          ].join(" ")}
        >
          рух {priceAction.label}
        </span>
        <span
          className={[
            "rounded-full border px-2.5 py-1",
            statusClassName[moveStage.status],
          ].join(" ")}
        >
          стадія {moveStage.label}
        </span>
      </div>

      <ReactionDetails
        reaction={reaction}
        zoneVolume={zoneVolume}
        directionalVolume={directionalVolume}
        moveStage={moveStage}
        openInterest={openInterest}
      />

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
    </div>
  );
}

function QualityStat({
  label,
  value,
  status,
}: {
  label: string;
  value: string;
  status: ReviewStatus;
}) {
  return (
    <div
      className={[
        "rounded-[0.85rem] border px-3 py-2",
        statusClassName[status],
      ].join(" ")}
    >
      <p className="text-[0.58rem] uppercase tracking-[0.18em] opacity-60">
        {label}
      </p>
      <p className="mt-1 font-mono text-sm font-semibold text-white">{value}</p>
    </div>
  );
}

function ReactionDetails({
  reaction,
  zoneVolume,
  directionalVolume,
  moveStage,
  openInterest,
}: {
  reaction: MarketZoneReaction;
  zoneVolume: ZoneVolumeProfile;
  directionalVolume: DirectionalZoneVolume;
  moveStage: MoveStageState;
  openInterest: OpenInterestState;
}) {
  return (
    <details className="mt-3 rounded-[0.85rem] border border-white/10 bg-black/14 px-3 py-2 text-xs text-white/52">
      <summary className="cursor-pointer select-none text-white/64">
        Деталі зони
      </summary>
      <div className="mt-2 grid gap-1 leading-5">
        <p>{reaction.detail}</p>
        <p>{moveStage.detail}</p>
        <p>{directionalVolume.detail}</p>
        <p>{zoneVolume.detail}</p>
        {openInterest.status === "ok" ? <p>{openInterest.detail}</p> : null}
        <p>
          Зона: {reaction.zoneLabel} {formatTradingViewPrice(reaction.zoneLow)} -{" "}
          {formatTradingViewPrice(reaction.zoneHigh)}
        </p>
        {reaction.touchedAt ? <p>Свічка: {reaction.touchedAt}</p> : null}
      </div>
    </details>
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
          />
        ))}
      </div>
    </section>
  );
}
