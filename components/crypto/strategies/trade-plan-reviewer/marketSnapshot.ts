import type {
  BtcBias,
  MarketAnalysisTimeframe,
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

const analysisTimeframeOrder: MarketAnalysisTimeframe[] = [
  "5m",
  "15m",
  "1h",
  "4h",
  "1d",
];

const timeframeZoneWeight: Record<MarketAnalysisTimeframe, number> = {
  "5m": 8,
  "15m": 12,
  "1h": 18,
  "4h": 26,
  "1d": 34,
};

const timeframeLookbackCandles: Record<MarketAnalysisTimeframe, number> = {
  "5m": 120,
  "15m": 140,
  "1h": 180,
  "4h": 220,
  "1d": 260,
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

function getAtr(candles: Candle[], period = 14) {
  const recentCandles = getRecentCandles(candles, period + 1);
  const trueRanges = recentCandles.slice(1).map((candle, index) => {
    const previousClose = recentCandles[index].close;
    const candleRange = candle.high - candle.low;
    const highGap = Math.abs(candle.high - previousClose);
    const lowGap = Math.abs(candle.low - previousClose);

    return Math.max(candleRange, highGap, lowGap);
  });

  return average(trueRanges);
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

function sortTimeframes(timeframes: MarketAnalysisTimeframe[]) {
  return [...timeframes].sort(
    (first, second) =>
      analysisTimeframeOrder.indexOf(first) - analysisTimeframeOrder.indexOf(second),
  );
}

function createZone({
  kind,
  label,
  low,
  high,
  price,
  strength,
  timeframes,
  sourceCount,
  isMultiTimeframe,
}: {
  kind: MarketZone["kind"];
  label: string;
  low: number;
  high: number;
  price?: number;
  strength: number;
  timeframes?: MarketAnalysisTimeframe[];
  sourceCount?: number;
  isMultiTimeframe?: boolean;
}): MarketZone {
  const safeLow = Math.min(low, high);
  const safeHigh = Math.max(low, high);
  const zoneTimeframes = sortTimeframes(timeframes ?? []);

  return {
    kind,
    label,
    low: safeLow,
    high: safeHigh,
    price: price ?? (safeLow + safeHigh) / 2,
    strength,
    timeframes: zoneTimeframes,
    sourceCount: sourceCount ?? zoneTimeframes.length,
    isMultiTimeframe: isMultiTimeframe ?? zoneTimeframes.length > 1,
  };
}

function pickImportantZone(candidates: MarketZone[]) {
  return candidates.find((zone) => zone.strength >= 70) ?? candidates[0];
}

function uniqueZones(zones: MarketZone[]) {
  const result: MarketZone[] = [];

  for (const zone of zones) {
    const hasZone = result.some(
      (item) =>
        item.kind === zone.kind &&
        Math.abs(item.price - zone.price) / Math.max(item.price, 1) < 0.0005,
    );

    if (!hasZone) {
      result.push(zone);
    }
  }

  return result;
}

function selectVisibleZones(allZones: MarketZone[], currentPrice: number) {
  const supports = allZones
    .filter((zone) => zone.kind === "support" && zone.price < currentPrice)
    .sort((a, b) => b.price - a.price);
  const resistances = allZones
    .filter((zone) => zone.kind === "resistance" && zone.price > currentPrice)
    .sort((a, b) => a.price - b.price);

  const nearestSupport = pickImportantZone(supports);
  const nearestResistance = pickImportantZone(resistances);

  return {
    nearestSupport,
    nearestResistance,
    zones: uniqueZones([
      nearestSupport,
      ...supports.slice(0, 2),
      nearestResistance,
      ...resistances.slice(0, 2),
    ].filter(Boolean)).sort((a, b) => a.price - b.price),
  };
}

function buildZones(
  candles: Candle[],
  currentPrice: number,
  options?: {
    timeframe?: MarketAnalysisTimeframe;
    lookbackCandles?: number;
  },
) {
  const timeframe = options?.timeframe ?? "15m";
  const recentCandles = getRecentCandles(
    candles,
    options?.lookbackCandles ?? timeframeLookbackCandles[timeframe],
  );
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
        timeframes: [timeframe],
      }));
    }

    if (isPivotHigh && candle.high > currentPrice) {
      pivotZones.push(createZone({
        kind: "resistance",
        label: "Локальний опір",
        low: candle.high - zonePadding,
        high: candle.high + zonePadding * 0.4,
        strength: Math.round(clamp(55 + recencyScore, 45, 92)),
        timeframes: [timeframe],
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
      timeframes: [timeframe],
    }),
    createZone({
      kind: "resistance",
      label: "Широкий опір",
      low: highest.high - currentPrice * 0.004,
      high: highest.high + currentPrice * 0.003,
      strength: 72,
      timeframes: [timeframe],
    }),
  ]);

  const visibleZones = selectVisibleZones(allZones, currentPrice);
  const nearestSupport =
    visibleZones.nearestSupport ??
    createZone({
      kind: "support",
      label: "Орієнтовна підтримка",
      low: currentPrice * 0.98,
      high: currentPrice * 0.988,
      strength: 45,
      timeframes: [timeframe],
    });
  const nearestResistance =
    visibleZones.nearestResistance ??
    createZone({
      kind: "resistance",
      label: "Орієнтовний опір",
      low: currentPrice * 1.012,
      high: currentPrice * 1.02,
      strength: 45,
      timeframes: [timeframe],
    });

  return {
    nearestSupport,
    nearestResistance,
    zones:
      visibleZones.zones.length > 0
        ? visibleZones.zones
        : [nearestSupport, nearestResistance],
    allZones,
  };
}

