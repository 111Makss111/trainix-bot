import type {
  BtcBias,
  MarketSnapshot,
  MarketZone,
  TradeTimeframe,
  TrendDirection,
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
    return "volume unknown";
  }

  const volumeRatio = lastVolume / averageVolume;

  if (volumeRatio >= 1.5) {
    return "volume above average";
  }

  if (volumeRatio <= 0.65) {
    return "volume below average";
  }

  return "volume normal";
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

function buildZones(candles: Candle[], currentPrice: number) {
  const recentCandles = getRecentCandles(candles, 80);
  const pivotZones: MarketZone[] = [];

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

    if (isPivotLow && candle.low < currentPrice) {
      pivotZones.push({
        kind: "support",
        label: "Pivot support",
        price: candle.low,
        strength: Math.round(clamp(55 + recencyScore, 45, 92)),
      });
    }

    if (isPivotHigh && candle.high > currentPrice) {
      pivotZones.push({
        kind: "resistance",
        label: "Pivot resistance",
        price: candle.high,
        strength: Math.round(clamp(55 + recencyScore, 45, 92)),
      });
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
    {
      kind: "support",
      label: "Recent low",
      price: lowest.low,
      strength: 72,
    },
    {
      kind: "resistance",
      label: "Recent high",
      price: highest.high,
      strength: 72,
    },
  ]);

  const supports = allZones
    .filter((zone) => zone.kind === "support" && zone.price < currentPrice)
    .sort((a, b) => b.price - a.price);
  const resistances = allZones
    .filter((zone) => zone.kind === "resistance" && zone.price > currentPrice)
    .sort((a, b) => a.price - b.price);

  const nearestSupport =
    supports[0] ??
    ({
      kind: "support",
      label: "Estimated support",
      price: currentPrice * 0.985,
      strength: 45,
    } satisfies MarketZone);
  const nearestResistance =
    resistances[0] ??
    ({
      kind: "resistance",
      label: "Estimated resistance",
      price: currentPrice * 1.015,
      strength: 45,
    } satisfies MarketZone);

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
}: {
  symbol: string;
  timeframe: TradeTimeframe;
  candles: Candle[];
  btcCandles: Candle[];
}): MarketSnapshot {
  const currentCandle = candles.at(-1);

  if (!currentCandle || candles.length < 30 || btcCandles.length < 30) {
    throw new Error("Not enough candle data to build market snapshot.");
  }

  const currentPrice = currentCandle.close;
  const trend = getTrend(candles);
  const zones = buildZones(candles, currentPrice);

  return {
    symbol,
    timeframe,
    currentPrice,
    trend: trend.trend,
    trendStrength: trend.trendStrength,
    btcBias: getBtcBias(btcCandles),
    volumeState: getVolumeState(candles),
    nearestSupport: zones.nearestSupport,
    nearestResistance: zones.nearestResistance,
    zones: zones.zones,
    updatedAt: new Date().toISOString(),
    source: "live",
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
    volumeState: "waiting for live data",
    nearestSupport: {
      kind: "support",
      label: "Estimated support",
      price: currentPrice * 0.98,
      strength: 45,
    },
    nearestResistance: {
      kind: "resistance",
      label: "Estimated resistance",
      price: currentPrice * 1.02,
      strength: 45,
    },
    zones: [
      {
        kind: "support",
        label: "Estimated support",
        price: currentPrice * 0.98,
        strength: 45,
      },
      {
        kind: "resistance",
        label: "Estimated resistance",
        price: currentPrice * 1.02,
        strength: 45,
      },
    ],
    updatedAt: "fallback",
    source: "fallback",
    candleCount: 0,
  };
}
