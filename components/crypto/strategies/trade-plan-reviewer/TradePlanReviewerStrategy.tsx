"use client";

import { useMemo, useState } from "react";
import { ChecklistPanel } from "./components/ChecklistPanel";
import { CollapsibleSection } from "./components/CollapsibleSection";
import { CompactHeader } from "./components/CompactHeader";
import { DecisionPanel } from "./components/DecisionPanel";
import { HiddenPlanDetails } from "./components/HiddenPlanDetails";
import { QuickTradeForm } from "./components/QuickTradeForm";
import { RiskSummary } from "./components/RiskSummary";
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
      <CompactHeader />

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_24rem]">
        <QuickTradeForm plan={plan} onChange={updatePlan} />
        <DecisionPanel review={review} />
      </div>

      <RiskSummary metrics={review.metrics} />

      <CollapsibleSection title="Деталі плану" badge="приховано">
        <HiddenPlanDetails plan={plan} onChange={updatePlan} />
      </CollapsibleSection>

      <CollapsibleSection title="Правила перевірки" badge={`${review.warnings.length} правок`}>
        <ChecklistPanel items={review.checklist} />
      </CollapsibleSection>
    </>
  );
}