function getZoneMergeTolerance(currentPrice: number, atr: number) {
  return Math.max(currentPrice * 0.0035, atr * 0.35);
}

function getZoneWeight(zone: MarketZone) {
  return (
    average(zone.timeframes.map((timeframe) => timeframeZoneWeight[timeframe])) +
    zone.strength / 10
  );
}

function mergeZoneGroup(
  zones: MarketZone[],
  currentPrice: number,
  atr: number,
) {
  const uniqueTimeframes = sortTimeframes([
    ...new Set(zones.flatMap((zone) => zone.timeframes)),
  ]);
  const totalTimeframeWeight = uniqueTimeframes.reduce(
    (sum, timeframe) => sum + timeframeZoneWeight[timeframe],
    0,
  );
  const weightedPriceTotal = zones.reduce(
    (sum, zone) => sum + zone.price * getZoneWeight(zone),
    0,
  );
  const weightedLowTotal = zones.reduce(
    (sum, zone) => sum + zone.low * getZoneWeight(zone),
    0,
  );
  const weightedHighTotal = zones.reduce(
    (sum, zone) => sum + zone.high * getZoneWeight(zone),
    0,
  );
  const totalZoneWeight = zones.reduce(
    (sum, zone) => sum + getZoneWeight(zone),
    0,
  );
  const averageStrength = average(zones.map((zone) => zone.strength));
  const sourceCount = uniqueTimeframes.length;
  const strength = Math.round(
    clamp(30 + totalTimeframeWeight + sourceCount * 4 + averageStrength * 0.18, 45, 98),
  );
  const kind = zones[0].kind;
  const mergedPrice = totalZoneWeight > 0
    ? weightedPriceTotal / totalZoneWeight
    : zones[0].price;
  const weightedLow = totalZoneWeight > 0
    ? weightedLowTotal / totalZoneWeight
    : Math.min(...zones.map((zone) => zone.low));
  const weightedHigh = totalZoneWeight > 0
    ? weightedHighTotal / totalZoneWeight
    : Math.max(...zones.map((zone) => zone.high));
  const maxHalfWidth = Math.max(currentPrice * 0.008, atr * 1.2);

  return createZone({
    kind,
    label:
      sourceCount > 1
        ? kind === "support"
          ? "MTF підтримка"
          : "MTF опір"
        : kind === "support"
          ? `${uniqueTimeframes[0]} підтримка`
          : `${uniqueTimeframes[0]} опір`,
    low: Math.max(weightedLow, mergedPrice - maxHalfWidth),
    high: Math.min(weightedHigh, mergedPrice + maxHalfWidth),
    price: mergedPrice,
    strength,
    timeframes: uniqueTimeframes,
    sourceCount,
    isMultiTimeframe: sourceCount > 1,
  });
}

function mergeZonesByKind(
  zones: MarketZone[],
  currentPrice: number,
  atr: number,
) {
  const tolerance = getZoneMergeTolerance(currentPrice, atr);
  const sortedZones = [...zones].sort((a, b) => a.price - b.price);
  const groups: MarketZone[][] = [];

  for (const zone of sortedZones) {
    const currentGroup = groups.at(-1);

    if (!currentGroup) {
      groups.push([zone]);
      continue;
    }

    const groupLow = Math.min(...currentGroup.map((item) => item.low));
    const groupHigh = Math.max(...currentGroup.map((item) => item.high));
    const overlapsGroup = zone.low <= groupHigh + tolerance && zone.high >= groupLow - tolerance;

    if (overlapsGroup) {
      currentGroup.push(zone);
    } else {
      groups.push([zone]);
    }
  }

  return groups.map((group) => mergeZoneGroup(group, currentPrice, atr));
}

