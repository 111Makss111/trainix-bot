import type {
  MarketSnapshot,
  ReviewGrade,
  ReviewItem,
  ReviewMetric,
  ReviewResult,
  ReviewStatus,
  TradeDirection,
  TradePlan,
} from "./types";

function toNumber(value: string) {
  const normalizedValue = value.replace(",", ".").trim();
  const numberValue = Number.parseFloat(normalizedValue);

  return Number.isFinite(numberValue) ? numberValue : null;
}

function formatPercent(value: number | null) {
  return value === null ? "auto" : `${value.toFixed(2)}%`;
}

function formatRatio(value: number | null) {
  return value === null ? "auto" : `${value.toFixed(2)}R`;
}

function formatPrice(value: number) {
  return value.toLocaleString("en-US", {
    maximumFractionDigits: value >= 1000 ? 0 : 2,
  });
}

function getEffectiveEntry(plan: TradePlan, market: MarketSnapshot) {
  return toNumber(plan.entryPrice) ?? market.currentPrice;
}

function getEffectiveStop(plan: TradePlan, market: MarketSnapshot) {
  const customStop = toNumber(plan.stopLoss);

  if (customStop !== null) {
    return customStop;
  }

  return plan.direction === "long"
    ? market.nearestSupport.price
    : market.nearestResistance.price;
}

function getEffectiveTarget(plan: TradePlan, market: MarketSnapshot) {
  const customTarget = toNumber(plan.takeProfit);

  if (customTarget !== null) {
    return customTarget;
  }

  return plan.direction === "long"
    ? market.nearestResistance.price
    : market.nearestSupport.price;
}

function getPriceSideStatus(
  direction: TradeDirection,
  entryPrice: number,
  stopLoss: number,
  takeProfit: number,
): ReviewStatus {
  if (direction === "long") {
    return stopLoss < entryPrice && takeProfit > entryPrice ? "pass" : "fail";
  }

  return stopLoss > entryPrice && takeProfit < entryPrice ? "pass" : "fail";
}

function getTrendStatus(direction: TradeDirection, market: MarketSnapshot) {
  if (market.trend === "sideways") {
    return "warning";
  }

  if (direction === "long" && market.trend === "up") {
    return "pass";
  }

  if (direction === "short" && market.trend === "down") {
    return "pass";
  }

  return "fail";
}

function getBtcStatus(direction: TradeDirection, market: MarketSnapshot) {
  if (market.btcBias === "neutral") {
    return "warning";
  }

  if (direction === "long" && market.btcBias === "bullish") {
    return "pass";
  }

  if (direction === "short" && market.btcBias === "bearish") {
    return "pass";
  }

  return "fail";
}

function getRiskStatus(accountRiskPercent: number | null): ReviewStatus {
  if (accountRiskPercent === null) {
    return "warning";
  }

  if (accountRiskPercent > 3) {
    return "fail";
  }

  if (accountRiskPercent > 1.5) {
    return "warning";
  }

  return "pass";
}

function getRewardStatus(rewardToRisk: number | null): ReviewStatus {
  if (rewardToRisk === null) {
    return "warning";
  }

  if (rewardToRisk < 1.2) {
    return "fail";
  }

  if (rewardToRisk < 2) {
    return "warning";
  }

  return "pass";
}

function buildMetric(
  label: string,
  value: string,
  detail: string,
  status: ReviewStatus,
): ReviewMetric {
  return { label, value, detail, status };
}

function buildSignal(
  id: string,
  label: string,
  detail: string,
  status: ReviewStatus,
): ReviewItem {
  return { id, label, detail, status };
}

function getGrade(signals: ReviewItem[], accountRiskPercent: number | null) {
  const failCount = signals.filter((item) => item.status === "fail").length;
  const warningCount = signals.filter((item) => item.status === "warning").length;

  if (failCount > 0 || (accountRiskPercent !== null && accountRiskPercent > 3)) {
    return "no-trade";
  }

  if (warningCount >= 3) {
    return "weak";
  }

  if (warningCount > 0) {
    return "review";
  }

  return "ready";
}

function getGradeCopy(grade: ReviewGrade) {
  if (grade === "ready") {
    return {
      title: "Setup aligned",
      summary: "Напрямок, BTC-контекст, зона і ризик не конфліктують між собою.",
    };
  }

  if (grade === "review") {
    return {
      title: "Needs review",
      summary: "Є попередження. Вхід можливий тільки після перевірки слабких місць.",
    };
  }

  if (grade === "weak") {
    return {
      title: "Weak setup",
      summary: "Ринок не дає достатньо підтверджень. Ідею краще не поспішати брати.",
    };
  }

  return {
    title: "No-trade",
    summary: "Є конфлікт із трендом, BTC або базовою логікою рівнів.",
  };
}

