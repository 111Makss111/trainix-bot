import { randomUUID } from "crypto";
import { getSql } from "@/lib/neon";

export type CryptoMarketType = "spot" | "futures";
export type CryptoZoneKind = "interest" | "zero_trend" | "breakout";
export type CryptoZoneBias =
  | "support"
  | "resistance"
  | "range"
  | "breakout-up"
  | "breakout-down";
export type CryptoZoneStatus = "active" | "touched" | "broken" | "completed";

export type CryptoWeeklyZone = {
  id: string;
  marketType: CryptoMarketType;
  symbol: string;
  weekKey: string;
  zoneKind: CryptoZoneKind;
  bias: CryptoZoneBias;
  label: string;
  priceFrom: number;
  priceTo: number;
  confidence: number;
  status: CryptoZoneStatus;
  sourceInterval: string;
  generatedAt: string;
  updatedAt: string;
  touchedAt: string | null;
  brokenAt: string | null;
  completedAt: string | null;
  currentPrice: number | null;
  distancePercent: number | null;
};

type CryptoZoneRow = {
  id: string;
  market_type: CryptoMarketType;
  symbol: string;
  week_key: string;
  zone_kind: CryptoZoneKind;
  bias: CryptoZoneBias;
  label: string;
  price_from: number;
  price_to: number;
  confidence: number;
  status: CryptoZoneStatus;
  source_interval: string;
  generated_at: string;
  updated_at: string;
  touched_at: string | null;
  broken_at: string | null;
  completed_at: string | null;
};

type BinanceRestKline = [
  number,
  string,
  string,
  string,
  string,
  string,
  number,
  string,
  number,
  string,
  string,
  string,
];

