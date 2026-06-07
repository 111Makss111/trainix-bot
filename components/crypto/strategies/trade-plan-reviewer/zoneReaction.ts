import type { Candle } from "./marketSnapshot";
import type { MarketZone, MarketZoneReaction } from "./types";

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function getRecentCandles(candles: Candle[], count: number) {
  return candles.slice(Math.max(0, candles.length - count));
}

function getReactionCandles(candles: Candle[]) {
  if (candles.length > 35) {
    return candles.slice(0, -1);
  }

  return candles;
}

function doesCandleTouchZone(candle: Candle, zone: MarketZone) {
  return candle.low <= zone.high && candle.high >= zone.low;
}

function getWickPercent(candle: Candle, zoneKind: MarketZone["kind"]) {
  const range = Math.max(candle.high - candle.low, 0);

  if (range === 0) {
    return 0;
  }

  const bodyLow = Math.min(candle.open, candle.close);
  const bodyHigh = Math.max(candle.open, candle.close);
  const wick =
    zoneKind === "support" ? bodyLow - candle.low : candle.high - bodyHigh;

  return clamp((Math.max(wick, 0) / range) * 100, 0, 100);
}

function getReactionStrength(score: number): MarketZoneReaction["strength"] {
  if (score >= 75) {
    return "strong";
  }

  if (score >= 55) {
    return "medium";
  }

  if (score >= 30) {
    return "weak";
  }

  return "none";
}

function formatReactionTime(openTime: number) {
  return new Date(openTime).toISOString().slice(0, 16).replace("T", " ");
}

function getStrengthLabel(strength: MarketZoneReaction["strength"]) {
  if (strength === "strong") {
    return "сильна";
  }

  if (strength === "medium") {
    return "середня";
  }

  if (strength === "weak") {
    return "слабка";
  }

  return "немає";
}

function getBehaviorLabel(behavior: MarketZoneReaction["behavior"]) {
  if (behavior === "buyback") {
    return "відкуп";
  }

  if (behavior === "rejection") {
    return "відбій";
  }

  if (behavior === "breakdown") {
    return "пробій вниз";
  }

  if (behavior === "breakout") {
    return "пробій вгору";
  }

  if (behavior === "noise") {
    return "шум";
  }

  return "немає";
}

function buildZoneReaction({
  zone,
  strength,
  behavior,
  score,
  touchedAt,
  wickPercent,
  closeReturned,
}: {
  zone: MarketZone;
  strength: MarketZoneReaction["strength"];
  behavior: MarketZoneReaction["behavior"];
  score: number;
  touchedAt: string | null;
  wickPercent: number;
  closeReturned: boolean;
}): MarketZoneReaction {
  const strengthLabel = getStrengthLabel(strength);
  const behaviorLabel = getBehaviorLabel(behavior);
  const returnText = closeReturned
    ? "закриття повернулось"
    : "закриття не повернулось";

  return {
    zoneKind: zone.kind,
    zoneLabel: zone.label,
    zoneLow: zone.low,
    zoneHigh: zone.high,
    strength,
    behavior,
    score,
    touchedAt,
    wickPercent,
    closeReturned,
    summary:
      behavior === "none" ? "реакції немає" : `${strengthLabel} · ${behaviorLabel}`,
    detail:
      behavior === "none"
        ? `Останні свічки не торкались зони ${zone.label}.`
        : `${strengthLabel}: ${behaviorLabel}. Тінь ${wickPercent.toFixed(0)}%, ${returnText}.`,
  };
}

export function getZoneReaction(
  candles: Candle[],
  zone: MarketZone,
): MarketZoneReaction {
  const recentCandles = getRecentCandles(getReactionCandles(candles), 12);
  const touchIndex = [...recentCandles]
    .reverse()
    .findIndex((candle) => doesCandleTouchZone(candle, zone));

  if (touchIndex === -1) {
    return buildZoneReaction({
      zone,
      strength: "none",
      behavior: "none",
      score: 0,
      touchedAt: null,
      wickPercent: 0,
      closeReturned: false,
    });
  }

  const actualTouchIndex = recentCandles.length - 1 - touchIndex;
  const touchCandle = recentCandles[actualTouchIndex];
  const followUpCandles = recentCandles.slice(
    actualTouchIndex + 1,
    actualTouchIndex + 3,
  );
  const checkCandles = [touchCandle, ...followUpCandles];
  const lastCandle = recentCandles.at(-1) ?? touchCandle;
  const wickPercent = getWickPercent(touchCandle, zone.kind);
  const touchedAt = formatReactionTime(touchCandle.openTime);

  if (zone.kind === "support") {
    const closeReturned = checkCandles.some(
      (candle) =>
        candle.close >= zone.high ||
        (candle.low < zone.low && candle.close > zone.price),
    );
    const brokeWithoutReturn = lastCandle.close < zone.low && !closeReturned;
    const bullishFollowUp = followUpCandles.some(
      (candle) => candle.close > candle.open,
    );
    let score = 20;

    if (wickPercent >= 35) {
      score += 25;
    }

    if (wickPercent >= 50) {
      score += 10;
    }

    if (touchCandle.close >= touchCandle.open) {
      score += 8;
    }

    if (closeReturned) {
      score += 25;
    }

    if (bullishFollowUp) {
      score += 7;
    }

    if (brokeWithoutReturn) {
      score = Math.min(score, 25);
    }

    const safeScore = Math.round(clamp(score, 0, 100));
    const behavior = brokeWithoutReturn
      ? "breakdown"
      : safeScore >= 55
        ? "buyback"
        : "noise";

    return buildZoneReaction({
      zone,
      strength: getReactionStrength(safeScore),
      behavior,
      score: safeScore,
      touchedAt,
      wickPercent,
      closeReturned,
    });
  }

  const closeReturned = checkCandles.some(
    (candle) =>
      candle.close <= zone.low ||
      (candle.high > zone.high && candle.close < zone.price),
  );
  const brokeWithoutReturn = lastCandle.close > zone.high && !closeReturned;
  const bearishFollowUp = followUpCandles.some(
    (candle) => candle.close < candle.open,
  );
  let score = 20;

  if (wickPercent >= 35) {
    score += 25;
  }

  if (wickPercent >= 50) {
    score += 10;
  }

  if (touchCandle.close <= touchCandle.open) {
    score += 8;
  }

  if (closeReturned) {
    score += 25;
  }

  if (bearishFollowUp) {
    score += 7;
  }

  if (brokeWithoutReturn) {
    score = Math.min(score, 25);
  }

  const safeScore = Math.round(clamp(score, 0, 100));
  const behavior = brokeWithoutReturn
    ? "breakout"
    : safeScore >= 55
      ? "rejection"
      : "noise";

  return buildZoneReaction({
    zone,
    strength: getReactionStrength(safeScore),
    behavior,
    score: safeScore,
    touchedAt,
    wickPercent,
    closeReturned,
  });
}
