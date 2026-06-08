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

function getEntryPenalty(review: ReviewResult) {
  const rewardToRisk = review.levels.rewardToRisk;
  const moveIsLate = review.verdict.label === "Рух уже реалізований";
  let penalty = moveIsLate ? 12 : 0;

  if (rewardToRisk !== null && rewardToRisk < 1.2) {
    penalty += 12;
  }

  return penalty;
}

function getScore(review: ReviewResult) {
  const rawScore =
    review.marketScore * 0.52 + review.entryScore * 0.48 - getEntryPenalty(review);

  return Math.round(clamp(rawScore, 0, getGradeCap(review.grade)));
}

function getReasons(review: ReviewResult) {
  return review.primaryIssues.slice(0, 3);
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
  const bestMarketScore = bestCandidate.review.marketScore;
  const bestEntryScore = bestCandidate.review.entryScore;
  const hasDirectionButWeakEntry = bestMarketScore >= 65 && bestEntryScore < 50;
  const shouldWait =
    hasDirectionButWeakEntry ||
    bestCandidate.score < 55 ||
    (scoreGap < 6 && bestCandidate.score < 75);

  if (shouldWait) {
    return {
      preferredDirection: "wait",
      title: hasDirectionButWeakEntry
        ? "Напрям є, вхід слабкий"
        : "Краще почекати",
      summary: hasDirectionButWeakEntry
        ? `${bestCandidate.label} має кращий ринок (${bestMarketScore}/100), але точка входу лише ${bestEntryScore}/100. Краще чекати відкат, чистіший RR або реакцію.`
        : "Long і Short не дають чистої переваги. Зараз важливіше дочекатися кращої зони або сильнішого руху.",
      candidates,
    };
  }

  return {
    preferredDirection: bestCandidate.direction,
    title: `Пріоритет: ${bestCandidate.label}`,
    summary:
      bestCandidate.direction === "long"
        ? `Long має кращий баланс ринку (${bestCandidate.review.marketScore}/100) і входу (${bestCandidate.review.entryScore}/100).`
        : `Short має кращий баланс ринку (${bestCandidate.review.marketScore}/100) і входу (${bestCandidate.review.entryScore}/100).`,
    candidates,
  };
}
