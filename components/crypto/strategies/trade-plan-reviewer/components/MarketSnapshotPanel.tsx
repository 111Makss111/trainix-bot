import type { MarketSnapshot, TrendDirection, ZoneKind } from "../types";

type MarketSnapshotPanelProps = {
  market: MarketSnapshot;
  isLoading: boolean;
  error: string | null;
};

const trendLabel: Record<TrendDirection, string> = {
  up: "UP",
  down: "DOWN",
  sideways: "RANGE",
};

const zoneClassName: Record<ZoneKind, string> = {
  support: "border-emerald-300/18 bg-emerald-300/8 text-emerald-100",
  resistance: "border-rose-300/18 bg-rose-300/8 text-rose-100",
};

function formatPrice(value: number) {
  return value.toLocaleString("en-US", {
    maximumFractionDigits: value >= 1000 ? 0 : 2,
  });
}

export function MarketSnapshotPanel({
  market,
  isLoading,
  error,
}: MarketSnapshotPanelProps) {
  const sourceLabel = market.source === "live" ? "LIVE" : "LOCAL";

  return (
    <section className="rounded-[1.5rem] border border-white/10 bg-white/[0.03] p-5 backdrop-blur-md">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[0.68rem] uppercase tracking-[0.28em] text-white/34">
            Market Snapshot
          </p>
          <h2 className="mt-2 text-xl font-medium text-white">
            {market.symbol} · {formatPrice(market.currentPrice)}
          </h2>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-sm text-white/58">
            {market.timeframe}
          </span>
          <span
            className={[
              "rounded-full border px-3 py-1.5 text-sm",
              market.source === "live"
                ? "border-emerald-300/18 bg-emerald-300/8 text-emerald-100"
                : "border-amber-300/18 bg-amber-300/8 text-amber-100",
            ].join(" ")}
          >
            {isLoading ? "LOADING" : sourceLabel}
          </span>
        </div>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <SnapshotStat label="Trend" value={trendLabel[market.trend]} detail={`${market.trendStrength}/100`} />
        <SnapshotStat label="BTC Bias" value={market.btcBias.toUpperCase()} detail={market.volumeState} />
        <SnapshotStat
          label="Candles"
          value={String(market.candleCount)}
          detail={market.updatedAt}
        />
      </div>

      {error ? (
        <div className="mt-4 rounded-[1.1rem] border border-amber-300/18 bg-amber-300/8 px-4 py-3 text-sm leading-6 text-amber-100">
          {error}
        </div>
      ) : null}

      <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {market.zones.map((zone) => (
          <div
            key={`${zone.kind}-${zone.price}`}
            className={[
              "rounded-[1.1rem] border px-4 py-3",
              zoneClassName[zone.kind],
            ].join(" ")}
          >
            <p className="text-xs uppercase tracking-[0.18em] opacity-70">
              {zone.kind}
            </p>
            <p className="mt-2 font-medium text-white">{zone.label}</p>
            <p className="mt-1 text-sm opacity-80">{formatPrice(zone.price)}</p>
            <p className="mt-1 text-xs opacity-60">strength {zone.strength}/100</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function SnapshotStat({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="rounded-[1.1rem] border border-white/10 bg-black/12 px-4 py-3">
      <p className="text-[0.62rem] uppercase tracking-[0.22em] text-white/36">
        {label}
      </p>
      <p className="mt-2 text-lg font-medium text-white">{value}</p>
      <p className="mt-1 text-xs text-white/44">{detail}</p>
    </div>
  );
}
