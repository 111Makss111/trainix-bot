"use client";

import { useState } from "react";
import { formatTradingViewPrice } from "../formatters";
import type { ReviewLevels, TradeDirection } from "../types";

type TradeLevelsPanelProps = {
  levels: ReviewLevels;
  direction: TradeDirection;
  heading?: string;
};

export function TradeLevelsPanel({
  levels,
  direction,
  heading,
}: TradeLevelsPanelProps) {
  const [copiedValue, setCopiedValue] = useState<string | null>(null);
  const rewardToRisk = levels.rewardToRisk;
  const isWeakPotential = rewardToRisk !== null && rewardToRisk < 1.2;
  const isMediumPotential = rewardToRisk !== null && rewardToRisk < 2;
  const isWaitingEntry = levels.entryMode === "limit";
  const isStopTooClose =
    levels.stopAtrMultiple !== null && levels.stopAtrMultiple < 0.7;
  const isTargetTooClose =
    levels.targetAtrMultiple !== null && levels.targetAtrMultiple < 1;
  const isTargetThin =
    levels.targetAtrMultiple !== null && levels.targetAtrMultiple < 1.5;
  const isStopTooWide =
    levels.stopAtrMultiple !== null && levels.stopAtrMultiple > 3;
  const levelStatus = isStopTooClose || isTargetTooClose || isWeakPotential
    ? "danger"
    : isWaitingEntry || isStopTooWide || isTargetThin || isMediumPotential
      ? "warning"
      : "ready";
  const statusLabel =
    levelStatus === "ready"
      ? "рівні готові"
      : isStopTooClose
        ? "стоп близько"
        : isTargetTooClose
          ? "ціль близько"
          : isWeakPotential
            ? "слабкий R/R"
            : isStopTooWide
              ? "широкий стоп"
              : isWaitingEntry
                ? "чекати вхід"
                : isTargetThin
                  ? "ціль слабка"
                  : "R/R середній";
  const entryDirectionText =
    direction === "long" ? "нижче поточної" : "вище поточної";
  const entryAtrDetail =
    levels.entryDistanceFromMarketAtr === null
      ? ""
      : ` · ${levels.entryDistanceFromMarketAtr.toFixed(1)} ATR`;
  const entryDetail =
    levels.entryMode === "market"
      ? "market-вхід"
      : levels.entryMode === "custom"
        ? "ручний вхід"
        : `очікуваний вхід · ${entryDirectionText} на ${levels.entryDistanceFromMarketPercent.toFixed(2)}%${entryAtrDetail}`;
  const stopAtrDetail =
    levels.stopAtrMultiple === null
      ? ""
      : ` · ${levels.stopAtrMultiple.toFixed(1)} ATR`;
  const targetAtrDetail =
    levels.targetAtrMultiple === null
      ? ""
      : ` · ${levels.targetAtrMultiple.toFixed(1)} ATR`;
  const rows = [
    {
      label: "Вхід",
      value: formatTradingViewPrice(levels.entryPrice),
      detail: entryDetail,
    },
    {
      label: "Стоп",
      value: formatTradingViewPrice(levels.stopLoss),
      detail: `${levels.riskDistancePercent.toFixed(2)}% від входу${stopAtrDetail}`,
    },
    {
      label: "Ціль",
      value: formatTradingViewPrice(levels.takeProfit),
      detail: `${levels.rewardDistancePercent.toFixed(2)}% від входу${targetAtrDetail}`,
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
            {heading ?? (direction === "long" ? "Авто Long" : "Авто Short")}
          </h2>
        </div>
        <span
          className={[
            "rounded-full border px-3 py-1.5 text-sm",
            levelStatus === "ready"
              ? "border-emerald-300/18 bg-emerald-300/8 text-emerald-100"
              : levelStatus === "warning"
                ? "border-amber-300/18 bg-amber-300/8 text-amber-100"
                : "border-rose-300/22 bg-rose-300/8 text-rose-100",
          ].join(" ")}
        >
          {statusLabel}
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

      {levelStatus !== "ready" ? (
        <p className="mt-4 rounded-[1rem] border border-rose-300/18 bg-rose-300/8 px-3 py-2 text-sm leading-5 text-rose-100">
          {isStopTooClose
            ? "Стоп занадто близько до входу відносно ATR. Такий рівень може вибити звичайним шумом."
            : isTargetTooClose
              ? "Ціль занадто близько відносно ATR. Рух може бути меншим за нормальний шум активу."
              : isWeakPotential
                ? "Потенціал менший за ризик. Для якіснішого входу треба ближчий стоп, дальша ціль або вхід ближче до підтримки."
                : isStopTooWide
                  ? "Стоп занадто широкий відносно ATR. Рівень може бути логічним, але ризик уже важкий."
                  : isWaitingEntry
                    ? "Ціна ще не в зоні входу. Система показує очікуваний вхід, а не угоду по поточній ціні."
                    : isTargetThin
                      ? "Ціль ще слабка відносно ATR. Для волатильної монети потрібен більший простір до цілі."
                      : "R/R нижче 2. Рівні вже не провальні, але запас по потенціалу ще середній."}
        </p>
      ) : null}
    </section>
  );
}
