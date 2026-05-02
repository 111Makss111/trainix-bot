"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  evaluateZoneStatus,
  generateWeeklyZonesFromCandles,
  getIsoWeekKey,
  getWeekStartUtc,
  type Candle,
  type CryptoZoneDraft,
} from "@/lib/crypto-zone-engine";
import type { CryptoWeeklyZone } from "@/lib/crypto-zones";
import {
  CandlestickSeries,
  ColorType,
  HistogramSeries,
  LineStyle,
  createChart,
  createSeriesMarkers,
  type IChartApi,
  type IPriceLine,
  type ISeriesApi,
  type ISeriesMarkersPluginApi,
  type SeriesMarker,
  type Time,
  type UTCTimestamp,
} from "lightweight-charts";

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

type LargeTrade = {
  id: string;
  side: "buy" | "sell";
  price: number;
  quantity: number;
  notional: number;
  time: number;
};

type OrderWall = {
  side: "bid" | "ask";
  price: number;
  quantity: number;
  notional: number;
};

type DayTickerStats = {
  priceChangePercent: number;
  quoteVolume: number;
  highPrice: number;
  lowPrice: number;
};

type TopBook = {
  bid: number | null;
  ask: number | null;
};

type MarketType = "spot" | "futures";

type WeeklyZonesResponse = {
  weekKey: string;
  generatedAt: string;
  currentPrice: number | null;
  zones: CryptoWeeklyZone[];
};

const spotPresetSymbols = [
  "BTCUSDT",
  "ETHUSDT",
  "SOLUSDT",
  "BNBUSDT",
  "XRPUSDT",
  "DOGEUSDT",
  "ADAUSDT",
  "LINKUSDT",
  "AVAXUSDT",
  "SUIUSDT",
  "PEPEUSDT",
  "SHIBUSDT",
] as const;
const futuresPresetSymbols = [
  "BTCUSDT",
  "ETHUSDT",
  "SOLUSDT",
  "BNBUSDT",
  "XRPUSDT",
  "DOGEUSDT",
  "SUIUSDT",
  "WIFUSDT",
  "PNUTUSDT",
  "FARTCOINUSDT",
  "POPCATUSDT",
  "1000BONKUSDT",
] as const;
const intervalOptions = ["1m", "5m", "15m", "1h", "4h"] as const;
const largeTradeThresholds = [25000, 50000, 100000, 250000, 500000] as const;
const klineHistoryLimit = 1000;
const restBackupRefreshMs = 15_000;
const staleStreamMs = 25_000;
const wallSyncThrottleMs = 1_200;
const bookTickerThrottleMs = 500;
const maxTradeMarkers = 30;
const visibleBarsByInterval: Record<(typeof intervalOptions)[number], number> = {
  "1m": 360,
  "5m": 420,
  "15m": 420,
  "1h": 360,
  "4h": 240,
};
const marketOptions = [
  {
    value: "spot",
    label: "Spot",
  },
  {
    value: "futures",
    label: "Futures",
  },
] as const;
const weeklySnapshotVersion = "v1";

function getRestBase(marketType: MarketType) {
  return marketType === "spot"
    ? "https://api.binance.com/api/v3"
    : "https://fapi.binance.com/fapi/v1";
}

function parseKlines(rows: BinanceRestKline[]): Candle[] {
  return rows.map((row) => ({
    openTime: Number(row[0]),
    open: Number(row[1]),
    high: Number(row[2]),
    low: Number(row[3]),
    close: Number(row[4]),
    volume: Number(row[5]),
  }));
}

function getWeeklySnapshotStorageKey(marketType: MarketType, symbol: string, weekKey: string) {
  return `crypto-weekly-zones:${weeklySnapshotVersion}:${marketType}:${symbol}:${weekKey}`;
}

function toChartTime(value: number) {
  return Math.floor(value / 1000) as UTCTimestamp;
}

function formatCompactNumber(value: number) {
  return new Intl.NumberFormat("uk-UA", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

function formatPrice(value: number) {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: value < 1 ? 4 : 2,
    maximumFractionDigits: value < 1 ? 6 : 2,
  }).format(value);
}

function getPricePrecision(value: number | null) {
  if (!value || value <= 0) {
    return 2;
  }

  if (value < 0.0001) {
    return 8;
  }

  if (value < 0.01) {
    return 6;
  }

  if (value < 1) {
    return 4;
  }

  if (value < 10) {
    return 3;
  }

  return 2;
}

function getSeriesPriceFormat(value: number | null) {
  const precision = getPricePrecision(value);

  return {
    type: "price" as const,
    precision,
    minMove: 1 / 10 ** precision,
  };
}

