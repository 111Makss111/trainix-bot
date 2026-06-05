import { NextResponse } from "next/server";
import {
  buildMarketSnapshotFromCandles,
  type Candle,
} from "@/components/crypto/strategies/trade-plan-reviewer/marketSnapshot";
import type {
  MarketAnalysisTimeframe,
  TradeTimeframe,
} from "@/components/crypto/strategies/trade-plan-reviewer/types";

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
const bybitBaseUrl = "https://api.bybit.com";
const okxBaseUrl = "https://www.okx.com";
const allowedTimeframes = new Set<TradeTimeframe>(["5m", "15m", "1h", "4h"]);
const analysisTimeframes: MarketAnalysisTimeframe[] = [
  "5m",
  "15m",
  "1h",
  "4h",
  "1d",
];
const bybitIntervalByTimeframe: Record<MarketAnalysisTimeframe, string> = {
  "5m": "5",
  "15m": "15",
  "1h": "60",
  "4h": "240",
  "1d": "D",
};
const okxBarByTimeframe: Record<MarketAnalysisTimeframe, string> = {
  "5m": "5m",
  "15m": "15m",
  "1h": "1H",
  "4h": "4H",
  "1d": "1D",
};
const candleLimitByTimeframe: Record<MarketAnalysisTimeframe, string> = {
  "5m": "180",
  "15m": "180",
  "1h": "220",
  "4h": "260",
  "1d": "300",
};

