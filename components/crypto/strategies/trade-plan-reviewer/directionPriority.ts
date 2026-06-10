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
    review.marketScore * 0.42 +
    review.entryScore * 0.38 +
    review.zoneScore * 0.2 -
    getEntryPenalty(review);

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
  const bestZoneScore = bestCandidate.review.zoneScore;
  const hasDirectionButWeakEntry = bestMarketScore >= 65 && bestEntryScore < 65;
  const entryIsInterestingButMarketWeak =
    bestEntryScore >= 65 && bestMarketScore < 60;
  const entryIsInterestingButZoneWeak =
    bestEntryScore >= 65 && bestZoneScore < 55;
  const oppositeEntryIsInterestingButMarketWeak =
    secondCandidate.review.entryScore >= 65 &&
    secondCandidate.review.marketScore < 60;
  const shouldWait =
    hasDirectionButWeakEntry ||
    entryIsInterestingButMarketWeak ||
    entryIsInterestingButZoneWeak ||
    bestCandidate.score < 55 ||
    (scoreGap < 6 && bestCandidate.score < 75);

  if (shouldWait) {
    return {
      preferredDirection: "wait",
      title: hasDirectionButWeakEntry
        ? "Ринок є, точка слабка"
        : entryIsInterestingButMarketWeak
          ? "Точка є, ринок слабкий"
          : entryIsInterestingButZoneWeak
            ? "Точка є, зона слабка"
        : "Краще почекати",
      summary: hasDirectionButWeakEntry
        ? `${bestCandidate.label}: ринок ${bestMarketScore}/100, але вхід ${bestEntryScore}/100. Краще чекати відкат, чистіший RR або реакцію.${
            oppositeEntryIsInterestingButMarketWeak
              ? ` ${secondCandidate.label}: точка цікава, але ринок ${secondCandidate.review.marketScore}/100 ще не підтвердив.`
              : ""
          }`
        : entryIsInterestingButMarketWeak
          ? `${bestCandidate.label}: точка входу ${bestEntryScore}/100, але ринок лише ${bestMarketScore}/100. Потрібне підтвердження напрямку.`
          : entryIsInterestingButZoneWeak
            ? `${bestCandidate.label}: вхід ${bestEntryScore}/100, але зона лише ${bestZoneScore}/100. Потрібна сильніша реакція або обсяг у зоні.`
          : "Long і Short не дають чистої переваги. Зараз важливіше дочекатися кращої зони або сильнішого руху.",
      candidates,
    };
  }

  return {
    preferredDirection: bestCandidate.direction,
    title: `Пріоритет: ${bestCandidate.label}`,
    summary:
      bestCandidate.direction === "long"
        ? `Long має кращу трійку: ринок ${bestCandidate.review.marketScore}/100, вхід ${bestCandidate.review.entryScore}/100, зона ${bestCandidate.review.zoneScore}/100.`
        : `Short має кращу трійку: ринок ${bestCandidate.review.marketScore}/100, вхід ${bestCandidate.review.entryScore}/100, зона ${bestCandidate.review.zoneScore}/100.`,
    candidates,
  };
}