export function reviewTradePlan(
  plan: TradePlan,
  market: MarketSnapshot,
): ReviewResult {
  const accountBalance = toNumber(plan.accountBalance);
  const positionSize = toNumber(plan.positionSize);
  const entryPrice = getEffectiveEntry(plan, market);
  const stopLoss = getEffectiveStop(plan, market);
  const takeProfit = getEffectiveTarget(plan, market);

  const riskDistancePercent = (Math.abs(entryPrice - stopLoss) / entryPrice) * 100;
  const rewardDistancePercent =
    (Math.abs(takeProfit - entryPrice) / entryPrice) * 100;

  const accountRiskPercent =
    accountBalance !== null && positionSize !== null
      ? ((positionSize * riskDistancePercent) / 100 / accountBalance) * 100
      : null;

  const rewardToRisk =
    riskDistancePercent > 0 ? rewardDistancePercent / riskDistancePercent : null;

  const trendStatus = getTrendStatus(plan.direction, market);
  const btcStatus = getBtcStatus(plan.direction, market);
  const priceSideStatus = getPriceSideStatus(
    plan.direction,
    entryPrice,
    stopLoss,
    takeProfit,
  );
  const riskStatus = getRiskStatus(accountRiskPercent);
  const rewardStatus = getRewardStatus(rewardToRisk);

  const setupZone =
    plan.direction === "long"
      ? market.nearestSupport
      : market.nearestResistance;

  const zoneDistancePercent =
    (Math.abs(entryPrice - setupZone.price) / entryPrice) * 100;
  const zoneStatus =
    zoneDistancePercent <= 1 ? "pass" : zoneDistancePercent <= 2.5 ? "warning" : "fail";

  const signals = [
    buildSignal(
      "trend",
      "Trend",
      market.trend === "sideways"
        ? `Ринок у боковику, сила ${market.trendStrength}/100.`
        : `Тренд ${market.trend === "up" ? "вгору" : "вниз"}, сила ${market.trendStrength}/100.`,
      trendStatus,
    ),
    buildSignal(
      "btc",
      "BTC",
      `BTC bias: ${market.btcBias}.`,
      btcStatus,
    ),
    buildSignal(
      "zone",
      "Zone",
      `Вхід на ${zoneDistancePercent.toFixed(2)}% від зони ${setupZone.label} (${formatPrice(setupZone.price)}).`,
      zoneStatus,
    ),
    buildSignal(
      "levels",
      "Levels",
      priceSideStatus === "pass"
        ? `Entry ${formatPrice(entryPrice)}, stop ${formatPrice(stopLoss)}, target ${formatPrice(takeProfit)}.`
        : "Стоп або ціль стоять не з того боку від входу.",
      priceSideStatus,
    ),
    buildSignal(
      "risk",
      "Risk",
      accountRiskPercent === null
        ? "Додай баланс і позицію, щоб порахувати ризик."
        : accountRiskPercent > 3
          ? `Ризик ${accountRiskPercent.toFixed(2)}% вище ліміту.`
          : `Ризик ${accountRiskPercent.toFixed(2)}% акаунту.`,
      riskStatus,
    ),
    buildSignal(
      "reward",
      "R/R",
      rewardToRisk === null
        ? "Не можу порахувати reward/risk."
        : `Потенціал ${rewardToRisk.toFixed(2)}R.`,
      rewardStatus,
    ),
  ];

  const metrics = [
    buildMetric(
      "Market Trend",
      market.trend === "up" ? "UP" : market.trend === "down" ? "DOWN" : "RANGE",
      `${market.trendStrength}/100 strength`,
      trendStatus,
    ),
    buildMetric(
      "Account Risk",
      formatPercent(accountRiskPercent),
      "ризик акаунту",
      riskStatus,
    ),
    buildMetric(
      "Reward / Risk",
      formatRatio(rewardToRisk),
      "потенціал",
      rewardStatus,
    ),
  ];

  const nextActions =
    signals.filter((item) => item.status !== "pass").length > 0
      ? signals
          .filter((item) => item.status !== "pass")
          .map((item) => item.detail)
      : ["Setup можна розглядати, але без автоторгівлі."];

  const grade = getGrade(signals, accountRiskPercent);
  const gradeCopy = getGradeCopy(grade);

  return {
    grade,
    title: gradeCopy.title,
    summary: gradeCopy.summary,
    metrics,
    signals,
    nextActions,
  };
}
