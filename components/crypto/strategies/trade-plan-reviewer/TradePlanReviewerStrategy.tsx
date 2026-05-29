"use client";

import { useMemo, useState } from "react";
import { ChecklistPanel } from "./components/ChecklistPanel";
import { ReviewResultPanel } from "./components/ReviewResultPanel";
import { RiskSummary } from "./components/RiskSummary";
import { StrategyHeader } from "./components/StrategyHeader";
import { TradePlanForm } from "./components/TradePlanForm";
import { initialTradePlan } from "./constants";
import { reviewTradePlan } from "./reviewTradePlan";
import type { TradePlan } from "./types";

export function TradePlanReviewerStrategy() {
  // Тут живе тільки стан форми. Самі правила оцінки винесені в reviewTradePlan.ts.
  const [plan, setPlan] = useState<TradePlan>(initialTradePlan);

  // Review перераховується щоразу, коли ти змінюєш будь-яке поле плану.
  const review = useMemo(() => reviewTradePlan(plan), [plan]);

  function updatePlan(patch: Partial<TradePlan>) {
    setPlan((currentPlan) => ({
      ...currentPlan,
      ...patch,
    }));
  }

  return (
    <>
      <StrategyHeader />

      <TradePlanForm plan={plan} onChange={updatePlan} />

      <ReviewResultPanel review={review} />

      <RiskSummary metrics={review.metrics} />

      <ChecklistPanel items={review.checklist} />
    </>
  );
}
