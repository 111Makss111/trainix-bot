import type { Candle } from "./marketSnapshot";
import type {
  MarketZone,
  MarketZoneReaction,
  PriceActionState,
  TrendDirection,
} from "./types";

function average(values: number[]) {
  if (values.length === 0) {
    return 0;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function getRecentCandles(candles: Candle[], count: number) {
  return candles.slice(Math.max(0, candles.length - count));
}

function getClosedCandles(candles: Candle[]) {
  if (candles.length > 35) {
    return candles.slice(0, -1);
  }

  return candles;
}

function getPercentChange(from: number, to: number) {
  if (from === 0) {
    return 0;
  }

  return ((to - from) / from) * 100;
}

function getAtrDistance(priceDistance: number, atr: number) {
  if (atr <= 0) {
    return 0;
  }

  return Math.abs(priceDistance) / atr;
}

function getClosePosition(candle: Candle) {
  const range = candle.high - candle.low;

  if (range <= 0) {
    return 0.5;
  }

  return (candle.close - candle.low) / range;
}

function getFallbackPriceDistance(currentPrice: number, atr: number, percent: number) {
  if (atr > 0) {
    return atr;
  }

  return currentPrice * percent;
}

function buildState(state: PriceActionState): PriceActionState {
  return state;
}

function getReactionDirection(
  supportReaction: MarketZoneReaction,
  resistanceReaction: MarketZoneReaction,
) {
  if (
    supportReaction.behavior === "buyback" &&
    supportReaction.strength !== "none"
  ) {
    return "support";
  }

  if (
    resistanceReaction.behavior === "rejection" &&
    resistanceReaction.strength !== "none"
  ) {
    return "resistance";
  }

  return null;
}

export function getPriceActionState({
  candles,
  currentPrice,
  atr,
  trend,
  nearestSupport,
  nearestResistance,
  supportReaction,
  resistanceReaction,
}: {
  candles: Candle[];
  currentPrice: number;
  atr: number;
  trend: TrendDirection;
  nearestSupport: MarketZone;
  nearestResistance: MarketZone;
  supportReaction: MarketZoneReaction;
  resistanceReaction: MarketZoneReaction;
}): PriceActionState {
  const closedCandles = getClosedCandles(candles);
  const structureCandles = getRecentCandles(closedCandles, 5);
  const lastFourCandles = getRecentCandles(closedCandles, 4);
  const referenceCandle = closedCandles.at(-7) ?? closedCandles[0];
  const recentMove = referenceCandle
    ? currentPrice - referenceCandle.close
    : 0;
  const recentMoveAtr = getAtrDistance(recentMove, atr);
  const recentMovePercent = referenceCandle
    ? Math.abs(getPercentChange(referenceCandle.close, currentPrice))
    : 0;
  const greenCount = lastFourCandles.filter(
    (candle) => candle.close > candle.open,
  ).length;
  const redCount = lastFourCandles.filter(
    (candle) => candle.close < candle.open,
  ).length;
  const closePosition = average(lastFourCandles.map(getClosePosition));
  const distance = getFallbackPriceDistance(currentPrice, atr, 0.006);
  const pullbackDistance = Math.max(distance * 0.35, currentPrice * 0.0015);
  const stopBuffer = Math.max(distance * 0.15, currentPrice * 0.0008);
  const minStopDistance = Math.max(distance * 0.75, currentPrice * 0.003);
  const maxStopDistance = Math.max(distance * 1.8, currentPrice * 0.009);
  const recentLow = Math.min(...structureCandles.map((candle) => candle.low));
  const recentHigh = Math.max(...structureCandles.map((candle) => candle.high));
  const supportDistanceAtr = getAtrDistance(currentPrice - nearestSupport.high, atr);
  const resistanceDistanceAtr = getAtrDistance(nearestResistance.low - currentPrice, atr);
  const supportReactionIsUseful =
    supportReaction.behavior === "buyback" &&
    (supportReaction.strength === "strong" || supportReaction.strength === "medium");
  const resistanceReactionIsUseful =
    resistanceReaction.behavior === "rejection" &&
    (resistanceReaction.strength === "strong" ||
      resistanceReaction.strength === "medium");
  const upImpulse =
    recentMove > 0 &&
    (trend === "up" || supportReactionIsUseful) &&
    recentMoveAtr >= 0.7 &&
    greenCount >= 2 &&
    closePosition >= 0.55;
  const downImpulse =
    recentMove < 0 &&
    (trend === "down" || resistanceReactionIsUseful) &&
    recentMoveAtr >= 0.7 &&
    redCount >= 2 &&
    closePosition <= 0.45;

  if (upImpulse) {
    const isCloseToTarget =
      resistanceDistanceAtr > 0 && resistanceDistanceAtr <= 0.45;
    const entryPrice = Math.max(
      nearestSupport.high,
      currentPrice - pullbackDistance,
    );
    const rawStop = recentLow - stopBuffer;
    const stopLoss = Math.min(
      entryPrice - minStopDistance,
      Math.max(rawStop, entryPrice - maxStopDistance),
    );
    const strength = Math.round(
      clamp(48 + recentMoveAtr * 12 + greenCount * 5 + closePosition * 18, 0, 100),
    );

    return buildState({
      mode: isCloseToTarget ? "overextended-up" : "impulse-up",
      direction: "long",
      label: isCloseToTarget ? "імпульс біля опору" : "імпульс вгору",
      summary: `Ціна йде вгору: ${recentMoveAtr.toFixed(1)} ATR за останні свічки.`,
      strength,
      entryPrice,
      stopLoss,
      takeProfit: nearestResistance.price,
    });
  }

  if (downImpulse) {
    const isCloseToTarget = supportDistanceAtr > 0 && supportDistanceAtr <= 0.45;
    const entryPrice = Math.min(
      nearestResistance.low,
      currentPrice + pullbackDistance,
    );
    const rawStop = recentHigh + stopBuffer;
    const stopLoss = Math.max(
      entryPrice + minStopDistance,
      Math.min(rawStop, entryPrice + maxStopDistance),
    );
    const strength = Math.round(
      clamp(
        48 + recentMoveAtr * 12 + redCount * 5 + (1 - closePosition) * 18,
        0,
        100,
      ),
    );

    return buildState({
      mode: isCloseToTarget ? "overextended-down" : "impulse-down",
      direction: "short",
      label: isCloseToTarget ? "імпульс біля підтримки" : "імпульс вниз",
      summary: `Ціна йде вниз: ${recentMoveAtr.toFixed(1)} ATR за останні свічки.`,
      strength,
      entryPrice,
      stopLoss,
      takeProfit: nearestSupport.price,
    });
  }

  const reactionDirection = getReactionDirection(
    supportReaction,
    resistanceReaction,
  );

  if (reactionDirection === "support") {
    return buildState({
      mode: "support-reaction",
      direction: "long",
      label: "реакція підтримки",
      summary: "Є реакція від підтримки, але імпульс ще не підтверджений.",
      strength: supportReaction.score,
      entryPrice: null,
      stopLoss: null,
      takeProfit: null,
    });
  }

  if (reactionDirection === "resistance") {
    return buildState({
      mode: "resistance-reaction",
      direction: "short",
      label: "реакція опору",
      summary: "Є реакція від опору, але імпульс ще не підтверджений.",
      strength: resistanceReaction.score,
      entryPrice: null,
      stopLoss: null,
      takeProfit: null,
    });
  }

  return buildState({
    mode: "range",
    direction: "neutral",
    label: "без імпульсу",
    summary:
      recentMovePercent > 0
        ? `Рух ${recentMovePercent.toFixed(2)}%, але без чистого імпульсу.`
        : "Ринок без чистого імпульсу.",
    strength: 35,
    entryPrice: null,
    stopLoss: null,
    takeProfit: null,
  });
}
