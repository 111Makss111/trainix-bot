"use client";

import { useState } from "react";
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

type ScoreDetailKind = "market" | "entry" | "zone";

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

function getOpenInterestBadgeClassName(
  openInterest: OpenInterestState,
  direction: DirectionCandidate["direction"],
) {
  if (openInterest.status !== "ok") {
    return openInterestClassName[openInterest.status];
  }

  if (
    (direction === "long" && openInterest.signal === "bullish-build") ||
    (direction === "short" && openInterest.signal === "bearish-build")
  ) {
    return "border-emerald-300/18 bg-emerald-300/8 text-emerald-100";
  }

  if (
    (direction === "long" &&
      (openInterest.signal === "bearish-build" ||
        openInterest.signal === "long-flush")) ||
    (direction === "short" &&
      (openInterest.signal === "bullish-build" ||
        openInterest.signal === "short-covering"))
  ) {
    return "border-rose-300/18 bg-rose-300/8 text-rose-100";
  }

  return "border-amber-300/18 bg-amber-300/8 text-amber-100";
}

function getDirectionAwareClassName({
  direction,
  signalDirection,
  fallbackStatus,
}: {
  direction: DirectionCandidate["direction"];
  signalDirection: DirectionCandidate["direction"] | "neutral";
  fallbackStatus: ReviewStatus;
}) {
  if (signalDirection === direction) {
    return statusClassName.pass;
  }

  if (signalDirection !== "neutral") {
    return statusClassName.fail;
  }

  return statusClassName[fallbackStatus];
}

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
  const [activeDetail, setActiveDetail] = useState<ScoreDetailKind | null>(null);
  const levels = candidate.review.levels;
  const rewardToRisk = levels.rewardToRisk;
  const reaction = levels.zoneReaction;
  const zoneVolume = levels.zoneVolume;
  const directionalVolume = levels.directionalVolume;
  const openInterest = levels.openInterest;
  const priceAction = levels.priceAction;
  const moveStage = levels.moveStage;
  const review = candidate.review;
  const scoreDetail = activeDetail
    ? getScoreDetail(activeDetail, candidate)
    : null;

  function toggleScoreDetail(kind: ScoreDetailKind) {
    setActiveDetail((currentDetail) => (currentDetail === kind ? null : kind));
  }

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
          isActive={activeDetail === "market"}
          onClick={() => toggleScoreDetail("market")}
        />
        <QualityStat
          label="Вхід"
          value={`${review.entryScore}/100`}
          status={getScoreStatus(review.entryScore)}
          isActive={activeDetail === "entry"}
          onClick={() => toggleScoreDetail("entry")}
        />
        <QualityStat
          label="Зона"
          value={`${review.zoneScore}/100`}
          status={getScoreStatus(review.zoneScore)}
          isActive={activeDetail === "zone"}
          onClick={() => toggleScoreDetail("zone")}
        />
      </div>

      {scoreDetail ? <ScoreDetailPanel detail={scoreDetail} /> : null}

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
              getOpenInterestBadgeClassName(openInterest, candidate.direction),
            ].join(" ")}
          >
            OI {openInterest.label} {openInterest.score}/100
          </span>
        ) : null}
        <span
          className={[
            "rounded-full border px-2.5 py-1",
            getDirectionAwareClassName({
              direction: candidate.direction,
              signalDirection:
                levels.volumePressure.pressure === "buying"
                  ? "long"
                  : levels.volumePressure.pressure === "selling"
                    ? "short"
                    : "neutral",
              fallbackStatus: levels.volumePressure.status,
            }),
          ].join(" ")}
        >
          обсяг {levels.volumePressure.label} {levels.volumePressure.score}/100
        </span>
        <span
          className={[
            "rounded-full border px-2.5 py-1",
            getDirectionAwareClassName({
              direction: candidate.direction,
              signalDirection: levels.adx.direction,
              fallbackStatus: levels.adx.status,
            }),
          ].join(" ")}
        >
          ADX {levels.adx.label}
        </span>
        <span
          className={[
            "rounded-full border px-2.5 py-1",
            getDirectionAwareClassName({
              direction: candidate.direction,
              signalDirection: levels.marketStructure.direction,
              fallbackStatus: levels.marketStructure.status,
            }),
          ].join(" ")}
        >
          структура {levels.marketStructure.label}
        </span>
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
  isActive,
  onClick,
}: {
  label: string;
  value: string;
  status: ReviewStatus;
  isActive: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "rounded-[0.85rem] border px-3 py-2 text-left transition hover:border-white/24 hover:bg-white/[0.08]",
        statusClassName[status],
        isActive ? "ring-1 ring-white/30" : "",
      ].join(" ")}
    >
      <p className="text-[0.58rem] uppercase tracking-[0.18em] opacity-60">
        {label}
      </p>
      <p className="mt-1 font-mono text-sm font-semibold text-white">{value}</p>
    </button>
  );
}

