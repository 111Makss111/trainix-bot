import { timeframeOptions } from "../constants";
import type { TradeTimeframe } from "../types";
import { AssetSearch } from "./AssetSearch";
import { FieldShell } from "./FieldShell";
import { SelectInput } from "./SelectInput";

type MarketControlsProps = {
  symbol: string;
  timeframe: TradeTimeframe;
  onChange: (patch: { symbol?: string; timeframe?: TradeTimeframe }) => void;
};

export function MarketControls({
  symbol,
  timeframe,
  onChange,
}: MarketControlsProps) {
  return (
    <section className="rounded-[1.25rem] border border-white/10 bg-white/[0.03] p-4 backdrop-blur-md">
      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_12rem]">
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
      </div>
    </section>
  );
}
