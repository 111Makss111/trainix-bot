import { StrategyPageLayout } from "@/components/crypto/strategies/shared/StrategyPageLayout";

export function RangeTouchStrategy() {
  return (
    <StrategyPageLayout
      eyebrow="Strategy 02"
      title="Range Touch Radar"
      description="Шукаємо боковик, сильні зони і точні дотики, де індикатори справді мають сенс, а не шумлять посеред тренду."
      status="Підготовка режиму"
      focus="Ця стратегія спершу має довести, що ринок у боковику. Тільки після цього вона дивиться на дотик до зони, RSI/Stoch RSI, Bollinger, ADX, ризик до інвалідації і потенційну ціль."
      metrics={[
        {
          label: "Signal",
          value: "Zone Touch",
          detail: "Дотик до верхньої або нижньої межі діапазону.",
        },
        {
          label: "Filter",
          value: "Sideways",
          detail: "Без підтвердженого боковика сигнал не має ваги.",
        },
        {
          label: "Speed",
          value: "Fast Alert",
          detail: "Для зони потрібне швидке повідомлення без зайвого шуму.",
        },
      ]}
      blocks={[
        {
          eyebrow: "Regime",
          title: "Перевірка боковика",
          items: [
            "ADX низький, ATR стабільний або стискається.",
            "Ціна поважає верхню і нижню межу діапазону.",
            "BTC не робить різкого імпульсу проти ідеї.",
          ],
        },
        {
          eyebrow: "Entry Zone",
          title: "Умови дотику",
          items: [
            "Ціна поруч із підтримкою або опором.",
            "Є підтвердження індикаторами, а не один випадковий сигнал.",
            "Інвалідація близько, потенційна ціль дає нормальний ризик.",
          ],
        },
        {
          eyebrow: "Screen",
          title: "Що буде на сторінці",
          items: [
            "Карта активних діапазонів по монетах.",
            "Поточний режим: боковик, тренд або невизначено.",
            "Останні дотики до зон і сила підтверджень.",
          ],
        },
      ]}
    />
  );
}