function getSignalDetail(candidate: DirectionCandidate, id: string) {
  return candidate.review.signals.find((signal) => signal.id === id)?.detail ?? "";
}

function getScoreDetail(kind: ScoreDetailKind, candidate: DirectionCandidate) {
  const levels = candidate.review.levels;
  const rewardToRisk = levels.rewardToRisk;

  if (kind === "market") {
    return {
      title: "Ринок",
      includes: [
        "тренд",
        "поточний рух",
        "обсяг",
        "ADX",
        "структура",
        "BTC",
        "Open Interest",
        "волатильність",
      ],
      current: [
        getSignalDetail(candidate, "market-quality"),
        `Обсяг: ${levels.volumePressure.detail}`,
        `ADX: ${levels.adx.detail}`,
        `Структура: ${levels.marketStructure.detail}`,
        levels.openInterest.status === "ok"
          ? `OI: ${levels.openInterest.summary}`
          : `OI: ${levels.openInterest.status === "partial" ? "є тільки поточне значення" : "немає нормальних даних"}`,
      ],
    };
  }

  if (kind === "entry") {
    return {
      title: "Вхід",
      includes: ["точка входу", "R/R", "ATR", "стоп і ціль", "стадія руху"],
      current: [
        getSignalDetail(candidate, "entry-quality"),
        getSignalDetail(candidate, "rr-noise"),
        getSignalDetail(candidate, "move-exhaustion"),
        getSignalDetail(candidate, "levels-risk"),
        `R/R: ${rewardToRisk === null ? "не пораховано" : `${rewardToRisk.toFixed(2)}R`}`,
      ],
    };
  }

  return {
    title: "Зона",
    includes: ["MTF-підтвердження", "реакція", "обсяг у зоні", "сила зони", "відстань до зони"],
    current: [
      getSignalDetail(candidate, "zone-quality"),
      levels.directionalVolume.detail,
      `Зона: ${levels.zoneReaction.zoneLabel} ${formatTradingViewPrice(levels.zoneReaction.zoneLow)} - ${formatTradingViewPrice(levels.zoneReaction.zoneHigh)}`,
    ],
  };
}

function ScoreDetailPanel({
  detail,
}: {
  detail: { title: string; includes: string[]; current: string[] };
}) {
  return (
    <div className="mt-3 rounded-[0.95rem] border border-white/10 bg-black/18 px-3 py-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium uppercase tracking-[0.18em] text-white/42">
          {detail.title}
        </span>
        {detail.includes.map((item) => (
          <span
            key={item}
            className="rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[0.68rem] text-white/58"
          >
            {item}
          </span>
        ))}
      </div>
      <div className="mt-2 grid gap-1.5 text-xs leading-5 text-white/58">
        {detail.current
          .filter((item) => item.length > 0)
          .map((item) => (
            <p key={item}>{item}</p>
          ))}
      </div>
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
