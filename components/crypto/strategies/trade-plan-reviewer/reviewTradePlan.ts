import type {
  EntryMode,
  MarketSnapshot,
  MarketZone,
  MarketZoneReaction,
  OpenInterestState,
  PriceActionState,
  ReviewGrade,
  ReviewItem,
  ReviewMetric,
  ReviewResult,
  ReviewStatus,
  TradeSignalInfo,
  TradeDirection,
  TradePlan,
  TradeVerdict,
  ZoneVolumeProfile,
} from "./types";
import { formatTradingViewPrice } from "./formatters";

const minimumAutoStopAtr = 0.75;
const minimumAutoTargetAtr = 1.5;
const minimumAutoRewardRatio = 1.5;
const marketEntryMaxAtrDistance = 0.35;
const plannedEntryMaxAtrDistance = 2.5;
const plannedEntryMaxPercentDistance = 8;
const zoneStopBufferAtr = 0.15;

function isMomentumMode(priceAction: PriceActionState) {
  return (
    priceAction.mode === "impulse-up" ||
    priceAction.mode === "impulse-down" ||
    priceAction.mode === "overextended-up" ||
    priceAction.mode === "overextended-down"
  );
}

function isPriceActionAligned(direction: TradeDirection, priceAction: PriceActionState) {
  return priceAction.direction === direction && isMomentumMode(priceAction);
}

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
  if (
    isPriceActionAligned(direction, market.priceAction) &&
    market.priceAction.entryPrice !== null
  ) {
    return buildEntryResult(market.priceAction.entryPrice, "momentum", market);
  }

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
  if (
    isPriceActionAligned(direction, market.priceAction) &&
    market.priceAction.stopLoss !== null
  ) {
    return market.priceAction.stopLoss;
  }

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
  if (
    isPriceActionAligned(direction, market.priceAction) &&
    market.priceAction.takeProfit !== null
  ) {
    return market.priceAction.takeProfit;
  }

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

  if (entryMode === "momentum") {
    return "warning";
  }

  return entryMode === "limit" ? "warning" : "pass";
}

function formatTimeframes(timeframes: MarketZone["timeframes"]) {
  return timeframes
    .map((timeframe) => (timeframe === "1d" ? "1D" : timeframe))
    .join(" / ");
}

function getMtfStatus(zone: MarketZone): ReviewStatus {
  const hasHigherTimeframe =
    zone.timeframes.includes("1h") ||
    zone.timeframes.includes("4h") ||
    zone.timeframes.includes("1d");

  if (zone.sourceCount >= 3 || zone.timeframes.includes("4h") || zone.timeframes.includes("1d")) {
    return "pass";
  }

  if (zone.sourceCount >= 2 || hasHigherTimeframe) {
    return "warning";
  }

  return "warning";
}

function getMtfSignalDetail(zone: MarketZone) {
  if (zone.sourceCount >= 2) {
    return `Робочу зону підтверджують таймфрейми ${formatTimeframes(zone.timeframes)}.`;
  }

  return `Зона поки тільки на робочому таймфреймі ${formatTimeframes(zone.timeframes)}. Підтвердження зі старших ТФ немає.`;
}

function getReactionStatus(reaction: MarketZoneReaction): ReviewStatus {
  if (reaction.behavior === "breakdown" || reaction.behavior === "breakout") {
    return "fail";
  }

  if (reaction.strength === "strong" || reaction.strength === "medium") {
    return "pass";
  }

  return "warning";
}

function getReactionSignalDetail(reaction: MarketZoneReaction) {
  if (reaction.behavior === "none") {
    return "Реакції біля робочої зони ще немає.";
  }

  if (reaction.behavior === "breakdown" || reaction.behavior === "breakout") {
    return `${reaction.summary}. Зона пробита без швидкого повернення.`;
  }

  return `${reaction.summary}. Тінь ${reaction.wickPercent.toFixed(0)}%, ${
    reaction.closeReturned ? "закриття повернулось" : "закриття слабке"
  }.`;
}

function getZoneVolumeStatus(zoneVolume: ZoneVolumeProfile): ReviewStatus {
  if (zoneVolume.strength === "strong") {
    return "pass";
  }

  return "warning";
}

function getZoneVolumeSignalDetail(zoneVolume: ZoneVolumeProfile) {
  if (zoneVolume.strength === "unknown") {
    return "Обсяг у зоні ще не підтверджений.";
  }

  return `Обсяг ${zoneVolume.score}/100: ${zoneVolume.summary}.`;
}

