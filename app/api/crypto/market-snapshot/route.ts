import { NextResponse } from "next/server";
import {
  buildMarketSnapshotFromCandles,
  type Candle,
} from "@/components/crypto/strategies/trade-plan-reviewer/marketSnapshot";
import type {
  MarketDataDiagnostic,
  MarketAnalysisTimeframe,
  MarketSource,
  OpenInterestPoint,
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
const bybitBaseUrls = ["https://api.bybit.com", "https://api.bytick.com"];
const bitgetBaseUrl = "https://api.bitget.com";
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
const bybitOpenInterestIntervalByTimeframe: Record<TradeTimeframe, string> = {
  "5m": "5min",
  "15m": "15min",
  "1h": "1h",
  "4h": "4h",
};
const binanceOpenInterestPeriodByTimeframe: Record<TradeTimeframe, string> = {
  "5m": "5m",
  "15m": "15m",
  "1h": "1h",
  "4h": "4h",
};
const okxOpenInterestPeriodByTimeframe: Record<TradeTimeframe, string> = {
  "5m": "5m",
  "15m": "15m",
  "1h": "1H",
  "4h": "4H",
};
const okxBarByTimeframe: Record<MarketAnalysisTimeframe, string> = {
  "5m": "5m",
  "15m": "15m",
  "1h": "1H",
  "4h": "4H",
  "1d": "1D",
};
const bitgetGranularityByTimeframe: Record<MarketAnalysisTimeframe, string> = {
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
const minimumKlineCandles = 20;

type KlineSource = {
  baseUrl: string;
  kind: "spot" | "futures" | "bybit" | "bitget" | "okx";
  path: string;
  requestType:
    | "symbol"
    | "continuous"
    | "bybit-linear"
    | "bitget-futures"
    | "okx-swap";
};

type KlineVenue = {
  kind: KlineSource["kind"];
  label: string;
  sources: KlineSource[];
};

type KlineFetchData = {
  candles: Candle[];
  source: Exclude<MarketSource, "fallback">;
};

type OpenInterestFetchData = {
  points: OpenInterestPoint[];
  source: Exclude<MarketSource, "fallback">;
};

type TimeframeFetchResult = {
  interval: MarketAnalysisTimeframe;
  data: KlineFetchData | null;
  check: MarketDataDiagnostic["checks"][number];
};

class MarketDataFetchError extends Error {
  diagnostics: MarketDataDiagnostic[];

  constructor(message: string, diagnostics: MarketDataDiagnostic[]) {
    super(message);
    this.name = "MarketDataFetchError";
    this.diagnostics = diagnostics;
  }
}

class KlineSourceHttpError extends Error {
  status: number;

  constructor(source: KlineSource, status: number, message: string) {
    super(`${source.kind} ${status}: ${message}`);
    this.name = "KlineSourceHttpError";
    this.status = status;
  }
}

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

type BybitOpenInterestResponse = {
  retCode: number;
  retMsg: string;
  result?: {
    list?: Array<{
      openInterest?: string;
      timestamp?: string;
    }>;
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

type OkxOpenInterestResponse = {
  code: string;
  msg: string;
  data?: unknown[];
};

type BitgetKline = [
  string,
  string,
  string,
  string,
  string,
  string,
  string,
];

type BitgetKlineResponse = {
  code: string;
  msg: string;
  data?: BitgetKline[];
};

type BitgetOpenInterestResponse = {
  code: string;
  msg: string;
  data?: {
    openInterestList?: Array<{
      size?: string;
    }>;
    list?: Array<{
      openInterest?: string;
    }>;
    ts?: string;
  };
};

type BinanceOpenInterestHistoryPoint = {
  sumOpenInterest?: string;
  timestamp?: number;
};

type BinanceOpenInterestResponse = {
  openInterest?: string;
  time?: number;
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

function toBitgetCandle(kline: BitgetKline): Candle {
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

async function readJsonResponse<T>(
  response: Response,
  source: { kind: string; path: string },
) {
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

function getOkxOpenInterestPoint(item: unknown): OpenInterestPoint | null {
  if (Array.isArray(item)) {
    const timestamp = Number(item[0]);
    const value = Number(item[1]);

    return Number.isFinite(timestamp) && Number.isFinite(value)
      ? { timestamp, value }
      : null;
  }

  if (!item || typeof item !== "object") {
    return null;
  }

  const record = item as Record<string, unknown>;
  const timestamp = Number(record.ts ?? record.timestamp ?? record[0]);
  const value = Number(
    record.oi ??
      record.openInterest ??
      record.openInterestValue ??
      record.oiCcy ??
      record[1],
  );

  return Number.isFinite(timestamp) && Number.isFinite(value)
    ? { timestamp, value }
    : null;
}

async function fetchBybitOpenInterest(
  symbol: string,
  timeframe: TradeTimeframe,
): Promise<OpenInterestFetchData> {
  const errors: string[] = [];

  for (const baseUrl of bybitBaseUrls) {
    const source = {
      baseUrl,
      kind: "bybit" as const,
      path: "/v5/market/open-interest",
    };
    const url = new URL(source.path, source.baseUrl);

    url.searchParams.set("category", "linear");
    url.searchParams.set("symbol", symbol);
    url.searchParams.set("intervalTime", bybitOpenInterestIntervalByTimeframe[timeframe]);
    url.searchParams.set("limit", "30");

    try {
      const response = await fetch(url, {
        cache: "no-store",
        headers: { Accept: "application/json" },
      });

      if (!response.ok) {
        throw new Error(`bybit OI ${response.status}: ${(await response.text()).slice(0, 120)}`);
      }

      const payload = await readJsonResponse<BybitOpenInterestResponse>(
        response,
        source,
      );

      if (payload.retCode !== 0) {
        throw new Error(`bybit OI ${payload.retCode}: ${payload.retMsg}`);
      }

      const points = (payload.result?.list ?? [])
        .map((item) => ({
          timestamp: Number(item.timestamp),
          value: Number(item.openInterest),
        }))
        .filter(
          (point) =>
            Number.isFinite(point.timestamp) && Number.isFinite(point.value),
        )
        .sort((first, second) => first.timestamp - second.timestamp);

      if (points.length === 0) {
        throw new Error("bybit OI returned empty list");
      }

      return { points, source: "bybit" };
    } catch (error) {
      errors.push(getErrorMessage(error));
    }
  }

  throw new Error(errors.at(-1) ?? "Bybit OI unavailable");
}

async function fetchOkxOpenInterest(
  symbol: string,
  timeframe: TradeTimeframe,
): Promise<OpenInterestFetchData> {
  const historySource = {
    baseUrl: okxBaseUrl,
    kind: "okx" as const,
    path: "/api/v5/rubik/stat/contracts/open-interest-history",
  };
  const historyUrl = new URL(historySource.path, historySource.baseUrl);

  historyUrl.searchParams.set("instId", toOkxSymbol(symbol));
  historyUrl.searchParams.set("period", okxOpenInterestPeriodByTimeframe[timeframe]);
  historyUrl.searchParams.set("limit", "30");

  try {
    const response = await fetch(historyUrl, {
      cache: "no-store",
      headers: { Accept: "application/json" },
    });

    if (!response.ok) {
      throw new Error(`okx OI history ${response.status}: ${(await response.text()).slice(0, 120)}`);
    }

    const payload = await readJsonResponse<OkxOpenInterestResponse>(
      response,
      historySource,
    );

    if (payload.code !== "0") {
      throw new Error(`okx OI history ${payload.code}: ${payload.msg}`);
    }

    const points = (payload.data ?? [])
      .map(getOkxOpenInterestPoint)
      .filter((point): point is OpenInterestPoint => point !== null)
      .sort((first, second) => first.timestamp - second.timestamp);

    if (points.length > 0) {
      return { points, source: "okx" };
    }
  } catch {
    // OKX can still provide a current OI snapshot, so keep trying below.
  }

  const currentSource = {
    baseUrl: okxBaseUrl,
    kind: "okx" as const,
    path: "/api/v5/public/open-interest",
  };
  const currentUrl = new URL(currentSource.path, currentSource.baseUrl);

  currentUrl.searchParams.set("instType", "SWAP");
  currentUrl.searchParams.set("instId", toOkxSymbol(symbol));

  const response = await fetch(currentUrl, {
    cache: "no-store",
    headers: { Accept: "application/json" },
  });

  if (!response.ok) {
    throw new Error(`okx OI ${response.status}: ${(await response.text()).slice(0, 120)}`);
  }

  const payload = await readJsonResponse<OkxOpenInterestResponse>(
    response,
    currentSource,
  );

  if (payload.code !== "0") {
    throw new Error(`okx OI ${payload.code}: ${payload.msg}`);
  }

  const point = (payload.data ?? [])
    .map(getOkxOpenInterestPoint)
    .find((item): item is OpenInterestPoint => item !== null);

  if (!point) {
    throw new Error("okx OI returned empty data");
  }

  return { points: [point], source: "okx" };
}

async function fetchBitgetOpenInterest(
  symbol: string,
): Promise<OpenInterestFetchData> {
  const source = {
    baseUrl: bitgetBaseUrl,
    kind: "bitget" as const,
    path: "/api/v2/mix/market/open-interest",
  };
  const url = new URL(source.path, source.baseUrl);

  url.searchParams.set("symbol", symbol);
  url.searchParams.set("productType", "usdt-futures");

  const response = await fetch(url, {
    cache: "no-store",
    headers: { Accept: "application/json" },
  });

  if (!response.ok) {
    throw new Error(`bitget OI ${response.status}: ${(await response.text()).slice(0, 120)}`);
  }

  const payload = await readJsonResponse<BitgetOpenInterestResponse>(
    response,
    source,
  );

  if (payload.code !== "00000") {
    throw new Error(`bitget OI ${payload.code}: ${payload.msg}`);
  }

  const currentValue = Number(
    payload.data?.openInterestList?.[0]?.size ??
      payload.data?.list?.[0]?.openInterest,
  );
  const timestamp = Number(payload.data?.ts ?? Date.now());

  if (!Number.isFinite(currentValue)) {
    throw new Error("bitget OI returned empty data");
  }

  return {
    points: [{ timestamp, value: currentValue }],
    source: "bitget",
  };
}

async function fetchBinanceOpenInterest(
  symbol: string,
  timeframe: TradeTimeframe,
): Promise<OpenInterestFetchData> {
  const historyErrors: string[] = [];

  for (const baseUrl of binanceFuturesBaseUrls) {
    const source = {
      baseUrl,
      kind: "futures" as const,
      path: "/futures/data/openInterestHist",
    };
    const url = new URL(source.path, source.baseUrl);

    url.searchParams.set("symbol", symbol);
    url.searchParams.set("period", binanceOpenInterestPeriodByTimeframe[timeframe]);
    url.searchParams.set("limit", "30");

    try {
      const response = await fetch(url, {
        cache: "no-store",
        headers: { Accept: "application/json" },
      });

      if (!response.ok) {
        throw new Error(`futures OI history ${response.status}: ${(await response.text()).slice(0, 120)}`);
      }

      const payload = await readJsonResponse<BinanceOpenInterestHistoryPoint[]>(
        response,
        source,
      );
      const points = payload
        .map((item) => ({
          timestamp: Number(item.timestamp),
          value: Number(item.sumOpenInterest),
        }))
        .filter(
          (point) =>
            Number.isFinite(point.timestamp) && Number.isFinite(point.value),
        )
        .sort((first, second) => first.timestamp - second.timestamp);

      if (points.length > 0) {
        return { points, source: "futures" };
      }
    } catch (error) {
      historyErrors.push(getErrorMessage(error));
    }
  }

  for (const baseUrl of binanceFuturesBaseUrls) {
    const source = {
      baseUrl,
      kind: "futures" as const,
      path: "/fapi/v1/openInterest",
    };
    const url = new URL(source.path, source.baseUrl);

    url.searchParams.set("symbol", symbol);

    try {
      const response = await fetch(url, {
        cache: "no-store",
        headers: { Accept: "application/json" },
      });

      if (!response.ok) {
        throw new Error(`futures OI ${response.status}: ${(await response.text()).slice(0, 120)}`);
      }

      const payload = await readJsonResponse<BinanceOpenInterestResponse>(
        response,
        source,
      );
      const value = Number(payload.openInterest);
      const timestamp = Number(payload.time ?? Date.now());

      if (Number.isFinite(value)) {
        return { points: [{ timestamp, value }], source: "futures" };
      }
    } catch {
      // Keep trying the next Binance base URL.
    }
  }

  throw new Error(historyErrors.at(-1) ?? "Binance OI unavailable");
}

async function fetchOpenInterestFromVenue(
  venue: KlineVenue,
  symbol: string,
  timeframe: TradeTimeframe,
) {
  if (venue.kind === "bybit") {
    return fetchBybitOpenInterest(symbol, timeframe);
  }

  if (venue.kind === "okx") {
    return fetchOkxOpenInterest(symbol, timeframe);
  }

  if (venue.kind === "bitget") {
    return fetchBitgetOpenInterest(symbol);
  }

  if (venue.kind === "futures") {
    return fetchBinanceOpenInterest(symbol, timeframe);
  }

  return null;
}

function hasOpenInterestHistory(openInterest: OpenInterestFetchData | null) {
  return (openInterest?.points.length ?? 0) >= 2;
}

async function fetchOpenInterestFromAvailableVenues(
  preferredVenue: KlineVenue,
  symbol: string,
  timeframe: TradeTimeframe,
) {
  const preferredOpenInterest = await fetchOpenInterestFromVenue(
    preferredVenue,
    symbol,
    timeframe,
  ).catch(() => null);

  if (hasOpenInterestHistory(preferredOpenInterest)) {
    return preferredOpenInterest;
  }

  for (const venue of klineVenues) {
    if (venue.kind === preferredVenue.kind || venue.kind === "spot") {
      continue;
    }

    const openInterest = await fetchOpenInterestFromVenue(
      venue,
      symbol,
      timeframe,
    ).catch(() => null);

    if (hasOpenInterestHistory(openInterest)) {
      return openInterest;
    }
  }

  return preferredOpenInterest;
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
  } else if (source.requestType === "bitget-futures") {
    url.searchParams.set("symbol", symbol);
    url.searchParams.set("productType", "usdt-futures");
    url.searchParams.set("granularity", bitgetGranularityByTimeframe[interval]);
  } else if (source.requestType === "continuous") {
    url.searchParams.set("pair", symbol);
    url.searchParams.set("contractType", "PERPETUAL");
  } else {
    url.searchParams.set("symbol", symbol);
  }

  if (
    source.requestType !== "bybit-linear" &&
    source.requestType !== "bitget-futures" &&
    source.requestType !== "okx-swap"
  ) {
    url.searchParams.set("interval", interval);
  }

  url.searchParams.set(
    "limit",
    source.requestType === "bitget-futures"
      ? String(Math.min(Number(candleLimitByTimeframe[interval]), 100))
      : candleLimitByTimeframe[interval],
  );

  const response = await fetch(url, {
    cache: "no-store",
    headers: {
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new KlineSourceHttpError(
      source,
      response.status,
      errorText.slice(0, 160),
    );
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

    if (candles.length < minimumKlineCandles) {
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

    if (candles.length < minimumKlineCandles) {
      throw new Error(`${source.kind} returned only ${candles.length} candles`);
    }

    return {
      candles,
      source: source.kind,
    };
  }

  if (source.requestType === "bitget-futures") {
    const payload = await readJsonResponse<BitgetKlineResponse>(response, source);

    if (payload.code !== "00000") {
      throw new Error(`${source.kind} ${payload.code}: ${payload.msg}`);
    }

    const candles = (payload.data ?? [])
      .map(toBitgetCandle)
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

    if (candles.length < minimumKlineCandles) {
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

  if (candles.length < minimumKlineCandles) {
    throw new Error(`${source.kind} returned only ${candles.length} candles`);
  }

  return {
    candles,
    source: source.kind,
  };
}

const klineVenues: KlineVenue[] = [
  {
    kind: "bybit",
    label: "Bybit",
    sources: bybitBaseUrls.map((baseUrl) => ({
      baseUrl,
      kind: "bybit" as const,
      path: "/v5/market/kline",
      requestType: "bybit-linear" as const,
    })),
  },
  {
    kind: "bitget",
    label: "Bitget Futures",
    sources: [
      {
        baseUrl: bitgetBaseUrl,
        kind: "bitget" as const,
        path: "/api/v2/mix/market/candles",
        requestType: "bitget-futures" as const,
      },
    ],
  },
  {
    kind: "okx",
    label: "OKX",
    sources: [
      {
        baseUrl: okxBaseUrl,
        kind: "okx" as const,
        path: "/api/v5/market/candles",
        requestType: "okx-swap" as const,
      },
    ],
  },
  {
    kind: "futures",
    label: "Binance Futures",
    sources: [
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
    ],
  },
  {
    kind: "spot",
    label: "Binance Spot",
    sources: binanceSpotBaseUrls.map((baseUrl) => ({
      baseUrl,
      kind: "spot" as const,
      path: "/api/v3/klines",
      requestType: "symbol" as const,
    })),
  },
];

async function fetchKlinesFromVenue(
  venue: KlineVenue,
  symbol: string,
  interval: MarketAnalysisTimeframe,
): Promise<KlineFetchData> {
  const errors: string[] = [];
  const stopRetryStatuses = new Set([403, 429, 451]);

  for (const source of venue.sources) {
    try {
      return await fetchKlinesFromSource(source, symbol, interval);
    } catch (error) {
      errors.push(error instanceof Error ? error.message : `${source.kind} failed`);

      if (
        source.kind !== "bybit" &&
        error instanceof KlineSourceHttpError &&
        stopRetryStatuses.has(error.status)
      ) {
        break;
      }
    }
  }

  throw new Error(`${venue.label}: ${errors.at(-1) ?? "no candles"}`);
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "unknown market data error";
}

async function fetchTimeframeFromVenue(
  venue: KlineVenue,
  symbol: string,
  interval: MarketAnalysisTimeframe,
): Promise<TimeframeFetchResult> {
  try {
    const data = await fetchKlinesFromVenue(venue, symbol, interval);

    return {
      interval,
      data,
      check: {
        timeframe: interval,
        status: "ok",
        candleCount: data.candles.length,
        source: data.source,
        error: null,
      },
    };
  } catch (error) {
    return {
      interval,
      data: null,
      check: {
        timeframe: interval,
        status: "failed",
        candleCount: 0,
        source: null,
        error: getErrorMessage(error),
      },
    };
  }
}

async function fetchVenueMarketPackage(
  venue: KlineVenue,
  symbol: string,
  selectedTimeframe: TradeTimeframe,
) {
  const selectedResult = await fetchTimeframeFromVenue(
    venue,
    symbol,
    selectedTimeframe,
  );

  if (!selectedResult.data) {
    return {
      selectedData: null,
      multiTimeframeCandles: {} as Partial<Record<MarketAnalysisTimeframe, Candle[]>>,
      openInterestPoints: null,
      openInterestSource: null,
      diagnostic: {
        symbol,
        venue: venue.label,
        source: venue.kind,
        status: "failed",
        selectedTimeframe,
        selectedCandleCount: 0,
        selectedError: selectedResult.check.error,
        checks: [selectedResult.check],
      } satisfies MarketDataDiagnostic,
    };
  }

  const [otherResults, openInterestResult] = await Promise.all([
    Promise.all(
      analysisTimeframes
        .filter((interval) => interval !== selectedTimeframe)
        .map((interval) => fetchTimeframeFromVenue(venue, symbol, interval)),
    ),
    fetchOpenInterestFromAvailableVenues(
      venue,
      symbol,
      selectedTimeframe,
    ).catch(() => null),
  ]);
  const checks = [selectedResult, ...otherResults].map((result) => result.check);
  const failedOptionalChecks = otherResults.filter((result) => !result.data);
  const diagnostic: MarketDataDiagnostic = {
    symbol,
    venue: venue.label,
    source: venue.kind,
    status: selectedResult.data
      ? failedOptionalChecks.length > 0
        ? "partial"
        : "ok"
      : "failed",
    selectedTimeframe,
    selectedCandleCount: selectedResult.data?.candles.length ?? 0,
    selectedError: selectedResult.check.error,
    checks,
  };

  return {
    selectedData: selectedResult.data,
    multiTimeframeCandles: Object.fromEntries([
      ...(selectedResult.data
        ? ([[selectedTimeframe, selectedResult.data.candles]] as const)
        : []),
      ...otherResults.flatMap((result) =>
        result.data ? [[result.interval, result.data.candles] as const] : [],
      ),
    ]) as Partial<Record<MarketAnalysisTimeframe, Candle[]>>,
    openInterestPoints: openInterestResult?.points ?? null,
    openInterestSource: openInterestResult?.source ?? null,
    diagnostic,
  };
}

async function fetchMarketPackage(
  symbol: string,
  selectedTimeframe: TradeTimeframe,
) {
  const diagnostics: MarketDataDiagnostic[] = [];

  for (const venue of klineVenues) {
    const venuePackage = await fetchVenueMarketPackage(
      venue,
      symbol,
      selectedTimeframe,
    );

    diagnostics.push(venuePackage.diagnostic);

    if (venuePackage.selectedData) {
      return {
        ...venuePackage,
        selectedData: venuePackage.selectedData,
        diagnostics,
      };
    }
  }

  throw new MarketDataFetchError(
    "No exchange returned selected candles.",
    diagnostics,
  );
}

async function fetchBtcCandles(timeframe: TradeTimeframe) {
  return fetchMarketPackage("BTCUSDT", timeframe);
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

  let diagnostics: MarketDataDiagnostic[] = [];

  try {
    const [marketResult, btcResult] = await Promise.allSettled([
      fetchMarketPackage(symbol, timeframe),
      fetchBtcCandles(timeframe),
    ]);

    diagnostics = [
      ...(marketResult.status === "fulfilled"
        ? marketResult.value.diagnostics
        : marketResult.reason instanceof MarketDataFetchError
          ? marketResult.reason.diagnostics
          : []),
      ...(btcResult.status === "fulfilled"
        ? btcResult.value.diagnostics
        : btcResult.reason instanceof MarketDataFetchError
          ? btcResult.reason.diagnostics
          : []),
    ];

    if (marketResult.status === "rejected") {
      throw new MarketDataFetchError(getErrorMessage(marketResult.reason), diagnostics);
    }

    if (btcResult.status === "rejected") {
      throw new MarketDataFetchError(getErrorMessage(btcResult.reason), diagnostics);
    }

    const marketPackage = marketResult.value;
    const btcPackage = btcResult.value;

    const market = buildMarketSnapshotFromCandles({
      symbol,
      timeframe,
      candles: marketPackage.selectedData.candles,
      btcCandles: btcPackage.selectedData.candles,
      source: marketPackage.selectedData.source,
      multiTimeframeCandles: marketPackage.multiTimeframeCandles,
      openInterestPoints: marketPackage.openInterestPoints,
      openInterestSource: marketPackage.openInterestSource,
    });

    return NextResponse.json({ market, diagnostics });
  } catch (error) {
    const detail =
      error instanceof Error ? error.message : "Failed to load market data.";
    const errorDiagnostics =
      error instanceof MarketDataFetchError ? error.diagnostics : diagnostics;

    return NextResponse.json(
      {
        error:
          "Не вдалося отримати ринкові свічки для цього активу. Спробуй інший таймфрейм або актив.",
        detail,
        diagnostics: errorDiagnostics,
      },
      { status: 502 },
    );
  }
}