type Candle = {
  openTime: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
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

type GeneratedZoneDraft = {
  zoneKind: CryptoZoneKind;
  bias: CryptoZoneBias;
  label: string;
  priceFrom: number;
  priceTo: number;
  confidence: number;
  sourceInterval: string;
};

let cryptoZonesTablePromise:
  | Promise<Awaited<ReturnType<typeof ensureCryptoZonesTableInner>>>
  | null = null;

function getRestBase(marketType: CryptoMarketType) {
  return marketType === "spot"
    ? "https://api.binance.com/api/v3"
    : "https://fapi.binance.com/fapi/v1";
}

function getIsoWeekKey(date: Date) {
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

function getWeekStartUtc(date: Date) {
  const utc = new Date(date);
  utc.setUTCHours(0, 0, 0, 0);
  const day = utc.getUTCDay() || 7;
  utc.setUTCDate(utc.getUTCDate() - (day - 1));
  return utc;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function mapRowToZone(
  row: CryptoZoneRow,
  currentPrice: number | null,
): CryptoWeeklyZone {
  const midPrice = (row.price_from + row.price_to) / 2;
  const distancePercent =
    currentPrice && currentPrice > 0
      ? Math.abs(midPrice - currentPrice) / currentPrice
      : null;

  return {
    id: row.id,
    marketType: row.market_type,
    symbol: row.symbol,
    weekKey: row.week_key,
    zoneKind: row.zone_kind,
    bias: row.bias,
    label: row.label,
    priceFrom: Number(row.price_from),
    priceTo: Number(row.price_to),
    confidence: row.confidence,
    status: row.status,
    sourceInterval: row.source_interval,
    generatedAt: row.generated_at,
    updatedAt: row.updated_at,
    touchedAt: row.touched_at,
    brokenAt: row.broken_at,
    completedAt: row.completed_at,
    currentPrice,
    distancePercent,
  };
}

function parseKlines(rows: BinanceRestKline[]) {
  return rows.map((row) => ({
    openTime: Number(row[0]),
    open: Number(row[1]),
    high: Number(row[2]),
    low: Number(row[3]),
    close: Number(row[4]),
    volume: Number(row[5]),
  }));
}

async function fetchBinanceKlines(input: {
  marketType: CryptoMarketType;
  symbol: string;
  interval: string;
  limit?: number;
  startTime?: number;
}) {
  const search = new URLSearchParams({
    symbol: input.symbol,
    interval: input.interval,
  });

  if (input.limit) {
    search.set("limit", String(input.limit));
  }

  if (input.startTime) {
    search.set("startTime", String(input.startTime));
  }

  const response = await fetch(`${getRestBase(input.marketType)}/klines?${search}`, {
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Binance kline request failed with status ${response.status}`);
  }

  const payload = (await response.json()) as BinanceRestKline[];
  return parseKlines(payload);
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

  const zones: GeneratedZoneDraft[] = [];

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

function buildBreakoutZones(candles: Candle[], zeroTrendZone: GeneratedZoneDraft | null) {
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

function generateWeeklyZonesFromCandles(candles: Candle[]) {
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

function evaluateZoneStatus(zone: GeneratedZoneDraft | CryptoZoneRow, candles: Candle[]) {
  const zoneFrom = "priceFrom" in zone ? zone.priceFrom : zone.price_from;
  const zoneTo = "priceTo" in zone ? zone.priceTo : zone.price_to;
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

async function ensureCryptoZonesTableInner() {
  const sql = getSql();

  if (!sql) {
    return null;
  }

  await sql`
    CREATE TABLE IF NOT EXISTS crypto_weekly_zones (
      id TEXT PRIMARY KEY,
      market_type TEXT NOT NULL,
      symbol TEXT NOT NULL,
      week_key TEXT NOT NULL,
      zone_kind TEXT NOT NULL,
      bias TEXT NOT NULL,
      label TEXT NOT NULL,
      price_from DOUBLE PRECISION NOT NULL,
      price_to DOUBLE PRECISION NOT NULL,
      confidence INTEGER NOT NULL DEFAULT 50,
      status TEXT NOT NULL DEFAULT 'active',
      source_interval TEXT NOT NULL DEFAULT '4h',
      touched_at TIMESTAMPTZ,
      broken_at TIMESTAMPTZ,
      completed_at TIMESTAMPTZ,
      generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (market_type, symbol, week_key, label)
    )
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS idx_crypto_weekly_zones_market_week
    ON crypto_weekly_zones (market_type, symbol, week_key, updated_at DESC)
  `;

  return sql;
}

async function ensureCryptoZonesTable() {
  if (!cryptoZonesTablePromise) {
    cryptoZonesTablePromise = ensureCryptoZonesTableInner().catch((error) => {
      cryptoZonesTablePromise = null;
      throw error;
    });
  }

  return cryptoZonesTablePromise;
}

async function getWeeklyStatusCandles(input: {
  marketType: CryptoMarketType;
  symbol: string;
  weekStart: Date;
}) {
  return fetchBinanceKlines({
    marketType: input.marketType,
    symbol: input.symbol,
    interval: "1h",
    startTime: input.weekStart.getTime(),
    limit: 240,
  });
}

export async function getWeeklyCryptoZones(input: {
  marketType: CryptoMarketType;
  symbol: string;
}) {
  const normalizedSymbol = input.symbol.trim().toUpperCase();
  const now = new Date();
  const weekKey = getIsoWeekKey(now);
  const weekStart = getWeekStartUtc(now);
  const sql = await ensureCryptoZonesTable();

  let rows: CryptoZoneRow[] = [];

  if (sql) {
    rows = (await sql`
      SELECT *
      FROM crypto_weekly_zones
      WHERE market_type = ${input.marketType}
        AND symbol = ${normalizedSymbol}
        AND week_key = ${weekKey}
      ORDER BY generated_at ASC
    `) as CryptoZoneRow[];
  }

  if (!rows.length) {
    const sourceCandles = await fetchBinanceKlines({
      marketType: input.marketType,
      symbol: normalizedSymbol,
      interval: "4h",
      limit: 120,
    });
    const generated = generateWeeklyZonesFromCandles(sourceCandles);
    const generatedAt = now.toISOString();

    rows = generated.map((zone) => ({
      id: randomUUID(),
      market_type: input.marketType,
      symbol: normalizedSymbol,
      week_key: weekKey,
      zone_kind: zone.zoneKind,
      bias: zone.bias,
      label: zone.label,
      price_from: zone.priceFrom,
      price_to: zone.priceTo,
      confidence: zone.confidence,
      status: "active",
      source_interval: zone.sourceInterval,
      touched_at: null,
      broken_at: null,
      completed_at: null,
      generated_at: generatedAt,
      updated_at: generatedAt,
    }));

    if (sql) {
      for (const zone of rows) {
        await sql`
          INSERT INTO crypto_weekly_zones (
            id,
            market_type,
            symbol,
            week_key,
            zone_kind,
            bias,
            label,
            price_from,
            price_to,
            confidence,
            status,
            source_interval,
            touched_at,
            broken_at,
            completed_at,
            generated_at,
            updated_at
          )
          VALUES (
            ${zone.id},
            ${zone.market_type},
            ${zone.symbol},
            ${zone.week_key},
            ${zone.zone_kind},
            ${zone.bias},
            ${zone.label},
            ${zone.price_from},
            ${zone.price_to},
            ${zone.confidence},
            ${zone.status},
            ${zone.source_interval},
            ${zone.touched_at},
            ${zone.broken_at},
            ${zone.completed_at},
            ${zone.generated_at},
            ${zone.updated_at}
          )
          ON CONFLICT (market_type, symbol, week_key, label) DO NOTHING
        `;
      }
    }
  }

  const statusCandles = await getWeeklyStatusCandles({
    marketType: input.marketType,
    symbol: normalizedSymbol,
    weekStart,
  });
  const currentPrice = statusCandles[statusCandles.length - 1]?.close ?? null;

  const nextRows = rows.map((row) => {
    const nextState = evaluateZoneStatus(row, statusCandles);

    return {
      ...row,
      status: nextState.status,
      touched_at: nextState.touchedAt,
      broken_at: nextState.brokenAt,
      completed_at: nextState.completedAt,
      updated_at: now.toISOString(),
    } satisfies CryptoZoneRow;
  });

  if (sql) {
    for (const zone of nextRows) {
      const previous = rows.find((row) => row.id === zone.id);

      if (
        !previous ||
        previous.status !== zone.status ||
        previous.touched_at !== zone.touched_at ||
        previous.broken_at !== zone.broken_at ||
        previous.completed_at !== zone.completed_at
      ) {
        await sql`
          UPDATE crypto_weekly_zones
          SET
            status = ${zone.status},
            touched_at = ${zone.touched_at},
            broken_at = ${zone.broken_at},
            completed_at = ${zone.completed_at},
            updated_at = NOW()
          WHERE id = ${zone.id}
        `;
      }
    }
  }

  const zones = nextRows
    .map((row) => mapRowToZone(row, currentPrice))
    .sort((left, right) => {
      const leftDistance = left.distancePercent ?? Number.POSITIVE_INFINITY;
      const rightDistance = right.distancePercent ?? Number.POSITIVE_INFINITY;

      return leftDistance - rightDistance;
    });

  return {
    weekKey,
    generatedAt: nextRows[0]?.generated_at ?? now.toISOString(),
    currentPrice,
    zones,
  };
}
