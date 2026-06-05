import { timeframeOptions } from "../constants";
import type { TradeTimeframe } from "../types";
import { AssetSearch } from "./AssetSearch";
import { FieldShell } from "./FieldShell";
import { SelectInput } from "./SelectInput";

type MarketControlsProps = {
  symbol: string;
  timeframe: TradeTimeframe;
  isLoading: boolean;
  onChange: (patch: { symbol?: string; timeframe?: TradeTimeframe }) => void;
  onRefresh: () => void;
};

export function MarketControls({
  symbol,
  timeframe,
  isLoading,
  onChange,
  onRefresh,
}: MarketControlsProps) {
  return (
    <section className="relative z-50 rounded-[1.25rem] border border-white/10 bg-white/[0.03] p-4 backdrop-blur-md">
      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_12rem_auto]">
        <FieldShell label="Монета">
          <AssetSearch
            value={symbol}
            onChange={(nextSymbol) => onChange({ symbol: nextSymbol.toUpperCase() })}
          />
        </FieldShell>

        <FieldShell label="Таймфрейм">
          <SelectInput<TradeTimeframe>
            value={timeframe}
            options={timeframeOptions}
            onChange={(nextTimeframe) => onChange({ timeframe: nextTimeframe })}
          />
        </FieldShell>

        <div className="flex items-end">
          <button
            type="button"
            onClick={onRefresh}
            disabled={isLoading}
            className="h-11 rounded-[1rem] border border-white/10 bg-white/[0.04] px-4 text-sm font-medium text-white/68 transition hover:border-white/22 hover:bg-white/[0.08] hover:text-white disabled:cursor-wait disabled:opacity-50"
          >
            {isLoading ? "Оновлення" : "Оновити"}
          </button>
        </div>
      </div>
    </section>
  );
}