type KlineSource = {
  baseUrl: string;
  kind: "spot" | "futures" | "bybit" | "okx";
  path: string;
  requestType: "symbol" | "continuous" | "bybit-linear" | "okx-swap";
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

type BybitKline = [
  string,
  string,
  string,
  string,
  string,
  string,
  string,
];

type BybitKlineResponse = {
  retCode: number;
  retMsg: string;
  result?: {
    list?: BybitKline[];
  };
};

type OkxKline = [
  string,
  string,
  string,
  string,
  string,
  string,
  string,
  string,
  string,
];

type OkxKlineResponse = {
  code: string;
  msg: string;
  data?: OkxKline[];
};

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

function toBybitCandle(kline: BybitKline): Candle {
  const openTime = Number(kline[0]);

  return {
    openTime,
    open: Number(kline[1]),
    high: Number(kline[2]),
    low: Number(kline[3]),
    close: Number(kline[4]),
    volume: Number(kline[5]),
    closeTime: openTime,
  };
}

function toOkxSymbol(symbol: string) {
  return symbol.endsWith("USDT")
    ? `${symbol.slice(0, -4)}-USDT-SWAP`
    : symbol;
}

function toOkxCandle(kline: OkxKline): Candle {
  const openTime = Number(kline[0]);

  return {
    openTime,
    open: Number(kline[1]),
    high: Number(kline[2]),
    low: Number(kline[3]),
    close: Number(kline[4]),
    volume: Number(kline[5]),
    closeTime: openTime,
  };
}

async function readJsonResponse<T>(response: Response, source: KlineSource) {
  const responseText = await response.text();

  if (!responseText.trim()) {
    throw new Error(`${source.kind} ${source.path} returned empty response`);
  }

  try {
    return JSON.parse(responseText) as T;
  } catch {
    throw new Error(
      `${source.kind} ${source.path} returned invalid JSON: ${responseText.slice(0, 120)}`,
    );
  }
}

async function fetchKlinesFromSource(
  source: KlineSource,
  symbol: string,
  interval: MarketAnalysisTimeframe,
) {
  const url = new URL(source.path, source.baseUrl);

  if (source.requestType === "okx-swap") {
    url.searchParams.set("instId", toOkxSymbol(symbol));
    url.searchParams.set("bar", okxBarByTimeframe[interval]);
  } else if (source.requestType === "bybit-linear") {
    url.searchParams.set("category", "linear");
    url.searchParams.set("symbol", symbol);
    url.searchParams.set("interval", bybitIntervalByTimeframe[interval]);
  } else if (source.requestType === "continuous") {
    url.searchParams.set("pair", symbol);
    url.searchParams.set("contractType", "PERPETUAL");
  } else {
    url.searchParams.set("symbol", symbol);
  }

  if (source.requestType !== "bybit-linear" && source.requestType !== "okx-swap") {
    url.searchParams.set("interval", interval);
  }

  url.searchParams.set("limit", candleLimitByTimeframe[interval]);

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

  if (source.requestType === "bybit-linear") {
    const payload = await readJsonResponse<BybitKlineResponse>(response, source);

    if (payload.retCode !== 0) {
      throw new Error(`${source.kind} ${payload.retCode}: ${payload.retMsg}`);
    }

    const candles = (payload.result?.list ?? [])
      .map(toBybitCandle)
      .filter((candle) => {
        return (
          Number.isFinite(candle.open) &&
          Number.isFinite(candle.high) &&
          Number.isFinite(candle.low) &&
          Number.isFinite(candle.close) &&
          Number.isFinite(candle.volume)
        );
      })
      .sort((first, second) => first.openTime - second.openTime);

    if (candles.length < 30) {
      throw new Error(`${source.kind} returned only ${candles.length} candles`);
    }

    return {
      candles,
      source: source.kind,
    };
  }

  if (source.requestType === "okx-swap") {
    const payload = await readJsonResponse<OkxKlineResponse>(response, source);

    if (payload.code !== "0") {
      throw new Error(`${source.kind} ${payload.code}: ${payload.msg}`);
    }

    const candles = (payload.data ?? [])
      .map(toOkxCandle)
      .filter((candle) => {
        return (
          Number.isFinite(candle.open) &&
          Number.isFinite(candle.high) &&
          Number.isFinite(candle.low) &&
          Number.isFinite(candle.close) &&
          Number.isFinite(candle.volume)
        );
      })
      .sort((first, second) => first.openTime - second.openTime);

    if (candles.length < 30) {
      throw new Error(`${source.kind} returned only ${candles.length} candles`);
    }

    return {
      candles,
      source: source.kind,
    };
  }

  const klines = await readJsonResponse<BinanceKline[]>(response, source);

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

async function fetchKlines(symbol: string, interval: MarketAnalysisTimeframe) {
  const sources: KlineSource[] = [
    {
      baseUrl: okxBaseUrl,
      kind: "okx" as const,
      path: "/api/v5/market/candles",
      requestType: "okx-swap" as const,
    },
    ...binanceFuturesBaseUrls.map((baseUrl) => ({
      baseUrl,
      kind: "futures" as const,
      path: "/fapi/v1/klines",
      requestType: "symbol" as const,
    })),
    ...binanceFuturesBaseUrls.map((baseUrl) => ({
      baseUrl,
      kind: "futures" as const,
      path: "/fapi/v1/continuousKlines",
      requestType: "continuous" as const,
    })),
    {
      baseUrl: bybitBaseUrl,
      kind: "bybit" as const,
      path: "/v5/market/kline",
      requestType: "bybit-linear" as const,
    },
    ...binanceSpotBaseUrls.map((baseUrl) => ({
      baseUrl,
      kind: "spot" as const,
      path: "/api/v3/klines",
      requestType: "symbol" as const,
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

  throw new Error(errors.slice(-3).join("; ") || "No market data source returned candles.");
}

async function fetchOptionalKlines(
  symbol: string,
  interval: MarketAnalysisTimeframe,
) {
  try {
    return {
      interval,
      data: await fetchKlines(symbol, interval),
      error: null,
    };
  } catch (error) {
    return {
      interval,
      data: null,
      error: error instanceof Error ? error.message : "Failed to load candles.",
    };
  }
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
    const [symbolTimeframeResults, btcData] = await Promise.all([
      Promise.all(
        analysisTimeframes.map((interval) => fetchOptionalKlines(symbol, interval)),
      ),
      fetchKlines("BTCUSDT", timeframe),
    ]);
    const selectedResult = symbolTimeframeResults.find(
      (result) => result.interval === timeframe,
    );
    const selectedData = selectedResult?.data;

    if (!selectedData) {
      throw new Error(
        selectedResult?.error ??
          "Selected timeframe did not return market candles.",
      );
    }
    const multiTimeframeCandles = Object.fromEntries(
      symbolTimeframeResults
        .filter((result) => result.data)
        .map((result) => [result.interval, result.data?.candles]),
    ) as Partial<Record<MarketAnalysisTimeframe, Candle[]>>;

    const market = buildMarketSnapshotFromCandles({
      symbol,
      timeframe,
      candles: selectedData.candles,
      btcCandles: btcData.candles,
      source: selectedData.source,
      multiTimeframeCandles,
    });

    return NextResponse.json({ market });
  } catch (error) {
    const detail =
      error instanceof Error ? error.message : "Failed to load market data.";

    return NextResponse.json(
      {
        error:
          "Не вдалося отримати ринкові свічки для цього активу. Спробуй інший таймфрейм або актив.",
        detail,
      },
      { status: 502 },
    );
  }
}
