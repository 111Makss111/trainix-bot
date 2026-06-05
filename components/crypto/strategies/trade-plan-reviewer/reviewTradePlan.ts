import type {
  EntryMode,
  MarketSnapshot,
  ReviewGrade,
  ReviewItem,
  ReviewMetric,
  ReviewResult,
  ReviewStatus,
  TradeDirection,
  TradePlan,
} from "./types";
import { formatTradingViewPrice } from "./formatters";

const minimumAutoStopAtr = 0.75;
const minimumAutoTargetAtr = 1.5;
const minimumAutoRewardRatio = 1.5;
const marketEntryMaxAtrDistance = 0.35;
const plannedEntryMaxAtrDistance = 2.5;
const plannedEntryMaxPercentDistance = 8;
const zoneStopBufferAtr = 0.15;

function toNumber(value: string) {
  const normalizedValue = value.replace(",", ".").trim();
  const numberValue = Number.parseFloat(normalizedValue);

  return Number.isFinite(numberValue) ? numberValue : null;
}

function formatRatio(value: number | null) {
  return value === null ? "авто" : `${value.toFixed(2)}R`;
}

function getAtrPriceDistance(
  market: MarketSnapshot,
  multiple: number,
  fallbackPercent: number,
) {
  if (market.atr > 0) {
    return market.atr * multiple;
  }

  return market.currentPrice * fallbackPercent;
}

function getAtrMultipleByPriceDistance(priceDistance: number, market: MarketSnapshot) {
  if (market.atr <= 0) {
    return null;
  }

  return priceDistance / market.atr;
}

function getEntryDistanceFromMarket(entryPrice: number, market: MarketSnapshot) {
  const priceDistance = Math.abs(entryPrice - market.currentPrice);

  return {
    percent:
      market.currentPrice > 0 ? (priceDistance / market.currentPrice) * 100 : 0,
    atr: getAtrMultipleByPriceDistance(priceDistance, market),
  };
}

function buildEntryResult(price: number, mode: EntryMode, market: MarketSnapshot) {
  const distance = getEntryDistanceFromMarket(price, market);

  return {
    price,
    mode,
    distanceFromMarketPercent: distance.percent,
    distanceFromMarketAtr: distance.atr,
  };
}

function getAutoEntry(direction: TradeDirection, market: MarketSnapshot) {
  const allowedDistance = getAtrPriceDistance(
    market,
    marketEntryMaxAtrDistance,
    0.002,
  );

  if (direction === "long") {
    const zoneEntry = market.nearestSupport.high;
    const isPriceNearEntryZone = market.currentPrice <= zoneEntry + allowedDistance;
    const zoneDistance = getEntryDistanceFromMarket(zoneEntry, market);
    const isZoneStillTradable =
      zoneDistance.percent <= plannedEntryMaxPercentDistance &&
      (zoneDistance.atr === null || zoneDistance.atr <= plannedEntryMaxAtrDistance);

    if (isPriceNearEntryZone) {
      return buildEntryResult(market.currentPrice, "market", market);
    }

    return isZoneStillTradable
      ? buildEntryResult(zoneEntry, "limit", market)
      : buildEntryResult(market.currentPrice, "distant", market);
  }

  const zoneEntry = market.nearestResistance.low;
  const isPriceNearEntryZone = market.currentPrice >= zoneEntry - allowedDistance;
  const zoneDistance = getEntryDistanceFromMarket(zoneEntry, market);
  const isZoneStillTradable =
    zoneDistance.percent <= plannedEntryMaxPercentDistance &&
    (zoneDistance.atr === null || zoneDistance.atr <= plannedEntryMaxAtrDistance);

  if (isPriceNearEntryZone) {
    return buildEntryResult(market.currentPrice, "market", market);
  }

  return isZoneStillTradable
    ? buildEntryResult(zoneEntry, "limit", market)
    : buildEntryResult(market.currentPrice, "distant", market);
}

function getEffectiveEntry(plan: TradePlan, market: MarketSnapshot) {
  const customEntry = toNumber(plan.entryPrice);

  if (customEntry !== null) {
    return buildEntryResult(customEntry, "custom", market);
  }

  return getAutoEntry(plan.direction, market);
}

function getAutoStopLoss(
  direction: TradeDirection,
  entryPrice: number,
  market: MarketSnapshot,
) {
  const minimumStopDistance = getAtrPriceDistance(
    market,
    minimumAutoStopAtr,
    0.004,
  );
  const zoneBuffer = getAtrPriceDistance(market, zoneStopBufferAtr, 0.001);

  if (direction === "long") {
    const stopBelowSupport = market.nearestSupport.low - zoneBuffer;
    const stopBelowEntry = entryPrice - minimumStopDistance;

    return Math.min(stopBelowSupport, stopBelowEntry);
  }

  const stopAboveResistance = market.nearestResistance.high + zoneBuffer;
  const stopAboveEntry = entryPrice + minimumStopDistance;

  return Math.max(stopAboveResistance, stopAboveEntry);
}

