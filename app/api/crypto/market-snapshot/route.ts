import { NextResponse } from "next/server";
import {
  buildMarketSnapshotFromCandles,
  type Candle,
} from "@/components/crypto/strategies/trade-plan-reviewer/marketSnapshot";
import type { TradeTimeframe } from "@/components/crypto/strategies/trade-plan-reviewer/types";

const binanceMarketDataBaseUrl = "https://data-api.binance.vision";
const binanceSpotBaseUrls = [
  binanceMarketDataBaseUrl,
  "https://api.binance.com",
  "https://api1.binance.com",
  "https://api2.binance.com",
  "https://api3.binance.com",
  "https://api4.binance.com",
];
const binanceFuturesBaseUrls = [
  "https://fapi.binance.com",
  "https://fapi1.binance.com",
  "https://fapi2.binance.com",
  "https://fapi3.binance.com",
  "https://fapi4.binance.com",
];
const allowedTimeframes = new Set<TradeTimeframe>(["5m", "15m", "1h", "4h"]);

type KlineSource = {
  baseUrl: string;
  kind: "spot" | "futures";
  path: string;
};

type BinanceKline = [
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

function normalizeSymbol(value: string | null) {
  const symbol = value?.trim().toUpperCase() ?? "";

  if (!/^[A-Z0-9]{5,20}$/.test(symbol)) {
    return null;
  }

  return symbol;
}

function normalizeTimeframe(value: string | null): TradeTimeframe {
  return allowedTimeframes.has(value as TradeTimeframe)
    ? (value as TradeTimeframe)
    : "15m";
}

function toCandle(kline: BinanceKline): Candle {
  return {
    openTime: kline[0],
    open: Number(kline[1]),
    high: Number(kline[2]),
    low: Number(kline[3]),
    close: Number(kline[4]),
    volume: Number(kline[5]),
    closeTime: kline[6],
  };
}

async function fetchKlinesFromSource(
  source: KlineSource,
  symbol: string,
  interval: TradeTimeframe,
) {
  const url = new URL(source.path, source.baseUrl);
  url.searchParams.set("symbol", symbol);
  url.searchParams.set("interval", interval);
  url.searchParams.set("limit", "120");

  const response = await fetch(url, {
    cache: "no-store",
    headers: {
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`${source.kind} ${response.status}: ${errorText.slice(0, 160)}`);
  }

  const klines = (await response.json()) as BinanceKline[];

  const candles = klines.map(toCandle).filter((candle) => {
    return (
      Number.isFinite(candle.open) &&
      Number.isFinite(candle.high) &&
      Number.isFinite(candle.low) &&
      Number.isFinite(candle.close) &&
      Number.isFinite(candle.volume)
    );
  });

  if (candles.length < 30) {
    throw new Error(`${source.kind} returned only ${candles.length} candles`);
  }

  return {
    candles,
    source: source.kind,
  };
}

async function fetchKlines(symbol: string, interval: TradeTimeframe) {
  const sources: KlineSource[] = [
    ...binanceSpotBaseUrls.map((baseUrl) => ({
      baseUrl,
      kind: "spot" as const,
      path: "/api/v3/klines",
    })),
    ...binanceFuturesBaseUrls.map((baseUrl) => ({
      baseUrl,
      kind: "futures" as const,
      path: "/fapi/v1/klines",
    })),
  ];
  const errors: string[] = [];

  for (const source of sources) {
    try {
      return await fetchKlinesFromSource(source, symbol, interval);
    } catch (error) {
      errors.push(error instanceof Error ? error.message : `${source.kind} failed`);
    }
  }

  throw new Error(errors.slice(-3).join("; ") || "Market data unavailable.");
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const symbol = normalizeSymbol(url.searchParams.get("symbol"));
  const timeframe = normalizeTimeframe(url.searchParams.get("timeframe"));

  if (!symbol) {
    return NextResponse.json(
      { error: "Invalid symbol. Example: BTCUSDT, ETHUSDT, SOLUSDT." },
      { status: 400 },
    );
  }

  try {
    const [symbolData, btcData] = await Promise.all([
      fetchKlines(symbol, timeframe),
      fetchKlines("BTCUSDT", timeframe),
    ]);

    const market = buildMarketSnapshotFromCandles({
      symbol,
      timeframe,
      candles: symbolData.candles,
      btcCandles: btcData.candles,
      source: symbolData.source,
    });

    return NextResponse.json({ market });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load market data.";

    return NextResponse.json({ error: message }, { status: 502 });
  }
}
