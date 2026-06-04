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

function formatRatio(value: number | null) {
  return value === null ? "авто" : `${value.toFixed(2)}R`;
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

function getSpaceStatus(targetSpacePercent: number, market: MarketSnapshot) {
  if (targetSpacePercent < 0.6 || market.rangeToNoiseRatio < 2) {
    return "fail";
  }

  if (targetSpacePercent < 1.2 || market.rangeToNoiseRatio < 3.5) {
    return "warning";
  }

  return "pass";
}

function getPositionStatus(
  direction: TradeDirection,
  pricePositionPercent: number,
): ReviewStatus {
  if (direction === "long") {
    if (pricePositionPercent <= 35) {
      return "pass";
    }

    if (pricePositionPercent <= 55) {
      return "warning";
    }

    return "fail";
  }

  if (pricePositionPercent >= 65) {
    return "pass";
  }

  if (pricePositionPercent >= 45) {
    return "warning";
  }

  return "fail";
}

function getVolatilityStatus(market: MarketSnapshot): ReviewStatus {
  if (market.volatilityState === "extreme") {
    return "fail";
  }

  if (market.volatilityState === "high" || market.volatilityState === "quiet") {
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
      title: "Ідея виглядає зібрано",
      summary: "Напрямок, BTC-контекст, зона і ризик не конфліктують між собою.",
    };
  }

  if (grade === "review") {
    return {
      title: "Є речі для перевірки",
      summary: "Є попередження. Вхід можливий тільки після перевірки слабких місць.",
    };
  }

  if (grade === "weak") {
    return {
      title: "Ідея поки слабка",
      summary: "Ринок не дає достатньо підтверджень. Ідею краще не поспішати брати.",
    };
  }

  return {
    title: "Угода зараз неякісна",
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
  const targetZone =
    plan.direction === "long"
      ? market.nearestResistance
      : market.nearestSupport;
  const targetSpacePercent =
    (Math.abs(targetZone.price - entryPrice) / entryPrice) * 100;
  const rangeWidth = market.nearestResistance.price - market.nearestSupport.price;
  const pricePositionPercent =
    rangeWidth > 0
      ? Math.min(
          Math.max(
            ((entryPrice - market.nearestSupport.price) / rangeWidth) * 100,
            0,
          ),
          100,
        )
      : 50;
  const spaceStatus = getSpaceStatus(targetSpacePercent, market);
  const positionStatus = getPositionStatus(plan.direction, pricePositionPercent);
  const volatilityStatus = getVolatilityStatus(market);

  const signals = [
    buildSignal(
      "trend",
      "Тренд",
      market.trend === "sideways"
        ? `Ринок у боковику, сила ${market.trendStrength}/100.`
        : `Тренд ${market.trend === "up" ? "вгору" : "вниз"}, сила ${market.trendStrength}/100.`,
      trendStatus,
    ),
    buildSignal(
      "btc",
      "BTC",
      `BTC зараз ${market.btcBias === "bullish" ? "підтримує ріст" : market.btcBias === "bearish" ? "тисне вниз" : "нейтральний"}.`,
      btcStatus,
    ),
    buildSignal(
      "space",
      "Простір до цілі",
      `До ${targetZone.label} ${targetSpacePercent.toFixed(2)}%. Діапазон ${market.rangeWidthPercent.toFixed(2)}%, шум ${market.averageRangePercent.toFixed(2)}%.`,
      spaceStatus,
    ),
    buildSignal(
      "position",
      "Позиція в діапазоні",
      plan.direction === "long"
        ? `Ціна на ${pricePositionPercent.toFixed(0)}% діапазону. Для Long краще нижня третина.`
        : `Ціна на ${pricePositionPercent.toFixed(0)}% діапазону. Для Short краще верхня третина.`,
      positionStatus,
    ),
    buildSignal(
      "zone",
      "Близькість до зони",
      `Вхід на ${zoneDistancePercent.toFixed(2)}% від зони ${setupZone.label} (${formatPrice(setupZone.low)} - ${formatPrice(setupZone.high)}).`,
      zoneStatus,
    ),
    buildSignal(
      "noise",
      "Ринковий шум",
      `Волатильність ${market.volatilityState === "extreme" ? "екстремальна" : market.volatilityState === "high" ? "висока" : market.volatilityState === "quiet" ? "тиха" : "нормальна"}, середній шум свічки ${market.averageRangePercent.toFixed(2)}%.`,
      volatilityStatus,
    ),
    buildSignal(
      "levels",
      "Рівні угоди",
      priceSideStatus === "pass"
        ? `Вхід ${formatPrice(entryPrice)}, стоп ${formatPrice(stopLoss)}, ціль ${formatPrice(takeProfit)}.`
        : "Стоп або ціль стоять не з того боку від входу.",
      priceSideStatus,
    ),
    buildSignal(
      "risk",
      "Ризик",
      accountRiskPercent === null
        ? "Додай баланс і позицію, щоб порахувати ризик."
        : accountRiskPercent > 3
          ? `Ризик ${accountRiskPercent.toFixed(2)}% вище ліміту.`
          : `Ризик ${accountRiskPercent.toFixed(2)}% акаунту.`,
      riskStatus,
    ),
    buildSignal(
      "reward",
      "Потенціал",
      rewardToRisk === null
        ? "Не можу порахувати співвідношення потенціалу до ризику."
        : `Потенціал ${rewardToRisk.toFixed(2)}R.`,
      rewardStatus,
    ),
  ];

  const metrics = [
    buildMetric(
      "Тренд ринку",
      market.trend === "up" ? "ВГОРУ" : market.trend === "down" ? "ВНИЗ" : "БОКОВИК",
      `сила ${market.trendStrength}/100`,
      trendStatus,
    ),
    buildMetric(
      "Простір до цілі",
      `${targetSpacePercent.toFixed(2)}%`,
      `${market.rangeToNoiseRatio.toFixed(1)}x шум`,
      spaceStatus,
    ),
    buildMetric(
      "Потенціал / ризик",
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
      : ["Ідею можна розглядати, але без автоторгівлі."];

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
