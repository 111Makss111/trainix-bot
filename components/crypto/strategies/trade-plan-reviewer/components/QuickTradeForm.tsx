import { directionOptions, timeframeOptions } from "../constants";
import type { TradeDirection, TradePlan, TradeTimeframe } from "../types";
import { FieldShell } from "./FieldShell";
import { NumberInput } from "./NumberInput";
import { SelectInput } from "./SelectInput";
import { TextInput } from "./TextInput";

type QuickTradeFormProps = {
  plan: TradePlan;
  onChange: (patch: Partial<TradePlan>) => void;
};

export function QuickTradeForm({ plan, onChange }: QuickTradeFormProps) {
  return (
    <section className="rounded-[1.5rem] border border-white/10 bg-white/[0.03] p-5 backdrop-blur-md">
      <div className="grid gap-3 sm:grid-cols-3">
        <FieldShell label="Монета">
          <TextInput
            value={plan.symbol}
            placeholder="BTCUSDT"
            onChange={(symbol) => onChange({ symbol: symbol.toUpperCase() })}
          />
        </FieldShell>

        <FieldShell label="Напрямок">
          <SelectInput<TradeDirection>
            value={plan.direction}
            options={directionOptions}
            onChange={(direction) => onChange({ direction })}
          />
        </FieldShell>

        <FieldShell label="Таймфрейм">
          <SelectInput<TradeTimeframe>
            value={plan.timeframe}
            options={timeframeOptions}
            onChange={(timeframe) => onChange({ timeframe })}
          />
        </FieldShell>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <FieldShell label="Баланс">
          <NumberInput
            value={plan.accountBalance}
            placeholder="1000"
            onChange={(accountBalance) => onChange({ accountBalance })}
          />
        </FieldShell>

        <FieldShell label="Позиція">
          <NumberInput
            value={plan.positionSize}
            placeholder="100"
            onChange={(positionSize) => onChange({ positionSize })}
          />
        </FieldShell>

        <FieldShell label="Вхід" hint="Порожньо = поточна ціна">
          <NumberInput
            value={plan.entryPrice}
            placeholder="65000"
            onChange={(entryPrice) => onChange({ entryPrice })}
          />
        </FieldShell>

        <FieldShell label="Стоп" hint="Порожньо = зона">
          <NumberInput
            value={plan.stopLoss}
            placeholder="64000"
            onChange={(stopLoss) => onChange({ stopLoss })}
          />
        </FieldShell>

        <FieldShell label="Ціль" hint="Порожньо = зона">
          <NumberInput
            value={plan.takeProfit}
            placeholder="68000"
            onChange={(takeProfit) => onChange({ takeProfit })}
          />
        </FieldShell>
      </div>
    </section>
  );
}
