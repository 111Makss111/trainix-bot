"use client";

import { useEffect, useMemo, useState } from "react";
import { CompactHeader } from "./components/CompactHeader";
import { DirectionPriorityPanel } from "./components/DirectionPriorityPanel";
import { MarketSnapshotPanel } from "./components/MarketSnapshotPanel";
import { MarketControls } from "./components/MarketControls";
import { SignalPanel } from "./components/SignalPanel";
import { TradeLevelsPanel } from "./components/TradeLevelsPanel";
import { initialTradePlan } from "./constants";
import { getDirectionPriority } from "./directionPriority";
import { getFallbackMarketSnapshot } from "./marketSnapshot";
import type { MarketDataDiagnostic, MarketSnapshot, TradePlan } from "./types";

const savedMarketControlsKey = "trainix.tradePlanReviewer.marketControls";
const autoRefreshMs = 30_000;

function getSavedMarketControls() {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const savedValue = window.localStorage.getItem(savedMarketControlsKey);

    if (!savedValue) {
      return null;
    }

    const parsedValue = JSON.parse(savedValue) as Partial<TradePlan>;

    return {
      symbol:
        typeof parsedValue.symbol === "string"
          ? parsedValue.symbol.trim().toUpperCase()
          : "",
      timeframe: parsedValue.timeframe,
    };
  } catch {
    return null;
  }
}

export function TradePlanReviewerStrategy() {
  // Тут живе тільки стан форми. Самі правила оцінки винесені в reviewTradePlan.ts.
  const [plan, setPlan] = useState<TradePlan>(initialTradePlan);
  const [market, setMarket] = useState<MarketSnapshot>(() =>
    getFallbackMarketSnapshot(initialTradePlan.symbol, initialTradePlan.timeframe),
  );
  const [isMarketLoading, setIsMarketLoading] = useState(true);
  const [marketError, setMarketError] = useState<string | null>(null);
  const [marketDiagnostics, setMarketDiagnostics] = useState<
    MarketDataDiagnostic[]
  >([]);
  const [refreshNonce, setRefreshNonce] = useState(0);
  const [hasLoadedSavedControls, setHasLoadedSavedControls] = useState(false);

  const directionPriority = useMemo(
    () => getDirectionPriority(plan, market),
    [plan, market],
  );
  const activeCandidate =
    directionPriority.candidates.find(
      (candidate) => candidate.direction === directionPriority.preferredDirection,
    ) ?? directionPriority.candidates[0];
  const activeLevelsHeading =
    directionPriority.preferredDirection === "wait"
      ? `Найближчий варіант: ${activeCandidate.label}`
      : `Авто ${activeCandidate.label}`;
  const hasMarketData = market.source !== "fallback" && market.candleCount > 0;

  useEffect(() => {
    const savedControls = getSavedMarketControls();

    if (savedControls?.symbol) {
      setPlan((currentPlan) => ({
        ...currentPlan,
        symbol: savedControls.symbol,
        timeframe: savedControls.timeframe ?? currentPlan.timeframe,
      }));
    }

    setHasLoadedSavedControls(true);
  }, []);

  useEffect(() => {
    if (!hasLoadedSavedControls) {
      return;
    }

    window.localStorage.setItem(
      savedMarketControlsKey,
      JSON.stringify({
        symbol: plan.symbol,
        timeframe: plan.timeframe,
      }),
    );
  }, [hasLoadedSavedControls, plan.symbol, plan.timeframe]);

  useEffect(() => {
    const controller = new AbortController();
    const normalizedSymbol = plan.symbol.trim().toUpperCase();

    if (!/^[A-Z0-9]{5,20}$/.test(normalizedSymbol)) {
      setMarket(getFallbackMarketSnapshot(normalizedSymbol, plan.timeframe));
      setMarketDiagnostics([]);
      setIsMarketLoading(false);
      setMarketError("Введи символ у форматі BTCUSDT.");
      return () => controller.abort();
    }

    setIsMarketLoading(true);
    setMarketError(null);
    setMarketDiagnostics([]);

    const timeoutId = window.setTimeout(async () => {
      try {
        const params = new URLSearchParams({
          symbol: normalizedSymbol,
          timeframe: plan.timeframe,
        });
        const response = await fetch(`/api/crypto/market-snapshot?${params}`, {
          signal: controller.signal,
        });
        const payload = (await response.json()) as {
          market?: MarketSnapshot;
          error?: string;
          detail?: string;
          diagnostics?: MarketDataDiagnostic[];
        };

        if (!response.ok || !payload.market) {
          setMarketDiagnostics(payload.diagnostics ?? []);
          throw new Error(
            payload.detail
              ? `${payload.error ?? "Market data unavailable."} Деталі: ${payload.detail}`
              : payload.error ?? "Market data unavailable.",
          );
        }

        setMarket(payload.market);
        setMarketDiagnostics(payload.diagnostics ?? []);
        setMarketError(null);
      } catch (error) {
        if (controller.signal.aborted) {
          return;
        }

        const message =
          error instanceof Error ? error.message : "Market data unavailable.";

        setMarket(getFallbackMarketSnapshot(normalizedSymbol, plan.timeframe));
        setMarketError(message);
      } finally {
        if (!controller.signal.aborted) {
          setIsMarketLoading(false);
        }
      }
    }, 350);

    return () => {
      window.clearTimeout(timeoutId);
      controller.abort();
    };
  }, [plan.symbol, plan.timeframe, refreshNonce]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setRefreshNonce((currentNonce) => currentNonce + 1);
    }, autoRefreshMs);

    return () => window.clearInterval(intervalId);
  }, []);

  function updateMarketControls(
    patch: Pick<Partial<TradePlan>, "symbol" | "timeframe">,
  ) {
    setPlan((currentPlan) => ({
      ...currentPlan,
      ...patch,
    }));
  }

  return (
    <>
      <CompactHeader />

      <MarketControls
        symbol={plan.symbol}
        timeframe={plan.timeframe}
        isLoading={isMarketLoading}
        onChange={updateMarketControls}
        onRefresh={() => setRefreshNonce((currentNonce) => currentNonce + 1)}
      />

      {hasMarketData ? (
        <>
          <DirectionPriorityPanel priority={directionPriority} />

          <TradeLevelsPanel
            levels={activeCandidate.review.levels}
            direction={activeCandidate.direction}
            heading={activeLevelsHeading}
          />
        </>
      ) : (
        <section className="rounded-[1.5rem] border border-amber-300/18 bg-amber-300/8 p-5 text-amber-100">
          <p className="text-[0.68rem] uppercase tracking-[0.28em] opacity-70">
            Дані не завантажені
          </p>
          <h2 className="mt-2 text-xl font-semibold text-white">
            Рівні не будуються без реальної ціни
          </h2>
          <p className="mt-2 text-sm leading-6 text-amber-100/78">
            Система не буде показувати резервні числа як торговий сигнал.
            Перевір підключення або спробуй інший актив/таймфрейм.
          </p>
        </section>
      )}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(26rem,0.8fr)]">
        <MarketSnapshotPanel
          market={market}
          isLoading={isMarketLoading}
          error={marketError}
          diagnostics={marketDiagnostics}
        />

        {hasMarketData ? <SignalPanel signals={activeCandidate.review.signals} /> : null}
      </div>
    </>
  );
}
