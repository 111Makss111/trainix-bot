export type CryptoZoneKind = "interest" | "zero_trend" | "breakout";
export type CryptoZoneBias =
  | "support"
  | "resistance"
  | "range"
  | "breakout-up"
  | "breakout-down";
export type CryptoZoneStatus = "active" | "touched" | "broken" | "completed";

export type Candle = {
  openTime: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

export type CryptoZoneDraft = {
  zoneKind: CryptoZoneKind;
  bias: CryptoZoneBias;
  label: string;
  priceFrom: number;
  priceTo: number;
  confidence: number;
  sourceInterval: string;
};

type PivotPoint = {
  price: number;
  index: number;
  volume: number;
  kind: "high" | "low";
};

type PivotCluster = {
  kind: "high" | "low";
  center: number;
  touchCount: number;
  latestIndex: number;
  volumeTotal: number;
};

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

export function getIsoWeekKey(date: Date) {
  const utc = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
  const day = utc.getUTCDay() || 7;
  utc.setUTCDate(utc.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(utc.getUTCFullYear(), 0, 1));
  const week = Math.ceil(
    ((utc.getTime() - yearStart.getTime()) / 86400000 + 1) / 7,
  );

  return `${utc.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

export function getWeekStartUtc(date: Date) {
  const utc = new Date(date);
  utc.setUTCHours(0, 0, 0, 0);
  const day = utc.getUTCDay() || 7;
  utc.setUTCDate(utc.getUTCDate() - (day - 1));
  return utc;
}

function buildPivotPoints(candles: Candle[]) {
  const points: PivotPoint[] = [];

  for (let index = 2; index < candles.length - 2; index += 1) {
    const current = candles[index];
    const prev = candles.slice(index - 2, index);
    const next = candles.slice(index + 1, index + 3);

    if (
      prev.every((item) => current.high >= item.high) &&
      next.every((item) => current.high > item.high)
    ) {
      points.push({
        price: current.high,
        index,
        volume: current.volume,
        kind: "high",
      });
    }

    if (
      prev.every((item) => current.low <= item.low) &&
      next.every((item) => current.low < item.low)
    ) {
      points.push({
        price: current.low,
        index,
        volume: current.volume,
        kind: "low",
      });
    }
  }

  return points;
}

function clusterPivots(points: PivotPoint[], tolerance: number) {
  const clusters: PivotCluster[] = [];

  for (const point of points) {
    const existing = clusters.find(
      (cluster) =>
        cluster.kind === point.kind &&
        Math.abs(cluster.center - point.price) <= tolerance,
    );

    if (existing) {
      existing.center =
        (existing.center * existing.touchCount + point.price) /
        (existing.touchCount + 1);
      existing.touchCount += 1;
      existing.latestIndex = Math.max(existing.latestIndex, point.index);
      existing.volumeTotal += point.volume;
      continue;
    }

    clusters.push({
      kind: point.kind,
      center: point.price,
      touchCount: 1,
      latestIndex: point.index,
      volumeTotal: point.volume,
    });
  }

  return clusters;
}

function computeAtr(candles: Candle[], period = 14) {
  if (candles.length < 2) {
    return 0;
  }

  const ranges = candles.slice(1).map((candle, index) => {
    const previousClose = candles[index].close;
    return Math.max(
      candle.high - candle.low,
      Math.abs(candle.high - previousClose),
      Math.abs(candle.low - previousClose),
    );
  });
  const selection = ranges.slice(-period);

  if (!selection.length) {
    return 0;
  }

  return selection.reduce((sum, value) => sum + value, 0) / selection.length;
}

function buildInterestZones(candles: Candle[]) {
  const currentPrice = candles[candles.length - 1]?.close ?? 0;
  const atr = computeAtr(candles, 14);
  const tolerance = Math.max(currentPrice * 0.004, atr * 0.4, currentPrice * 0.0012);
  const width = Math.max(tolerance * 0.85, currentPrice * 0.0022);
  const averageVolume =
    candles.reduce((sum, candle) => sum + candle.volume, 0) /
      Math.max(candles.length, 1) || 1;
  const clusters = clusterPivots(buildPivotPoints(candles), tolerance);

  const scoreCluster = (cluster: PivotCluster) =>
    cluster.touchCount * 30 +
    (cluster.latestIndex / candles.length) * 18 +
    Math.min(20, cluster.volumeTotal / averageVolume);

  const support = clusters
    .filter((cluster) => cluster.kind === "low" && cluster.center <= currentPrice * 1.01)
    .sort((left, right) => scoreCluster(right) - scoreCluster(left))[0];
  const resistance = clusters
    .filter((cluster) => cluster.kind === "high" && cluster.center >= currentPrice * 0.99)
    .sort((left, right) => scoreCluster(right) - scoreCluster(left))[0];

  const zones: CryptoZoneDraft[] = [];

  if (support) {
    zones.push({
      zoneKind: "interest",
      bias: "support",
      label: "Interest support",
      priceFrom: Math.max(0, support.center - width),
      priceTo: support.center + width,
      confidence: clamp(Math.round(scoreCluster(support)), 45, 92),
      sourceInterval: "4h",
    });
  }

  if (resistance) {
    zones.push({
      zoneKind: "interest",
      bias: "resistance",
      label: "Interest resistance",
      priceFrom: Math.max(0, resistance.center - width),
      priceTo: resistance.center + width,
      confidence: clamp(Math.round(scoreCluster(resistance)), 45, 92),
      sourceInterval: "4h",
    });
  }

  return zones;
}

function buildZeroTrendZone(candles: Candle[]) {
  let bestWindow:
    | {
        low: number;
        high: number;
        score: number;
      }
    | null = null;
  const recent = candles.slice(-36);
  const windowSizes = [6, 8, 10, 12];

  for (const size of windowSizes) {
    for (let index = 0; index <= recent.length - size; index += 1) {
      const slice = recent.slice(index, index + size);
      const low = Math.min(...slice.map((candle) => candle.low));
      const high = Math.max(...slice.map((candle) => candle.high));
      const avgClose =
        slice.reduce((sum, candle) => sum + candle.close, 0) / slice.length;
      const rangePct = (high - low) / avgClose;
      const driftPct =
        Math.abs(slice[slice.length - 1].close - slice[0].close) / avgClose;
      const recencyFactor = index / recent.length;
      const score = rangePct * 0.7 + driftPct * 0.3 - recencyFactor * 0.015;

      if (rangePct > 0.085) {
        continue;
      }

      if (!bestWindow || score < bestWindow.score) {
        bestWindow = {
          low,
          high,
          score,
        };
      }
    }
  }

  if (!bestWindow) {
    return null;
  }

  return {
    zoneKind: "zero_trend" as const,
    bias: "range" as const,
    label: "Zero trend",
    priceFrom: bestWindow.low,
    priceTo: bestWindow.high,
    confidence: clamp(Math.round(90 - bestWindow.score * 1200), 50, 94),
    sourceInterval: "4h",
  };
}

function buildBreakoutZones(candles: Candle[], zeroTrendZone: CryptoZoneDraft | null) {
  const baseRange = zeroTrendZone
    ? {
        low: zeroTrendZone.priceFrom,
        high: zeroTrendZone.priceTo,
      }
    : (() => {
        const slice = candles.slice(-18);
        return {
          low: Math.min(...slice.map((candle) => candle.low)),
          high: Math.max(...slice.map((candle) => candle.high)),
        };
      })();
  const currentPrice = candles[candles.length - 1]?.close ?? 0;
  const width = Math.max(
    (baseRange.high - baseRange.low) * 0.22,
    currentPrice * 0.0024,
  );

  return [
    {
      zoneKind: "breakout" as const,
      bias: "breakout-up" as const,
      label: "Breakout long",
      priceFrom: Math.max(0, baseRange.high - width * 0.35),
      priceTo: baseRange.high + width,
      confidence: zeroTrendZone ? clamp(zeroTrendZone.confidence - 6, 48, 90) : 58,
      sourceInterval: "4h",
    },
    {
      zoneKind: "breakout" as const,
      bias: "breakout-down" as const,
      label: "Breakout short",
      priceFrom: Math.max(0, baseRange.low - width),
      priceTo: baseRange.low + width * 0.35,
      confidence: zeroTrendZone ? clamp(zeroTrendZone.confidence - 6, 48, 90) : 58,
      sourceInterval: "4h",
    },
  ];
}

export function generateWeeklyZonesFromCandles(candles: Candle[]) {
  if (candles.length < 24) {
    throw new Error("Not enough market data to build weekly zones");
  }

  const interestZones = buildInterestZones(candles);
  const zeroTrendZone = buildZeroTrendZone(candles);
  const breakoutZones = buildBreakoutZones(candles, zeroTrendZone);

  return [
    ...interestZones,
    ...(zeroTrendZone ? [zeroTrendZone] : []),
    ...breakoutZones,
  ];
}

export function evaluateZoneStatus(zone: CryptoZoneDraft, candles: Candle[]) {
  const zoneFrom = zone.priceFrom;
  const zoneTo = zone.priceTo;
  const bias = zone.bias;
  const mid = (zoneFrom + zoneTo) / 2;
  const zoneWidth = Math.max(zoneTo - zoneFrom, mid * 0.0015);
  const breakBuffer = Math.max(zoneWidth * 0.18, mid * 0.0014);
  const touchedCandle = candles.find(
    (candle) => candle.high >= zoneFrom && candle.low <= zoneTo,
  );

  if (bias === "breakout-up") {
    const completedCandle = candles.find(
      (candle) => candle.close > zoneTo + breakBuffer,
    );

    if (completedCandle) {
      return {
        status: "completed" as const,
        touchedAt: touchedCandle ? new Date(touchedCandle.openTime).toISOString() : null,
        brokenAt: null,
        completedAt: new Date(completedCandle.openTime).toISOString(),
      };
    }
  }

  if (bias === "breakout-down") {
    const completedCandle = candles.find(
      (candle) => candle.close < zoneFrom - breakBuffer,
    );

    if (completedCandle) {
      return {
        status: "completed" as const,
        touchedAt: touchedCandle ? new Date(touchedCandle.openTime).toISOString() : null,
        brokenAt: null,
        completedAt: new Date(completedCandle.openTime).toISOString(),
      };
    }
  }

  if (bias === "support") {
    const brokenCandle = candles.find(
      (candle) => candle.close < zoneFrom - breakBuffer,
    );

    if (brokenCandle) {
      return {
        status: "broken" as const,
        touchedAt: touchedCandle ? new Date(touchedCandle.openTime).toISOString() : null,
        brokenAt: new Date(brokenCandle.openTime).toISOString(),
        completedAt: null,
      };
    }
  }

  if (bias === "resistance") {
    const brokenCandle = candles.find(
      (candle) => candle.close > zoneTo + breakBuffer,
    );

    if (brokenCandle) {
      return {
        status: "broken" as const,
        touchedAt: touchedCandle ? new Date(touchedCandle.openTime).toISOString() : null,
        brokenAt: new Date(brokenCandle.openTime).toISOString(),
        completedAt: null,
      };
    }
  }

  if (bias === "range") {
    const brokenCandle = candles.find(
      (candle) =>
        candle.close < zoneFrom - breakBuffer || candle.close > zoneTo + breakBuffer,
    );

    if (brokenCandle) {
      return {
        status: "broken" as const,
        touchedAt: touchedCandle ? new Date(touchedCandle.openTime).toISOString() : null,
        brokenAt: new Date(brokenCandle.openTime).toISOString(),
        completedAt: null,
      };
    }
  }

  if (touchedCandle) {
    return {
      status: "touched" as const,
      touchedAt: new Date(touchedCandle.openTime).toISOString(),
      brokenAt: null,
      completedAt: null,
    };
  }

  return {
    status: "active" as const,
    touchedAt: null,
    brokenAt: null,
    completedAt: null,
  };
}
