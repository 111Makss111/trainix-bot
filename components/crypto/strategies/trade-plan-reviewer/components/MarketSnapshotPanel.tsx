import type {
  MarketDataDiagnostic,
  MarketAnalysisTimeframe,
  MarketSnapshot,
  TrendDirection,
  ZoneKind,
  ZoneVolumeProfile,
} from "../types";
import { formatTradingViewPrice } from "../formatters";

type MarketSnapshotPanelProps = {
  market: MarketSnapshot;
  isLoading: boolean;
  error: string | null;
  diagnostics?: MarketDataDiagnostic[];
};

const trendLabel: Record<TrendDirection, string> = {
  up: "ВГОРУ",
  down: "ВНИЗ",
  sideways: "БОКОВИК",
};

const zoneClassName: Record<ZoneKind, string> = {
  support: "border-emerald-300/18 bg-emerald-300/8 text-emerald-100",
  resistance: "border-rose-300/18 bg-rose-300/8 text-rose-100",
};

const volumeClassName: Record<ZoneVolumeProfile["strength"], string> = {
  strong: "border-emerald-300/18 bg-emerald-300/8 text-emerald-100",
  normal: "border-sky-300/18 bg-sky-300/8 text-sky-100",
  weak: "border-amber-300/18 bg-amber-300/8 text-amber-100",
  unknown: "border-white/10 bg-white/[0.04] text-white/52",
};

const timeframeLabel: Record<MarketAnalysisTimeframe, string> = {
  "5m": "5m",
  "15m": "15m",
  "1h": "1h",
  "4h": "4h",
  "1d": "1D",
};

