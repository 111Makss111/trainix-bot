import { directionOptions, setupOptions } from "../constants";
import type { TradeDirection, TradePlan, TradeSetup } from "../types";
import { FieldShell } from "./FieldShell";
import { NumberInput } from "./NumberInput";
import { SelectInput } from "./SelectInput";
import { TextAreaInput } from "./TextAreaInput";
import { TextInput } from "./TextInput";

type TradePlanFormProps = {
  plan: TradePlan;
  onChange: (patch: Partial<TradePlan>) => void;
};

export function TradePlanForm({ plan, onChange }: TradePlanFormProps) {
  return (
    <section className="rounded-[2rem] border border-white/10 bg-white/[0.03] px-6 py-6 backdrop-blur-md">
      <div>
        <p className="text-[0.72rem] uppercase tracking-[0.3em] text-white/38">
          Trade Plan
        </p>
        <h2 className="mt-3 text-2xl font-medium text-white">
          Конструктор плану
        </h2>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-3">
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

        <FieldShell label="Контекст стратегії">
          <SelectInput<TradeSetup>
            value={plan.setup}
            options={setupOptions}
            onChange={(setup) => onChange({ setup })}
          />
        </FieldShell>
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <FieldShell label="Баланс акаунту" hint="У USDT. Потрібно для ризику.">
          <NumberInput
            value={plan.accountBalance}
            placeholder="1000"
            onChange={(accountBalance) => onChange({ accountBalance })}
          />
        </FieldShell>

        <FieldShell label="Розмір позиції" hint="У USDT, не в монетах.">
          <NumberInput
            value={plan.positionSize}
            placeholder="100"
            onChange={(positionSize) => onChange({ positionSize })}
          />
        </FieldShell>

        <FieldShell label="Вхід">
          <NumberInput
            value={plan.entryPrice}
            placeholder="65000"
            onChange={(entryPrice) => onChange({ entryPrice })}
          />
        </FieldShell>

        <FieldShell label="Стоп">
          <NumberInput
            value={plan.stopLoss}
            placeholder="64000"
            onChange={(stopLoss) => onChange({ stopLoss })}
          />
        </FieldShell>

        <FieldShell label="Ціль">
          <NumberInput
            value={plan.takeProfit}
            placeholder="68000"
            onChange={(takeProfit) => onChange({ takeProfit })}
          />
        </FieldShell>
      </div>

      <div className="mt-5 grid gap-4 xl:grid-cols-3">
        <FieldShell label="Причина входу">
          <TextAreaInput
            value={plan.entryReason}
            placeholder="Наприклад: монета сильніша за BTC, пробила локальний рівень, обʼєм росте..."
            onChange={(entryReason) => onChange({ entryReason })}
          />
        </FieldShell>

        <FieldShell label="Контекст ринку">
          <TextAreaInput
            value={plan.marketContext}
            placeholder="Що зараз робить BTC, який режим ринку, чи є сильний тренд або боковик..."
            onChange={(marketContext) => onChange({ marketContext })}
          />
        </FieldShell>

        <FieldShell label="Що скасовує ідею">
          <TextAreaInput
            value={plan.invalidation}
            placeholder="Наприклад: закріплення нижче рівня, втрата обʼєму, BTC різко ламає структуру..."
            onChange={(invalidation) => onChange({ invalidation })}
          />
        </FieldShell>
      </div>
    </section>
  );
}