function getEffectiveStop(
  plan: TradePlan,
  market: MarketSnapshot,
  entryPrice: number,
) {
  const customStop = toNumber(plan.stopLoss);

  if (customStop !== null) {
    return customStop;
  }

  return getAutoStopLoss(plan.direction, entryPrice, market);
}

function getAutoTakeProfit(
  direction: TradeDirection,
  entryPrice: number,
  stopLoss: number,
  market: MarketSnapshot,
) {
  const riskDistance = Math.abs(entryPrice - stopLoss);
  const minimumTargetDistance = Math.max(
    riskDistance * minimumAutoRewardRatio,
    getAtrPriceDistance(market, minimumAutoTargetAtr, 0.008),
  );

  if (direction === "long") {
    const targetByZone = market.nearestResistance.price;
    const targetByAtr = entryPrice + minimumTargetDistance;

    return Math.max(targetByZone, targetByAtr);
  }

  const targetByZone = market.nearestSupport.price;
  const targetByAtr = entryPrice - minimumTargetDistance;

  return Math.min(targetByZone, targetByAtr);
}

function getEffectiveTarget(
  plan: TradePlan,
  market: MarketSnapshot,
  entryPrice: number,
  stopLoss: number,
) {
  const customTarget = toNumber(plan.takeProfit);

  if (customTarget !== null) {
    return customTarget;
  }

  return getAutoTakeProfit(plan.direction, entryPrice, stopLoss, market);
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

function getAtrMultiple(distancePercent: number, market: MarketSnapshot) {
  if (market.atrPercent <= 0) {
    return null;
  }

  return distancePercent / market.atrPercent;
}

function getAtrStatus(
  stopAtrMultiple: number | null,
  targetAtrMultiple: number | null,
): ReviewStatus {
  if (stopAtrMultiple === null || targetAtrMultiple === null) {
    return "warning";
  }

  if (stopAtrMultiple < 0.7 || targetAtrMultiple < 1) {
    return "fail";
  }

  if (stopAtrMultiple > 3 || targetAtrMultiple < 1.5) {
    return "warning";
  }

  return "pass";
}

function getEntryStatus(entryMode: EntryMode): ReviewStatus {
  if (entryMode === "distant") {
    return "fail";
  }

  return entryMode === "limit" ? "warning" : "pass";
}

function getEntrySignalDetail({
  direction,
  entryMode,
  entryDistanceFromMarketPercent,
  entryDistanceFromMarketAtr,
}: {
  direction: TradeDirection;
  entryMode: EntryMode;
  entryDistanceFromMarketPercent: number;
  entryDistanceFromMarketAtr: number | null;
}) {
  if (entryMode === "custom") {
    return "Використовується ручна ціна входу.";
  }

  if (entryMode === "market") {
    return "Поточна ціна вже достатньо близько до ATR-зони входу.";
  }

  if (entryMode === "distant") {
    return "Найближча сильна MTF-зона занадто далеко від поточної ціни. Це не робочий вхід зараз.";
  }

  const sideText = direction === "long" ? "нижче" : "вище";
  const atrText =
    entryDistanceFromMarketAtr === null
      ? ""
      : `, ${entryDistanceFromMarketAtr.toFixed(1)} ATR`;

  return `Ціна відійшла від нормальної зони. Вхід краще чекати ${sideText} поточної на ${entryDistanceFromMarketPercent.toFixed(2)}%${atrText}.`;
}

function getAtrSignalDetail(
  stopAtrMultiple: number | null,
  targetAtrMultiple: number | null,
  market: MarketSnapshot,
) {
  if (stopAtrMultiple === null || targetAtrMultiple === null) {
    return "ATR ще не пораховано. Без нього стоп і ціль не можна порівняти з нормальним рухом активу.";
  }

  if (stopAtrMultiple < 0.7) {
    return `Стоп лише ${stopAtrMultiple.toFixed(1)} ATR. Його може вибити звичайним ринковим шумом.`;
  }

  if (targetAtrMultiple < 1) {
    return `Ціль лише ${targetAtrMultiple.toFixed(1)} ATR. Потенціал менший за нормальний рух активу.`;
  }

  if (stopAtrMultiple > 3) {
    return `Стоп ${stopAtrMultiple.toFixed(1)} ATR. Він занадто широкий для поточного шуму.`;
  }

  if (targetAtrMultiple < 1.5) {
    return `Ціль ${targetAtrMultiple.toFixed(1)} ATR. Запас руху є, але він ще слабкий.`;
  }

  return `ATR ${market.atrPercent.toFixed(2)}%. Стоп ${stopAtrMultiple.toFixed(1)} ATR, ціль ${targetAtrMultiple.toFixed(1)} ATR.`;
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
    summary: "Є конфлікт із трендом, BTC, простором до цілі або базовою логікою рівнів.",
  };
}

