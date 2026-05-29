import { NextResponse } from "next/server";
import {
  buildMarketSnapshotFromCandles,
  type Candle,
} from "@/components/crypto/strategies/trade-plan-reviewer/marketSnapshot";
import type { TradeTimeframe } from "@/components/crypto/strategies/trade-plan-reviewer/types";

const binanceMarketDataBaseUrl = "https://data-api.binance.vision";
const allowedTimeframes = new Set<TradeTimeframe>(["5m", "15m", "1h", "4h"]);

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

async function fetchKlines(symbol: string, interval: TradeTimeframe) {
  const url = new URL("/api/v3/klines", binanceMarketDataBaseUrl);
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
    throw new Error(
      `Binance returned ${response.status}: ${errorText.slice(0, 160)}`,
    );
  }

  const klines = (await response.json()) as BinanceKline[];

  return klines.map(toCandle).filter((candle) => {
    return (
      Number.isFinite(candle.open) &&
      Number.isFinite(candle.high) &&
      Number.isFinite(candle.low) &&
      Number.isFinite(candle.close) &&
      Number.isFinite(candle.volume)
    );
  });
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
    const [candles, btcCandles] = await Promise.all([
      fetchKlines(symbol, timeframe),
      fetchKlines("BTCUSDT", timeframe),
    ]);

    const market = buildMarketSnapshotFromCandles({
      symbol,
      timeframe,
      candles,
      btcCandles,
    });

    return NextResponse.json({ market });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load market data.";

    return NextResponse.json({ error: message }, { status: 502 });
  }
}