function getOpenInterestStatus(
  direction: TradeDirection,
  openInterest: OpenInterestState,
): ReviewStatus {
  if (openInterest.status !== "ok") {
    return "pass";
  }

  if (direction === "long" && openInterest.signal === "new-longs") {
    return "pass";
  }

  if (direction === "short" && openInterest.signal === "new-shorts") {
    return "pass";
  }

  return "warning";
}

function getOpenInterestSignalDetail(openInterest: OpenInterestState) {
  if (openInterest.status === "unavailable") {
    return "Open Interest не завантажився для цієї біржі.";
  }

  if (openInterest.status === "partial") {
    return `${openInterest.summary} Показуємо без оцінки динаміки.`;
  }

  return `${openInterest.label}. ${openInterest.summary}`;
}

function getPriceActionStatus(
  direction: TradeDirection,
  priceAction: PriceActionState,
): ReviewStatus {
  if (priceAction.direction === "neutral") {
    return "warning";
  }

  if (priceAction.direction !== direction) {
    return "fail";
  }

  if (
    priceAction.mode === "overextended-up" ||
    priceAction.mode === "overextended-down"
  ) {
    return "warning";
  }

  return "pass";
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

  if (entryMode === "momentum") {
    return "Ціна вже в русі. Вхід рахується від мікро-відкату, не від старої зони.";
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
  priceAction: PriceActionState,
): ReviewStatus {
  if (isPriceActionAligned(direction, priceAction)) {
    return priceAction.mode === "overextended-up" ||
      priceAction.mode === "overextended-down"
      ? "warning"
      : "pass";
  }

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

function getZoneStatus(
  entryMode: EntryMode,
  zoneDistancePercent: number,
  priceActionStatus: ReviewStatus,
): ReviewStatus {
  if (entryMode === "momentum") {
    return priceActionStatus === "fail" ? "warning" : priceActionStatus;
  }

  return zoneDistancePercent <= 1
    ? "pass"
    : zoneDistancePercent <= 2.5
      ? "warning"
      : "fail";
}

function getStatusWeight(status: ReviewStatus) {
  if (status === "pass") {
    return 1;
  }

  if (status === "warning") {
    return 0.55;
  }

  return 0;
}

function getStatusByScore(score: number): ReviewStatus {
  if (score >= 70) {
    return "pass";
  }

  if (score >= 45) {
    return "warning";
  }

  return "fail";
}

function getWorstStatus(statuses: ReviewStatus[]): ReviewStatus {
  if (statuses.includes("fail")) {
    return "fail";
  }

  if (statuses.includes("warning")) {
    return "warning";
  }

  return "pass";
}

function getMarketScore({
  trendStatus,
  btcStatus,
  priceActionStatus,
  mtfStatus,
  reactionStatus,
  zoneVolumeStatus,
  openInterestStatus,
  volatilityStatus,
  market,
}: {
  trendStatus: ReviewStatus;
  btcStatus: ReviewStatus;
  priceActionStatus: ReviewStatus;
  mtfStatus: ReviewStatus;
  reactionStatus: ReviewStatus;
  zoneVolumeStatus: ReviewStatus;
  openInterestStatus: ReviewStatus;
  volatilityStatus: ReviewStatus;
  market: MarketSnapshot;
}) {
  const openInterestWeight = market.openInterest.status === "ok" ? 8 : 0;
  const availableWeight = 92 + openInterestWeight;
  const rawScore =
    getStatusWeight(trendStatus) * 20 +
    getStatusWeight(btcStatus) * 16 +
    getStatusWeight(priceActionStatus) * 20 +
    getStatusWeight(mtfStatus) * 12 +
    getStatusWeight(reactionStatus) * 9 +
    getStatusWeight(zoneVolumeStatus) * 6 +
    getStatusWeight(openInterestStatus) * openInterestWeight +
    getStatusWeight(volatilityStatus) * 9;
  const strengthBonus = market.trend === "sideways" ? 0 : market.trendStrength * 0.1;

  return Math.round(Math.min((rawScore / availableWeight) * 100 + strengthBonus, 100));
}

function getEntryScore({
  entryStatus,
  rewardStatus,
  atrStatus,
  spaceStatus,
  positionStatus,
  zoneStatus,
  riskStatus,
  priceSideStatus,
}: {
  entryStatus: ReviewStatus;
  rewardStatus: ReviewStatus;
  atrStatus: ReviewStatus;
  spaceStatus: ReviewStatus;
  positionStatus: ReviewStatus;
  zoneStatus: ReviewStatus;
  riskStatus: ReviewStatus;
  priceSideStatus: ReviewStatus;
}) {
  const rawScore =
    getStatusWeight(entryStatus) * 18 +
    getStatusWeight(rewardStatus) * 24 +
    getStatusWeight(atrStatus) * 18 +
    getStatusWeight(spaceStatus) * 14 +
    getStatusWeight(positionStatus) * 12 +
    getStatusWeight(zoneStatus) * 8 +
    getStatusWeight(riskStatus) * 4 +
    getStatusWeight(priceSideStatus) * 2;

  return Math.round(Math.min(rawScore, 100));
}

function getMoveExhaustion({
  direction,
  market,
  targetAtrMultiple,
  rewardToRisk,
}: {
  direction: TradeDirection;
  market: MarketSnapshot;
  targetAtrMultiple: number | null;
  rewardToRisk: number | null;
}) {
  const isAlignedMove =
    market.priceAction.direction === direction &&
    (market.priceAction.mode === "impulse-up" ||
      market.priceAction.mode === "impulse-down" ||
      market.priceAction.mode === "overextended-up" ||
      market.priceAction.mode === "overextended-down");
  const isOverextended =
    market.priceAction.mode === "overextended-up" ||
    market.priceAction.mode === "overextended-down";
  const score = Math.round(
    Math.min(
      (isAlignedMove ? market.priceAction.strength * 0.35 : 0) +
        (isOverextended ? 30 : 0) +
        (targetAtrMultiple !== null && targetAtrMultiple < 1 ? 25 : 0) +
        (rewardToRisk !== null && rewardToRisk < 1.2 ? 15 : 0),
      100,
    ),
  );
  const status: ReviewStatus =
    score >= 70 ? "fail" : score >= 45 ? "warning" : "pass";
  const detail =
    score >= 70
      ? `Перегрів ${score}/100. Рух уже частково реалізований, переслідувати ціну небезпечно.`
      : score >= 45
        ? `Перегрів ${score}/100. Напрям є, але краще чекати відкат або кращий RR.`
        : `Перегрів ${score}/100. Рух ще не виглядає занадто пізнім.`;

  return { score, status, detail };
}

function getSignalInfo({
  direction,
  entryMode,
  market,
  moveExhaustionScore,
  reaction,
}: {
  direction: TradeDirection;
  entryMode: EntryMode;
  market: MarketSnapshot;
  moveExhaustionScore: number;
  reaction: MarketZoneReaction;
}): TradeSignalInfo {
  if (moveExhaustionScore >= 70) {
    return {
      type: "late-entry",
      label: "Пізній трендовий вхід",
      detail: "Напрям сильний, але рух уже пройшов значну частину потенціалу.",
    };
  }

  if (entryMode === "limit") {
    return {
      type: "pullback",
      label: "Вхід від відкату",
      detail: "Система не женеться за ціною, а чекає кращу точку біля робочої зони.",
    };
  }

  if (isPriceActionAligned(direction, market.priceAction)) {
    return {
      type: "trend-following",
      label: "Трендовий рух",
      detail: "Напрям підтримують поточний рух, тренд і ринковий контекст.",
    };
  }

  if (reaction.behavior === "breakout" || reaction.behavior === "breakdown") {
    return {
      type: "breakout",
      label: "Пробій зони",
      detail: "Ідея базується на пробої, а не на класичному вході від підтримки чи опору.",
    };
  }

  if (market.trend === "sideways") {
    return {
      type: "range-bounce",
      label: "Відбій у діапазоні",
      detail: "Ринок більше схожий на боковик, тому важливі реакція зони і RR.",
    };
  }

  return {
    type: "mixed",
    label: "Змішаний сигнал",
    detail: "Частина факторів підтримує напрям, але вхід ще не має чистої структури.",
  };
}

function getVerdict({
  marketScore,
  entryScore,
  rewardToRisk,
  moveExhaustion,
  priceSideStatus,
}: {
  marketScore: number;
  entryScore: number;
  rewardToRisk: number | null;
  moveExhaustion: { score: number; status: ReviewStatus };
  priceSideStatus: ReviewStatus;
}): TradeVerdict {
  if (priceSideStatus === "fail") {
    return {
      label: "Не входити",
      detail: "Стоп або ціль стоять не з того боку від входу.",
      status: "fail",
    };
  }

  if (moveExhaustion.status === "fail") {
    return {
      label: "Рух уже реалізований",
      detail: "Тренд може бути сильним, але поточна точка схожа на пізній вхід.",
      status: "fail",
    };
  }

  if (rewardToRisk !== null && rewardToRisk < 1.2) {
    return {
      label: "Поганий RR",
      detail: `Потенціал лише ${rewardToRisk.toFixed(2)}R. Ризик не окупається.`,
      status: "fail",
    };
  }

  if (marketScore >= 65 && entryScore < 65) {
    return {
      label: "Ринок сильний, точка слабка",
      detail: "Напрям має перевагу, але конкретний вхід ще не дає достатньої якості.",
      status: "warning",
    };
  }

  if (entryScore >= 65 && marketScore < 60) {
    return {
      label: "Точка цікава, ринок не підтвердив",
      detail: "Ціна біля хорошої зони, але напрям і реакція ще не дають переваги.",
      status: "warning",
    };
  }

  if (marketScore >= 65 && entryScore >= 65) {
    return {
      label: "Вхід можна розглядати",
      detail: "Ринок і точка входу не конфліктують між собою.",
      status: "pass",
    };
  }

  if (marketScore < 55) {
    return {
      label: "Ринок слабкий",
      detail: "Напрям ще не має достатньої переваги.",
      status: "warning",
    };
  }

  return {
    label: "Почекати точку",
    detail: "Потрібен кращий відкат, сильніша реакція або чистіший простір до цілі.",
    status: "warning",
  };
}

function getPrimaryIssues(signals: ReviewItem[]) {
  const weakSignals = signals.filter((signal) => signal.status !== "pass");

  if (weakSignals.length === 0) {
    return ["Ринок і вхід не мають явних конфліктів."];
  }

  return weakSignals.slice(0, 4).map((signal) => signal.detail);
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
  const priceActionStatus = getPriceActionStatus(plan.direction, market.priceAction);

  const setupZone =
    plan.direction === "long"
      ? market.nearestSupport
      : market.nearestResistance;

  const zoneDistancePercent =
    (Math.abs(entryPrice - setupZone.price) / entryPrice) * 100;
  const zoneStatus = getZoneStatus(
    entry.mode,
    zoneDistancePercent,
    priceActionStatus,
  );
  const mtfStatus = getMtfStatus(setupZone);
  const zoneReaction =
    plan.direction === "long"
      ? market.zoneReactions.support
      : market.zoneReactions.resistance;
  const reactionStatus = getReactionStatus(zoneReaction);
  const zoneVolume =
    plan.direction === "long" ? market.zoneVolumes.support : market.zoneVolumes.resistance;
  const zoneVolumeStatus = getZoneVolumeStatus(zoneVolume);
  const openInterestStatus = getOpenInterestStatus(
    plan.direction,
    market.openInterest,
  );
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
  const positionStatus = getPositionStatus(
    plan.direction,
    pricePositionPercent,
    market.priceAction,
  );
  const volatilityStatus = getVolatilityStatus(market);
  const moveExhaustion = getMoveExhaustion({
    direction: plan.direction,
    market,
    targetAtrMultiple,
    rewardToRisk,
  });
  const marketScore = getMarketScore({
    trendStatus,
    btcStatus,
    priceActionStatus,
    mtfStatus,
    reactionStatus,
    zoneVolumeStatus,
    openInterestStatus,
    volatilityStatus,
    market,
  });
  const entryScore = getEntryScore({
    entryStatus,
    rewardStatus,
    atrStatus,
    spaceStatus,
    positionStatus,
    zoneStatus,
    riskStatus,
    priceSideStatus,
  });
  const signal = getSignalInfo({
    direction: plan.direction,
    entryMode: entry.mode,
    market,
    moveExhaustionScore: moveExhaustion.score,
    reaction: zoneReaction,
  });
  const verdict = getVerdict({
    marketScore,
    entryScore,
    rewardToRisk,
    moveExhaustion,
    priceSideStatus,
  });

  const entryDetail = getEntrySignalDetail({
    direction: plan.direction,
    entryMode: entry.mode,
    entryDistanceFromMarketPercent: entry.distanceFromMarketPercent,
    entryDistanceFromMarketAtr: entry.distanceFromMarketAtr,
  });
  const rrText = rewardToRisk === null ? "RR не пораховано" : `RR ${rewardToRisk.toFixed(2)}R`;
  const noiseDetail =
    targetSpacePercent <= market.averageRangePercent
      ? `Ціль ${targetSpacePercent.toFixed(2)}%, шум ${market.averageRangePercent.toFixed(2)}%. Рух менший за шум.`
      : `${rrText}. Ціль ${targetSpacePercent.toFixed(2)}%, шум ${market.averageRangePercent.toFixed(2)}%, простір/шум ${market.rangeToNoiseRatio.toFixed(1)}x.`;
  const zoneDetail = `${getMtfSignalDetail(setupZone)} ${getReactionSignalDetail(zoneReaction)} ${getZoneVolumeSignalDetail(zoneVolume)} Реакція ${zoneReaction.score}/100.`;
  const levelsDetail =
    priceSideStatus === "pass"
      ? `Вхід ${formatTradingViewPrice(entryPrice)}, стоп ${formatTradingViewPrice(stopLoss)}, ціль ${formatTradingViewPrice(takeProfit)}. Ризик ${
          accountRiskPercent === null
            ? "не пораховано"
            : `${accountRiskPercent.toFixed(2)}% акаунту`
        }.`
      : "Стоп або ціль стоять не з того боку від входу.";

  const signals = [
    buildSignal(
      "market-quality",
      "Якість ринку",
      `Оцінка ${marketScore}/100. ${
        market.trend === "sideways"
          ? "Ринок у боковику"
          : `Тренд ${market.trend === "up" ? "вгору" : "вниз"}`
      }, рух ${market.priceAction.label}, BTC ${
        market.btcBias === "bullish"
          ? "підтримує ріст"
          : market.btcBias === "bearish"
            ? "тисне вниз"
            : "нейтральний"
      }.`,
      getStatusByScore(marketScore),
    ),
    buildSignal(
      "entry-quality",
      "Якість входу",
      `Оцінка ${entryScore}/100. ${entryDetail}`,
      getStatusByScore(entryScore),
    ),
    ...(market.openInterest.status === "ok"
      ? [
          buildSignal(
            "open-interest",
            "Фʼючерсний інтерес",
            getOpenInterestSignalDetail(market.openInterest),
            openInterestStatus,
          ),
        ]
      : []),
    buildSignal(
      "rr-noise",
      "RR / шум",
      noiseDetail,
      getWorstStatus([rewardStatus, spaceStatus, volatilityStatus]),
    ),
    buildSignal(
      "move-exhaustion",
      "Перегрів руху",
      moveExhaustion.detail,
      moveExhaustion.status,
    ),
    buildSignal(
      "zone-confirmation",
      "Зона і реакція",
      zoneDetail,
      getWorstStatus([zoneStatus, mtfStatus, reactionStatus, zoneVolumeStatus]),
    ),
    buildSignal(
      "levels-risk",
      "Рівні і ризик",
      levelsDetail,
      getWorstStatus([priceSideStatus, riskStatus, atrStatus]),
    ),
  ];

  const metrics = [
    buildMetric(
      "Якість ринку",
      `${marketScore}/100`,
      signal.label,
      getStatusByScore(marketScore),
    ),
    buildMetric(
      "Якість входу",
      `${entryScore}/100`,
      verdict.label,
      getStatusByScore(entryScore),
    ),
    buildMetric(
      "RR",
      formatRatio(rewardToRisk),
      `${targetSpacePercent.toFixed(2)}% до цілі`,
      rewardStatus,
    ),
    buildMetric(
      "Перегрів",
      `${moveExhaustion.score}/100`,
      moveExhaustion.score >= 70 ? "пізній рух" : "контроль руху",
      moveExhaustion.status,
    ),
  ];
  const primaryIssues = getPrimaryIssues(signals);

  const nextActions =
    primaryIssues.length > 0
      ? primaryIssues
      : ["Ідею можна розглядати, але без автоторгівлі."];

  const grade = getGrade(signals, accountRiskPercent);
  const gradeCopy = getGradeCopy(grade);

  return {
    grade,
    title: gradeCopy.title,
    summary: gradeCopy.summary,
    marketScore,
    entryScore,
    signal,
    verdict,
    primaryIssues,
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
      priceAction: market.priceAction,
      zoneReaction,
      zoneVolume,
      openInterest: market.openInterest,
    },
    metrics,
    signals,
    nextActions,
  };
}
