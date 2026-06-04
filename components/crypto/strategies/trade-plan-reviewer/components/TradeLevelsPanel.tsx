"use client";

import { useState } from "react";
import { formatTradingViewPrice } from "../formatters";
import type { ReviewLevels, TradeDirection } from "../types";

type TradeLevelsPanelProps = {
  levels: ReviewLevels;
  direction: TradeDirection;
};

export function TradeLevelsPanel({ levels, direction }: TradeLevelsPanelProps) {
  const [copiedValue, setCopiedValue] = useState<string | null>(null);
  const rewardToRisk = levels.rewardToRisk;
  const isWeakPotential = rewardToRisk !== null && rewardToRisk < 1.2;
  const rows = [
    {
      label: "Вхід",
      value: formatTradingViewPrice(levels.entryPrice),
      detail: "ціна входу",
    },
    {
      label: "Стоп",
      value: formatTradingViewPrice(levels.stopLoss),
      detail: `${levels.riskDistancePercent.toFixed(2)}% від входу`,
    },
    {
      label: "Ціль",
      value: formatTradingViewPrice(levels.takeProfit),
      detail: `${levels.rewardDistancePercent.toFixed(2)}% від входу`,
    },
    {
      label: "R/R",
      value: rewardToRisk === null ? "авто" : `${rewardToRisk.toFixed(2)}R`,
      detail: "потенціал до ризику",
    },
  ];

  async function copyValue(value: string) {
    if (!navigator.clipboard) {
      return;
    }

    await navigator.clipboard.writeText(value);
    setCopiedValue(value);
    window.setTimeout(() => setCopiedValue(null), 1200);
  }

  return (
    <section className="rounded-[1.5rem] border border-white/10 bg-white/[0.03] p-5 backdrop-blur-md">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[0.68rem] uppercase tracking-[0.28em] text-white/34">
            Рівні для TradingView
          </p>
          <h2 className="mt-2 text-xl font-medium text-white">
            {direction === "long" ? "Вибраний Long" : "Вибраний Short"}
          </h2>
        </div>
        <span
          className={[
            "rounded-full border px-3 py-1.5 text-sm",
            isWeakPotential
              ? "border-rose-300/22 bg-rose-300/8 text-rose-100"
              : "border-emerald-300/18 bg-emerald-300/8 text-emerald-100",
          ].join(" ")}
        >
          {isWeakPotential ? "слабкий R/R" : "рівні готові"}
        </span>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {rows.map((row) => (
          <div
            key={row.label}
            className="rounded-[1.1rem] border border-white/10 bg-black/12 px-4 py-3"
          >
            <p className="text-[0.62rem] uppercase tracking-[0.22em] text-white/36">
              {row.label}
            </p>
            <div className="mt-2 flex items-center justify-between gap-3">
              <p className="font-mono text-xl font-semibold text-white">
                {row.value}
              </p>
              <button
                type="button"
                onClick={() => copyValue(row.value)}
                className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs text-white/64 transition hover:border-white/22 hover:bg-white/[0.08] hover:text-white"
              >
                {copiedValue === row.value ? "скопійовано" : "копія"}
              </button>
            </div>
            <p className="mt-1 text-xs text-white/44">{row.detail}</p>
          </div>
        ))}
      </div>

      {isWeakPotential ? (
        <p className="mt-4 rounded-[1rem] border border-rose-300/18 bg-rose-300/8 px-3 py-2 text-sm leading-5 text-rose-100">
          Потенціал менший за ризик. Для якіснішого входу треба ближчий стоп,
          дальша ціль або вхід ближче до підтримки.
        </p>
      ) : null}
    </section>
  );
}
