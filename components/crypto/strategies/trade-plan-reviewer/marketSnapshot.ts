import type {
  BtcBias,
  MarketSnapshot,
  MarketSource,
  MarketZone,
  TradeTimeframe,
  TrendDirection,
  VolatilityState,
} from "./types";

export type Candle = {
  openTime: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  closeTime: number;
};

function average(values: number[]) {
  if (values.length === 0) {
    return 0;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function getPercentChange(from: number, to: number) {
  if (from === 0) {
    return 0;
  }

  return ((to - from) / from) * 100;
}

function getRecentCandles(candles: Candle[], count: number) {
  return candles.slice(Math.max(0, candles.length - count));
}

function getSma(candles: Candle[], count: number) {
  return average(getRecentCandles(candles, count).map((candle) => candle.close));
}

function getTrend(candles: Candle[]): {
  trend: TrendDirection;
  trendStrength: number;
} {
  const currentPrice = candles.at(-1)?.close ?? 0;
  const shortSma = getSma(candles, 9);
  const longSma = getSma(candles, 21);
  const referenceCandle = candles.at(-21) ?? candles[0];
  const recentMove = referenceCandle
    ? getPercentChange(referenceCandle.close, currentPrice)
    : 0;
  const smaGap = longSma === 0 ? 0 : getPercentChange(longSma, shortSma);
  const rawStrength = Math.abs(recentMove) * 7 + Math.abs(smaGap) * 14;
  const trendStrength = Math.round(clamp(35 + rawStrength, 0, 100));

  if (shortSma > longSma && currentPrice > longSma && recentMove > 0.25) {
    return { trend: "up", trendStrength };
  }

  if (shortSma < longSma && currentPrice < longSma && recentMove < -0.25) {
    return { trend: "down", trendStrength };
  }

  return {
    trend: "sideways",
    trendStrength: Math.round(clamp(100 - rawStrength * 2, 20, 62)),
  };
}

function getBtcBias(btcCandles: Candle[]): BtcBias {
  const btcTrend = getTrend(btcCandles).trend;

  if (btcTrend === "up") {
    return "bullish";
  }

  if (btcTrend === "down") {
    return "bearish";
  }

  return "neutral";
}

function getVolumeState(candles: Candle[]) {
  const lastVolume = candles.at(-1)?.volume ?? 0;
  const previousVolumes = getRecentCandles(candles.slice(0, -1), 20).map(
    (candle) => candle.volume,
  );
  const averageVolume = average(previousVolumes);

  if (averageVolume === 0) {
    return "обсяг невідомий";
  }

  const volumeRatio = lastVolume / averageVolume;

  if (volumeRatio >= 1.5) {
    return "обсяг вище норми";
  }

  if (volumeRatio <= 0.65) {
    return "обсяг нижче норми";
  }

  return "обсяг у нормі";
}

function getAverageRangePercent(candles: Candle[]) {
  const recentCandles = getRecentCandles(candles, 20);
  const ranges = recentCandles.map((candle) => {
    if (candle.close === 0) {
      return 0;
    }

    return ((candle.high - candle.low) / candle.close) * 100;
  });

  return average(ranges);
}

function getVolatilityState(averageRangePercent: number): VolatilityState {
  if (averageRangePercent >= 1.2) {
    return "extreme";
  }

  if (averageRangePercent >= 0.7) {
    return "high";
  }

  if (averageRangePercent <= 0.18) {
    return "quiet";
  }

  return "normal";
}

function dedupeZones(zones: MarketZone[]) {
  const result: MarketZone[] = [];

  for (const zone of zones.sort((a, b) => b.strength - a.strength)) {
    const hasSimilarZone = result.some((item) => {
      const distancePercent = Math.abs(zone.price - item.price) / item.price;
      return distancePercent < 0.004;
    });

    if (!hasSimilarZone) {
      result.push(zone);
    }
  }

  return result;
}

function createZone({
  kind,
  label,
  low,
  high,
  strength,
}: {
  kind: MarketZone["kind"];
  label: string;
  low: number;
  high: number;
  strength: number;
}): MarketZone {
  const safeLow = Math.min(low, high);
  const safeHigh = Math.max(low, high);

  return {
    kind,
    label,
    low: safeLow,
    high: safeHigh,
    price: (safeLow + safeHigh) / 2,
    strength,
  };
}

function buildZones(candles: Candle[], currentPrice: number) {
  const recentCandles = getRecentCandles(candles, 80);
  const pivotZones: MarketZone[] = [];
  const averageRangePercent = getAverageRangePercent(candles);

  for (let index = 2; index < recentCandles.length - 2; index += 1) {
    const candle = recentCandles[index];
    const left = recentCandles.slice(index - 2, index);
    const right = recentCandles.slice(index + 1, index + 3);
    const isPivotLow = [...left, ...right].every(
      (nearbyCandle) => candle.low <= nearbyCandle.low,
    );
    const isPivotHigh = [...left, ...right].every(
      (nearbyCandle) => candle.high >= nearbyCandle.high,
    );
    const recencyScore = (index / recentCandles.length) * 25;
    const zonePadding = candle.close * Math.max(averageRangePercent / 100, 0.0025);

    if (isPivotLow && candle.low < currentPrice) {
      pivotZones.push(createZone({
        kind: "support",
        label: "Локальна підтримка",
        low: candle.low - zonePadding * 0.4,
        high: candle.low + zonePadding,
        strength: Math.round(clamp(55 + recencyScore, 45, 92)),
      }));
    }

    if (isPivotHigh && candle.high > currentPrice) {
      pivotZones.push(createZone({
        kind: "resistance",
        label: "Локальний опір",
        low: candle.high - zonePadding,
        high: candle.high + zonePadding * 0.4,
        strength: Math.round(clamp(55 + recencyScore, 45, 92)),
      }));
    }
  }

  const lowest = recentCandles.reduce(
    (lowestCandle, candle) => (candle.low < lowestCandle.low ? candle : lowestCandle),
    recentCandles[0],
  );
  const highest = recentCandles.reduce(
    (highestCandle, candle) =>
      candle.high > highestCandle.high ? candle : highestCandle,
    recentCandles[0],
  );

  const allZones = dedupeZones([
    ...pivotZones,
    createZone({
      kind: "support",
      label: "Широка підтримка",
      low: lowest.low - currentPrice * 0.003,
      high: lowest.low + currentPrice * 0.004,
      strength: 72,
    }),
    createZone({
      kind: "resistance",
      label: "Широкий опір",
      low: highest.high - currentPrice * 0.004,
      high: highest.high + currentPrice * 0.003,
      strength: 72,
    }),
  ]);

  const supports = allZones
    .filter((zone) => zone.kind === "support" && zone.price < currentPrice)
    .sort((a, b) => b.price - a.price);
  const resistances = allZones
    .filter((zone) => zone.kind === "resistance" && zone.price > currentPrice)
    .sort((a, b) => a.price - b.price);

  const nearestSupport =
    supports[0] ??
    createZone({
      kind: "support",
      label: "Орієнтовна підтримка",
      low: currentPrice * 0.98,
      high: currentPrice * 0.988,
      strength: 45,
    });
  const nearestResistance =
    resistances[0] ??
    createZone({
      kind: "resistance",
      label: "Орієнтовний опір",
      low: currentPrice * 1.012,
      high: currentPrice * 1.02,
      strength: 45,
    });

  const visibleZones = [
    ...supports.slice(0, 2),
    ...resistances.slice(0, 2),
  ].sort((a, b) => a.price - b.price);

  return {
    nearestSupport,
    nearestResistance,
    zones: visibleZones.length > 0 ? visibleZones : [nearestSupport, nearestResistance],
  };
}

export function buildMarketSnapshotFromCandles({
  symbol,
  timeframe,
  candles,
  btcCandles,
  source,
}: {
  symbol: string;
  timeframe: TradeTimeframe;
  candles: Candle[];
  btcCandles: Candle[];
  source: Exclude<MarketSource, "fallback">;
}): MarketSnapshot {
  const currentCandle = candles.at(-1);

  if (!currentCandle || candles.length < 30 || btcCandles.length < 30) {
    throw new Error("Not enough candle data to build market snapshot.");
  }

  const currentPrice = currentCandle.close;
  const trend = getTrend(candles);
  const zones = buildZones(candles, currentPrice);
  const averageRangePercent = getAverageRangePercent(candles);
  const rangeWidthPercent =
    ((zones.nearestResistance.price - zones.nearestSupport.price) /
      currentPrice) *
    100;
  const rangeToNoiseRatio =
    averageRangePercent > 0 ? rangeWidthPercent / averageRangePercent : 0;

  return {
    symbol,
    timeframe,
    currentPrice,
    trend: trend.trend,
    trendStrength: trend.trendStrength,
    btcBias: getBtcBias(btcCandles),
    averageRangePercent,
    rangeWidthPercent,
    rangeToNoiseRatio,
    volatilityState: getVolatilityState(averageRangePercent),
    volumeState: getVolumeState(candles),
    nearestSupport: zones.nearestSupport,
    nearestResistance: zones.nearestResistance,
    zones: zones.zones,
    updatedAt: new Date().toISOString(),
    source,
    candleCount: candles.length,
  };
}

export function getFallbackMarketSnapshot(
  symbol: string,
  timeframe: TradeTimeframe,
): MarketSnapshot {
  const normalizedSymbol = symbol.trim().toUpperCase() || "BTCUSDT";
  const currentPrice = normalizedSymbol === "ETHUSDT" ? 3820 : 100;

  return {
    symbol: normalizedSymbol,
    timeframe,
    currentPrice,
    trend: "sideways",
    trendStrength: 42,
    btcBias: "neutral",
    averageRangePercent: 0,
    rangeWidthPercent: 4,
    rangeToNoiseRatio: 0,
    volatilityState: "normal",
    volumeState: "очікуємо живі дані",
    nearestSupport: {
      kind: "support",
      label: "Орієнтовна підтримка",
      low: currentPrice * 0.976,
      high: currentPrice * 0.984,
      price: currentPrice * 0.98,
      strength: 45,
    },
    nearestResistance: {
      kind: "resistance",
      label: "Орієнтовний опір",
      low: currentPrice * 1.016,
      high: currentPrice * 1.024,
      price: currentPrice * 1.02,
      strength: 45,
    },
    zones: [
      {
        kind: "support",
        label: "Орієнтовна підтримка",
        low: currentPrice * 0.976,
        high: currentPrice * 0.984,
        price: currentPrice * 0.98,
        strength: 45,
      },
      {
        kind: "resistance",
        label: "Орієнтовний опір",
        low: currentPrice * 1.016,
        high: currentPrice * 1.024,
        price: currentPrice * 1.02,
        strength: 45,
      },
    ],
    updatedAt: "fallback",
    source: "fallback",
    candleCount: 0,
  };
}
