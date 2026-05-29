import type { TradePlan } from "../types";
import { FieldShell } from "./FieldShell";
import { TextAreaInput } from "./TextAreaInput";

type HiddenPlanDetailsProps = {
  plan: TradePlan;
  onChange: (patch: Partial<TradePlan>) => void;
};

export function HiddenPlanDetails({ plan, onChange }: HiddenPlanDetailsProps) {
  return (
    <div className="grid gap-3 xl:grid-cols-3">
      <FieldShell label="Причина входу">
        <TextAreaInput
          value={plan.entryReason}
          placeholder="Конкретний аргумент входу..."
          onChange={(entryReason) => onChange({ entryReason })}
        />
      </FieldShell>

      <FieldShell label="Контекст ринку">
        <TextAreaInput
          value={plan.marketContext}
          placeholder="Що зараз робить BTC або ринок..."
          onChange={(marketContext) => onChange({ marketContext })}
        />
      </FieldShell>

      <FieldShell label="Що скасовує ідею">
        <TextAreaInput
          value={plan.invalidation}
          placeholder="Умова, після якої план неактуальний..."
          onChange={(invalidation) => onChange({ invalidation })}
        />
      </FieldShell>
    </div>
  );
}