export function MarketSnapshotPanel({
  market,
  isLoading,
  error,
  diagnostics = [],
}: MarketSnapshotPanelProps) {
  const sourceLabel =
    market.source === "spot"
      ? "SPOT"
      : market.source === "futures"
        ? "FUTURES"
        : market.source === "bybit"
          ? "BYBIT"
          : market.source === "bitget"
            ? "BITGET"
            : market.source === "okx"
              ? "OKX"
              : "НЕМАЄ ДАНИХ";
  const hasMarketData = market.source !== "fallback" && market.candleCount > 0;

  return (
    <section className="rounded-[1.5rem] border border-white/10 bg-white/[0.03] p-5 backdrop-blur-md">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[0.68rem] uppercase tracking-[0.28em] text-white/34">
            Стан ринку
          </p>
          <h2 className="mt-2 text-xl font-medium text-white">
            {market.symbol} · {formatTradingViewPrice(market.currentPrice)}
          </h2>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-sm text-white/58">
            {market.timeframe}
          </span>
          <span
            className={[
              "rounded-full border px-3 py-1.5 text-sm",
              hasMarketData
                ? "border-emerald-300/18 bg-emerald-300/8 text-emerald-100"
                : "border-amber-300/18 bg-amber-300/8 text-amber-100",
            ].join(" ")}
          >
            {isLoading ? "ОНОВЛЕННЯ" : sourceLabel}
          </span>
        </div>
      </div>

      {!hasMarketData ? (
        <div className="mt-5 rounded-[1.1rem] border border-amber-300/18 bg-amber-300/8 px-4 py-3 text-sm leading-6 text-amber-100">
          {error ??
            "Не вдалося отримати реальні свічки для цього активу. Авто-рівні не будуються без ринкових даних."}
        </div>
      ) : null}

      {diagnostics.length > 0 ? (
        <MarketDataDiagnostics
          diagnostics={diagnostics}
          isOpenByDefault={!hasMarketData}
        />
      ) : null}

      {hasMarketData ? (
      <>
      <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <SnapshotStat
          label="Тренд"
          value={trendLabel[market.trend]}
          detail={`сила ${market.trendStrength}/100`}
        />
        <SnapshotStat
          label="Рух"
          value={market.priceAction.label.toUpperCase()}
          detail={`сила ${market.priceAction.strength}/100`}
        />
        <SnapshotStat
          label="Стадія"
          value={market.moveStage.label.toUpperCase()}
          detail={`${market.moveStage.moveAtr.toFixed(1)} ATR · ризик ${market.moveStage.riskScore}/100`}
        />
        <SnapshotStat
          label="Настрій BTC"
          value={market.btcBias === "bullish" ? "СИЛА" : market.btcBias === "bearish" ? "СЛАБКІСТЬ" : "НЕЙТРАЛЬНО"}
          detail={market.volumeState}
        />
        <SnapshotStat
          label="Свічки"
          value={String(market.candleCount)}
          detail={`ТФ ${market.analyzedTimeframes.map((timeframe) => timeframeLabel[timeframe]).join(" / ")}`}
        />
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <SnapshotStat
          label="Діапазон"
          value={`${market.rangeWidthPercent.toFixed(2)}%`}
          detail="між підтримкою й опором"
        />
        <SnapshotStat
          label="Шум"
          value={`${market.averageRangePercent.toFixed(2)}%`}
          detail={
            market.volatilityState === "extreme"
              ? "екстремальний"
              : market.volatilityState === "high"
                ? "високий"
                : market.volatilityState === "quiet"
                  ? "тихий"
                  : "нормальний"
          }
        />
        <SnapshotStat
          label="ATR"
          value={`${market.atrPercent.toFixed(2)}%`}
          detail={`рух ${formatTradingViewPrice(market.atr)}`}
        />
        <SnapshotStat
          label="Open Interest"
          value={getOpenInterestValue(market)}
          detail={getOpenInterestDetail(market)}
        />
        <SnapshotStat
          label="Простір / шум"
          value={`${market.rangeToNoiseRatio.toFixed(1)}x`}
          detail="ширина проти шуму"
        />
      </div>

      <div className="mt-3 grid gap-3 md:grid-cols-3">
        <SnapshotStat
          label="Обсяг"
          value={market.volumePressure.label.toUpperCase()}
          detail={market.volumePressure.summary}
        />
        <SnapshotStat
          label="ADX"
          value={market.adx.value === null ? "НЕМАЄ" : String(market.adx.value)}
          detail={market.adx.summary}
        />
        <SnapshotStat
          label="Структура"
          value={market.marketStructure.label.toUpperCase()}
          detail={market.marketStructure.summary}
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
              {zone.kind === "support" ? "ПІДТРИМКА" : "ОПІР"}
            </p>
            <p className="mt-2 font-medium text-white">{zone.label}</p>
            <p className="mt-1 text-sm opacity-80">
              {formatTradingViewPrice(zone.low)} - {formatTradingViewPrice(zone.high)}
            </p>
            <p className="mt-1 text-xs opacity-60">
              центр {formatTradingViewPrice(zone.price)}
            </p>
            <p className="mt-1 text-xs opacity-60">
              ТФ {zone.timeframes.map((timeframe) => timeframeLabel[timeframe]).join(" / ")}
            </p>
            <p className="mt-1 text-xs opacity-60">
              {zone.isMultiTimeframe ? "MTF " : ""}міцність {zone.strength}/100
            </p>
            <ZoneVolumeBadge market={market} zoneKind={zone.kind} zoneLow={zone.low} zoneHigh={zone.high} />
          </div>
        ))}
      </div>
      </>
      ) : null}
    </section>
  );
}