function formatTime(value: number) {
  return new Intl.DateTimeFormat("uk-UA", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(new Date(value));
}

function formatDistancePercent(value: number | null) {
  if (value === null) {
    return "—";
  }

  return `${(value * 100).toFixed(2)}%`;
}

function getZoneStatusLabel(status: CryptoWeeklyZone["status"]) {
  switch (status) {
    case "touched":
      return "Торкнулась";
    case "broken":
      return "Зламана";
    case "completed":
      return "Відпрацювала";
    default:
      return "Активна";
  }
}

function getZoneColor(zone: CryptoWeeklyZone) {
  if (zone.zoneKind === "zero_trend") {
    return zone.status === "broken" ? "rgba(125, 211, 252, 0.38)" : "rgba(125, 211, 252, 0.58)";
  }

  if (zone.bias === "support" || zone.bias === "breakout-up") {
    return zone.status === "completed"
      ? "rgba(52, 211, 153, 0.72)"
      : zone.status === "broken"
        ? "rgba(52, 211, 153, 0.32)"
        : "rgba(52, 211, 153, 0.58)";
  }

  return zone.status === "completed"
    ? "rgba(251, 146, 60, 0.68)"
    : zone.status === "broken"
      ? "rgba(248, 113, 113, 0.34)"
      : "rgba(248, 113, 113, 0.56)";
}

function buildAttentionScore(input: {
  largeTrades: LargeTrade[];
  walls: OrderWall[];
  currentPrice: number | null;
}) {
  if (!input.currentPrice) {
    return 0;
  }

  const recentNotional = input.largeTrades
    .slice(0, 8)
    .reduce((sum, trade) => sum + trade.notional, 0);
  const strongestWall = input.walls[0]?.notional ?? 0;
  const nearestWallDistance = input.walls[0]
    ? Math.abs(input.walls[0].price - input.currentPrice) / input.currentPrice
    : 1;
  const tradeScore = Math.min(45, recentNotional / 15000);
  const wallScore = Math.min(35, strongestWall / 25000);
  const proximityScore = Math.max(0, 20 - nearestWallDistance * 1000);

  return Math.round(Math.min(100, tradeScore + wallScore + proximityScore));
}

function describeAttention(score: number) {
  if (score >= 75) {
    return "Висока увага";
  }

  if (score >= 45) {
    return "Підвищений інтерес";
  }

  return "Спокійний ринок";
}

export function CryptoWorkspace() {
  const [marketType, setMarketType] = useState<MarketType>("spot");
  const [symbol, setSymbol] = useState("BTCUSDT");
  const [symbolInput, setSymbolInput] = useState("BTCUSDT");
  const [interval, setInterval] = useState<(typeof intervalOptions)[number]>("5m");
  const [largeTradeThreshold, setLargeTradeThreshold] =
    useState<(typeof largeTradeThresholds)[number]>(100000);
  const [isLoading, setIsLoading] = useState(true);
  const [status, setStatus] = useState("Підключаю ринок...");
  const [error, setError] = useState<string | null>(null);
  const [currentPrice, setCurrentPrice] = useState<number | null>(null);
  const [dayStats, setDayStats] = useState<DayTickerStats | null>(null);
  const [topBook, setTopBook] = useState<TopBook>({ bid: null, ask: null });
  const [largeTrades, setLargeTrades] = useState<LargeTrade[]>([]);
  const [walls, setWalls] = useState<OrderWall[]>([]);
  const [weeklyZones, setWeeklyZones] = useState<CryptoWeeklyZone[]>([]);
  const [weeklyZonesWeekKey, setWeeklyZonesWeekKey] = useState<string | null>(null);
  const [weeklyZonesGeneratedAt, setWeeklyZonesGeneratedAt] = useState<string | null>(null);
  const [weeklyZonesStatus, setWeeklyZonesStatus] = useState("Готую weekly snapshot...");
  const [weeklyZonesError, setWeeklyZonesError] = useState<string | null>(null);
  const chartContainerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<"Histogram"> | null>(null);
  const markersRef = useRef<ISeriesMarkersPluginApi<Time> | null>(null);
  const wallLinesRef = useRef<IPriceLine[]>([]);
  const zoneLinesRef = useRef<IPriceLine[]>([]);
  const candlesRef = useRef<Candle[]>([]);
  const orderBookRef = useRef<{
    bids: Map<string, number>;
    asks: Map<string, number>;
  }>({
    bids: new Map(),
    asks: new Map(),
  });

  const attentionScore = useMemo(
    () =>
      buildAttentionScore({
        largeTrades,
        walls,
        currentPrice,
      }),
    [currentPrice, largeTrades, walls],
  );

  const activePresetSymbols = useMemo<readonly string[]>(
    () => (marketType === "spot" ? spotPresetSymbols : futuresPresetSymbols),
    [marketType],
  );

  const spreadData = useMemo(() => {
    if (!topBook.bid || !topBook.ask) {
      return null;
    }

    const spread = topBook.ask - topBook.bid;
    const mid = (topBook.ask + topBook.bid) / 2;

    return {
      absolute: spread,
      percent: mid > 0 ? (spread / mid) * 100 : 0,
    };
  }, [topBook]);

  const wallPressure = useMemo(() => {
    const bidNotional = walls
      .filter((wall) => wall.side === "bid")
      .reduce((sum, wall) => sum + wall.notional, 0);
    const askNotional = walls
      .filter((wall) => wall.side === "ask")
      .reduce((sum, wall) => sum + wall.notional, 0);
    const total = bidNotional + askNotional;

    if (!total) {
      return {
        label: "Нейтрально",
        percent: 50,
      };
    }

    const bidPercent = Math.round((bidNotional / total) * 100);

    if (bidPercent >= 60) {
      return {
        label: "Перевага bid",
        percent: bidPercent,
      };
    }

    if (bidPercent <= 40) {
      return {
        label: "Перевага ask",
        percent: bidPercent,
      };
    }

    return {
      label: "Баланс",
      percent: bidPercent,
    };
  }, [walls]);

  function applySymbolInput() {
    const normalized = symbolInput.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");

    if (!normalized) {
      setSymbolInput(symbol);
      return;
    }

    setSymbolInput(normalized);

    if (normalized === "POPCATUSDT" && marketType === "spot") {
      setMarketType("futures");
    }

    if (normalized !== symbol) {
      setSymbol(normalized);
    }
  }

  async function buildClientWeeklyZonesSnapshot(
    activeMarketType: MarketType,
    activeSymbol: string,
  ): Promise<WeeklyZonesResponse> {
    const now = new Date();
    const weekKey = getIsoWeekKey(now);
    const generatedAt = now.toISOString();
    const storageKey = getWeeklySnapshotStorageKey(activeMarketType, activeSymbol, weekKey);
    const restBase = getRestBase(activeMarketType);

    let snapshot: CryptoZoneDraft[] | null = null;

    if (typeof window !== "undefined") {
      const raw = window.localStorage.getItem(storageKey);

      if (raw) {
        try {
          snapshot = JSON.parse(raw) as CryptoZoneDraft[];
        } catch (error) {
          console.error("Failed to parse local weekly snapshot", error);
          window.localStorage.removeItem(storageKey);
        }
      }
    }

    if (!snapshot || !snapshot.length) {
      const sourceResponse = await fetch(
        `${restBase}/klines?symbol=${activeSymbol}&interval=4h&limit=120`,
        {
          cache: "no-store",
        },
      );

      if (!sourceResponse.ok) {
        throw new Error("Failed to load browser-side klines for weekly zones");
      }

      const sourceRows = (await sourceResponse.json()) as BinanceRestKline[];
      snapshot = generateWeeklyZonesFromCandles(parseKlines(sourceRows));

      if (typeof window !== "undefined") {
        window.localStorage.setItem(storageKey, JSON.stringify(snapshot));
      }
    }

    const statusResponse = await fetch(
      `${restBase}/klines?symbol=${activeSymbol}&interval=1h&startTime=${getWeekStartUtc(now).getTime()}&limit=240`,
      {
        cache: "no-store",
      },
    );

    if (!statusResponse.ok) {
      throw new Error("Failed to load browser-side status candles for weekly zones");
    }

    const statusRows = (await statusResponse.json()) as BinanceRestKline[];
    const statusCandles = parseKlines(statusRows);
    const currentWeeklyPrice = statusCandles[statusCandles.length - 1]?.close ?? null;

    return {
      weekKey,
      generatedAt,
      currentPrice: currentWeeklyPrice,
      zones: snapshot
        .map((zone) => {
          const statusState = evaluateZoneStatus(zone, statusCandles);
          const midPrice = (zone.priceFrom + zone.priceTo) / 2;
          const distancePercent =
            currentWeeklyPrice && currentWeeklyPrice > 0
              ? Math.abs(midPrice - currentWeeklyPrice) / currentWeeklyPrice
              : null;

          return {
            id: `${weekKey}-${zone.label}-${zone.bias}`,
            marketType: activeMarketType,
            symbol: activeSymbol,
            weekKey,
            zoneKind: zone.zoneKind,
            bias: zone.bias,
            label: zone.label,
            priceFrom: zone.priceFrom,
            priceTo: zone.priceTo,
            confidence: zone.confidence,
            status: statusState.status,
            sourceInterval: zone.sourceInterval,
            generatedAt,
            updatedAt: generatedAt,
            touchedAt: statusState.touchedAt,
            brokenAt: statusState.brokenAt,
            completedAt: statusState.completedAt,
            currentPrice: currentWeeklyPrice,
            distancePercent,
          } satisfies CryptoWeeklyZone;
        })
        .sort((left, right) => {
          const leftDistance = left.distancePercent ?? Number.POSITIVE_INFINITY;
          const rightDistance = right.distancePercent ?? Number.POSITIVE_INFINITY;

          return leftDistance - rightDistance;
        }),
    };
  }

  useEffect(() => {
    setSymbolInput(symbol);
  }, [symbol]);

  useEffect(() => {
    let active = true;

    async function loadWeeklyZones() {
      setWeeklyZonesError(null);
      setWeeklyZonesStatus("Оновлюю weekly snapshot...");

      try {
        const response = await fetch(
          `/api/crypto/zones?marketType=${encodeURIComponent(marketType)}&symbol=${encodeURIComponent(symbol)}`,
          {
            cache: "no-store",
          },
        );

        if (!response.ok) {
          throw new Error("Failed to load weekly zones");
        }

        const payload = (await response.json()) as WeeklyZonesResponse;

        if (!active) {
          return;
        }

        setWeeklyZones(payload.zones);
        setWeeklyZonesWeekKey(payload.weekKey);
        setWeeklyZonesGeneratedAt(payload.generatedAt);
        setWeeklyZonesStatus(
          payload.zones.length
            ? `${payload.weekKey} · ${payload.zones.length} frozen zones готові`
            : "Weekly zones ще не зібрались",
        );
      } catch (loadError) {
        console.error(loadError);
        try {
          const fallbackPayload = await buildClientWeeklyZonesSnapshot(
            marketType,
            symbol,
          );

          if (!active) {
            return;
          }

          setWeeklyZones(fallbackPayload.zones);
          setWeeklyZonesWeekKey(fallbackPayload.weekKey);
          setWeeklyZonesGeneratedAt(fallbackPayload.generatedAt);
          setWeeklyZonesStatus(
            fallbackPayload.zones.length
              ? `${fallbackPayload.weekKey} · локальний frozen snapshot готовий`
              : "Weekly zones ще не зібрались",
          );
          setWeeklyZonesError(null);
        } catch (fallbackError) {
          console.error(fallbackError);

          if (!active) {
            return;
          }

          setWeeklyZones([]);
          setWeeklyZonesWeekKey(null);
          setWeeklyZonesGeneratedAt(null);
          setWeeklyZonesError("Не вдалося побудувати weekly zones для цього активу.");
          setWeeklyZonesStatus("Weekly snapshot тимчасово недоступний.");
        }
      }
    }

    void loadWeeklyZones();

    return () => {
      active = false;
    };
  }, [marketType, symbol]);

  useEffect(() => {
    if (!chartContainerRef.current || chartRef.current) {
      return;
    }

    const chart = createChart(chartContainerRef.current, {
      autoSize: true,
      layout: {
        background: {
          type: ColorType.Solid,
          color: "#07101f",
        },
        textColor: "rgba(255,255,255,0.72)",
        attributionLogo: true,
      },
      grid: {
        vertLines: {
          color: "rgba(255,255,255,0.05)",
        },
        horzLines: {
          color: "rgba(255,255,255,0.05)",
        },
      },
      crosshair: {
        vertLine: {
          color: "rgba(125, 211, 252, 0.32)",
        },
        horzLine: {
          color: "rgba(125, 211, 252, 0.24)",
        },
      },
      rightPriceScale: {
        borderColor: "rgba(255,255,255,0.08)",
      },
      timeScale: {
        borderColor: "rgba(255,255,255,0.08)",
        timeVisible: true,
        secondsVisible: false,
      },
    });

    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: "#24b47e",
      borderUpColor: "#24b47e",
      wickUpColor: "#24b47e",
      downColor: "#f2555a",
      borderDownColor: "#f2555a",
      wickDownColor: "#f2555a",
      priceLineVisible: true,
      lastValueVisible: true,
      priceFormat: getSeriesPriceFormat(null),
    });

    const volumeSeries = chart.addSeries(HistogramSeries, {
      priceFormat: {
        type: "volume",
      },
      priceScaleId: "",
      color: "rgba(125, 211, 252, 0.35)",
    });

    volumeSeries.priceScale().applyOptions({
      scaleMargins: {
        top: 0.82,
        bottom: 0,
      },
    });

    chartRef.current = chart;
    candleSeriesRef.current = candleSeries;
    volumeSeriesRef.current = volumeSeries;
    markersRef.current = createSeriesMarkers(candleSeries, []);

    return () => {
      wallLinesRef.current.forEach((line) => candleSeries.removePriceLine(line));
      wallLinesRef.current = [];
      zoneLinesRef.current.forEach((line) => candleSeries.removePriceLine(line));
      zoneLinesRef.current = [];
      markersRef.current = null;
      chart.remove();
      chartRef.current = null;
      candleSeriesRef.current = null;
      volumeSeriesRef.current = null;
    };
  }, []);

  useEffect(() => {
    const candleSeries = candleSeriesRef.current;
    const volumeSeries = volumeSeriesRef.current;
    const markerApi = markersRef.current;

    if (!candleSeries || !volumeSeries || !markerApi) {
      return;
    }

    const candleSeriesInstance = candleSeries;
    const volumeSeriesInstance = volumeSeries;
    const markerApiInstance = markerApi;

    let cancelled = false;
    let socket: WebSocket | null = null;
    let restBackupTimer: number | null = null;
    let wallSyncTimer: number | null = null;
    let bookTickerTimer: number | null = null;
    let pendingTopBook: TopBook | null = null;
    let lastWallSyncAt = 0;
    let lastStreamKlineAt = Date.now();
    let isRestBackupRunning = false;
    const restBase = getRestBase(marketType);
    const wsBase =
      marketType === "spot"
        ? "wss://stream.binance.com:9443/stream?streams="
        : "wss://fstream.binance.com/stream?streams=";
    const streamBase = symbol.toLowerCase();

    function focusRecentRange(totalCandles: number) {
      const chart = chartRef.current;

      if (!chart || totalCandles <= 0) {
        return;
      }

      const visibleBars = Math.min(
        totalCandles,
        visibleBarsByInterval[interval] ?? 360,
      );

      chart.timeScale().setVisibleLogicalRange({
        from: Math.max(0, totalCandles - visibleBars),
        to: totalCandles + 8,
      });
    }

    function updateSeriesPriceFormat(price: number | null) {
      candleSeriesInstance.applyOptions({
        priceFormat: getSeriesPriceFormat(price),
      });
    }

    function rememberCandle(nextRawCandle: Candle) {
      const nextCandles = [...candlesRef.current];
      const lastCandle = nextCandles[nextCandles.length - 1];

      if (lastCandle?.openTime === nextRawCandle.openTime) {
        nextCandles[nextCandles.length - 1] = nextRawCandle;
      } else {
        nextCandles.push(nextRawCandle);
      }

      candlesRef.current = nextCandles.slice(-klineHistoryLimit);
    }

    function updateLiveCandle(nextRawCandle: Candle) {
      const candle = {
        time: toChartTime(nextRawCandle.openTime),
        open: nextRawCandle.open,
        high: nextRawCandle.high,
        low: nextRawCandle.low,
        close: nextRawCandle.close,
        volume: nextRawCandle.volume,
      };

      candleSeriesInstance.update(candle);
      volumeSeriesInstance.update({
        time: candle.time,
        value: candle.volume,
        color:
          candle.close >= candle.open
            ? "rgba(36,180,126,0.35)"
            : "rgba(242,85,90,0.35)",
      });
      rememberCandle(nextRawCandle);
      updateSeriesPriceFormat(nextRawCandle.close);
      setCurrentPrice(nextRawCandle.close);
    }

    function scheduleTopBookUpdate(nextTopBook: TopBook) {
      pendingTopBook = nextTopBook;

      if (bookTickerTimer) {
        return;
      }

      bookTickerTimer = window.setTimeout(() => {
        bookTickerTimer = null;

        if (cancelled || !pendingTopBook) {
          return;
        }

        setTopBook(pendingTopBook);
        pendingTopBook = null;
      }, bookTickerThrottleMs);
    }

    function scheduleWallsSync() {
      const now = Date.now();
      const elapsed = now - lastWallSyncAt;

      if (elapsed >= wallSyncThrottleMs) {
        lastWallSyncAt = now;
        syncWalls(candleSeriesInstance, symbol);
        return;
      }

      if (wallSyncTimer) {
        return;
      }

      wallSyncTimer = window.setTimeout(() => {
        wallSyncTimer = null;

        if (cancelled) {
          return;
        }

        lastWallSyncAt = Date.now();
        syncWalls(candleSeriesInstance, symbol);
      }, wallSyncThrottleMs - elapsed);
    }

    async function refreshLatestMarketSnapshot(reason: "backup" | "stale") {
      if (isRestBackupRunning) {
        return;
      }

      isRestBackupRunning = true;

      try {
        const [latestKlinesResponse, bookTickerResponse] = await Promise.all([
          fetch(`${restBase}/klines?symbol=${symbol}&interval=${interval}&limit=2`, {
            cache: "no-store",
          }),
          fetch(`${restBase}/ticker/bookTicker?symbol=${symbol}`, {
            cache: "no-store",
          }),
        ]);

        if (!latestKlinesResponse.ok || !bookTickerResponse.ok) {
          throw new Error("REST backup не отримав актуальні дані.");
        }

        const latestKlines = (await latestKlinesResponse.json()) as BinanceRestKline[];
        const bookTicker = (await bookTickerResponse.json()) as {
          bidPrice: string;
          askPrice: string;
        };
        const latestRow = latestKlines[latestKlines.length - 1];

        if (cancelled || !latestRow) {
          return;
        }

        updateLiveCandle({
          openTime: Number(latestRow[0]),
          open: Number(latestRow[1]),
          high: Number(latestRow[2]),
          low: Number(latestRow[3]),
          close: Number(latestRow[4]),
          volume: Number(latestRow[5]),
        });
        setTopBook({
          bid: Number(bookTicker.bidPrice),
          ask: Number(bookTicker.askPrice),
        });
        setError(null);

        if (reason === "stale") {
          setStatus("WebSocket підвис. Останню ціну тримає REST backup.");
        }
      } catch (backupError) {
        console.error(backupError);
      } finally {
        isRestBackupRunning = false;
      }
    }

    async function loadMarket() {
      setIsLoading(true);
      setError(null);
      setStatus("Завантажую свічки та стакан...");
      setLargeTrades([]);
      setWalls([]);
      setCurrentPrice(null);
      setDayStats(null);
      setTopBook({ bid: null, ask: null });
      orderBookRef.current = {
        bids: new Map(),
        asks: new Map(),
      };
      markerApiInstance.setMarkers([]);
      wallLinesRef.current.forEach((line) => candleSeriesInstance.removePriceLine(line));
      wallLinesRef.current = [];

      try {
        const [klinesResponse, depthResponse, tickerResponse, bookTickerResponse] =
          await Promise.all([
          fetch(
            `${restBase}/klines?symbol=${symbol}&interval=${interval}&limit=${klineHistoryLimit}`,
            { cache: "no-store" },
          ),
          fetch(
            `${restBase}/depth?symbol=${symbol}&limit=100`,
            { cache: "no-store" },
          ),
          fetch(`${restBase}/ticker/24hr?symbol=${symbol}`, {
            cache: "no-store",
          }),
          fetch(`${restBase}/ticker/bookTicker?symbol=${symbol}`, {
            cache: "no-store",
          }),
        ]);

        if (
          !klinesResponse.ok ||
          !depthResponse.ok ||
          !tickerResponse.ok ||
          !bookTickerResponse.ok
        ) {
          throw new Error("Binance не віддав дані для старту.");
        }

        const klines = (await klinesResponse.json()) as BinanceRestKline[];
        const depth = (await depthResponse.json()) as {
          bids: Array<[string, string]>;
          asks: Array<[string, string]>;
        };
        const ticker = (await tickerResponse.json()) as {
          priceChangePercent: string;
          quoteVolume: string;
          highPrice: string;
          lowPrice: string;
        };
        const bookTicker = (await bookTickerResponse.json()) as {
          bidPrice: string;
          askPrice: string;
        };

        if (cancelled) {
          return;
        }

        const candles = klines.map((item) => ({
          time: toChartTime(item[0]),
          open: Number(item[1]),
          high: Number(item[2]),
          low: Number(item[3]),
          close: Number(item[4]),
          volume: Number(item[5]),
        }));
        candlesRef.current = klines.map((item) => ({
          openTime: Number(item[0]),
          open: Number(item[1]),
          high: Number(item[2]),
          low: Number(item[3]),
          close: Number(item[4]),
          volume: Number(item[5]),
        }));

        const lastClose = candles[candles.length - 1]?.close ?? null;

        updateSeriesPriceFormat(lastClose);
        candleSeriesInstance.setData(candles);
        volumeSeriesInstance.setData(
          candles.map((item) => ({
            time: item.time,
            value: item.volume,
            color:
              item.close >= item.open
                ? "rgba(36,180,126,0.35)"
              : "rgba(242,85,90,0.35)",
          })),
        );
        focusRecentRange(candles.length);
        setCurrentPrice(lastClose);
        setDayStats({
          priceChangePercent: Number(ticker.priceChangePercent),
          quoteVolume: Number(ticker.quoteVolume),
          highPrice: Number(ticker.highPrice),
          lowPrice: Number(ticker.lowPrice),
        });
        setTopBook({
          bid: Number(bookTicker.bidPrice),
          ask: Number(bookTicker.askPrice),
        });

        for (const [price, quantity] of depth.bids) {
          orderBookRef.current.bids.set(price, Number(quantity));
        }
        for (const [price, quantity] of depth.asks) {
          orderBookRef.current.asks.set(price, Number(quantity));
        }

        syncWalls(candleSeriesInstance, symbol);

        setStatus("Потік підключений. Дані оновлюються в реальному часі.");
        setIsLoading(false);

        socket = new WebSocket(
          `${wsBase}${streamBase}@kline_${interval}/${streamBase}@aggTrade/${streamBase}@depth@100ms/${streamBase}@bookTicker`,
        );

        socket.onopen = () => {
          if (!cancelled) {
            lastStreamKlineAt = Date.now();
            setStatus("Live-потік підключений. Графік оновлюється.");
          }
        };

        socket.onmessage = (event) => {
          const payload = JSON.parse(event.data) as {
            stream: string;
            data: Record<string, unknown>;
          };

          if (cancelled) {
            return;
          }

          if (payload.stream.includes("@kline_")) {
            const kline = payload.data.k as Record<string, unknown>;
            lastStreamKlineAt = Date.now();
            updateLiveCandle({
              openTime: Number(kline.t),
              open: Number(kline.o),
              high: Number(kline.h),
              low: Number(kline.l),
              close: Number(kline.c),
              volume: Number(kline.v),
            });
            return;
          }

          if (payload.stream.includes("@aggTrade")) {
            const price = Number(payload.data.p);
            const quantity = Number(payload.data.q);
            const notional = price * quantity;
            const isMakerSell = Boolean(payload.data.m);

            if (notional >= largeTradeThreshold) {
              const trade: LargeTrade = {
                id: String(payload.data.a),
                side: isMakerSell ? "sell" : "buy",
                price,
                quantity,
                notional,
                time: Number(payload.data.T),
              };

              setLargeTrades((current) => {
                const nextTrades = [trade, ...current].slice(0, 12);
                const markers: SeriesMarker<Time>[] = nextTrades
                  .slice(0, maxTradeMarkers)
                  .map((item) => ({
                    time: toChartTime(item.time),
                    position: item.side === "buy" ? "belowBar" : "aboveBar",
                    color: item.side === "buy" ? "#22c55e" : "#f87171",
                    shape: item.side === "buy" ? "arrowUp" : "arrowDown",
                    text: `${item.side === "buy" ? "BUY" : "SELL"} ${formatCompactNumber(item.notional)}`,
                  }));

                markerApiInstance.setMarkers(markers);
                return nextTrades;
              });
            }
            return;
          }

          if (payload.stream.includes("@depth")) {
            const bids = Array.isArray(payload.data.b)
              ? (payload.data.b as Array<[string, string]>)
              : [];
            const asks = Array.isArray(payload.data.a)
              ? (payload.data.a as Array<[string, string]>)
              : [];

            for (const [price, quantity] of bids) {
              const nextQuantity = Number(quantity);
              if (nextQuantity <= 0) {
                orderBookRef.current.bids.delete(price);
              } else {
                orderBookRef.current.bids.set(price, nextQuantity);
              }
            }

            for (const [price, quantity] of asks) {
              const nextQuantity = Number(quantity);
              if (nextQuantity <= 0) {
                orderBookRef.current.asks.delete(price);
              } else {
                orderBookRef.current.asks.set(price, nextQuantity);
              }
            }

            scheduleWallsSync();
            return;
          }

          if (payload.stream.includes("@bookTicker")) {
            scheduleTopBookUpdate({
              bid: Number(payload.data.b),
              ask: Number(payload.data.a),
            });
          }
        };

        socket.onerror = () => {
          if (!cancelled) {
            setStatus("Live-потік дав збій. Вмикаю REST backup для останньої ціни.");
          }
        };

        socket.onclose = () => {
          if (!cancelled) {
            setStatus("Live-потік відключився. Тримаю графік через REST backup.");
            void refreshLatestMarketSnapshot("stale");
          }
        };

        restBackupTimer = window.setInterval(() => {
          if (Date.now() - lastStreamKlineAt > staleStreamMs) {
            void refreshLatestMarketSnapshot("stale");
          }
        }, restBackupRefreshMs);
      } catch (loadError) {
        console.error(loadError);
        if (!cancelled) {
          setError(
            marketType === "spot"
              ? "Не вдалося завантажити ринок. Можливо, ця пара недоступна на Binance Spot."
              : "Не вдалося завантажити ринок. Перевір підключення або спробуй інший futures-актив.",
          );
          setStatus("Стартові дані не завантажились.");
          setIsLoading(false);
        }
      }
    }

    function syncWalls(series: ISeriesApi<"Candlestick">, activeSymbol: string) {
      const topBids = [...orderBookRef.current.bids.entries()]
        .map(([price, quantity]) => ({
          side: "bid" as const,
          price: Number(price),
          quantity,
          notional: Number(price) * quantity,
        }))
        .sort((left, right) => right.notional - left.notional)
        .slice(0, 3);

      const topAsks = [...orderBookRef.current.asks.entries()]
        .map(([price, quantity]) => ({
          side: "ask" as const,
          price: Number(price),
          quantity,
          notional: Number(price) * quantity,
        }))
        .sort((left, right) => right.notional - left.notional)
        .slice(0, 3);

      const nextWalls = [...topBids, ...topAsks].sort(
        (left, right) => right.notional - left.notional,
      );

      setWalls(nextWalls);

      wallLinesRef.current.forEach((line) => series.removePriceLine(line));
      wallLinesRef.current = nextWalls.map((wall) =>
        series.createPriceLine({
          price: wall.price,
          color: wall.side === "bid" ? "rgba(34,197,94,0.55)" : "rgba(248,113,113,0.55)",
          lineWidth: 1,
          lineStyle: LineStyle.LargeDashed,
          axisLabelVisible: true,
          title: `${wall.side === "bid" ? "BID" : "ASK"} ${formatCompactNumber(wall.notional)}`,
        }),
      );

      setStatus(`Live: ${activeSymbol} · ${nextWalls.length} сильних рівнів відстежуються`);
    }

    void loadMarket();

    return () => {
      cancelled = true;
      if (restBackupTimer) {
        window.clearInterval(restBackupTimer);
      }
      if (wallSyncTimer) {
        window.clearTimeout(wallSyncTimer);
      }
      if (bookTickerTimer) {
        window.clearTimeout(bookTickerTimer);
      }
      if (socket && socket.readyState < 2) {
        socket.close();
      }
    };
  }, [interval, largeTradeThreshold, marketType, symbol]);

  useEffect(() => {
    const candleSeries = candleSeriesRef.current;

    if (!candleSeries) {
      return;
    }

    zoneLinesRef.current.forEach((line) => candleSeries.removePriceLine(line));
    zoneLinesRef.current = weeklyZones.flatMap((zone) => {
      const color = getZoneColor(zone);
      const lower = candleSeries.createPriceLine({
        price: zone.priceFrom,
        color,
        lineWidth: zone.status === "active" ? 1 : 2,
        lineStyle: LineStyle.SparseDotted,
        axisLabelVisible: false,
        title: "",
      });
      const upper = candleSeries.createPriceLine({
        price: zone.priceTo,
        color,
        lineWidth: zone.status === "active" ? 1 : 2,
        lineStyle: LineStyle.SparseDotted,
        axisLabelVisible: true,
        title: `${zone.label} · ${getZoneStatusLabel(zone.status)}`,
      });

      return [lower, upper];
    });

    return () => {
      zoneLinesRef.current.forEach((line) => candleSeries.removePriceLine(line));
      zoneLinesRef.current = [];
    };
  }, [weeklyZones]);

  return (
    <section className="rounded-[2rem] border border-white/10 bg-white/[0.03] p-4 backdrop-blur-md sm:p-5">
      <div className="grid gap-4 2xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="rounded-[1.7rem] border border-white/10 bg-[#08101d]/82 p-4">
          <div className="grid gap-4 2xl:grid-cols-[minmax(0,14rem)_minmax(0,1fr)] 2xl:items-start">
            <div className="min-w-0 rounded-[1.3rem] border border-white/8 bg-black/10 p-4">
              <p className="text-[0.72rem] uppercase tracking-[0.28em] text-white/38">
                {marketType === "spot" ? "Binance Spot" : "Binance Futures"}
              </p>
              <h2 className="mt-3 text-2xl font-medium text-white">{symbol}</h2>
              <p className="mt-2 text-sm leading-7 text-white/58">
                Свічки, великі трейди та order walls в одному місці.
              </p>
            </div>

            <div className="rounded-[1.3rem] border border-white/8 bg-black/10 p-4">
              <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-12">
                <label className="grid min-w-0 gap-2 2xl:col-span-2">
                  <span className="block text-[0.64rem] uppercase tracking-[0.16em] whitespace-nowrap text-white/34">
                    Ринок
                  </span>
                  <select
                    value={marketType}
                    onChange={(event) => setMarketType(event.target.value as MarketType)}
                    className="h-11 w-full min-w-0 rounded-[1rem] border border-white/12 bg-[#0a1328]/95 px-4 text-sm text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] outline-none transition focus:border-white/20"
                  >
                    {marketOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="grid min-w-0 gap-2 2xl:col-span-4">
                  <span className="block text-[0.64rem] uppercase tracking-[0.16em] whitespace-nowrap text-white/34">
                    Актив
                  </span>
                  <select
                    value={symbol}
                    onChange={(event) => setSymbol(event.target.value)}
                    className="h-11 w-full min-w-0 rounded-[1rem] border border-white/12 bg-[#0a1328]/95 px-4 text-sm text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] outline-none transition focus:border-white/20"
                  >
                    {!activePresetSymbols.includes(symbol) ? (
                      <option value={symbol}>{symbol} · custom</option>
                    ) : null}
                    {activePresetSymbols.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="grid min-w-0 gap-2 2xl:col-span-3">
                  <span className="block text-[0.64rem] uppercase tracking-[0.16em] whitespace-nowrap text-white/34">
                    Таймфрейм
                  </span>
                  <select
                    value={interval}
                    onChange={(event) =>
                      setInterval(event.target.value as (typeof intervalOptions)[number])
                    }
                    className="h-11 w-full min-w-0 rounded-[1rem] border border-white/12 bg-[#0a1328]/95 px-4 text-sm text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] outline-none transition focus:border-white/20"
                  >
                    {intervalOptions.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="grid min-w-0 gap-2 2xl:col-span-3">
                  <span className="block text-[0.64rem] uppercase tracking-[0.16em] whitespace-nowrap text-white/34">
                    Поріг трейду
                  </span>
                  <select
                    value={largeTradeThreshold}
                    onChange={(event) =>
                      setLargeTradeThreshold(Number(event.target.value) as (typeof largeTradeThresholds)[number])
                    }
                    className="h-11 w-full min-w-0 rounded-[1rem] border border-white/12 bg-[#0a1328]/95 px-4 text-sm text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] outline-none transition focus:border-white/20"
                  >
                    {largeTradeThresholds.map((option) => (
                      <option key={option} value={option}>
                        ${formatCompactNumber(option)}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="grid gap-2 md:col-span-2 2xl:col-span-12">
                  <span className="block text-[0.64rem] uppercase tracking-[0.16em] whitespace-nowrap text-white/34">
                    Власна пара Binance {marketType === "spot" ? "Spot" : "Futures"}
                  </span>
                  <div className="flex flex-col gap-2 xl:flex-row">
                    <input
                      value={symbolInput}
                      onChange={(event) => setSymbolInput(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          event.preventDefault();
                          applySymbolInput();
                        }
                      }}
                      placeholder="Наприклад POPCATUSDT"
                      className="h-11 min-w-0 flex-1 rounded-[1rem] border border-white/12 bg-[#0a1328]/95 px-4 text-sm text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] outline-none transition placeholder:text-white/24 focus:border-white/20"
                    />
                    <button
                      type="button"
                      onClick={applySymbolInput}
                      className="h-11 shrink-0 rounded-[1rem] border border-white/12 bg-white/[0.05] px-4 text-sm font-medium text-white/82 transition hover:bg-white/[0.08] xl:min-w-[9rem]"
                    >
                      Застосувати
                    </button>
                  </div>
                  <p className="max-w-[52rem] text-xs leading-6 text-white/34">
                    Якщо потрібної монети немає в списку, введи свою пару вручну. Для мем-монет типу{" "}
                    <span className="text-white/60">POPCATUSDT</span>{" "}
                    переключайся на{" "}
                    <span className="text-white/60">Futures</span>, бо на Binance Spot ця пара недоступна.
                  </p>
                </label>
              </div>
            </div>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
            <div className="rounded-[1.2rem] border border-white/8 bg-black/10 px-4 py-3">
              <p className="text-[0.68rem] uppercase tracking-[0.22em] text-white/36">
                Ціна
              </p>
              <p className="mt-2 text-lg font-medium text-white">
                {currentPrice ? formatPrice(currentPrice) : "—"}
              </p>
            </div>
            <div className="rounded-[1.2rem] border border-white/8 bg-black/10 px-4 py-3">
              <p className="text-[0.68rem] uppercase tracking-[0.22em] text-white/36">
                Attention score
              </p>
              <p className="mt-2 text-lg font-medium text-white">{attentionScore}/100</p>
              <p className="mt-1 text-sm text-white/48">{describeAttention(attentionScore)}</p>
            </div>
            <div className="rounded-[1.2rem] border border-white/8 bg-black/10 px-4 py-3">
              <p className="text-[0.68rem] uppercase tracking-[0.22em] text-white/36">
                24h зміна
              </p>
              <p
                className={[
                  "mt-2 text-lg font-medium",
                  !dayStats
                    ? "text-white"
                    : dayStats.priceChangePercent >= 0
                      ? "text-emerald-300"
                      : "text-red-300",
                ].join(" ")}
              >
                {dayStats ? `${dayStats.priceChangePercent >= 0 ? "+" : ""}${dayStats.priceChangePercent.toFixed(2)}%` : "—"}
              </p>
              <p className="mt-1 text-sm text-white/48">
                {dayStats ? `Vol ${formatCompactNumber(dayStats.quoteVolume)} USDT` : "24h ticker"}
              </p>
            </div>
            <div className="rounded-[1.2rem] border border-white/8 bg-black/10 px-4 py-3">
              <p className="text-[0.68rem] uppercase tracking-[0.22em] text-white/36">
                Spread
              </p>
              <p className="mt-2 text-lg font-medium text-white">
                {spreadData ? formatPrice(spreadData.absolute) : "—"}
              </p>
              <p className="mt-1 text-sm text-white/48">
                {spreadData ? `${spreadData.percent.toFixed(3)}% між bid/ask` : "book ticker"}
              </p>
            </div>
            <div className="rounded-[1.2rem] border border-white/8 bg-black/10 px-4 py-3">
              <p className="text-[0.68rem] uppercase tracking-[0.22em] text-white/36">
                Тиск стакану
              </p>
              <p className="mt-2 text-lg font-medium text-white">{wallPressure.percent}%</p>
              <p className="mt-1 text-sm text-white/48">{wallPressure.label}</p>
            </div>
            <div className="rounded-[1.2rem] border border-white/8 bg-black/10 px-4 py-3">
              <p className="text-[0.68rem] uppercase tracking-[0.22em] text-white/36">
                Потік
              </p>
              <p className="mt-2 text-sm leading-6 text-white/68">
                {status}
              </p>
            </div>
          </div>

          {error ? (
            <div className="mt-4 rounded-[1.2rem] border border-red-300/14 bg-red-300/[0.08] px-4 py-3 text-sm text-red-50">
              {error}
            </div>
          ) : null}

          <div className="mt-5 overflow-hidden rounded-[1.6rem] border border-white/10 bg-[#050b16]">
            <div ref={chartContainerRef} className="h-[34rem] w-full 2xl:h-[38rem]" />
          </div>

          <p className="mt-4 text-xs leading-6 text-white/34">
            Графік побудований на Lightweight Charts від TradingView. Live-дані йдуть з Binance{" "}
            {marketType === "spot" ? "Spot" : "Futures"} WebSocket та REST snapshot, а weekly zones
            фіксуються окремим тижневим snapshot.
          </p>
        </div>

        <div className="space-y-4">
          <div className="rounded-[1.7rem] border border-white/10 bg-[#08101d]/82 p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[0.72rem] uppercase tracking-[0.24em] text-white/38">
                  Weekly zones
                </p>
                <h3 className="mt-2 text-lg font-medium text-white">Тижневі зони</h3>
                <p className="mt-1 text-sm leading-6 text-white/40">
                  Frozen-рівні на тиждень, які не рухаються щохвилини.
                </p>
              </div>
              <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[0.68rem] uppercase tracking-[0.22em] text-white/58">
                {weeklyZones.length}
              </span>
            </div>

            <div className="mt-4 rounded-[1.2rem] border border-white/8 bg-black/10 px-4 py-3">
              <p className="text-xs leading-6 text-white/46">{weeklyZonesStatus}</p>
              {weeklyZonesWeekKey ? (
                <p className="mt-2 text-[0.72rem] uppercase tracking-[0.18em] text-white/32">
                  {weeklyZonesWeekKey}
                  {weeklyZonesGeneratedAt
                    ? ` · snapshot ${new Date(weeklyZonesGeneratedAt).toLocaleDateString("uk-UA")}`
                    : ""}
                </p>
              ) : null}
            </div>

            <div className="mt-4 space-y-3">
              {weeklyZones.length ? (
                weeklyZones.map((zone) => (
                  <div
                    key={zone.id}
                    className="rounded-[1.2rem] border border-white/8 bg-black/10 px-4 py-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className="inline-flex h-2.5 w-2.5 rounded-full"
                            style={{ backgroundColor: getZoneColor(zone) }}
                          />
                          <span className="text-sm font-medium text-white">{zone.label}</span>
                        </div>
                        <p className="mt-2 text-xs leading-6 text-white/44">
                          {zone.zoneKind === "interest"
                            ? "Зона інтересу, де ринок уже реагував."
                            : zone.zoneKind === "zero_trend"
                              ? "Боковик або слабкий тренд без чіткого напрямку."
                              : "Тригерна зона для можливого імпульсного виходу."}
                        </p>
                      </div>
                      <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[0.64rem] uppercase tracking-[0.18em] text-white/64">
                        {getZoneStatusLabel(zone.status)}
                      </span>
                    </div>

                    <div className="mt-3 grid gap-2 sm:grid-cols-3">
                      <div>
                        <p className="text-[0.64rem] uppercase tracking-[0.18em] text-white/30">
                          Діапазон
                        </p>
                        <p className="mt-1 text-sm text-white/72">
                          {formatPrice(zone.priceFrom)} - {formatPrice(zone.priceTo)}
                        </p>
                      </div>
                      <div>
                        <p className="text-[0.64rem] uppercase tracking-[0.18em] text-white/30">
                          Distance
                        </p>
                        <p className="mt-1 text-sm text-white/72">
                          {formatDistancePercent(zone.distancePercent)}
                        </p>
                      </div>
                      <div>
                        <p className="text-[0.64rem] uppercase tracking-[0.18em] text-white/30">
                          Confidence
                        </p>
                        <p className="mt-1 text-sm text-white/72">{zone.confidence}/100</p>
                      </div>
                    </div>
                  </div>
                ))
              ) : weeklyZonesError ? (
                <div className="rounded-[1.2rem] border border-red-300/14 bg-red-300/[0.08] px-4 py-6 text-sm leading-7 text-red-50/88">
                  {weeklyZonesError}
                </div>
              ) : (
                <div className="rounded-[1.2rem] border border-dashed border-white/10 bg-black/10 px-4 py-6 text-sm leading-7 text-white/38">
                  Після побудови тижневого snapshot тут з’являться frozen zones зі статусами.
                </div>
              )}
            </div>
          </div>

          <div className="rounded-[1.7rem] border border-white/10 bg-[#08101d]/82 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[0.72rem] uppercase tracking-[0.24em] text-white/38">
                  Large trades
                </p>
                <h3 className="mt-2 text-lg font-medium text-white">Великі виконані угоди</h3>
              </div>
              <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[0.68rem] uppercase tracking-[0.22em] text-white/58">
                {largeTrades.length}
              </span>
            </div>

            <div className="mt-4 space-y-3">
              {largeTrades.length ? (
                largeTrades.map((trade) => (
                  <div
                    key={trade.id}
                    className={[
                      "rounded-[1.2rem] border px-4 py-3",
                      trade.side === "buy"
                        ? "border-emerald-300/12 bg-emerald-300/[0.08]"
                        : "border-red-300/12 bg-red-300/[0.08]",
                    ].join(" ")}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span
                        className={[
                          "rounded-full border px-2.5 py-1 text-[0.64rem] uppercase tracking-[0.22em]",
                          trade.side === "buy"
                            ? "border-emerald-300/18 bg-emerald-300/12 text-emerald-50"
                            : "border-red-300/18 bg-red-300/12 text-red-50",
                        ].join(" ")}
                      >
                        {trade.side === "buy" ? "BUY" : "SELL"}
                      </span>
                      <span className="text-sm font-medium text-white">
                        ${formatCompactNumber(trade.notional)}
                      </span>
                    </div>
                    <div className="mt-3 flex items-center justify-between gap-3 text-sm text-white/56">
                      <span>{formatPrice(trade.price)}</span>
                      <span>{formatCompactNumber(trade.quantity)}</span>
                      <span>{formatTime(trade.time)}</span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-[1.2rem] border border-dashed border-white/10 bg-black/10 px-4 py-6 text-sm leading-7 text-white/38">
                  Щойно в стрім зайдуть великі угоди вище порогу, вони з’являться тут і відмітяться на графіку стрілками.
                </div>
              )}
            </div>
          </div>

          <div className="rounded-[1.7rem] border border-white/10 bg-[#08101d]/82 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[0.72rem] uppercase tracking-[0.24em] text-white/38">
                  Order walls
                </p>
                <h3 className="mt-2 text-lg font-medium text-white">Сильні рівні в стакані</h3>
              </div>
              <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[0.68rem] uppercase tracking-[0.22em] text-white/58">
                {walls.length}
              </span>
            </div>

            <div className="mt-4 space-y-3">
              {walls.length ? (
                walls.map((wall) => (
                  <div
                    key={`${wall.side}-${wall.price}`}
                    className={[
                      "rounded-[1.2rem] border px-4 py-3",
                      wall.side === "bid"
                        ? "border-emerald-300/12 bg-emerald-300/[0.08]"
                        : "border-red-300/12 bg-red-300/[0.08]",
                    ].join(" ")}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span
                        className={[
                          "rounded-full border px-2.5 py-1 text-[0.64rem] uppercase tracking-[0.22em]",
                          wall.side === "bid"
                            ? "border-emerald-300/18 bg-emerald-300/12 text-emerald-50"
                            : "border-red-300/18 bg-red-300/12 text-red-50",
                        ].join(" ")}
                      >
                        {wall.side === "bid" ? "BID wall" : "ASK wall"}
                      </span>
                      <span className="text-sm font-medium text-white">
                        ${formatCompactNumber(wall.notional)}
                      </span>
                    </div>
                    <div className="mt-3 flex items-center justify-between gap-3 text-sm text-white/56">
                      <span>{formatPrice(wall.price)}</span>
                      <span>{formatCompactNumber(wall.quantity)}</span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-[1.2rem] border border-dashed border-white/10 bg-black/10 px-4 py-6 text-sm leading-7 text-white/38">
                  Після старту локального стакану тут з’являться найбільші стіни bid/ask, які можуть впливати на ціну.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="mt-4 rounded-[1.3rem] border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-white/58">
          Завантажую стартові свічки і стакан...
        </div>
      ) : null}
    </section>
  );
}
