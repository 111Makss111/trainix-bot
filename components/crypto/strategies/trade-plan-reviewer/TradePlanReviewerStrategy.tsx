"use client";

import { useEffect, useMemo, useState } from "react";
import { CompactHeader } from "./components/CompactHeader";
import { DecisionPanel } from "./components/DecisionPanel";
import { DirectionPriorityPanel } from "./components/DirectionPriorityPanel";
import { MarketSnapshotPanel } from "./components/MarketSnapshotPanel";
import { QuickTradeForm } from "./components/QuickTradeForm";
import { RiskSummary } from "./components/RiskSummary";
import { SignalPanel } from "./components/SignalPanel";
import { TradeLevelsPanel } from "./components/TradeLevelsPanel";
import { initialTradePlan } from "./constants";
import { getDirectionPriority } from "./directionPriority";
import { getFallbackMarketSnapshot } from "./marketSnapshot";
import { reviewTradePlan } from "./reviewTradePlan";
import type { MarketSnapshot, TradeDirection, TradePlan } from "./types";

export function TradePlanReviewerStrategy() {
  // Тут живе тільки стан форми. Самі правила оцінки винесені в reviewTradePlan.ts.
  const [plan, setPlan] = useState<TradePlan>(initialTradePlan);
  const [market, setMarket] = useState<MarketSnapshot>(() =>
    getFallbackMarketSnapshot(initialTradePlan.symbol, initialTradePlan.timeframe),
  );
  const [isMarketLoading, setIsMarketLoading] = useState(true);
  const [marketError, setMarketError] = useState<string | null>(null);

  // Review вже спирається не на твої пояснення, а на market snapshot + рівні угоди.
  const review = useMemo(() => reviewTradePlan(plan, market), [plan, market]);
  const directionPriority = useMemo(
    () => getDirectionPriority(plan, market),
    [plan, market],
  );

  useEffect(() => {
    const controller = new AbortController();
    const normalizedSymbol = plan.symbol.trim().toUpperCase();

    if (!/^[A-Z0-9]{5,20}$/.test(normalizedSymbol)) {
      setMarket(getFallbackMarketSnapshot(normalizedSymbol, plan.timeframe));
      setIsMarketLoading(false);
      setMarketError("Введи символ у форматі BTCUSDT.");
      return () => controller.abort();
    }

    setIsMarketLoading(true);
    setMarketError(null);

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
        };

        if (!response.ok || !payload.market) {
          throw new Error(payload.error ?? "Market data unavailable.");
        }

        setMarket(payload.market);
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
  }, [plan.symbol, plan.timeframe]);

  function updatePlan(patch: Partial<TradePlan>) {
    setPlan((currentPlan) => ({
      ...currentPlan,
      ...patch,
    }));
  }

  function useAutoDirection(direction: TradeDirection) {
    setPlan((currentPlan) => ({
      ...currentPlan,
      direction,
      entryPrice: "",
      stopLoss: "",
      takeProfit: "",
    }));
  }

  return (
    <>
      <CompactHeader />

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_24rem]">
        <QuickTradeForm plan={plan} onChange={updatePlan} />
        <DecisionPanel review={review} />
      </div>

      <RiskSummary metrics={review.metrics} />

      <DirectionPriorityPanel
        priority={directionPriority}
        onUseDirection={useAutoDirection}
      />

      <TradeLevelsPanel levels={review.levels} direction={plan.direction} />

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(26rem,0.8fr)]">
        <MarketSnapshotPanel
          market={market}
          isLoading={isMarketLoading}
          error={marketError}
        />

        <SignalPanel signals={review.signals} />
      </div>
    </>
  );
}
