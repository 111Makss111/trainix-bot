import type { DayTickerStats } from "./types";
import { formatCompactNumber, formatPrice } from "./format";

type CryptoStatsGridProps = {
  currentPrice: number | null;
  attentionScore: number;
  attentionLabel: string;
  dayStats: DayTickerStats | null;
  spreadData: { absolute: number; percent: number } | null;
  wallPressure: { label: string; percent: number };
  status: string;
};

export function CryptoStatsGrid({
  currentPrice,
  attentionScore,
  attentionLabel,
  dayStats,
  spreadData,
  wallPressure,
  status,
}: CryptoStatsGridProps) {
  return (
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
        <p className="mt-2 text-lg font-medium text-white">
          {attentionScore}/100
        </p>
        <p className="mt-1 text-sm text-white/48">{attentionLabel}</p>
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
          {dayStats
            ? `${dayStats.priceChangePercent >= 0 ? "+" : ""}${dayStats.priceChangePercent.toFixed(2)}%`
            : "—"}
        </p>
        <p className="mt-1 text-sm text-white/48">
          {dayStats
            ? `Vol ${formatCompactNumber(dayStats.quoteVolume)} USDT`
            : "24h ticker"}
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
          {spreadData
            ? `${spreadData.percent.toFixed(3)}% між bid/ask`
            : "book ticker"}
        </p>
      </div>

      <div className="rounded-[1.2rem] border border-white/8 bg-black/10 px-4 py-3">
        <p className="text-[0.68rem] uppercase tracking-[0.22em] text-white/36">
          Тиск стакану
        </p>
        <p className="mt-2 text-lg font-medium text-white">
          {wallPressure.percent}%
        </p>
        <p className="mt-1 text-sm text-white/48">{wallPressure.label}</p>
      </div>

      <div className="rounded-[1.2rem] border border-white/8 bg-black/10 px-4 py-3">
        <p className="text-[0.68rem] uppercase tracking-[0.22em] text-white/36">
          Потік
        </p>
        <p className="mt-2 text-sm leading-6 text-white/68">{status}</p>
      </div>
    </div>
  );
}
