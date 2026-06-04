import { reviewTradePlan } from "./reviewTradePlan";
import type {
  DirectionCandidate,
  DirectionPriority,
  ReviewGrade,
  ReviewResult,
  ReviewStatus,
  TradeDirection,
  TradePlan,
  MarketSnapshot,
} from "./types";

const directionLabel: Record<TradeDirection, string> = {
  long: "Long",
  short: "Short",
};

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function getStatus(score: number): ReviewStatus {
  if (score >= 75) {
    return "pass";
  }

  if (score >= 55) {
    return "warning";
  }

  return "fail";
}

function getGradeCap(grade: ReviewGrade) {
  if (grade === "ready") {
    return 100;
  }

  if (grade === "review") {
    return 78;
  }

  if (grade === "weak") {
    return 62;
  }

  return 45;
}

function getRewardBonus(review: ReviewResult) {
  const rewardToRisk = review.levels.rewardToRisk;

  if (rewardToRisk === null) {
    return 0;
  }

  if (rewardToRisk >= 2) {
    return 10;
  }

  if (rewardToRisk >= 1.5) {
    return 5;
  }

  if (rewardToRisk < 1.2) {
    return -12;
  }

  return 0;
}

function getScore(review: ReviewResult) {
  const passCount = review.signals.filter((signal) => signal.status === "pass").length;
  const warningCount = review.signals.filter(
    (signal) => signal.status === "warning",
  ).length;
  const failCount = review.signals.filter((signal) => signal.status === "fail").length;
  const rawScore =
    45 + passCount * 6 - warningCount * 5 - failCount * 16 + getRewardBonus(review);

  return Math.round(clamp(rawScore, 0, getGradeCap(review.grade)));
}

function getReasons(review: ReviewResult) {
  const blockedSignals = review.signals.filter((signal) => signal.status === "fail");
  const warningSignals = review.signals.filter(
    (signal) => signal.status === "warning",
  );
  const strongSignals = review.signals.filter((signal) => signal.status === "pass");

  if (blockedSignals.length > 0) {
    return blockedSignals.slice(0, 2).map((signal) => signal.detail);
  }

  if (warningSignals.length > 0) {
    return warningSignals.slice(0, 2).map((signal) => signal.detail);
  }

  return strongSignals.slice(0, 2).map((signal) => signal.detail);
}

function buildAutoPlan(
  plan: TradePlan,
  direction: TradeDirection,
): TradePlan {
  return {
    ...plan,
    direction,
    entryPrice: "",
    stopLoss: "",
    takeProfit: "",
  };
}

function buildCandidate(
  plan: TradePlan,
  market: MarketSnapshot,
  direction: TradeDirection,
): DirectionCandidate {
  const review = reviewTradePlan(buildAutoPlan(plan, direction), market);
  const score = getScore(review);

  return {
    direction,
    label: directionLabel[direction],
    score,
    status: getStatus(score),
    review,
    reasons: getReasons(review),
  };
}

export function getDirectionPriority(
  plan: TradePlan,
  market: MarketSnapshot,
): DirectionPriority {
  const candidates = [
    buildCandidate(plan, market, "long"),
    buildCandidate(plan, market, "short"),
  ].sort((first, second) => second.score - first.score);
  const [bestCandidate, secondCandidate] = candidates;
  const scoreGap = bestCandidate.score - secondCandidate.score;
  const shouldWait = bestCandidate.score < 55 || (scoreGap < 6 && bestCandidate.score < 75);

  if (shouldWait) {
    return {
      preferredDirection: "wait",
      title: "Краще почекати",
      summary:
        "Long і Short не дають чистої переваги. Зараз важливіше дочекатися кращої зони або сильнішого руху.",
      candidates,
    };
  }

  return {
    preferredDirection: bestCandidate.direction,
    title: `Пріоритет: ${bestCandidate.label}`,
    summary:
      bestCandidate.direction === "long"
        ? "Long зараз має кращу суму по тренду, зоні, простору до цілі та ризику."
        : "Short зараз має кращу суму по тренду, зоні, простору до цілі та ризику.",
    candidates,
  };
}
