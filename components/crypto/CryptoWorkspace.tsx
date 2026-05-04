"use client";

import { useEffect, useMemo, useState } from "react";
import { CryptoSidePanels } from "./CryptoSidePanels";
import { CryptoStatsGrid } from "./CryptoStatsGrid";
import { CryptoWeeklyZonesBrief } from "./CryptoWeeklyZonesBrief";
import {
  futuresPresetSymbols,
  intervalOptions,
  largeTradeThresholds,
  marketOptions,
  spotPresetSymbols,
} from "./config";
import { formatCompactNumber } from "./format";
import { describeAttention } from "./market-calculations";
import { useCryptoMarketStream } from "./useCryptoMarketStream";
import { useCryptoWeeklyZones } from "./useCryptoWeeklyZones";
import type {
  CryptoInterval,
  LargeTradeThreshold,
  MarketType,
} from "./types";

export function CryptoWorkspace() {
  const [marketType, setMarketType] = useState<MarketType>("spot");
  const [symbol, setSymbol] = useState("BTCUSDT");
  const [symbolInput, setSymbolInput] = useState("BTCUSDT");
  const [interval, setInterval] = useState<CryptoInterval>("5m");
  const [largeTradeThreshold, setLargeTradeThreshold] =
    useState<LargeTradeThreshold>(100000);

  const activePresetSymbols = useMemo<readonly string[]>(
    () => (marketType === "spot" ? spotPresetSymbols : futuresPresetSymbols),
    [marketType],
  );

  const weeklyZonesState = useCryptoWeeklyZones(marketType, symbol);
  const {
    chartContainerRef,
    isLoading,
    status,
    error,
    currentPrice,
    dayStats,
    largeTrades,
    walls,
    attentionScore,
    spreadData,
    wallPressure,
  } = useCryptoMarketStream({
    marketType,
    symbol,
    interval,
    largeTradeThreshold,
    weeklyZones: weeklyZonesState.weeklyZones,
  });

  useEffect(() => {
    setSymbolInput(symbol);
  }, [symbol]);

  function applySymbolInput() {
    const normalized = symbolInput
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "");

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

  return (
    <div className="space-y-4">
      <CryptoWeeklyZonesBrief
        marketType={marketType}
        symbol={symbol}
        weeklyZones={weeklyZonesState.weeklyZones}
        weeklyZonesWeekKey={weeklyZonesState.weeklyZonesWeekKey}
        weeklyZonesGeneratedAt={weeklyZonesState.weeklyZonesGeneratedAt}
        weeklyZonesStatus={weeklyZonesState.weeklyZonesStatus}
        weeklyZonesError={weeklyZonesState.weeklyZonesError}
      />

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
                    onChange={(event) =>
                      setMarketType(event.target.value as MarketType)
                    }
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
                      setInterval(event.target.value as CryptoInterval)
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
                      setLargeTradeThreshold(
                        Number(event.target.value) as LargeTradeThreshold,
                      )
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
                    Власна пара Binance{" "}
                    {marketType === "spot" ? "Spot" : "Futures"}
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
                    Якщо потрібної монети немає в списку, введи свою пару
                    вручну. Для мем-монет типу{" "}
                    <span className="text-white/60">POPCATUSDT</span>{" "}
                    переключайся на{" "}
                    <span className="text-white/60">Futures</span>, бо на
                    Binance Spot ця пара недоступна.
                  </p>
                </label>
              </div>
            </div>
          </div>

          <CryptoStatsGrid
            currentPrice={currentPrice}
            attentionScore={attentionScore}
            attentionLabel={describeAttention(attentionScore)}
            dayStats={dayStats}
            spreadData={spreadData}
            wallPressure={wallPressure}
            status={status}
          />

          {error ? (
            <div className="mt-4 rounded-[1.2rem] border border-red-300/14 bg-red-300/[0.08] px-4 py-3 text-sm text-red-50">
              {error}
            </div>
          ) : null}

          <div className="mt-5 overflow-hidden rounded-[1.6rem] border border-white/10 bg-[#050b16]">
            <div
              ref={chartContainerRef}
              className="h-[34rem] w-full 2xl:h-[38rem]"
            />
          </div>

          <p className="mt-4 text-xs leading-6 text-white/34">
            Графік побудований на Lightweight Charts від TradingView. Live-дані
            йдуть з Binance {marketType === "spot" ? "Spot" : "Futures"}{" "}
            WebSocket та REST snapshot, а weekly zones фіксуються окремим
            тижневим snapshot.
          </p>
          </div>

          <CryptoSidePanels largeTrades={largeTrades} walls={walls} />
        </div>

        {isLoading ? (
          <div className="mt-4 rounded-[1.3rem] border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-white/58">
            Завантажую стартові свічки і стакан...
          </div>
        ) : null}
      </section>
    </div>
  );
}