function mergeMultiTimeframeZones(
  zones: MarketZone[],
  currentPrice: number,
  atr: number,
) {
  const supports = zones.filter((zone) => zone.kind === "support");
  const resistances = zones.filter((zone) => zone.kind === "resistance");

  return [
    ...mergeZonesByKind(supports, currentPrice, atr),
    ...mergeZonesByKind(resistances, currentPrice, atr),
  ].sort((a, b) => a.price - b.price);
}

function buildMultiTimeframeZones({
  currentPrice,
  atr,
  selectedTimeframe,
  candles,
  multiTimeframeCandles,
}: {
  currentPrice: number;
  atr: number;
  selectedTimeframe: TradeTimeframe;
  candles: Candle[];
  multiTimeframeCandles?: Partial<Record<MarketAnalysisTimeframe, Candle[]>>;
}) {
  const candlesByTimeframe: Partial<Record<MarketAnalysisTimeframe, Candle[]>> = {
    ...multiTimeframeCandles,
    [selectedTimeframe]: multiTimeframeCandles?.[selectedTimeframe] ?? candles,
  };
  const rawZones = analysisTimeframeOrder.flatMap((timeframe) => {
    const timeframeCandles = candlesByTimeframe[timeframe];

    if (!timeframeCandles || timeframeCandles.length < 30) {
      return [];
    }

    return buildZones(timeframeCandles, currentPrice, {
      timeframe,
      lookbackCandles: timeframeLookbackCandles[timeframe],
    }).allZones;
  });

  if (rawZones.length === 0) {
    return buildZones(candles, currentPrice, { timeframe: selectedTimeframe });
  }

  const allZones = mergeMultiTimeframeZones(rawZones, currentPrice, atr);
  const visibleZones = selectVisibleZones(allZones, currentPrice);
  const fallbackZones = buildZones(candles, currentPrice, {
    timeframe: selectedTimeframe,
  });

  return {
    nearestSupport: visibleZones.nearestSupport ?? fallbackZones.nearestSupport,
    nearestResistance: visibleZones.nearestResistance ?? fallbackZones.nearestResistance,
    zones:
      visibleZones.zones.length > 0
        ? visibleZones.zones
        : [fallbackZones.nearestSupport, fallbackZones.nearestResistance],
    allZones,
  };
}

export function buildMarketSnapshotFromCandles({
  symbol,
  timeframe,
  candles,
  btcCandles,
  source,
  multiTimeframeCandles,
}: {
  symbol: string;
  timeframe: TradeTimeframe;
  candles: Candle[];
  btcCandles: Candle[];
  source: Exclude<MarketSource, "fallback">;
  multiTimeframeCandles?: Partial<Record<MarketAnalysisTimeframe, Candle[]>>;
}): MarketSnapshot {
  const currentCandle = candles.at(-1);

  if (!currentCandle || candles.length < 30 || btcCandles.length < 30) {
    throw new Error("Not enough candle data to build market snapshot.");
  }

  const currentPrice = currentCandle.close;
  const trend = getTrend(candles);
  const averageRangePercent = getAverageRangePercent(candles);
  const atr = getAtr(candles);
  const atrPercent = currentPrice > 0 ? (atr / currentPrice) * 100 : 0;
  const zones = buildMultiTimeframeZones({
    currentPrice,
    atr,
    selectedTimeframe: timeframe,
    candles,
    multiTimeframeCandles,
  });
  const analyzedTimeframes = analysisTimeframeOrder.filter((analysisTimeframe) => {
    if (analysisTimeframe === timeframe) {
      return true;
    }

    return (multiTimeframeCandles?.[analysisTimeframe]?.length ?? 0) >= 30;
  });
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
    atr,
    atrPercent,
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
    analyzedTimeframes,
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
    atr: 0,
    atrPercent: 0,
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
      timeframes: [timeframe],
      sourceCount: 1,
      isMultiTimeframe: false,
    },
    nearestResistance: {
      kind: "resistance",
      label: "Орієнтовний опір",
      low: currentPrice * 1.016,
      high: currentPrice * 1.024,
      price: currentPrice * 1.02,
      strength: 45,
      timeframes: [timeframe],
      sourceCount: 1,
      isMultiTimeframe: false,
    },
    zones: [
      {
        kind: "support",
        label: "Орієнтовна підтримка",
        low: currentPrice * 0.976,
        high: currentPrice * 0.984,
        price: currentPrice * 0.98,
        strength: 45,
        timeframes: [timeframe],
        sourceCount: 1,
        isMultiTimeframe: false,
      },
      {
        kind: "resistance",
        label: "Орієнтовний опір",
        low: currentPrice * 1.016,
        high: currentPrice * 1.024,
        price: currentPrice * 1.02,
        strength: 45,
        timeframes: [timeframe],
        sourceCount: 1,
        isMultiTimeframe: false,
      },
    ],
    updatedAt: "fallback",
    source: "fallback",
    candleCount: 0,
    analyzedTimeframes: [timeframe],
  };
}
