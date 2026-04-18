import { randomUUID } from "crypto";
import { getSql } from "@/lib/neon";
import {
  evaluateZoneStatus,
  generateWeeklyZonesFromCandles,
  getIsoWeekKey,
  getWeekStartUtc,
  type CryptoZoneBias,
  type CryptoZoneKind,
  type CryptoZoneStatus,
} from "@/lib/crypto-zone-engine";

export type CryptoMarketType = "spot" | "futures";

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

let cryptoZonesTablePromise:
  | Promise<Awaited<ReturnType<typeof ensureCryptoZonesTableInner>>>
  | null = null;

function getRestBase(marketType: CryptoMarketType) {
  return marketType === "spot"
    ? "https://api.binance.com/api/v3"
    : "https://fapi.binance.com/fapi/v1";
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
    const nextState = evaluateZoneStatus(
      {
        zoneKind: row.zone_kind,
        bias: row.bias,
        label: row.label,
        priceFrom: Number(row.price_from),
        priceTo: Number(row.price_to),
        confidence: row.confidence,
        sourceInterval: row.source_interval,
      },
      statusCandles,
    );

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