function ZoneVolumeBadge({
  market,
  zoneKind,
  zoneLow,
  zoneHigh,
}: {
  market: MarketSnapshot;
  zoneKind: ZoneKind;
  zoneLow: number;
  zoneHigh: number;
}) {
  const zoneVolume =
    zoneKind === "support" ? market.zoneVolumes.support : market.zoneVolumes.resistance;
  const isWorkingZone =
    zoneVolume.zoneLow <= zoneHigh && zoneVolume.zoneHigh >= zoneLow;

  if (!isWorkingZone) {
    return null;
  }

  return (
    <p
      className={[
        "mt-2 inline-flex rounded-full border px-2.5 py-1 text-[0.68rem]",
        volumeClassName[zoneVolume.strength],
      ].join(" ")}
      title={zoneVolume.detail}
    >
      обсяг зони {zoneVolume.score}/100 · {zoneVolume.summary}
    </p>
  );
}

function MarketDataDiagnostics({
  diagnostics,
  isOpenByDefault,
}: {
  diagnostics: MarketDataDiagnostic[];
  isOpenByDefault: boolean;
}) {
  return (
    <details
      className="mt-4 rounded-[1.1rem] border border-white/10 bg-black/12 px-4 py-3"
      open={isOpenByDefault}
    >
      <summary className="cursor-pointer list-none text-sm font-medium text-white/72">
        Діагностика бірж
        <span className="ml-2 text-xs font-normal text-white/38">
          {diagnostics.length} перевірок
        </span>
      </summary>

      <div className="mt-3 grid gap-2">
        {diagnostics.map((diagnostic) => (
          <div
            key={`${diagnostic.symbol}-${diagnostic.venue}`}
            className="rounded-[0.9rem] border border-white/8 bg-white/[0.03] px-3 py-2"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-medium text-white">
                {diagnostic.symbol} · {diagnostic.venue}
              </p>
              <span
                className={[
                  "rounded-full border px-2.5 py-1 text-xs",
                  diagnostic.status === "ok"
                    ? "border-emerald-300/18 bg-emerald-300/8 text-emerald-100"
                    : diagnostic.status === "partial"
                      ? "border-amber-300/18 bg-amber-300/8 text-amber-100"
                      : "border-rose-300/18 bg-rose-300/8 text-rose-100",
                ].join(" ")}
              >
                {getDiagnosticStatusLabel(diagnostic.status)}
              </span>
            </div>

            <div className="mt-2 flex flex-wrap gap-1.5">
              {diagnostic.checks.map((check) => (
                <span
                  key={`${diagnostic.symbol}-${diagnostic.venue}-${check.timeframe}`}
                  className={[
                    "rounded-full border px-2 py-1 text-[0.7rem]",
                    check.status === "ok"
                      ? "border-white/10 bg-white/[0.04] text-white/68"
                      : "border-rose-300/14 bg-rose-300/8 text-rose-100/78",
                  ].join(" ")}
                  title={check.error ?? undefined}
                >
                  {timeframeLabel[check.timeframe]}:{" "}
                  {check.status === "ok" ? `${check.candleCount} свіч.` : "немає"}
                </span>
              ))}
            </div>

            {diagnostic.selectedError ? (
              <p className="mt-2 text-xs leading-5 text-amber-100/72">
                {shortenDiagnosticError(diagnostic.selectedError)}
              </p>
            ) : null}
          </div>
        ))}
      </div>
    </details>
  );
}

function getDiagnosticStatusLabel(status: MarketDataDiagnostic["status"]) {
  if (status === "ok") {
    return "дані є";
  }

  if (status === "partial") {
    return "частково";
  }

  return "немає";
}

function getOpenInterestValue(market: MarketSnapshot) {
  if (market.openInterest.status === "ok") {
    return market.openInterest.label.toUpperCase();
  }

  if (market.openInterest.status === "partial") {
    return "ПОТОЧНИЙ";
  }

  return "НЕМАЄ";
}

function getOpenInterestDetail(market: MarketSnapshot) {
  if (market.openInterest.status === "unavailable") {
    return "без даних біржі";
  }

  if (market.openInterest.status === "partial") {
    return "є значення без історії";
  }

  return market.openInterest.summary;
}

function shortenDiagnosticError(error: string) {
  return error.length > 180 ? `${error.slice(0, 180)}...` : error;
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