export function reviewTradePlan(
  plan: TradePlan,
  market: MarketSnapshot,
): ReviewResult {
  const accountBalance = toNumber(plan.accountBalance);
  const positionSize = toNumber(plan.positionSize);
  const entry = getEffectiveEntry(plan, market);
  const entryPrice = entry.price;
  const stopLoss = getEffectiveStop(plan, market, entryPrice);
  const takeProfit = getEffectiveTarget(plan, market, entryPrice, stopLoss);

  const riskDistancePercent = (Math.abs(entryPrice - stopLoss) / entryPrice) * 100;
  const rewardDistancePercent =
    (Math.abs(takeProfit - entryPrice) / entryPrice) * 100;

  const accountRiskPercent =
    accountBalance !== null && positionSize !== null
      ? ((positionSize * riskDistancePercent) / 100 / accountBalance) * 100
      : null;

  const rewardToRisk =
    riskDistancePercent > 0 ? rewardDistancePercent / riskDistancePercent : null;
  const stopAtrMultiple = getAtrMultiple(riskDistancePercent, market);
  const targetAtrMultiple = getAtrMultiple(rewardDistancePercent, market);

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
  const atrStatus = getAtrStatus(stopAtrMultiple, targetAtrMultiple);
  const entryStatus = getEntryStatus(entry.mode);

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
  const nearestTargetZoneDistancePercent =
    (Math.abs(targetZone.price - entryPrice) / entryPrice) * 100;
  const targetSpacePercent = rewardDistancePercent;
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
      "entry",
      "Вхід",
      getEntrySignalDetail({
        direction: plan.direction,
        entryMode: entry.mode,
        entryDistanceFromMarketPercent: entry.distanceFromMarketPercent,
        entryDistanceFromMarketAtr: entry.distanceFromMarketAtr,
      }),
      entryStatus,
    ),
    buildSignal(
      "space",
      "Простір до цілі",
      targetSpacePercent <= market.averageRangePercent
        ? `Ціль занадто близько: ${targetSpacePercent.toFixed(2)}%, а середній шум свічки ${market.averageRangePercent.toFixed(2)}%. Рух менший за шум.`
        : `Ціль ${targetSpacePercent.toFixed(2)}% від входу. Найближча зона ${targetZone.label} на ${nearestTargetZoneDistancePercent.toFixed(2)}%. Шум ${market.averageRangePercent.toFixed(2)}%.`,
      spaceStatus,
    ),
    buildSignal(
      "atr",
      "ATR",
      getAtrSignalDetail(stopAtrMultiple, targetAtrMultiple, market),
      atrStatus,
    ),
    buildSignal(
      "position",
      "Позиція в діапазоні",
      plan.direction === "long"
        ? pricePositionPercent > 55
          ? `Ціна вже на ${pricePositionPercent.toFixed(0)}% діапазону. Для Long краще чекати ближче до підтримки.`
          : `Ціна на ${pricePositionPercent.toFixed(0)}% діапазону. Для Long краще нижня третина.`
        : pricePositionPercent < 45
          ? `Ціна лише на ${pricePositionPercent.toFixed(0)}% діапазону. Для Short краще чекати ближче до опору.`
          : `Ціна на ${pricePositionPercent.toFixed(0)}% діапазону. Для Short краще верхня третина.`,
      positionStatus,
    ),
    buildSignal(
      "zone",
      "Близькість до зони",
      `Вхід на ${zoneDistancePercent.toFixed(2)}% від зони ${setupZone.label} (${formatTradingViewPrice(setupZone.low)} - ${formatTradingViewPrice(setupZone.high)}).`,
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
        ? `Вхід ${formatTradingViewPrice(entryPrice)}, стоп ${formatTradingViewPrice(stopLoss)}, ціль ${formatTradingViewPrice(takeProfit)}.`
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
        : rewardToRisk < 1.2
          ? `Потенціал ${rewardToRisk.toFixed(2)}R. Ризик більший за потенціал, угоду краще не брати.`
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
    levels: {
      currentPrice: market.currentPrice,
      entryPrice,
      entryMode: entry.mode,
      entryDistanceFromMarketPercent: entry.distanceFromMarketPercent,
      entryDistanceFromMarketAtr: entry.distanceFromMarketAtr,
      stopLoss,
      takeProfit,
      riskDistancePercent,
      rewardDistancePercent,
      targetSpacePercent,
      zoneDistancePercent,
      pricePositionPercent,
      accountRiskPercent,
      rewardToRisk,
      stopAtrMultiple,
      targetAtrMultiple,
    },
    metrics,
    signals,
    nextActions,
  };
}
