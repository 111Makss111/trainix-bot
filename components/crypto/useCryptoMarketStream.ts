"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Candle } from "@/lib/crypto-zone-engine";
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
} from "lightweight-charts";
import {
  bookTickerThrottleMs,
  getRestBase,
  klineHistoryLimit,
  maxTradeMarkers,
  restBackupRefreshMs,
  staleStreamMs,
  visibleBarsByInterval,
  wallSyncThrottleMs,
} from "./config";
import { formatCompactNumber, getSeriesPriceFormat } from "./format";
import {
  buildAttentionScore,
  getSpreadData,
  getWallPressure,
} from "./market-calculations";
import { toChartTime } from "./market-data";
import {
  getZoneColor,
  getZoneStatusLabel,
} from "./weekly-zones";
import type {
  BinanceRestKline,
  CryptoInterval,
  DayTickerStats,
  LargeTrade,
  LargeTradeThreshold,
  MarketType,
  OrderWall,
  TopBook,
} from "./types";

type UseCryptoMarketStreamInput = {
  marketType: MarketType;
  symbol: string;
  interval: CryptoInterval;
  largeTradeThreshold: LargeTradeThreshold;
  weeklyZones: CryptoWeeklyZone[];
};

export function useCryptoMarketStream({
  marketType,
  symbol,
  interval,
  largeTradeThreshold,
  weeklyZones,
}: UseCryptoMarketStreamInput) {
  const [isLoading, setIsLoading] = useState(true);
  const [status, setStatus] = useState("Підключаю ринок...");
  const [error, setError] = useState<string | null>(null);
  const [currentPrice, setCurrentPrice] = useState<number | null>(null);
  const [dayStats, setDayStats] = useState<DayTickerStats | null>(null);
  const [topBook, setTopBook] = useState<TopBook>({ bid: null, ask: null });
  const [largeTrades, setLargeTrades] = useState<LargeTrade[]>([]);
  const [walls, setWalls] = useState<OrderWall[]>([]);

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
  const spreadData = useMemo(() => getSpreadData(topBook), [topBook]);
  const wallPressure = useMemo(() => getWallPressure(walls), [walls]);

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
      wallLinesRef.current.forEach((line) =>
        candleSeries.removePriceLine(line),
      );
      wallLinesRef.current = [];
      zoneLinesRef.current.forEach((line) =>
        candleSeries.removePriceLine(line),
      );
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
          fetch(
            `${restBase}/klines?symbol=${symbol}&interval=${interval}&limit=2`,
            {
              cache: "no-store",
            },
          ),
          fetch(`${restBase}/ticker/bookTicker?symbol=${symbol}`, {
            cache: "no-store",
          }),
        ]);

        if (!latestKlinesResponse.ok || !bookTickerResponse.ok) {
          throw new Error("REST backup не отримав актуальні дані.");
        }

        const latestKlines =
          (await latestKlinesResponse.json()) as BinanceRestKline[];
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
      wallLinesRef.current.forEach((line) =>
        candleSeriesInstance.removePriceLine(line),
      );
      wallLinesRef.current = [];

      try {
        const [
          klinesResponse,
          depthResponse,
          tickerResponse,
          bookTickerResponse,
        ] = await Promise.all([
          fetch(
            `${restBase}/klines?symbol=${symbol}&interval=${interval}&limit=${klineHistoryLimit}`,
            { cache: "no-store" },
          ),
          fetch(`${restBase}/depth?symbol=${symbol}&limit=100`, {
            cache: "no-store",
          }),
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
            setStatus(
              "Live-потік дав збій. Вмикаю REST backup для останньої ціни.",
            );
          }
        };

        socket.onclose = () => {
          if (!cancelled) {
            setStatus(
              "Live-потік відключився. Тримаю графік через REST backup.",
            );
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

    function syncWalls(
      series: ISeriesApi<"Candlestick">,
      activeSymbol: string,
    ) {
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
          color:
            wall.side === "bid"
              ? "rgba(34,197,94,0.55)"
              : "rgba(248,113,113,0.55)",
          lineWidth: 1,
          lineStyle: LineStyle.LargeDashed,
          axisLabelVisible: true,
          title: `${wall.side === "bid" ? "BID" : "ASK"} ${formatCompactNumber(wall.notional)}`,
        }),
      );

      setStatus(
        `Live: ${activeSymbol} · ${nextWalls.length} сильних рівнів відстежуються`,
      );
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
      zoneLinesRef.current.forEach((line) =>
        candleSeries.removePriceLine(line),
      );
      zoneLinesRef.current = [];
    };
  }, [weeklyZones]);

  return {
    chartContainerRef,
    isLoading,
    status,
    error,
    currentPrice,
    dayStats,
    topBook,
    largeTrades,
    walls,
    attentionScore,
    spreadData,
    wallPressure,
  };
}
